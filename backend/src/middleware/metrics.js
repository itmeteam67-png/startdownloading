'use strict';

/* PII-free operational counters (Phase 7). Only aggregates are kept:
   route, status class, error code — never URLs, IPs, or user content. */

const counters = {
  startedAt: Date.now(),
  apiRequests: 0,
  downloadRequests: 0,
  responses: { '2xx': 0, '4xx': 0, '5xx': 0 },
  downloadOutcomes: {}, // code -> count
  rateLimited: 0,
};

function metricsMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  counters.apiRequests += 1;
  if (req.path === '/api/download') counters.downloadRequests += 1;
  res.on('finish', () => {
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    if (counters.responses[cls] !== undefined) counters.responses[cls] += 1;
    if (res.statusCode === 429) counters.rateLimited += 1;
  });
  next();
}

function recordDownloadOutcome(code) {
  if (!code) return;
  counters.downloadOutcomes[code] = (counters.downloadOutcomes[code] || 0) + 1;
}

function snapshot() {
  return {
    uptimeSec: Math.floor((Date.now() - counters.startedAt) / 1000),
    apiRequests: counters.apiRequests,
    downloadRequests: counters.downloadRequests,
    responses: Object.assign({}, counters.responses),
    downloadOutcomes: Object.assign({}, counters.downloadOutcomes),
    rateLimited: counters.rateLimited,
  };
}

module.exports = { metricsMiddleware, recordDownloadOutcome, snapshot };
