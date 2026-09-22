'use strict';

/* SSRF protection: submitted URLs are untrusted. We resolve the
   hostname server-side and refuse loopback / private / link-local /
   cloud-metadata destinations. Hostname-string checks alone are NOT
   sufficient, so DNS resolution is verified too. */

const dns = require('dns').promises;
const net = require('net');

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  };
  return (
    inRange('10.0.0.0', 8) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.168.0.0', 16) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) || // link-local incl. 169.254.169.254 metadata
    inRange('0.0.0.0', 8)
  );
}

function isBlockedIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // loopback, unspecified, link-local, unique-local
    return lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  return true; // unknown family: refuse
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

async function assertUrlSafe(urlObj) {
  const hostname = urlObj.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    const err = new Error('Blocked destination');
    err.code = 'SSRF_BLOCKED';
    throw err;
  }
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      const err = new Error('Blocked destination');
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
    return;
  }
  // Verify DNS: refuse if every resolved address is internal.
  let records = [];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (e) {
    const err = new Error('DNS resolution failed');
    err.code = 'SSRF_DNS';
    throw err;
  }
  if (!records.length || records.every((r) => isBlockedIP(r.address))) {
    const err = new Error('Blocked destination');
    err.code = 'SSRF_BLOCKED';
    throw err;
  }
}

module.exports = { assertUrlSafe, isBlockedIP };
