'use strict';

const crypto = require('crypto');

function newRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

function newJobId() {
  return crypto.randomBytes(12).toString('hex');
}

function safeFilename(platform, ext) {
  const cleanExt = String(ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'mp4';
  return `startdownloading-${platform}-${Date.now()}.${cleanExt}`;
}

/* Title-based filename: sanitized, no path traversal, bounded length.
   Falls back to the legacy timestamped name when the title is unusable. */
function safeTitleFilename(title, platform, quality, ext) {
  const cleanExt = String(ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'mp4';
  const cleanPlatform = String(platform || 'video').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'video';
  const base = String(title || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .slice(0, 60).replace(/^-+|-+$/g, '');
  const q = String(quality || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  if (!base) return safeFilename(cleanPlatform, cleanExt);
  return `startdownloading-${cleanPlatform}-${base}${q ? `-${q}` : ''}.${cleanExt}`;
}

module.exports = { newRequestId, newJobId, safeFilename, safeTitleFilename };
