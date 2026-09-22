'use strict';

/* Temporary-file lifecycle: TTL expiry + startup sweep + periodic sweep
   for abandoned files. Never touches files without the job-id prefix shape
   or files still tracked as active/ready. */

const fsp = require('fs/promises');
const path = require('path');
const config = require('../config');
const jobStore = require('./jobStore');
const { cleanupFile } = require('./downloadEngine');

const JOB_PREFIX = /^[a-f0-9]{24}/;

async function sweepStaleTempFiles() {
  let entries = [];
  try {
    entries = await fsp.readdir(config.tempDir);
  } catch (e) {
    return { swept: 0 };
  }
  const now = Date.now();
  let swept = 0;
  await Promise.all(entries.map(async (name) => {
    if (!JOB_PREFIX.test(name)) return; // only engine-produced files
    const full = path.join(config.tempDir, name);
    const id = name.slice(0, 24);
    if (jobStore.get(id)) return; // actively tracked — leave alone
    try {
      const stat = await fsp.stat(full);
      if (!stat.isFile()) return;
      if (now - stat.mtimeMs > config.fileTtlMs) {
        await cleanupFile(full);
        swept += 1;
      }
    } catch (e) { /* raced deletion — ignore */ }
  }));
  return { swept };
}

function startCleanupJob(log) {
  const interval = Math.max(60000, Math.min(config.fileTtlMs, 15 * 60 * 1000));
  const timer = setInterval(() => {
    sweepStaleTempFiles()
      .then(({ swept }) => { if (swept > 0 && log) log(`cleanup swept ${swept} stale file(s)`); })
      .catch(() => {});
  }, interval);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { sweepStaleTempFiles, startCleanupJob };
