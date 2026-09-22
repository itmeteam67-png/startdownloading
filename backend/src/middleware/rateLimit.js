'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

function json429(message) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
    });
  };
}

/* General API limiter: cheap endpoints (health, file metadata). */
function apiLimiter() {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: json429('Too many requests. Please try again later.'),
  });
}

/* Strict limiter: the expensive processing endpoint. Separate budget so a
   burst of cheap reads can never starve — or mask — download abuse. */
function downloadLimiter() {
  return rateLimit({
    windowMs: config.downloadWindowMs,
    max: config.downloadMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: json429('Too many download requests. Please wait a moment and try again.'),
  });
}

/* Light limiter for cheap content pages (homepage + knowledge/downloaders).
   Generous for humans and crawlers; still bounds floods. HTML 429 page. */
function siteLimiter() {
  return rateLimit({
    windowMs: config.siteWindowMs,
    max: config.siteMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).type('html').send(
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Too many requests</title></head>' +
        '<body><h1>Too many requests</h1><p>Please wait a moment and try again.</p></body></html>'
      );
    },
  });
}

module.exports = { apiLimiter, downloadLimiter, siteLimiter };
