'use strict';

const path = require('path');
// Local development configuration. Production uses real environment
// variables; .env is git-ignored and never committed.
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv optional — env may come from the shell */ }

const { createApp, initMaintenance } = require('./app');
const config = require('./config');

const app = createApp();

initMaintenance().catch(() => {});
const server = app.listen(config.port, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: 'server', msg: `listening on :${config.port} (${config.nodeEnv})` }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: 'server', msg: `received ${signal}, shutting down` }));
  try { require('./services/downloadEngine').shutdownChildren(); } catch (e) { /* noop */ }
  try { require('./services/spawnTracker').shutdownAll(); } catch (e) { /* noop */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
