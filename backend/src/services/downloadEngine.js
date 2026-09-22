'use strict';

/* Download engine (Phase 5 hardened).
   - Only processes publicly accessible, permitted content.
   - No DRM / auth / paywall / access-control bypasses: yt-dlp runs WITHOUT
     --cookies/--username/--password/--impersonate style flags, and TLS
     verification stays ON (no --no-check-certificate).
   - The user URL is a single spawn argv element (shell:false, no interpolation).
   - Executable path is allow-listed at startup (bare name or absolute path,
     no shell metacharacters, no user control).
   - Per-platform formats come from src/platforms (single source of truth).
   - Output extension allow-list + real-file verification before serving. */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { newJobId, safeFilename, safeTitleFilename } = require('../utils/ids');
const { platformFormat, classifyEngineFailure } = require('../platforms');
const jobStore = require('./jobStore');

const ALLOWED_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4a', 'mp3']);

/* Tracked so server shutdown can terminate in-flight engine processes —
   no zombie yt-dlp instances survive a restart. */
const activeChildren = new Set();

function shutdownChildren() {
  for (const child of activeChildren) {
    try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
  }
}

/* Guard the configured executable once at startup: fail closed. */
function resolveEngineBin() {
  const bin = String(config.ytdlpBin || '');
  // Fail closed on shell metacharacters. Backslash and colon are allowed so
  // Windows absolute paths (C:\...) pass; everything is still passed as a
  // single argv element with shell:false, never interpreted by a shell.
  if (!bin || /[\s;"'`$&|<>!*?~(){}[\]$]/.test(bin) || bin.length > 512) {
    throw new Error('Invalid YTDLP_BIN configuration.');
  }
  const isBare = /^[A-Za-z0-9_.-]+$/.test(bin);
  const isAbs = path.isAbsolute(bin);
  if (!isBare && !isAbs) {
    throw new Error('YTDLP_BIN must be a bare executable name or an absolute path.');
  }
  return bin;
}

const ENGINE_BIN = resolveEngineBin();

async function ensureTempDir() {
  await fsp.mkdir(config.tempDir, { recursive: true });
}

function engineError(code, message, status = 500) {
  const err = new Error(message);
  err.errorCode = code;
  err.publicMessage = message;
  err.status = status;
  return err;
}

function cleanupFile(filePath) {
  if (!filePath) return Promise.resolve();
  const resolved = path.resolve(filePath);
  if (resolved !== path.normalize(resolved) || !resolved.startsWith(config.tempDir + path.sep)) return Promise.resolve();
  return fsp.unlink(resolved).catch(() => {});
}

async function runYtdlp({ url, platform, jobId, log, formatSelector, needsMerge }) {
  await ensureTempDir();
  const outTemplate = path.join(config.tempDir, `${jobId}.%(ext)s`);
  const args = [
    '--no-playlist',
    '--no-cookies',
    '--no-cache-dir',
    '--no-mtime',
    '--socket-timeout', '20',
    '--retries', '1',
  ];
  if (config.ffmpegLocation) args.push('--ffmpeg-location', config.ffmpegLocation);
  // Phase 7: when a validated formatId was selected, it (and only it)
  // determines the media. Video-only selections are merged with the best
  // compatible audio into an MP4 via ffmpeg. The legacy single-step path
  // still uses the per-platform default selector.
  const selector = formatSelector || platformFormat(platform);
  args.push('-f', selector);
  if (needsMerge) args.push('--merge-output-format', 'mp4');
  args.push(
    '--max-filesize', `${Math.floor(config.maxDownloadBytes / 1024 / 1024)}M`,
    '-o', outTemplate,
    '--print', 'after_move:filepath',
    url // single argv element — never concatenated into a shell string
  );
  log(`spawning engine for platform=${platform}`);
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(ENGINE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
    } catch (e) {
      reject(engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502));
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
      reject(engineError('PROCESSING_TIMEOUT', 'The request took too long and was stopped.', 504));
    }, config.downloadTimeoutMs);
    if (killTimer.unref) killTimer.unref();

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      if (err) reject(err);
      else resolve(value);
    };

    child.stdout.on('data', (d) => { stdout += d.toString().slice(0, 4000); });
    child.stderr.on('data', (d) => { stderr += d.toString().slice(-2000); });
    activeChildren.add(child);
    const untrack = () => activeChildren.delete(child);
    child.on('error', (e) => {
      untrack();
      if (e && e.code === 'ENOENT') {
        finish(engineError('PROCESSING_FAILED', 'Download engine is not installed on the server. Please try again later.', 502));
      } else {
        finish(engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502));
      }
    });
    child.on('close', (code) => {
      untrack();
      if (code === 0) {
        const produced = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop();
        if (!produced) {
          finish(engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502));
          return;
        }
        finish(null, { produced: produced.trim() });
      } else {
        const mergeErr = classifyMergeFailure(stderr.slice(-800));
        if (mergeErr && needsMerge) { finish(mergeErr); return; }
        const c = classifyEngineFailure(stderr.slice(-800));
        finish(engineError(c.code, c.message, c.status));
      }
    });
  });
}

