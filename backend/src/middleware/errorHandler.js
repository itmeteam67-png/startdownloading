'use strict';

/* Controlled error shape. Never leaks stack traces, paths, secrets,
   command lines, or internal details to clients. */

const CODE_TO_STATUS = {
  INVALID_REQUEST: 400,
  INVALID_URL: 400,
  UNSUPPORTED_PLATFORM: 422,
  PRIVATE_CONTENT: 422,
  PROCESSING_FAILED: 502,
  PROCESSING_TIMEOUT: 504,
  OUTPUT_TOO_LARGE: 413,
  FILE_TOO_LARGE: 413, // legacy alias, kept for compatibility
  FORMAT_NOT_AVAILABLE: 422,
  VIDEO_NOT_FOUND: 404,
  VIDEO_UNAVAILABLE: 422,
  VIDEO_PRIVATE: 422,
  MERGE_FAILED: 502,
  DOWNLOAD_FAILED: 502,
  NETWORK_ERROR: 502,
  TEMPORARY_FAILURE: 503,
  RATE_LIMITED: 429,
  RESOURCE_LIMIT: 429,
  SERVER_ERROR: 500,
};

function errorHandler(err, req, res, _next) {
  const code = err && err.errorCode && CODE_TO_STATUS[err.errorCode] ? err.errorCode : 'SERVER_ERROR';
  const status = (err && err.status && Number.isInteger(err.status)) ? err.status : (CODE_TO_STATUS[code] || 500);
  if (!err.errorCode) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), req: req && req.requestId, scope: 'unhandled', message: String((err && err.message) || err) }));
  }
  res.status(status).json({
    success: false,
    error: { code, message: (err && err.publicMessage) || 'Something went wrong. Please try again.' },
  });
}

function notFound(_req, res) {
  res.status(404).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Not found.' } });
}

module.exports = { errorHandler, notFound, CODE_TO_STATUS };
