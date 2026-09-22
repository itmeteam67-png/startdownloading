'use strict';

/* Phase 7 two-step controllers.
   POST /api/video/info     { url }            -> real metadata + real formats
   POST /api/video/download { url, formatId }  -> real file for that format
   The formatId is NEVER trusted blindly: it is validated against a fresh
   (or freshly-cached) engine dump for the SAME canonical URL. */

const { validateVideoInfoRequest, validateVideoDownloadRequest } = require('../validators/videoValidator');
const { assertUrlSafe } = require('../utils/ssrf');
const { parseUrl } = require('../utils/url');
const { logLine } = require('../utils/log');
const { recordDownloadOutcome } = require('../middleware/metrics');
const { fetchVideoInfo, getCachedInfo } = require('../services/infoEngine');
const { processDownload } = require('../services/downloadEngine');

function requireJson(req) {
  if (!req.is('application/json')) {
    const err = new Error('Content-Type must be application/json.');
    err.status = 415;
    err.errorCode = 'INVALID_REQUEST';
    err.publicMessage = 'Invalid request format.';
    throw err;
  }
}

async function postVideoInfo(req, res, next) {
  const startedAt = Date.now();
  try {
    requireJson(req);
    const { url, platform } = validateVideoInfoRequest(req.body);
    try {
      await assertUrlSafe(parseUrl(url));
    } catch (e) {
      const err = new Error('This URL cannot be processed.');
      err.status = 422;
      err.errorCode = 'UNSUPPORTED_PLATFORM';
      err.publicMessage = 'This URL cannot be processed.';
      throw err;
    }
    const info = await fetchVideoInfo({ url, platform, requestId: req.requestId });
    recordDownloadOutcome('SUCCESS');
    logLine(req, { platform, url, durationMs: Date.now() - startedAt, outcome: 'info', formats: info.formats.length, status: 200 });
    res.status(200).json({ success: true, data: info });
  } catch (err) {
    err.requestId = req.requestId;
    recordDownloadOutcome(err.errorCode || 'SERVER_ERROR');
    logLine(req, { outcome: 'error', code: err.errorCode || 'SERVER_ERROR', durationMs: Date.now() - startedAt, status: err.status || 500 });
    next(err);
  }
}

async function postVideoDownload(req, res, next) {
  const startedAt = Date.now();
  try {
    requireJson(req);
    const { url, platform, formatId } = validateVideoDownloadRequest(req.body);
    try {
      await assertUrlSafe(parseUrl(url));
    } catch (e) {
      const err = new Error('This URL cannot be processed.');
      err.status = 422;
      err.errorCode = 'UNSUPPORTED_PLATFORM';
      err.publicMessage = 'This URL cannot be processed.';
      throw err;
    }
    // Authoritative format check: the id must belong to THIS url's real dump.
    let cached = getCachedInfo(url);
    let info = cached ? cached.data : null;
    let rawById = cached ? cached.rawById : null;
    if (!info) {
      info = await fetchVideoInfo({ url, platform, requestId: req.requestId });
      cached = getCachedInfo(url);
      rawById = cached ? cached.rawById : null;
    }
    const validIds = cached && cached.validIds ? cached.validIds : new Set(info.formats.map((f) => f.formatId));
    if (!validIds.has(formatId)) {
      const err = new Error('The selected quality is not available for this video.');
      err.status = 422;
      err.errorCode = 'FORMAT_NOT_AVAILABLE';
      err.publicMessage = 'The selected quality is not available for this video. Please refresh and choose again.';
      throw err;
    }
    const selected = (rawById && rawById.get(formatId)) || info.formats.find((f) => f.formatId === formatId);
    if (!selected) {
      const err = new Error('The selected quality is not available for this video.');
      err.status = 422;
      err.errorCode = 'FORMAT_NOT_AVAILABLE';
      err.publicMessage = 'The selected quality is not available for this video. Please refresh and choose again.';
      throw err;
    }
    // Build a safe yt-dlp format selector from the VALIDATED entry only —
    // never from raw browser input.
    const hasVideo = !!selected.hasVideo;
    const hasAudio = !!selected.hasAudio;
    const needsMerge = hasVideo && !hasAudio;
    const formatSelector = needsMerge ? `${selected.formatId}+bestaudio/b` : selected.formatId;
    const quality = selected.quality || null;

    const result = await processDownload({
      url, platform, requestId: req.requestId,
      formatSelector, needsMerge,
      title: info.title, quality,
    });
    recordDownloadOutcome('SUCCESS');
    logLine(req, { platform, url, durationMs: Date.now() - startedAt, outcome: 'success', bytes: result.bytes, status: 200 });
    res.status(200).json({
      success: true,
      platform: result.platform,
      downloadUrl: `/api/file/${result.jobId}`,
      filename: result.filename,
      formatId: selected.formatId,
      quality: selected.quality || null,
    });
  } catch (err) {
    err.requestId = req.requestId;
    recordDownloadOutcome(err.errorCode || 'SERVER_ERROR');
    logLine(req, { outcome: 'error', code: err.errorCode || 'SERVER_ERROR', durationMs: Date.now() - startedAt, status: err.status || 500 });
    next(err);
  }
}

module.exports = { postVideoInfo, postVideoDownload };
