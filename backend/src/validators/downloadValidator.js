'use strict';

/* Authoritative request validation. Runs before any media processing.
   Redirect note: the engine (yt-dlp) follows platform redirects internally
   with TLS verification kept ON; the initial URL is fully validated here
   (protocol/userinfo/port/host/SSRF) and restricted targets always fail
   closed with controlled errors — they are never bypassed. */

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

function validateDownloadRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  const keys = Object.keys(body);
  if (keys.length > 4) {
    throw validationError('INVALID_REQUEST', 'Request body has too many fields.');
  }
  const { url } = body;
  if (url === undefined || url === null) {
    throw validationError('INVALID_REQUEST', 'The "url" field is required.');
  }
  if (typeof url !== 'string') {
    throw validationError('INVALID_URL', 'The "url" field must be a string.');
  }
  const trimmed = url.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    throw validationError('INVALID_URL', 'Please enter a video URL.');
  }
  if (trimmed.length > config.maxUrlLength) {
    throw validationError('INVALID_URL', 'The URL is too long.');
  }
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
  // Canonical backend value: platform derived server-side, never from the client.
  const platform = detectPlatform(parsed.hostname);
  if (platform === 'unknown') {
    const err = validationError('UNSUPPORTED_PLATFORM', 'This platform is not currently supported.', 422);
    err.platform = platform;
    throw err;
  }
  if (parsed.protocol === 'http:') parsed.protocol = 'https:';
  return { url: parsed.toString(), platform };
}

module.exports = { validateDownloadRequest };
