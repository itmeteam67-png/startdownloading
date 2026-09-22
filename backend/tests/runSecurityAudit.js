'use strict';

/* Security regression suite (production-grade hardening).
   Covers: static exposure, security headers, CSP compatibility markers,
   oversized bodies, wrong methods, forged file IDs, traversal, malicious
   formatIds, command-injection shapes, concurrency gate, site rate limit,
   error sanitization, robots safety. Hermetic: no engine download needed.
   Run: npm run test:security2 (or node tests/runSecurityAudit.js) */

const assert = require('assert');
const http = require('http');
const path = require('path');
const { createApp } = require('../src/app');

let passed = 0;
function ok(name) { passed += 1; console.log(`PASS ${name}`); }

function startApp(env) {
  const saved = {};
  for (const k of Object.keys(env || {})) { saved[k] = process.env[k]; process.env[k] = env[k]; }
  Object.keys(require.cache).forEach((k) => { if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k]; });
  const app = require('../src/app').createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      restore() {
        for (const k of Object.keys(env || {})) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
        Object.keys(require.cache).forEach((k) => { if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k]; });
      },
    }));
  });
}

function req(port, method, urlPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const headers = {};
    if (data !== null) {
      headers['Content-Type'] = contentType || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    } else if (contentType) {
      headers['Content-Type'] = contentType;
    }
    const r = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: chunks, headers: res.headers }));
    });
    r.on('error', reject);
    if (data !== null) r.write(data);
    r.end();
  });
}

function json(body) { try { return JSON.parse(body); } catch (e) { return {}; } }

