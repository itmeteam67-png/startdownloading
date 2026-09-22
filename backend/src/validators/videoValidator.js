'use strict';

/* Phase 7 validators for the two-step flow.
   - /api/video/info:     { url }
   - /api/video/download: { url, formatId }
   Reuses the same authoritative URL policy as the legacy endpoint. */

const config = require('../config');
const { normalizeInput, parseUrl, validatePublicHttpUrl } = require('../utils/url');
const { detectPlatform } = require('../platforms');

function validationError(code, message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.errorCode = code;
  err.publicMessage = message;
  return err;
}

function validateUrlField(url) {
  if (url === undefined || url === null) {
    throw validationError('INVALID_REQUEST', 'The "url" field is required.');
  }
  if (typeof url !== 'string') {
    throw validationError('INVALID_URL', 'The "url" field must be a string.');
  }
  const trimmed = url.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw validationError('INVALID_URL', 'Please enter a video URL.');
  if (trimmed.length > config.maxUrlLength) throw validationError('INVALID_URL', 'The URL is too long.');
  let parsed;
  try {
    parsed = parseUrl(trimmed);
  } catch (e) {
    if (e && e.errorCode) throw e;
    throw validationError('INVALID_URL', 'That link doesn\u2019t look like a valid URL.');
  }
  try {
    validatePublicHttpUrl(parsed);
  } catch (e) {
    throw validationError(e.errorCode || 'INVALID_URL', e.message);
  }
  const platform = detectPlatform(parsed.hostname);
  if (platform === 'unknown') {
    const err = validationError('UNSUPPORTED_PLATFORM', 'This platform is not currently supported.', 422);
    err.platform = platform;
    throw err;
  }
  if (parsed.protocol === 'http:') parsed.protocol = 'https:';
  return { url: parsed.toString(), platform };
}

function validateVideoInfoRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  if (Object.keys(body).length > 4) {
    throw validationError('INVALID_REQUEST', 'Request body has too many fields.');
  }
  return validateUrlField(body.url);
}

const FORMAT_ID_RE = /^[A-Za-z0-9_.\-+]+$/;

function validateFormatId(raw) {
  if (raw === undefined || raw === null) {
    throw validationError('INVALID_REQUEST', 'The "formatId" field is required.');
  }
  if (typeof raw !== 'string') {
    throw validationError('FORMAT_NOT_AVAILABLE', 'The selected quality is not available.', 422);
  }
  const s = raw.trim();
  if (!s || s.length > 64 || !FORMAT_ID_RE.test(s)) {
    throw validationError('FORMAT_NOT_AVAILABLE', 'The selected quality is not available.', 422);
  }
  return s;
}

function validateVideoDownloadRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  if (Object.keys(body).length > 4) {
    throw validationError('INVALID_REQUEST', 'Request body has too many fields.');
  }
  const { url, platform } = validateUrlField(body.url);
  const formatId = validateFormatId(body.formatId);
  return { url, platform, formatId };
}

module.exports = { validateVideoInfoRequest, validateVideoDownloadRequest, validateFormatId };
