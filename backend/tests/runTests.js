'use strict';

/* Backend tests (Phase 5 hardened suite). No private/protected content used.
   Run: npm test (from backend/). Exits non-zero on failure. */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/app');
const { validateDownloadRequest } = require('../src/validators/downloadValidator');
const { assertUrlSafe } = require('../src/utils/ssrf');
const { parseUrl } = require('../src/utils/url');
const { detectPlatform, classifyEngineFailure, SUPPORTED } = require('../src/platforms');

let passed = 0;
function ok(name) { passed += 1; console.log(`PASS ${name}`); }
const srcDir = path.join(__dirname, '..', 'src');

function startApp() {
  return new Promise((resolve) => {
    const app = createApp();
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function post(port, body, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, path: '/api/download', method: 'POST',
      headers: { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(chunks || '{}'); } catch (e) { /* non-JSON */ }
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(chunks || '{}'); } catch (e) { /* non-JSON */ }
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    }).on('error', reject);
  });
}

(async () => {
  /* ---------- API validation ---------- */
  assert.throws(() => validateDownloadRequest({}), (e) => e.errorCode === 'INVALID_REQUEST');
  ok('T18 missing URL -> INVALID_REQUEST');
  assert.throws(() => validateDownloadRequest({ url: '   ' }), (e) => e.errorCode === 'INVALID_URL');
  ok('T19a empty URL -> INVALID_URL');
  assert.throws(() => validateDownloadRequest({ url: '::::' }), (e) => e.errorCode === 'INVALID_URL');
  ok('T19b malformed URL -> INVALID_URL');
  assert.throws(() => validateDownloadRequest({ url: 'https://example.com/video' }), (e) => e.errorCode === 'UNSUPPORTED_PLATFORM');
  ok('T20 unsupported platform -> UNSUPPORTED_PLATFORM (422)');
  const v = validateDownloadRequest({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.strictEqual(v.platform, 'youtube');
  ok('T21 supported URL validates, platform=youtube');

  /* ---------- hardening: structural URL attacks ---------- */
  assert.throws(() => validateDownloadRequest({ url: 'https://youtube.com:8443/watch?v=1' }), (e) => e.errorCode === 'INVALID_URL');
  ok('SEC explicit port rejected');
  assert.throws(() => validateDownloadRequest({ url: 'https://user:pass@youtube.com/watch?v=1' }), (e) => e.errorCode === 'INVALID_URL');
  ok('SEC embedded credentials rejected');
  assert.throws(() => validateDownloadRequest({ url: 'ftp://youtube.com/watch' }), (e) => e.errorCode === 'INVALID_URL');
  ok('SEC non-http scheme rejected');
  // Control characters are normalized away: the canonical backend URL never
  // carries raw newlines, and the engine receives it as ONE spawn argv
  // element (shell:false), so shell metacharacters are inert data.
  const injected = validateDownloadRequest({ url: 'https://youtube.com/watch?v=1\nX-INJECT;$(whoami)' });
  assert.ok(!/[\r\n]/.test(injected.url), 'no raw control chars in canonical URL');
  assert.strictEqual(injected.platform, 'youtube');
  ok('SEC control chars normalized; metachars stay inert single-argv data');
  assert.throws(
    () => validateDownloadRequest({ url: 'https://youtube.com/' + 'a'.repeat(2100) }),
    (e) => e.errorCode === 'INVALID_URL'
  );
  ok('SEC oversized URL (>2048) rejected');
  assert.throws(() => validateDownloadRequest({ url: 12345 }), (e) => e.errorCode === 'INVALID_URL');
  ok('SEC non-string URL rejected');

  /* ---------- platform registry ---------- */
  assert.deepStrictEqual([...SUPPORTED].sort(), ['instagram', 'tiktok', 'twitter', 'youtube']);
  assert.strictEqual(detectPlatform('youtu.be'), 'youtube');
  assert.strictEqual(detectPlatform('m.youtube.com'), 'youtube');
  assert.strictEqual(detectPlatform('vt.tiktok.com'), 'tiktok');
  assert.strictEqual(detectPlatform('instagr.am'), 'instagram');
  assert.strictEqual(detectPlatform('x.com'), 'twitter');
  assert.strictEqual(detectPlatform('mobile.twitter.com'), 'twitter');
  assert.strictEqual(detectPlatform('evil-youtube.com'), 'unknown');
  assert.strictEqual(detectPlatform('youtube.com.evil.com'), 'unknown');
  assert.strictEqual(detectPlatform('notyoutube.com'), 'unknown');
  ok('PLATFORM registry: variants accepted, lookalikes rejected');

  /* ---------- failure classifier (no bypasses, honest codes) ---------- */
  assert.strictEqual(classifyEngineFailure('ERROR: Unsupported URL').code, 'UNSUPPORTED_PLATFORM');
  assert.strictEqual(classifyEngineFailure('ERROR: Private video').code, 'PRIVATE_CONTENT');
  assert.strictEqual(classifyEngineFailure('ERROR: Sign in to confirm your age').code, 'PRIVATE_CONTENT');
  assert.strictEqual(classifyEngineFailure('ERROR: This video contains DRM').code, 'PRIVATE_CONTENT');
  assert.strictEqual(classifyEngineFailure('ERROR: Unable to download webpage: timed out').code, 'NETWORK_ERROR');
  assert.strictEqual(classifyEngineFailure('some random failure').code, 'PROCESSING_FAILED');
  ok('PLATFORM classifier: private/DRM never bypassed, mapped to PRIVATE_CONTENT');

  /* ---------- SSRF ---------- */
  await assert.rejects(assertUrlSafe(parseUrl('http://127.0.0.1/video.mp4')), (e) => e.code === 'SSRF_BLOCKED');
  await assert.rejects(assertUrlSafe(parseUrl('http://localhost/video.mp4')), (e) => e.code === 'SSRF_BLOCKED');
  await assert.rejects(assertUrlSafe(parseUrl('http://[::1]/video.mp4')), (e) => e.code === 'SSRF_BLOCKED');
  await assert.rejects(assertUrlSafe(parseUrl('http://10.0.0.5/video.mp4')), (e) => e.code === 'SSRF_BLOCKED');
  await assert.rejects(assertUrlSafe(parseUrl('http://169.254.169.254/latest/meta-data/')), (e) => e.code === 'SSRF_BLOCKED');
  ok('SEC SSRF blocked: loopback, ::1, localhost, private IPv4, metadata endpoint');

  /* ---------- HTTP-level tests ---------- */
  const { server, port } = await startApp();
  try {
    // Readiness + metrics contracts (aggregate-only, no PII)
    let h = await get(port, '/api/health');
    assert.strictEqual(h.status, 200); assert.strictEqual(h.json.ok, true);
    let rd = await get(port, '/api/ready');
    assert.ok([200, 503].includes(rd.status));
    assert.strictEqual(typeof rd.json.checks.tempWritable, 'boolean');
    assert.strictEqual(typeof rd.json.checks.engine, 'boolean');
    ok('HTTP /api/health + /api/ready contracts');
    let m = await get(port, '/api/metrics');
    assert.strictEqual(m.status, 200);
    for (const k of ['uptimeSec', 'apiRequests', 'responses', 'downloadOutcomes', 'activeJobs', 'tempFiles']) {
      assert.ok(m.json[k] !== undefined, `metrics has ${k}`);
    }
    assert.ok(!('url' in m.json) && !('ip' in m.json), 'metrics carry no PII');
    ok('HTTP /api/metrics aggregate-only contract');
    let r = await post(port, {});
    assert.strictEqual(r.status, 400); assert.strictEqual(r.json.error.code, 'INVALID_REQUEST');
    assert.ok(!('stack' in (r.json.error || {})), 'no stack leak');
    ok('HTTP missing body -> 400, sanitized');

    r = await post(port, { url: 'https://example.com/video' });
    assert.strictEqual(r.status, 422); assert.strictEqual(r.json.error.code, 'UNSUPPORTED_PLATFORM');
    ok('HTTP unsupported -> 422');

    r = await post(port, { url: 'http://127.0.0.1/video.mp4' });
    assert.strictEqual(r.status, 422);
    ok('HTTP SSRF attempt -> controlled 422');

    r = await post(port, '{"url":"https://youtube.com/watch"}', 'text/plain');
    assert.ok([400, 415].includes(r.status), `unexpected ${r.status}`);
    ok(`HTTP wrong Content-Type rejected (${r.status})`);

    assert.ok(r.headers['x-request-id'] && r.headers['x-request-id'].length >= 8, 'request id header');
    ok('HTTP X-Request-Id response header present');

    // Path traversal / arbitrary-file access attempts
    r = await get(port, '/api/file/..%2F..%2Fsecret.env');
    assert.strictEqual(r.status, 404); assert.strictEqual(r.json.error.code, 'INVALID_REQUEST');
    r = await get(port, '/api/file/not-a-job-id');
    assert.strictEqual(r.status, 404);
    r = await get(port, '/api/file/abcdef0123456789abcdef01');
    assert.strictEqual(r.status, 404); // well-formed but unknown/expired
    ok('SEC file endpoint: traversal + unknown ids -> 404, no file leak');

    // Processing path: WITHOUT an engine binary this is an honest controlled
    // failure; WITH a working engine (local real-download setup) it is a real
    // 200 whose file is then fetched and verified. Never faked either way.
    r = await post(port, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    assert.ok([200, 502, 422, 429].includes(r.status), `unexpected status ${r.status}`);
    if (r.status === 200) {
      assert.strictEqual(r.json.success, true);
      assert.ok(typeof r.json.downloadUrl === 'string' && typeof r.json.filename === 'string');
      const fileRes = await get(port, r.json.downloadUrl);
      assert.strictEqual(fileRes.status, 200);
      assert.ok(Number(fileRes.headers['content-length'] || 0) > 100 * 1024, 'real file has substance');
      ok(`HTTP real processing success (200/${r.json.platform}, ${(fileRes.headers['content-length'] / 1048576).toFixed(1)}MB verified)`);
    } else {
      assert.strictEqual(r.json.success, false);
      assert.ok(r.json.error && r.json.error.code && r.json.error.message);
      // No internal details: no paths, no commands, no stacks
      const blob = JSON.stringify(r.json);
      assert.ok(!blob.includes('temp/') && !blob.includes('yt-dlp ') && !blob.includes('at '), 'sanitized');
      ok(`HTTP processing failure controlled (${r.status}/${r.json.error.code}), sanitized, no fake download`);
    }

    // Repeated invalid requests: all handled, no crash
    const batch = await Promise.all([1, 2, 3].map(() => post(port, { url: 'not a url' })));
    assert.ok(batch.every((x) => x.status === 400 && x.json.error.code === 'INVALID_URL'));
    ok('HTTP repeated requests handled consistently');

    // Limits configured (timeouts, sizes, concurrency)
    const config = require('../src/config');
    assert.ok(config.downloadTimeoutMs > 0 && config.maxDownloadBytes > 0 && config.maxConcurrentJobs >= 1);
    assert.ok(config.downloadMax > 0 && config.downloadWindowMs > 0);
    ok('CONFIG timeouts + size + concurrency + dual rate limits present');
  } finally {
    server.close();
  }

  /* ---------- isolated exec-path guard check (fail-closed config) ---------- */
  process.env.YTDLP_BIN = 'yt-dlp; rm -rf /';
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(srcDir)) delete require.cache[k]; });
  assert.throws(() => require('../src/services/downloadEngine'), /YTDLP_BIN/);
  ok('SEC malicious YTDLP_BIN rejected at startup (fail-closed)');
  delete process.env.YTDLP_BIN;
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(srcDir)) delete require.cache[k]; });

  /* ---------- isolated download-limiter check (fresh app, tiny budget) ----------
     (srcDir is defined at the top of this file) */
  process.env.RATE_LIMIT_DOWNLOAD_MAX = '2';
  process.env.RATE_LIMIT_DOWNLOAD_WINDOW_MS = '60000';
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(srcDir)) delete require.cache[k]; });
  const app2 = require('../src/app').createApp();
  const srv2 = await new Promise((resolve) => { const s = app2.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const p2 = srv2.address().port;
    await post(p2, { url: 'not a url' });
    await post(p2, { url: 'not a url' });
    const limited = await post(p2, { url: 'not a url' });
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.json.error.code, 'RATE_LIMITED');
    ok('RATE-LIMIT download budget enforced (3rd rapid request -> 429 RATE_LIMITED)');
  } finally {
    srv2.close();
  }
  delete process.env.RATE_LIMIT_DOWNLOAD_MAX;
  delete process.env.RATE_LIMIT_DOWNLOAD_WINDOW_MS;
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(srcDir)) delete require.cache[k]; });

  /* ---------- cleanup sweep ---------- */
  const config2 = require('../src/config');
  const { sweepStaleTempFiles } = require('../src/services/cleanup');
  await fs.promises.mkdir(config2.tempDir, { recursive: true });
  const stale = path.join(config2.tempDir, 'abcdef0123456789abcdef01-stale.mp4');
  const fresh = path.join(config2.tempDir, 'abcdef0123456789abcdef02-fresh.mp4');
  const innocent = path.join(config2.tempDir, 'keep-me.txt');
  await fs.promises.writeFile(stale, 'x');
  await fs.promises.writeFile(fresh, 'x');
  await fs.promises.writeFile(innocent, 'x');
  const old = Date.now() - config2.fileTtlMs - 60000;
  await fs.promises.utimes(stale, new Date(old), new Date(old));
  const { swept } = await sweepStaleTempFiles();
  assert.ok(swept >= 1, 'stale swept');
  assert.ok(!fs.existsSync(stale), 'stale removed');
  assert.ok(fs.existsSync(fresh), 'fresh kept');
  assert.ok(fs.existsSync(innocent), 'non-engine files untouched');
  await fs.promises.unlink(fresh).catch(() => {});
  await fs.promises.unlink(innocent).catch(() => {});
  ok('CLEANUP stale sweep removes abandoned files, keeps fresh + unrelated');

  console.log(`\nALL ${passed} BACKEND TESTS PASS`);
})().catch((e) => { console.error('TEST FAILURE:', e); process.exit(1); });
