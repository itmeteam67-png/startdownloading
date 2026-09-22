'use strict';

/* In-memory job registry with a simple concurrency gate.
   Stateless across restarts by design (no DB in Phase 4). */

const config = require('../config');

const jobs = new Map(); // jobId -> { status, filePath, filename, platform, createdAt, timer }
let activeCount = 0;

function canStart() {
  return activeCount < config.maxConcurrentJobs;
}

function acquire() {
  activeCount += 1;
}

function release() {
  activeCount = Math.max(0, activeCount - 1);
}

function put(job) {
  jobs.set(job.id, job);
}

function get(id) {
  return jobs.get(id);
}

function remove(id) {
  jobs.delete(id);
}

module.exports = { jobs, canStart, acquire, release, put, get, remove };
