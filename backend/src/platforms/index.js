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
   protected content is NEVER bypassed — it maps to PRIVATE_CONTENT, which
   is reserved for strong evidence of genuinely private/walled content.
   Upstream rejections (bot-checks, rate limits, HTTP 403/429 from the
   platform against our hosting IPs) map to UPSTREAM_REJECTED so a public
   video is never mislabeled as "private". */
function sanitizeEngineStderr(raw, maxLen = 800) {
  // Privacy-conscious diagnostic helper: strip ANSI escapes, collapse
  // whitespace, redact cookie/credential-like fragments, truncate.
  let s = String(raw || '');
  s = s.replace(/\[[0-9;]*m/g, '');
  // Never log full URLs (query strings may carry tokens) — same rule as log.js.
  s = s.replace(/https?:\/\/[^\s'"]+/gi, '[url]');
  s = s.replace(/(cookie|cookies|authorization|bearer|token|session|passwd|password)([\s=:]+)([^\s;,}]+)/gi, '$1$2[redacted]');
  s = s.replace(/\s+/g, ' ').trim();
  const n = Number(maxLen) > 0 ? Number(maxLen) : 800;
  if (s.length > n) s = s.slice(-n);
  return s;
}
function classifyEngineFailure(stderrTail) {
  const tail = String(stderrTail || '').toLowerCase();
  if (!tail) return { code: 'PROCESSING_FAILED', message: 'We couldn\u2019t process this video. Please try again.', status: 502 };
  if (tail.includes('unsupported url') || tail.includes('not supported') || tail.includes('no video formats found')) {
    return { code: 'UNSUPPORTED_PLATFORM', message: 'This link is not currently supported.', status: 422 };
  }
  if (tail.includes('max-filesize') || tail.includes('larger than max') || tail.includes('file is too large')) {
    return { code: 'OUTPUT_TOO_LARGE', message: 'The resulting file is too large to download.', status: 413 };
  }
  // Upstream rejection BEFORE the private check: YouTube's datacenter
  // bot-challenge ("Sign in to confirm you're not a bot") contains the
  // substring "sign in", and its HTTP 403 contains "forbidden" — both used
  // to fall through to PRIVATE_CONTENT. Bot/rate-limit signals are checked
  // first so public videos are never mislabeled as private.
  if (
    tail.includes('not a bot') || (tail.includes('confirm you') && tail.includes('bot')) ||
    tail.includes('captcha') || tail.includes('unusual traffic') ||
    tail.includes('http error 429') || tail.includes('error 429') || tail.includes('status code 429') ||
    tail.includes('too many requests') || tail.includes('rate-limit') || tail.includes('rate limit') || tail.includes('rate limited') ||
    tail.includes('http error 403') || tail.includes('error 403') || tail.includes('status code 403') ||
    tail.includes('forbidden')
  ) {
    return { code: 'UPSTREAM_REJECTED', message: 'YouTube is refusing requests from our server right now (automated-traffic check or rate limit). Please try again later.', status: 502 };
  }
  // PRIVATE_CONTENT requires strong evidence: genuinely private content,
  // premium/DRM walls, or age-gates. Bare "sign in" only counts when it is
  // NOT part of a bot-challenge (bot-challenges were handled above).
  if (
    tail.includes('private') || tail.includes('premium') || tail.includes('drm') ||
    (tail.includes('age') && tail.includes('confirm')) ||
    tail.includes('login') ||
    (tail.includes('sign in') && !tail.includes('bot'))
  ) {
    return { code: 'PRIVATE_CONTENT', message: 'This video isn\u2019t publicly downloadable. Please try a public link.', status: 422 };
  }
  if (tail.includes('timed out') || tail.includes('timeout') || tail.includes('econnreset') || tail.includes('enotfound') || tail.includes('econnrefused') || tail.includes('eai_again') || tail.includes('socket hang up') || tail.includes('http error 5')) {
    return { code: 'NETWORK_ERROR', message: 'The video service didn\u2019t respond. Please try again.', status: 502 };
  }
  if (tail.includes('not found') || tail.includes('unavailable') || tail.includes('removed') || tail.includes('deleted') || tail.includes('no longer available')) {
    return { code: 'VIDEO_NOT_FOUND', message: 'This video was not found or is unavailable.', status: 404 };
  }
  return { code: 'PROCESSING_FAILED', message: 'We couldn\u2019t process this video. Please try again.', status: 502 };
}

module.exports = { PLATFORMS, SUPPORTED, detectPlatform, platformName, platformFormat, classifyEngineFailure, sanitizeEngineStderr };
