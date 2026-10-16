'use strict';
const { execFile } = require('child_process');

function curl(label, args) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('curl', ['-sS', '-o', '/dev/null', '-m', '12', '-w', '%{http_code}', ...args],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        let error = err ? String(stderr || err.message) : null;
        if (error && process.env.PROXY_URL) error = error.split(process.env.PROXY_URL).join('<PROXY>');
        resolve({ label, http: String(stdout || '').trim() || null, ms: Date.now() - t0, error: error && error.slice(0, 200) });
      });
  });
}

module.exports = async function debugNet(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.searchParams.get('k') !== 'chof-2026-xyz') { res.statusCode = 404; return res.end(); }
  const p = process.env.PROXY_URL;
  const tests = [
    curl('1-direct-youtube', ['https://www.youtube.com']),
    curl('2-direct-instagram', ['https://www.instagram.com']),
  ];
  if (p) {
    tests.push(
      curl('3-proxy-ip', ['-x', p, 'https://api.ipify.org']),
      curl('4-proxy-youtube', ['-x', p, 'https://www.youtube.com']),
      curl('5-proxy-instagram', ['-x', p, 'https://www.instagram.com'])
    );
  }
  const results = await Promise.all(tests);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ hasProxy: !!p, results }, null, 2));
};
