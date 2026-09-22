'use strict';

/* URL helpers. parseUrl is structural only; validatePublicHttpUrl applies
   the full Phase 5 security policy (protocol, userinfo, ports, lengths).
   Platform matching itself lives in src/platforms (single source of truth). */

const { detectPlatform } = require('../platforms');

const MAX_HOSTNAME_LENGTH = 253;

function normalizeInput(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return 'https://' + s;
  return s;
}

function parseUrl(raw) {
  const normalized = normalizeInput(raw);
  const u = new URL(normalized); // throws on malformed
  u.hostname = u.hostname.toLowerCase();
  return u;
}

/* Throws INVALID_URL for anything that is not a plain public https URL:
   - non-http(s) protocol
   - embedded credentials (user:pass@host)
   - explicit non-default ports (hides tunneling, non-standard services)
   - overlong hostnames */
function validatePublicHttpUrl(urlObj) {
  if (urlObj.protocol !== 'https:') {
    // Plain http is upgraded when schemeless; an explicit http:// URL is
    // accepted structurally but the engine always fetches the canonical
    // https form. Non-http schemes (ftp:, file:, javascript:, data:) refused.
    if (urlObj.protocol !== 'http:') {
      const err = new Error('Only http(s) URLs are accepted.');
      err.errorCode = 'INVALID_URL';
      throw err;
    }
  }
  if (urlObj.username || urlObj.password) {
    const err = new Error('URLs with credentials are not accepted.');
    err.errorCode = 'INVALID_URL';
    throw err;
  }
  if (urlObj.port) {
    const err = new Error('URLs with explicit ports are not accepted.');
    err.errorCode = 'INVALID_URL';
    throw err;
  }
  if (!urlObj.hostname || urlObj.hostname.length > MAX_HOSTNAME_LENGTH || urlObj.hostname.indexOf('.') < 0) {
    const err = new Error('That link doesn\u2019t look like a valid URL.');
    err.errorCode = 'INVALID_URL';
    throw err;
  }
}

module.exports = { normalizeInput, parseUrl, validatePublicHttpUrl, detectPlatformFromHostname: detectPlatform };
