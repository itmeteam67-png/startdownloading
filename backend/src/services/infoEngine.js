'use strict';

/* Video-info engine (Phase 7).
   Runs yt-dlp --dump-single-json safely (spawn argv, shell:false, timeout)
   and normalizes the REAL formats into a curated quality list.
   - One selectable option per height (best MP4 variant), plus best audio.
   - Never invents qualities; everything comes from the engine output.
   - Short-lived in-memory cache (10 min) so the download step can validate
     the selected formatId without trusting the browser. */

const crypto = require('crypto');
const { spawn } = require('child_process');
const config = require('../config');
const { classifyEngineFailure } = require('../platforms');
const { shutdownChildrenTracking } = require('./spawnTracker');

const INFO_TIMEOUT_MS = Math.min(90000, config.downloadTimeoutMs || 90000);
const INFO_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_INFO_BYTES = 8 * 1024 * 1024;

const infoCache = new Map(); // cacheKey -> { expiresAt, data, validIds:Set, rawById:Map }

function cacheKeyForUrl(canonicalUrl) {
  return crypto.createHash('sha256').update(String(canonicalUrl)).digest('hex');
}

function engineError(code, message, status = 500) {
  const err = new Error(message);
  err.errorCode = code;
  err.publicMessage = message;
  err.status = status;
  return err;
}

