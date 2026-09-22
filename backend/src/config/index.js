'use strict';

/* Centralized, env-driven configuration. No secrets are ever sent to the frontend. */

const path = require('path');

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function list(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const config = {
  port: num('PORT', 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: list('CORS_ORIGINS', ['http://localhost:3001', 'http://127.0.0.1:3001']),
  ytdlpBin: process.env.YTDLP_BIN || 'yt-dlp',
  // Optional absolute dir containing ffmpeg/ffprobe. Passed to the engine as
  // --ffmpeg-location so local dev works without PATH surgery.
  ffmpegLocation: process.env.FFMPEG_LOCATION || '',
  tempDir: path.resolve(__dirname, '..', '..', process.env.TEMP_DIR || './temp'),
  maxDownloadBytes: num('MAX_DOWNLOAD_BYTES', 512 * 1024 * 1024),
  downloadTimeoutMs: num('DOWNLOAD_TIMEOUT_MS', 120000),
  maxConcurrentJobs: num('MAX_CONCURRENT_JOBS', 2),
  maxBodyBytes: num('MAX_BODY_BYTES', 1024 * 1024),
  // General API budget…
  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60000),
  rateLimitMax: num('RATE_LIMIT_MAX', 60),
  // …and a separate, stricter budget for the expensive download endpoint.
  downloadWindowMs: num('RATE_LIMIT_DOWNLOAD_WINDOW_MS', 60000),
  downloadMax: num('RATE_LIMIT_DOWNLOAD_MAX', 10),
  // …plus a light budget for cheap content pages (crawler/abuse backstop).
  siteWindowMs: num('RATE_LIMIT_SITE_WINDOW_MS', 60000),
  siteMax: num('RATE_LIMIT_SITE_MAX', 300),
  fileTtlMs: num('FILE_TTL_MS', 10 * 60 * 1000),
  maxUrlLength: 2048,
};

module.exports = config;
