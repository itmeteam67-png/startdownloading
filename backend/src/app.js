'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config');
const { newRequestId } = require('./utils/ids');
const downloadRoutes = require('./routes/downloadRoutes');
const { apiLimiter, siteLimiter } = require('./middleware/rateLimit');
const { metricsMiddleware } = require('./middleware/metrics');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { sweepStaleTempFiles, startCleanupJob } = require('./services/cleanup');

/* Config bytes -> express `limit` string (e.g. 1048576 -> "1024kb"). */
function bytesToExpressLimit(bytes) {
  const kb = Math.max(1, Math.floor(Number(bytes) / 1024));
  return `${kb}kb`;
}

/* Content-Security-Policy matched to the real resource inventory:
   - inline <script>/<style> are architectural (single-file frontend, no build
     step) → 'unsafe-inline' is a documented exception; XSS defense rests on
     output escaping (never user HTML) + textContent rendering + no inline
     event handlers (script-src-attr 'none' enforced and audited).
   - jsDelivr: Bootstrap CSS + bundle. Google Fonts: stylesheet + font files.
   - Images: self + https (Unsplash decor, platform thumbnails) + data:.
   - API calls are same-origin fetch → connect-src 'self'.
   - frame-ancestors 'self' (+ X-Frame-Options SAMEORIGIN) blocks clickjacking.
   - object-src 'none' blocks plugin content. base-uri/form-action locked. */
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', "'unsafe-inline'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'https:', 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  upgradeInsecureRequests: [],
};

/* Only intentionally-public files are ever served. The previous
   express.static(root) exposed backend source (e.g. /backend/src/app.js).
   Now: strict allowlist, dotfiles denied, traversal impossible by construction. */
const PUBLIC_FILES = {
  '/': { file: 'index.html', cache: 'no-cache' },
  '/index.html': { file: 'index.html', cache: 'no-cache' },
  '/robots.txt': { file: 'robots.txt', cache: 'public, max-age=3600' },
  '/sitemap.xml': { file: 'sitemap.xml', cache: 'public, max-age=3600' },
};

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: { directives: CSP_DIRECTIVES },
    // HSTS (prod TLS via reverse proxy) + no-referrer + SAMEORIGIN framing
    // come from helmet defaults; Permissions-Policy is set explicitly below.
  }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=()');
    next();
  });
  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST'], maxAge: 600 }));
  app.use(compression({ threshold: 1024 })); // gzip bodies >=1kb (html/api); no user data cached
  app.use(express.json({ limit: bytesToExpressLimit(config.maxBodyBytes) }));

  // Request IDs for traceable logs + responses (no sensitive data logged).
  app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] && typeof req.headers['x-request-id'] === 'string'
      ? String(req.headers['x-request-id']).slice(0, 32)
      : newRequestId();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // Production HTTPS: the app sits behind a TLS-terminating reverse proxy
  // (see DEPLOY.md). This enforces https when the proxy reports plain http.
  // In dev (NODE_ENV!=production) it is a no-op.
  if (config.nodeEnv === 'production') {
    app.use((req, res, next) => {
      if (req.get('x-forwarded-proto') === 'http') {
        return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
      }
      next();
    });
  }

  app.use('/api', apiLimiter());
  app.use(metricsMiddleware);
  app.use('/api', downloadRoutes);

  // Content-site routes (footer hub + downloader pages + Knowledge Center).
  // Light per-IP budget; expensive /api paths keep their own strict budgets.
  const siteBudget = siteLimiter();
  try {
    app.use('/', siteBudget, require('./site/siteRoutes').createSiteRouter());
  } catch (e) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), scope: 'site', msg: 'site routes disabled', error: String(e && e.message) }));
  }

  // Serve ONLY the allowlisted public files. Everything else (backend
  // source, configs, .env, temp, Dockerfiles, markdown) is unreachable over
  // HTTP by construction — there is no static directory middleware at all.
  const frontendRoot = path.resolve(__dirname, '..', '..');
  for (const [route, entry] of Object.entries(PUBLIC_FILES)) {
    app.get(route, siteBudget, (req, res, next) => {
      res.setHeader('Cache-Control', entry.cache);
      res.sendFile(entry.file, { root: frontendRoot, dotfiles: 'deny' }, (err) => {
        if (err) next(err);
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

/* Called once at boot (and safe to call in tests): removes abandoned
   temp files left by previous runs, then schedules periodic sweeps. */
async function initMaintenance() {
  const { swept } = await sweepStaleTempFiles();
  if (swept > 0) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), scope: 'cleanup', msg: `startup sweep removed ${swept} stale file(s)` }));
  }
  startCleanupJob((msg) => console.log(JSON.stringify({ ts: new Date().toISOString(), scope: 'cleanup', msg })));
}

module.exports = { createApp, initMaintenance };