function getEngineBin() {
  // Reuse the same fail-closed guard as the download engine without
  // importing it (avoids circular resolution at startup).
  const path = require('path');
  const bin = String(config.ytdlpBin || '');
  if (!bin || /[\s;"'`$&|<>!*?~(){}[\]$]/.test(bin) || bin.length > 512) {
    throw new Error('Invalid YTDLP_BIN configuration.');
  }
  const isBare = /^[A-Za-z0-9_.-]+$/.test(bin);
  const isAbs = path.isAbsolute(bin);
  if (!isBare && !isAbs) throw new Error('YTDLP_BIN must be a bare executable name or an absolute path.');
  return bin;
}

function runInfoDump({ url, requestId }) {
  const bin = getEngineBin();
  const args = [
    '--dump-single-json',
    '--no-playlist',
    '--no-cookies',
    '--no-cache-dir',
    '--no-mtime',
    '--socket-timeout', '20',
    '--retries', '1',
    url, // single argv element — never a shell string
  ];
  return new Promise((resolve, reject) => {
    let child;
    try {
      const tracker = shutdownChildrenTracking();
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
      tracker.add(child);
      var untrack = () => tracker.delete(child);
    } catch (e) {
      reject(engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502));
      return;
    }
    let stdoutLen = 0;
    const stdoutChunks = [];
    let stderr = '';
    let settled = false;
    const killTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
      reject(engineError('PROCESSING_TIMEOUT', 'Analyzing the video took too long and was stopped.', 504));
    }, INFO_TIMEOUT_MS);
    if (killTimer.unref) killTimer.unref();

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      try { untrack(); } catch (e) { /* noop */ }
      if (err) reject(err);
      else resolve(value);
    };

    child.stdout.on('data', (d) => {
      stdoutLen += d.length;
      if (stdoutLen > MAX_INFO_BYTES) {
        try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
        finish(engineError('OUTPUT_TOO_LARGE', 'The video information is too large to process.', 413));
        return;
      }
      stdoutChunks.push(d);
    });
    child.stderr.on('data', (d) => { stderr += d.toString().slice(-2000); });
    child.on('error', (e) => {
      if (e && e.code === 'ENOENT') {
        finish(engineError('PROCESSING_FAILED', 'Download engine is not installed on the server. Please try again later.', 502));
      } else {
        finish(engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502));
      }
    });
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const raw = Buffer.concat(stdoutChunks).toString('utf8');
          finish(null, { raw });
        } catch (e) {
          finish(engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502));
        }
      } else {
        const c = classifyEngineFailure(stderr.slice(-800));
        if (c.code === 'UNSUPPORTED_PLATFORM') {
          finish(engineError(c.code, c.message, c.status));
        } else if (c.code === 'PRIVATE_CONTENT') {
          finish(engineError(c.code, c.message, c.status));
        } else if (c.code === 'NETWORK_ERROR') {
          finish(engineError(c.code, c.message, c.status));
        } else {
          // Map "video not found / unavailable" wording explicitly.
          const tail = String(stderr).toLowerCase();
          if (tail.includes('not found') || tail.includes('unavailable') || tail.includes('removed') || tail.includes('deleted')) {
            finish(engineError('VIDEO_NOT_FOUND', 'This video was not found or is unavailable.', 404));
          } else {
            finish(engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502));
          }
        }
      }
    });
    if (requestId) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), req: requestId, scope: 'infoEngine', msg: 'spawning info dump' }));
    }
  });
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(r)}`;
  return `${m}:${pad(r)}`;
}

function pickThumbnail(data) {
  if (typeof data.thumbnail === 'string' && /^https?:\/\//.test(data.thumbnail)) return data.thumbnail;
  const thumbs = Array.isArray(data.thumbnails) ? data.thumbnails : [];
  // Prefer the highest-resolution https thumbnail.
  let best = null;
  for (const t of thumbs) {
    if (!t || typeof t.url !== 'string' || !/^https?:\/\//.test(t.url)) continue;
    const score = (Number(t.width) || 0) * (Number(t.height) || 0) || Number(t.preference) || 0;
    if (!best || score > best.score) best = { url: t.url, score };
  }
  return best ? best.url : null;
}

const ALLOWED_INFO_EXTS = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4a', 'mp3']);

function normalizeFormats(rawFormats) {
  const list = Array.isArray(rawFormats) ? rawFormats : [];
  const candidates = [];
  for (const f of list) {
    if (!f || typeof f !== 'object') continue;
    const formatId = String(f.format_id || '');
    if (!formatId || formatId.length > 64 || !/^[A-Za-z0-9_.\-+]+$/.test(formatId)) continue;
    const ext = String(f.ext || '').toLowerCase();
    if (!ALLOWED_INFO_EXTS.has(ext)) continue;
    const vcodec = String(f.vcodec || 'none');
    const acodec = String(f.acodec || 'none');
    const hasVideo = vcodec !== 'none';
    const hasAudio = acodec !== 'none';
    if (!hasVideo && !hasAudio) continue;
    const height = Number(f.height) || 0;
    const width = Number(f.width) || 0;
    const fps = Number(f.fps) || 0;
    const filesize = Number(f.filesize) > 0 ? Number(f.filesize)
      : (Number(f.filesize_approx) > 0 ? Number(f.filesize_approx) : null);
    const tbr = Number(f.tbr) > 0 ? Number(f.tbr) : null;
    candidates.push({
      formatId, extension: ext, format: ext,
      width: width || null, height: height || null, fps: fps || null,
      vcodec, acodec, hasVideo, hasAudio,
      filesize, tbr,
      formatNote: typeof f.format_note === 'string' ? f.format_note.slice(0, 60) : null,
    });
  }
  return candidates;
}

function qualityRank(height) {
  // Higher height = better. Audio-only ranks below everything.
  if (!height || height <= 0) return -1;
  return height;
}

function pickBestPerHeight(candidates) {
  // Group video formats by height; keep the best MP4 variant per height.
  // Preference: progressive (hasAudio) > avc1/h264 codec > larger tbr/filesize.
  // This keeps the UI to one honest button per genuinely-available height.
  const byHeight = new Map();
  const audioOnly = [];
  for (const c of candidates) {
    if (!c.hasVideo && c.hasAudio) { audioOnly.push(c); continue; }
    if (!c.hasVideo) continue;
    const h = Number(c.height) || 0;
    if (h <= 0) continue;
    if (!byHeight.has(h)) byHeight.set(h, []);
    byHeight.get(h).push(c);
  }
  const picked = [];
  for (const [h, group] of byHeight.entries()) {
    const mp4s = group.filter((g) => g.extension === 'mp4');
    const pool = mp4s.length > 0 ? mp4s : group;
    pool.sort((a, b) => {
      const prog = (b.hasAudio ? 1 : 0) - (a.hasAudio ? 1 : 0);
      if (prog !== 0) return prog;
      const aAvc = /avc1|h264/i.test(a.vcodec) ? 1 : 0;
      const bAvc = /avc1|h264/i.test(b.vcodec) ? 1 : 0;
      if (bAvc !== aAvc) return bAvc - aAvc;
      const tb = (b.tbr || 0) - (a.tbr || 0);
      if (tb !== 0) return tb;
      return (b.filesize || 0) - (a.filesize || 0);
    });
    picked.push(pool[0]);
  }
  // Best audio-only track (prefer m4a, then largest).
  let bestAudio = null;
  if (audioOnly.length > 0) {
    const pool = [...audioOnly].sort((a, b) => {
      const aM = a.extension === 'm4a' ? 1 : 0;
      const bM = b.extension === 'm4a' ? 1 : 0;
      if (bM !== aM) return bM - aM;
      const tb = (b.tbr || 0) - (a.tbr || 0);
      if (tb !== 0) return tb;
      return (b.filesize || 0) - (a.filesize || 0);
    });
    bestAudio = pool[0];
  }
  // Sort video desc by height, audio last.
  picked.sort((a, b) => qualityRank(b.height) - qualityRank(a.height));
  const out = picked.map((c) => {
    const label = c.fps && c.fps >= 50 ? `${c.height}p${Math.round(c.fps)}` : `${c.height}p`;
    return {
      formatId: c.formatId,
      quality: `${c.height}p`,
      qualityLabel: label,
      height: c.height,
      width: c.width,
      fps: c.fps,
      format: c.format,
      extension: c.extension,
      filesize: c.filesize,
      tbr: c.tbr,
      vcodec: c.vcodec,
      acodec: c.acodec,
      hasVideo: c.hasVideo,
      hasAudio: c.hasAudio,
      needsMerge: c.hasVideo && !c.hasAudio,
    };
  });
  if (bestAudio) {
    out.push({
      formatId: bestAudio.formatId,
      quality: 'audio',
      qualityLabel: 'Audio only',
      height: null, width: null, fps: null,
      format: bestAudio.format, extension: bestAudio.extension,
      filesize: bestAudio.filesize, tbr: bestAudio.tbr,
      vcodec: bestAudio.vcodec, acodec: bestAudio.acodec,
      hasVideo: false, hasAudio: true, needsMerge: false,
    });
  }
  return out;
}

async function fetchVideoInfo({ url, platform, requestId }) {
  const key = cacheKeyForUrl(url);
  const now = Date.now();
  const cached = infoCache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const { raw } = await runInfoDump({ url, requestId });
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw engineError('PROCESSING_FAILED', 'We couldn\u2019t analyze this video. Please try again.', 502);
  }
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim().slice(0, 300) : 'Untitled video';
  const durationSec = Number(data.duration) > 0 ? Math.floor(Number(data.duration)) : null;
  const info = {
    platform,
    title,
    thumbnail: pickThumbnail(data),
    duration: durationSec != null ? formatDuration(durationSec) : (typeof data.duration_string === 'string' ? data.duration_string : null),
    durationSec,
    uploader: typeof data.uploader === 'string' ? data.uploader.slice(0, 200)
      : (typeof data.channel === 'string' ? data.channel.slice(0, 200) : null),
    formats: pickBestPerHeight(normalizeFormats(data.formats)),
  };
  if (info.formats.length === 0) {
    throw engineError('VIDEO_NOT_FOUND', 'No downloadable formats were found for this video.', 404);
  }
  const validIds = new Set(info.formats.map((f) => f.formatId));
  // Also accept any raw format id seen in the dump (defense: the curated list
  // is what the UI shows, but validation accepts the full real set so a
  // legit id can never be wrongly rejected due to curation).
  for (const f of normalizeFormats(data.formats)) validIds.add(f.formatId);
  const rawById = new Map();
  for (const f of normalizeFormats(data.formats)) {
    if (!rawById.has(f.formatId)) rawById.set(f.formatId, f);
  }
  // Overlay curated flags (needsMerge etc.) onto raw entries.
  for (const f of info.formats) {
    const base = rawById.get(f.formatId) || {};
    rawById.set(f.formatId, Object.assign({}, base, f));
  }
  infoCache.set(key, { expiresAt: now + INFO_CACHE_TTL_MS, data: info, validIds, rawById });
  // Bound cache size (avoid unbounded growth).
  if (infoCache.size > 200) {
    const oldest = infoCache.keys().next().value;
    infoCache.delete(oldest);
  }
  return info;
}

function getCachedInfo(url) {
  const key = cacheKeyForUrl(url);
  const entry = infoCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry;
}

module.exports = { fetchVideoInfo, getCachedInfo, cacheKeyForUrl, pickBestPerHeight, normalizeFormats, formatDuration };
