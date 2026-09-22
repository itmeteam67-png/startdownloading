'use strict';

/* Structured operational logging. Privacy rule: never log full user URLs
   (query strings may carry tokens); log registrable host + platform only. */

function redactHost(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch (e) {
    return 'unparseable';
  }
}

function logLine(req, extra) {
  const base = { ts: new Date().toISOString(), req: req.requestId, method: req.method, path: req.path };
  if (extra && extra.url) {
    extra = Object.assign({}, extra, { host: redactHost(extra.url) });
    delete extra.url;
  }
  console.log(JSON.stringify(Object.assign(base, extra)));
}

module.exports = { logLine, redactHost };
