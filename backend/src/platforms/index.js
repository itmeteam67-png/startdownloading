'use strict';

/* Platform abstraction (Phase 5).
   Single source of truth for supported platforms. All platform-specific
   knowledge lives here — never scattered across controllers/services.
   The backend always derives the platform from the URL itself; client
   input is never trusted. */

const PLATFORMS = {
  youtube: {
    name: 'YouTube',
    hostnames: [/^(www\.|m\.|music\.)?youtube\.com$/, /^youtu\.be$/],
    // Quality cap keeps output bounded; never requests premium-only formats.
    format: 'bv*[height<=1080]+ba/b[height<=1080]/b',
  },
  tiktok: {
    name: 'TikTok',
    hostnames: [/^(www\.|m\.|vt\.|vm\.)?tiktok\.com$/, /^vt\.tiktok\.com$/, /^vm\.tiktok\.com$/],
    format: 'b',
  },
  instagram: {
    name: 'Instagram',
    hostnames: [/^(www\.|m\.)?instagram\.com$/, /^instagr\.am$/],
    format: 'b',
  },
  twitter: {
    name: 'Twitter / X',
    hostnames: [/^(www\.|m\.|mobile\.)?(twitter\.com|x\.com)$/],
    format: 'b',
  },
};

const SUPPORTED = Object.keys(PLATFORMS);

function detectPlatform(hostname) {
  const host = String(hostname || '').toLowerCase();
  for (const [id, def] of Object.entries(PLATFORMS)) {
    if (def.hostnames.some((re) => re.test(host))) return id;
  }
  return 'unknown';
}

function platformName(id) {
  return (PLATFORMS[id] && PLATFORMS[id].name) || 'Unknown';
}

function platformFormat(id) {
  return (PLATFORMS[id] && PLATFORMS[id].format) || 'b';
}

/* Classify engine stderr into controlled error codes. Restricted /
   protected content is NEVER bypassed — it maps to PRIVATE_CONTENT. */
function classifyEngineFailure(stderrTail) {
  const tail = String(stderrTail || '').toLowerCase();
  if (!tail) return { code: 'PROCESSING_FAILED', message: 'We couldn\u2019t process this video. Please try again.', status: 502 };
  if (tail.includes('unsupported url') || tail.includes('not supported') || tail.includes('no video formats found')) {
    return { code: 'UNSUPPORTED_PLATFORM', message: 'This link is not currently supported.', status: 422 };
  }
  if (
    tail.includes('private') || tail.includes('login') || tail.includes('sign in') ||
    tail.includes('forbidden') || tail.includes('premium') || tail.includes('drm') ||
    tail.includes('age') && tail.includes('confirm')
  ) {
    return { code: 'PRIVATE_CONTENT', message: 'This video isn\u2019t publicly downloadable. Please try a public link.', status: 422 };
  }
  if (tail.includes('timed out') || tail.includes('timeout') || tail.includes('econnreset') || tail.includes('enotfound') || tail.includes('econnrefused')) {
    return { code: 'NETWORK_ERROR', message: 'The video service didn\u2019t respond. Please try again.', status: 502 };
  }
  return { code: 'PROCESSING_FAILED', message: 'We couldn\u2019t process this video. Please try again.', status: 502 };
}

module.exports = { PLATFORMS, SUPPORTED, detectPlatform, platformName, platformFormat, classifyEngineFailure };
