'use strict';
const { execFile } = require('child_process');

// Hosts only (no credentials in code: the repo is public).
const HOSTS = [
  '45.38.107.97:6014',
  '64.137.96.74:6641',
  '198.23.243.226:6361',
  '38.154.185.97:6370',
  '84.247.60.125:6095',
  '191.96.254.138:6185',
  '198.46.161.42:5092',
  '64.137.10.153:5803',
  '104.164.49.38:7693',
  '23.26.71.145:5628',
];

function clean(s, secrets) {
  let out = String(s || '');
  for (const x of secrets) if (x) out = out.split(x).join('<X>');
  return out;
}

function curl(label, args, secrets) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('curl', ['-sS', '-o', '/dev/null', '-m', '12', '-w', '%{http_code}', ...args],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        resolve({
          label,
          http: String(stdout || '').trim() || null,
          ms: Date.now() - t0,
          error: err ? clean(stderr || err.message, secrets).slice(0, 120) : null,
        });
      });
  });
}

function ytdlp(label, proxy, url, secrets) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('yt-dlp', [
      '--dump-single-json', '--no-playlist', '--no-cache-dir', '--force-ipv4',
      '--socket-timeout', '10', '--retries', '1',
      '--js-runtimes', 'deno:/usr/local/bin/deno',
      '--proxy', proxy, url,
    ], { timeout: 45000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      let title = null;
      if (!err) { try { title = String(JSON.parse(stdout).title || '').slice(0, 50); } catch (e) { /* noop */ } }
      resolve({
        label,
        ok: !err,
        ms: Date.now() - t0,
        title,
        error: err ? clean(stderr || err.message, secrets).slice(-180) : null,
      });
    });
  });
}

module.exports = async function debugNet(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  if (q.get('k') !== 'chof-2026-xyz') { res.statusCode = 404; return res.end(); }

  const u = q.get('u');
  const pw = q.get('pw');
  const testUrl = q.get('url'); // optional: real yt-dlp test on this video URL
  const secrets = [u, pw];
  const jobs = [];

  if (u && pw) {
    for (const h of HOSTS) {
      const proxy = `http://${u}:${pw}@${h}`;
      if (testUrl) {
        jobs.push(ytdlp(`${h} yt-dlp`, proxy, testUrl, secrets));
      } else {
        for (const [name, site] of [['ip', 'https://api.ipify.org'], ['youtube', 'https://www.youtube.com'], ['instagram', 'https://www.instagram.com'], ['tiktok', 'https://www.tiktok.com']]) {
          jobs.push(curl(`${h} ${name}`, ['-x', proxy, site], secrets));
        }
      }
    }
  }

  const results = await Promise.all(jobs);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(results, null, 2));
};
