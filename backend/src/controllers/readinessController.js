'use strict';

/* Readiness probes (Phase 7). Liveness stays GET /api/health.
   Readiness verifies real dependencies without doing any expensive work
   and without exposing internals: temp dir writable + engine binary
   resolvable. The engine check is cached for 60s so polling is cheap. */

const { spawnSync } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const config = require('../config');

let engineCache = { at: 0, ok: false };
const ENGINE_CACHE_MS = 60000;

function engineAvailable() {
  const now = Date.now();
  if (now - engineCache.at < ENGINE_CACHE_MS) return engineCache.ok;
  let ok = false;
  try {
    const r = spawnSync(config.ytdlpBin, ['--version'], { timeout: 10000, stdio: 'ignore', shell: false, windowsHide: true });
    ok = !r.error && r.status === 0;
  } catch (e) {
    ok = false;
  }
  engineCache = { at: now, ok };
  return ok;
}

async function getReadiness(_req, res) {
  let tempWritable = false;
  try {
    await fsp.mkdir(config.tempDir, { recursive: true });
    await fsp.access(config.tempDir, fs.constants.W_OK);
    tempWritable = true;
  } catch (e) {
    tempWritable = false;
  }
  const engine = engineAvailable();
  const ready = tempWritable; // engine absence degrades to honest 502s, not unready
  res.status(ready ? 200 : 503).json({
    ok: ready,
    checks: { tempWritable, engine },
  });
}

module.exports = { getReadiness };
