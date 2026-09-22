'use strict';

const path = require('path');
const jobStore = require('../services/jobStore');
const { processDownload } = require('../services/downloadEngine');
const { validateDownloadRequest } = require('../validators/downloadValidator');
const { assertUrlSafe } = require('../utils/ssrf');
const { parseUrl } = require('../utils/url');
const { logLine } = require('../utils/log');
const { recordDownloadOutcome } = require('../middleware/metrics');
const config = require('../config');

async function postDownload(req, res, next) {
  const startedAt = Date.now();
  try {
    if (!req.is('application/json')) {
      const err = new Error('Content-Type must be application/json.');
      err.status = 415;
      err.errorCode = 'INVALID_REQUEST';
      err.publicMessage = 'Invalid request format.';
      throw err;
    }
    const { url, platform } = validateDownloadRequest(req.body);
    // SSRF check on the canonical backend-parsed URL (independent of frontend).
    try {
      await assertUrlSafe(parseUrl(url));
    } catch (e) {
      const err = new Error('This URL cannot be processed.');
      err.status = 422;
      err.errorCode = 'UNSUPPORTED_PLATFORM';
      err.publicMessage = 'This URL cannot be processed.';
      throw err;
    }
    const result = await processDownload({ url, platform, requestId: req.requestId });
    recordDownloadOutcome('SUCCESS');
    logLine(req, { platform, url, durationMs: Date.now() - startedAt, outcome: 'success', bytes: result.bytes, status: 200 });
    res.status(200).json({
      success: true,
      platform: result.platform,
      downloadUrl: `/api/file/${result.jobId}`,
      filename: result.filename,
    });
  } catch (err) {
    err.requestId = req.requestId;
    recordDownloadOutcome(err.errorCode || 'SERVER_ERROR');
    logLine(req, { outcome: 'error', code: err.errorCode || 'SERVER_ERROR', durationMs: Date.now() - startedAt, status: err.status || 500 });
    next(err);
  }
}

function getFile(req, res, next) {
  const { id } = req.params;
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) {
    const err = new Error('File not found.');
    err.status = 404;
    err.errorCode = 'INVALID_REQUEST';
    err.publicMessage = 'File not found.';
    return next(err);
  }
  const job = jobStore.get(id);
  if (!job || job.status !== 'ready') {
    const err = new Error('File not found or expired.');
    err.status = 404;
    err.errorCode = 'INVALID_REQUEST';
    err.publicMessage = 'File not found or expired.';
    return next(err);
  }
  // Containment: resolved path must stay inside the controlled temp dir.
  const resolved = path.resolve(job.filePath);
  if (resolved !== job.filePath || !resolved.startsWith(config.tempDir + path.sep)) {
    const err = new Error('File not found.');
    err.status = 404;
    err.errorCode = 'INVALID_REQUEST';
    err.publicMessage = 'File not found.';
    return next(err);
  }
  logLine(req, { outcome: 'file', platform: job.platform, status: 200 });
  res.download(resolved, job.filename, (err) => {
    if (err && !res.headersSent) next(err);
  });
}

function getHealth(req, res) {
  res.status(200).json({ ok: true, service: 'startdownloading-backend', time: new Date().toISOString() });
}

module.exports = { postDownload, getFile, getHealth };
