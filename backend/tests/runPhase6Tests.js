'use strict';

/* Phase 6 quality-gate tests: frontend unit tests (shipped inline script
   executed in a sandbox), API contract checks + latency measurement,
   static SEO/a11y/security audits. Exits non-zero on failure. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

let passed = 0;
function ok(name) { passed += 1; console.log(`PASS ${name}`); }

/* ---------- A. Frontend unit tests: run the real shipped script ---------- */
function makeEl() {
  const el = {
    dataset: {}, style: {}, disabled: false, textContent: '', value: '',
    hidden: false, parentNode: null,
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, insertBefore() {}, removeChild() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    focus() {}, click() {}, blur() {},
    scrollIntoView() {}, getBoundingClientRect() { return { top: 1000 }; },
  };
  return el;
}

function loadFrontend() {
  const scripts = [...html.matchAll(/<script(?![^>]*src)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).filter((s) => s.trim().length > 50);
  assert.ok(scripts.length >= 1, 'inline frontend script found');
  const documentStub = {
    getElementById() { return makeEl(); },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    createElement() { return makeEl(); },
    addEventListener() {},
  };
  const sandbox = {
    document: documentStub,
    window: {},
    requestAnimationFrame(fn) { return 0; },
    addEventListener() {},
    removeEventListener() {},
    innerHeight: 900,
    URL,
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scripts[0], sandbox, { filename: 'frontend-inline.js' });
  assert.ok(sandbox.StartDownloading, 'StartDownloading namespace exposed');
  return sandbox.StartDownloading;
}

const SD = loadFrontend();
assert.strictEqual(SD.validate('').ok, false);
assert.strictEqual(SD.validate('').error, 'empty');
ok('UNIT empty input -> empty error');
assert.strictEqual(SD.validate('not a url').error, 'invalid');
ok('UNIT malformed input -> invalid error');
assert.strictEqual(SD.validate('   ').error, 'empty');
ok('UNIT whitespace-only -> empty error');
assert.strictEqual(SD.validate(null).error, 'empty');
ok('UNIT null input -> empty error (no throw)');
assert.strictEqual(SD.validate('x'.repeat(5000)).ok, false);
ok('UNIT extreme-length input handled without throw');
assert.strictEqual(SD.validate('https://www.youtube.com/watch?v=abc').platform, 'youtube');
assert.strictEqual(SD.validate('https://youtu.be/abc').platform, 'youtube');
assert.strictEqual(SD.validate('https://www.tiktok.com/@u/video/1').platform, 'tiktok');
assert.strictEqual(SD.validate('https://www.instagram.com/p/1/').platform, 'instagram');
assert.strictEqual(SD.validate('https://x.com/u/status/1').platform, 'twitter');
assert.strictEqual(SD.validate('https://example.com/v').platform, 'unknown');
assert.strictEqual(SD.validate('https://example.com/v').error, 'unsupported');
ok('UNIT platform detection: 4 supported + unknown');
assert.strictEqual(SD.detectPlatform('HTTPS://YOUTUBE.COM/watch'), 'youtube');
ok('UNIT hostname case-insensitivity');
assert.strictEqual(SD.normalizeUrl('  https://x.com/a  '), 'https://x.com/a');
ok('UNIT normalization trims pasted whitespace');
assert.ok(SD.errorFor('PRIVATE_CONTENT').toLowerCase().includes('public'));
assert.ok(SD.errorFor('RATE_LIMITED').toLowerCase().includes('too many'));
assert.ok(SD.errorFor('NO_SUCH_CODE').length > 10, 'unknown codes fall back safely');
ok('UNIT error mapping covers backend codes + safe fallback');
const st = SD.getState();
assert.deepStrictEqual(Object.keys(st).sort(), ['detectedPlatform', 'loading', 'status', 'url', 'validationError']);
ok('UNIT state shape: url/detectedPlatform/validationError/status/loading');

/* ---------- B+C+D. Live contract + static audits ---------- */
function post(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, path: '/api/download', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(chunks || '{}'), headers: res.headers }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function assertContract(res) {
  assert.strictEqual(typeof res.json.success, 'boolean', 'success is boolean');
  if (res.json.success) {
    assert.strictEqual(typeof res.json.platform, 'string');
    assert.strictEqual(typeof res.json.downloadUrl, 'string');
    assert.strictEqual(typeof res.json.filename, 'string');
  } else {
    assert.strictEqual(typeof res.json.error.code, 'string');
    assert.strictEqual(typeof res.json.error.message, 'string');
    assert.ok(!('stack' in res.json.error), 'no stack leak');
  }
}

(async () => {
  /* Static SEO checks */
  for (const needle of [
    '<link rel="canonical" href="https://startdownloading.com/">',
    'name="description"', 'name="robots"', 'property="og:title"', 'property="og:description"',
    'property="og:url"', 'name="twitter:card"', 'rel="icon"',
    'application/ld+json', '<main', 'id="heroTitle"', 'id="featuresTitle"',
    'class="skip-link"', 'aria-live="polite"', '<html lang="en"', 'name="viewport"',
    'prefers-reduced-motion', '@media(max-width:1023.98px)', '@media(max-width:767.98px)',
  ]) {
    assert.ok(html.includes(needle), `missing: ${needle}`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'robots.txt')), 'robots.txt exists');
  assert.ok(fs.existsSync(path.join(ROOT, 'sitemap.xml')), 'sitemap.xml exists');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(ld['@type'], 'WebSite');
  assert.ok(!JSON.stringify(ld).match(/rating|review|price|award|count/i), 'no invented claims in structured data');
  ok('STATIC SEO: canonical/meta/OG/twitter/favicon/JSON-LD/robots/sitemap all present, no invented claims');

  /* Static a11y/visual-preservation checks */
  assert.ok(!/<div[^>]*onclick/.test(html), 'no div-buttons');
  assert.ok(html.includes('<label class="sr-only" for="urlInput">'), 'explicit input label');
  for (const marker of ['site-header', 'hero-title', 'downloader', 'platforms', 'float-card', 'feat-grid', 'wave', 'badge']) {
    assert.ok(html.includes(marker), `visual component intact: ${marker}`);
  }
  const inlineScripts = [...html.matchAll(/<script(?![^>]*src)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(!inlineScripts.some((s) => /console\.(log|debug)/.test(s)), 'no debug logs in shipped JS');
  ok('STATIC a11y+visual: landmarks/labels/live-regions intact, zero visual components removed, no debug logs');

  /* Static responsive/Bootstrap checks (no redesign, no new sections) */
  for (const needle of [
    'cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'navbar-expand-lg', 'navbar-toggler', 'navbar-collapse', 'id="mainMenu"',
    'col-12 col-md-6 col-lg-3', 'float-row', 'img-fluid', 'sd-badge', 'sd-btn',
    '@media(max-width:991.98px)', '@media(max-width:767.98px)', '@media(max-width:575.98px)',
  ]) {
    assert.ok(html.includes(needle), `responsive marker missing: ${needle}`);
  }
  assert.ok(!html.includes('class="btn ') && !html.includes('class="badge"'), 'no Bootstrap-colliding .btn/.badge classes remain');
  assert.ok(!/\.float-card,\.deco-arrow\{display:none/.test(html), 'floating cards are never display:none on mobile');
  ok('STATIC responsive: Bootstrap 5.3.3 wired, collapse menu, grid cols, visible cards, no class collisions');

  /* Static backend security wiring checks */
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const needle of ['helmet(', 'cors(', 'compression(', 'apiLimiter()', 'X-Request-Id', 'Cache-Control']) {
    assert.ok(appSrc.includes(needle), `app wiring missing: ${needle}`);
  }
  const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'downloadEngine.js'), 'utf8');
  assert.ok(engineSrc.includes('shell: false'), 'spawn shell:false');
  assert.ok(!/shell:\s*true/.test(engineSrc), 'no shell:true anywhere in engine');
  assert.ok(!/\beval\(/.test(engineSrc), 'no eval in engine');
  const errSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'errorHandler.js'), 'utf8');
  assert.ok(!errSrc.includes('err.stack'), 'error handler never leaks stacks');
  ok('STATIC backend: helmet/cors/compression/limits/req-id/caching wired; safe exec; sanitized errors');

  /* Live contract + latency */
  const { createApp } = require('../src/app');
  const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const port = server.address().port;
    const cases = [
      [{}, 400, 'INVALID_REQUEST'],
      [{ url: '' }, 400, 'INVALID_URL'],
      [{ url: 'not a url' }, 400, 'INVALID_URL'],
      [{ url: 'https://example.com/video' }, 422, 'UNSUPPORTED_PLATFORM'],
    ];
    for (const [body, status, code] of cases) {
      const r = await post(port, body);
      assert.strictEqual(r.status, status);
      assert.strictEqual(r.json.error.code, code);
      assertContract(r);
    }
    const rOk = await post(port, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    assert.ok([200, 502, 422, 429].includes(rOk.status));
    assertContract(rOk);
    ok('CONTRACT stable success/error shapes on all paths (missing/empty/invalid/unsupported/processing)');

    // Real latency measurement: validation-only requests (no engine involved)
    const N = 20;
    const t0 = Date.now();
    for (let i = 0; i < N; i += 1) { await post(port, { url: 'not a url' }); }
    const avgMs = (Date.now() - t0) / N;
    console.log(`MEASURED validation-request avg latency: ${avgMs.toFixed(2)}ms over ${N} local requests`);
    assert.ok(avgMs < 50, `validation path fast (avg ${avgMs.toFixed(2)}ms < 50ms)`);
    ok('PERF validation path avg < 50ms (measured, local)');
  } finally {
    server.close();
  }

  /* Frontend weight (measured, not estimated) */
  const bytes = fs.statSync(HTML_PATH).size;
  console.log(`MEASURED index.html: ${bytes} bytes single file, 1 inline script, 0 shipped debug logs`);
  assert.ok(bytes < 75000, 'single-file page stays lean (<75KB)');

  /* Security regression: full Phase 5 suite must still pass */
  await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'runTests.js')], { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) { console.error(stdout); console.error(stderr); reject(new Error('Phase 5 suite failed')); return; }
      const tail = stdout.trim().split('\n').pop();
      console.log(`REGRESSION phase-5 suite: ${tail}`);
      resolve();
    });
  });
  ok('REGRESSION Phase 5 security suite still fully green');

  console.log(`\nALL ${passed} PHASE-6 TESTS PASS`);
})().catch((e) => { console.error('TEST FAILURE:', e); process.exit(1); });
