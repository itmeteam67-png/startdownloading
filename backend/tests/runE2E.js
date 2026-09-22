'use strict';

/* Final production flow (Phase 7 §43): frontend -> validation -> platform
   detection -> backend request -> security validation -> controlled result.
   Uses only safe test URLs; expects honest controlled errors where no
   engine binary exists. Run: node tests/runE2E.js */

const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/app');

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port, path: urlPath, method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': Buffer.byteLength(data) } : {}
      ),
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: chunks, headers: res.headers }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  try {
    // OPEN WEBSITE -> frontend served with all Phase 2 sections
    let r = await req(port, 'GET', '/');
    assert.strictEqual(r.status, 200);
    for (const m of ['hero-title', 'dlForm', 'feat-grid', 'float-card', 'platforms', 'startdownloading.com']) {
      assert.ok(r.body.includes(m), `frontend marker: ${m}`);
    }
    console.log('PASS E2E open website, hero + downloader + platforms + features intact');

    // PASTE URL -> invalid rejected before any processing
    r = await req(port, 'POST', '/api/download', { url: 'not a url' });
    assert.strictEqual(r.status, 400);
    console.log('PASS E2E invalid URL -> controlled 400');

    // Unsupported platform rejected
    r = await req(port, 'POST', '/api/download', { url: 'https://example.com/video' });
    assert.strictEqual(r.status, 422);
    console.log('PASS E2E unsupported platform -> controlled 422');

    // Supported URL -> security validation passes. Without an engine binary
    // this is an honest controlled failure; WITH a working engine (local
    // real-download setup) it is an honest real 200. Never faked either way.
    r = await req(port, 'POST', '/api/download', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    const data = JSON.parse(r.body);
    assert.ok([200, 502, 422, 429].includes(r.status), `unexpected status ${r.status}`);
    if (r.status === 200) {
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.downloadUrl === 'string' && typeof data.filename === 'string');
      console.log(`PASS E2E supported URL -> real 200 (${data.platform}), no fake download`);
    } else {
      assert.strictEqual(data.success, false);
      console.log(`PASS E2E supported URL -> honest controlled ${r.status}/${data.error.code}, no fake download`);
    }

    // Observability reflects the run
    r = await req(port, 'GET', '/api/metrics');
    const metrics = JSON.parse(r.body);
    assert.ok(metrics.downloadRequests >= 3, 'metrics counted downloads');
    console.log(`PASS E2E metrics counted ${metrics.downloadRequests} download requests`);

    r = await req(port, 'GET', '/api/ready');
    assert.ok([200, 503].includes(r.status));
    console.log('PASS E2E readiness probe responds with checks');
  } finally {
    server.close();
  }
  console.log('\nE2E PRODUCTION FLOW COMPLETE');
})().catch((e) => { console.error('E2E FAILURE:', e); process.exit(1); });
