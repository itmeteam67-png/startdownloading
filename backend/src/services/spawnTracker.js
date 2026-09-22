'use strict';

/* Shared child-process registry so server shutdown can terminate in-flight
   engine processes (info dumps + downloads). No zombies survive a restart. */

const activeChildren = new Set();

function add(child) { activeChildren.add(child); }
function remove(child) { activeChildren.delete(child); }

function shutdownChildrenTracking() {
  return { add, delete: remove };
}

function shutdownAll() {
  for (const child of activeChildren) {
    try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
  }
}

module.exports = { shutdownChildrenTracking, shutdownAll, activeChildren };