/* Classify a merge-stage failure into an honest controlled error. */
function classifyMergeFailure(stderrTail) {
  const tail = String(stderrTail || '').toLowerCase();
  if (tail.includes('ffmpeg') || tail.includes('merge') || tail.includes('combine')) {
    return engineError('MERGE_FAILED', 'The selected quality needs video+audio merging but the merge failed. Try a lower quality.', 502);
  }
  return null;
}

async function processDownload({ url, platform, requestId, formatSelector, needsMerge, title, quality }) {
  const log = (msg) => console.log(JSON.stringify({ ts: new Date().toISOString(), req: requestId, scope: 'engine', msg }));
  if (!jobStore.canStart()) {
    throw engineError('RATE_LIMITED', 'The server is busy. Please try again in a moment.', 429);
  }
  jobStore.acquire();
  const startedAt = Date.now();
  const jobId = newJobId();
  let producedPath = null;
  try {
    const { produced } = await runYtdlp({ url, platform, jobId, log, formatSelector, needsMerge });
    // Containment: engine output must resolve inside the temp dir.
    const resolved = path.resolve(config.tempDir, path.basename(produced));
    if (resolved !== path.resolve(produced) || !resolved.startsWith(config.tempDir + path.sep)) {
      await cleanupFile(resolved);
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    producedPath = resolved;
    let stat;
    try {
      stat = await fsp.stat(producedPath);
    } catch (e) {
      // Engine reported success but the file is absent (e.g. merge skipped
      // when ffmpeg is unavailable). Honest controlled failure, never a 500.
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    if (!stat.isFile()) {
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    if (stat.size === 0) {
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    if (stat.size > config.maxDownloadBytes) {
      throw engineError('OUTPUT_TOO_LARGE', 'The resulting file is too large to download.', 413);
    }
    const ext = path.extname(producedPath).replace(/^\./, '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    const filename = title ? safeTitleFilename(title, platform, quality, ext) : safeFilename(platform, ext);
    const finalPath = path.join(config.tempDir, `${jobId}-${filename}`);
    try {
      await fsp.rename(producedPath, finalPath);
    } catch (e) {
      throw engineError('PROCESSING_FAILED', 'We couldn\u2019t process this video. Please try again.', 502);
    }
    producedPath = finalPath;
    log(`success platform=${platform} bytes=${stat.size} durationMs=${Date.now() - startedAt}`);
    const ttlTimer = setTimeout(() => {
      cleanupFile(finalPath).catch(() => {});
      jobStore.remove(jobId);
    }, config.fileTtlMs);
    if (ttlTimer.unref) ttlTimer.unref();
    jobStore.put({ id: jobId, status: 'ready', filePath: finalPath, filename, platform, createdAt: Date.now(), timer: ttlTimer });
    return { jobId, filename, platform, bytes: stat.size };
  } catch (err) {
    const sweepJob = async () => {
      if (producedPath) await cleanupFile(producedPath);
      try {
        const entries = await fsp.readdir(config.tempDir);
        await Promise.all(entries.filter((n) => n.startsWith(jobId)).map((n) => cleanupFile(path.join(config.tempDir, n))));
      } catch (e) { /* temp dir may not exist */ }
    };
    await sweepJob();
    // Delayed re-sweep: on Windows SIGKILL only terminates the direct child;
    // engine grandchildren (ffmpeg) can flush .part fragments a moment later.
    // A second pass + the startup/periodic stale sweep guarantee no buildup.
    setTimeout(() => { sweepJob().catch(() => {}); }, 5000).unref?.();
    throw err;
  } finally {
    jobStore.release();
  }
}

async function processDownloadWithFormat(args) {
  return processDownload(args);
}

module.exports = { processDownload, processDownloadWithFormat, classifyMergeFailure, cleanupFile, ALLOWED_EXTENSIONS, shutdownChildren };