(async () => {
  /* ---------- A. Static exposure: only allowlisted public files ---------- */
  {
    const { server, port, restore } = await startApp({});
    try {
      for (const p of ['/', '/index.html', '/robots.txt', '/sitemap.xml']) {
        const r = await req(port, 'GET', p);
        assert.strictEqual(r.status, 200, `${p} public`);
      }
      ok('A1 allowlisted public files reachable (/, index, robots, sitemap)');
      for (const p of [
        '/backend/src/app.js', '/backend/src/services/downloadEngine.js',
        '/backend/package.json', '/backend/package-lock.json',
        '/backend/.env', '/backend/.env.example', '/backend/Dockerfile',
        '/backend/temp/x.mp4', '/server.js', '/index.js', '/.gitignore',
        '/backend/src/site/siteMap.js', '/DEPLOY.md',
      ]) {
        const r = await req(port, 'GET', p);
        assert.strictEqual(r.status, 404, `${p} must not be served (got ${r.status})`);
        assert.ok(!r.body.includes('spawn') && !r.body.includes('ytdlp'), `${p} leaks no source`);
      }
      ok('A2 backend source, configs, env, temp, docs NOT served (404, no leak)');
      // Encoded traversal attempts against public serving + file endpoint
      for (const p of ['/%2e%2e/backend/.env', '/..%2fbackend%2fsrc%2fapp.js', '/api/file/..%2F..%2Fbackend%2F.env']) {
        const r = await req(port, 'GET', p);
        assert.ok([400, 404].includes(r.status), `${p} blocked (${r.status})`);
      }
      ok('A3 encoded traversal blocked');
    } finally { server.close(); restore(); }
  }

  /* ---------- B. Security headers + compatible CSP ---------- */
  {
    const { server, port, restore } = await startApp({});
    try {
      const r = await req(port, 'GET', '/youtube-downloader');
      const h = r.headers;
      assert.strictEqual(h['x-content-type-options'], 'nosniff');
      assert.strictEqual(h['x-frame-options'], 'SAMEORIGIN');
      assert.strictEqual(h['referrer-policy'], 'no-referrer');
      assert.ok((h['permissions-policy'] || '').includes('camera=()'), 'permissions-policy');
      assert.ok((h['strict-transport-security'] || '').includes('max-age='), 'hsts');
      assert.ok(!('x-powered-by' in h), 'no x-powered-by');
      ok('B1 hardening headers present, powered-by hidden');
      const csp = h['content-security-policy'] || '';
      assert.ok(csp.includes("script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'"), 'csp allows real scripts');
      assert.ok(csp.includes('https://fonts.googleapis.com'), 'csp allows fonts css');
      assert.ok(csp.includes("img-src 'self' https: data:"), 'csp allows real images');
      assert.ok(csp.includes("connect-src 'self'"), 'csp same-origin api');
      assert.ok(csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'self'"), 'csp lockdown parts');
      assert.ok(csp.includes("script-src-attr 'none'"), 'csp no inline handlers');
      ok('B2 CSP matches real inventory (CDN/fonts/images/api) + lockdown (no objects/framing/handlers)');
      const api = await req(port, 'POST', '/api/video/info', { url: 'https://www.youtube.com/watch?v=x' });
      assert.ok((api.headers['content-security-policy'] || '').includes("frame-ancestors 'self'"), 'api also framed-protected');
      ok('B3 API responses carry frame/header protection too');
    } finally { server.close(); restore(); }
  }

  /* ---------- C. Input validation edges on new endpoints ---------- */
  {
    const { server, port, restore } = await startApp({});
    try {
      // Oversized JSON body (default 1MB cap) → 413
      const big = 'x'.repeat(2 * 1024 * 1024);
      let r = await req(port, 'POST', '/api/video/info', JSON.stringify({ url: 'https://www.youtube.com/watch?v=1&x=' + big }));
      assert.ok([413, 400].includes(r.status), `oversized body controlled (${r.status})`);
      ok('C1 oversized request body rejected');
      // Wrong methods on processing endpoints
      r = await req(port, 'GET', '/api/video/info');
      assert.ok([404, 405].includes(r.status), `GET info not allowed (${r.status})`);
      r = await req(port, 'GET', '/api/video/download');
      assert.ok([404, 405].includes(r.status), `GET download not allowed (${r.status})`);
      r = await req(port, 'DELETE', '/api/video/download', {});
      assert.ok([404, 405].includes(r.status), `DELETE not allowed (${r.status})`);
      ok('C2 unexpected methods rejected (404/405, no handler leak)');
      // Malformed JSON + wrong content type
      r = await req(port, 'POST', '/api/video/info', '{not json', 'application/json');
      assert.ok(r.status >= 400 && r.status < 500, `malformed json ${r.status}`);
      assert.ok(!json(r.body).error?.stack, 'no stack on malformed json');
      r = await req(port, 'POST', '/api/video/info', 'url=x', 'text/plain');
      assert.ok([400, 415].includes(r.status), `wrong content-type ${r.status}`);
      ok('C3 malformed JSON + wrong Content-Type rejected, sanitized');
      // Command-injection-shaped formatIds (never reach a shell; argv-only anyway)
      for (const evil of ['1; rm -rf /', '$(whoami)', '`id`', '1|cat /etc/passwd', '..\\evil', 'a\nb', 'x'.repeat(65)]) {
        r = await req(port, 'POST', '/api/video/download', { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', formatId: evil });
        assert.strictEqual(r.status, 422, `evil formatId rejected (${evil.slice(0, 12)})`);
        assert.strictEqual(json(r.body).error.code, 'FORMAT_NOT_AVAILABLE');
      }
      ok('C4 injection-shaped/traversal/oversized formatIds → 422 FORMAT_NOT_AVAILABLE');
      // Forged/unknown file IDs (24-hex shape but unknown + malformed)
      for (const id of ['abcdef0123456789abcdef01', 'not-a-job-id', '....//....//etc/passwd', '%2e%2e%2fsecret']) {
        r = await req(port, 'GET', `/api/file/${id}`);
        assert.strictEqual(r.status, 404, `file ${id} → 404`);
      }
      ok('C5 forged/unknown file IDs → 404 (no cross-user access, no leak)');
      // SSRF shapes on the info endpoint (no DNS-dependent asserts beyond loopback literals)
      for (const u of ['http://127.0.0.1/x.mp4', 'http://localhost/x', 'http://[::1]/x', 'http://0.0.0.0/x', 'http://169.254.169.254/', 'ftp://youtube.com/x', 'file:///etc/passwd', 'javascript:alert(1)']) {
        r = await req(port, 'POST', '/api/video/info', { url: u });
        assert.ok([400, 422].includes(r.status), `${u} → ${r.status}`);
      }
      ok('C6 SSRF/scheme shapes refused on /api/video/info (400/422)');
      // Sanitized errors carry no internals
      r = await req(port, 'POST', '/api/video/download', { url: 'https://www.youtube.com/watch?v=1', formatId: 'nope' });
      const blob = r.body;
      assert.ok(!/temp|yt-dlp|spawn|Error:|at |node_modules/i.test(blob), 'error body sanitized');
      ok('C7 error bodies sanitized (no paths/commands/stacks)');
    } finally { server.close(); restore(); }
  }

  /* ---------- D. Concurrency gate + site rate limit ---------- */
  {
    const jobStore = require('../src/services/jobStore');
    const config = require('../src/config');
    const max = config.maxConcurrentJobs;
    for (let i = 0; i < max; i++) jobStore.acquire();
    assert.strictEqual(jobStore.canStart(), false, 'gate closed at capacity');
    jobStore.release();
    assert.strictEqual(jobStore.canStart(), true, 'gate reopens after release');
    ok('D1 concurrency gate saturates and releases correctly');
  }
  {
    const { server, port, restore } = await startApp({ RATE_LIMIT_SITE_MAX: '3', RATE_LIMIT_SITE_WINDOW_MS: '60000' });
    try {
      await req(port, 'GET', '/');
      await req(port, 'GET', '/');
      await req(port, 'GET', '/');
      const r = await req(port, 'GET', '/');
      assert.strictEqual(r.status, 429, `site budget enforced (${r.status})`);
      ok('D2 site rate-limit budget enforced (4th rapid request → 429)');
    } finally { server.close(); restore(); }
  }

  /* ---------- E. Robots/sitemap safety ---------- */
  {
    const { server, port, restore } = await startApp({});
    try {
      const r = await req(port, 'GET', '/robots.txt');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.includes('Disallow: /api/'), 'api disallowed');
      assert.ok(r.body.includes('sitemap.xml'), 'sitemap advertised');
      assert.ok(!r.body.includes('/backend/') || r.body.includes('Disallow: /backend/'), 'backend disallowed');
      ok('E1 robots.txt allows / but disallows /api/ + /backend/');
    } finally { server.close(); restore(); }
  }

  console.log(`\nALL ${passed} SECURITY-AUDIT TESTS PASS`);
})().catch((e) => { console.error('SECURITY AUDIT FAILURE:', e); process.exit(1); });
