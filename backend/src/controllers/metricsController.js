'use strict';

const fsp = require('fs/promises');
const config = require('../config');
const jobStore = require('../services/jobStore');
const { snapshot } = require('../middleware/metrics');

/* Aggregate-only observability: counts and gauges, no URLs/IPs/content. */
async function getMetrics(_req, res) {
  let tempFiles = -1; // -1 = unreadable (surfaced honestly, not hidden)
  try {
    tempFiles = (await fsp.readdir(config.tempDir)).length;
  } catch (e) { /* temp dir may not exist yet */ }
  res.status(200).json(Object.assign(snapshot(), {
    activeJobs: jobStore.jobs.size,
    maxConcurrentJobs: config.maxConcurrentJobs,
    tempFiles,
  }));
}

module.exports = { getMetrics };
