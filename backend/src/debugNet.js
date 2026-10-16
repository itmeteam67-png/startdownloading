'use strict';
const { execFile } = require('child_process');

function curl(label, args, secrets) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('curl', ['-sS', '-o', '/dev/null', '-m', '12', '-w', '%{http_code}', ...args],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        let error = err ? String(stderr || err.message) : null;
        for (const s of secrets) if (error && s) error = error.split(s).join('<X>');
        resolve({ label, http: String(stdout || '').trim() || null, ms: Date.now() - t0, error: error && error.slice(0, 120) });
      });
  });
}

module.exports = async function debugNet(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  if (q.get('k') !== 'chof-2026-xyz') { res.statusCode = 404; return res.end(); }

  const u = q.get('u'), pw = q.get('pw');
  const hosts = (q.get('hosts') || '').split(',').filter(Boolean);
  const secrets = [u, pw];
  const jobs = [];

  for (const h of hosts) {
    const proxy = `http://${u}:${pw}@${h}`;
    for (const [name, url] of [['ip', 'https://api.ipify.org'], ['youtube', 'https://www.youtube.com'], ['instagram', 'https://www.instagram.com'], ['tiktok', 'https://www.tiktok.com']]) {
      jobs.push(curl(`${h} ${name}`, ['-x', proxy, url], secrets));
    }
  }
  if (!hosts.length) {
    const p = process.env.PROXY_URL;
    jobs.push(curl('direct-youtube', ['https://www.youtube.com'], []));
    if (p) jobs.push(curl('env-proxy-ip', ['-x', p, 'https://api.ipify.org'], [p]));
  }

  const results = await Promise.all(jobs);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(results, null, 2));
};
