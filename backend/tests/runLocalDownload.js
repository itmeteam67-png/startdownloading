'use strict';

/* MANUAL local real-download test (NOT part of CI — needs the yt-dlp
   engine + ffmpeg + internet). Run: node tests/runLocalDownload.js
   Expected: honest controlled result; success only with a real file. */

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* env may come from the shell */ }
const fs = require('fs');
const http = require('http');
const { createApp } = require('../src/app');

// Big Buck Bunny (Blender Foundation, CC-BY) — permitted public test content.
const TEST_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

function post(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, path: '/api/download', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let c = '';
      res.on('data', (x) => { c += x; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(c || '{}') }));
    });
    req.on('error', reject);
    req.setTimeout(170000, () => req.destroy(new Error('client timeout')));
    req.write(data);
    req.end();
  });
}

function getFile(port, urlPath, dest) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`file status ${res.statusCode}`)); return; }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => resolve(res.headers));
      ws.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  try {
    console.log(`REQUEST url=${TEST_URL}`);
    const t0 = Date.now();
    const r = await post(port, { url: TEST_URL });
    console.log(`RESULT status=${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(r.json));
    if (!r.json.success) {
      console.log('OUTCOME: controlled failure (no fake download) — see error code above');
      process.exitCode = 2;
      return;
    }
    const dest = path.join(__dirname, '..', 'temp', `manual-test-${Date.now()}.bin`);
    const headers = await getFile(port, r.json.downloadUrl, dest);
    const stat = fs.statSync(dest);
    const head = Buffer.alloc(12);
    fs.readFileSync(dest, { flag: 'r' });
    const fd = fs.openSync(dest, 'r');
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    const magic = head.toString('latin1');
    const isMp4 = magic.slice(4, 8) === 'ftyp';
    const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    console.log(`FILE bytes=${stat.size} content-type=${headers['content-type']} mp4=${isMp4} webm/mkv=${isWebm}`);
    assertReal(stat.size, isMp4 || isWebm);
    fs.unlinkSync(dest);
    console.log('OUTCOME: REAL DOWNLOAD VERIFIED — playable container, served by the API');
  } finally {
    server.close();
  }
})().catch((e) => { console.error('LOCAL DOWNLOAD FAILURE:', e.message); process.exit(1); });

function assertReal(size, container) {
  if (!(size > 100 * 1024 && container)) throw new Error('downloaded file failed verification');
}
