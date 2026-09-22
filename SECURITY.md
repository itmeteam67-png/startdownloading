# StartDownloading — Security Policy & Architecture

StartDownloading is treated as a production-grade public web application.
There is no authentication, no database, no file uploads, and no cookies —
which removes entire vulnerability classes by design. The attack surface is:
untrusted video URLs, untrusted format IDs, the yt-dlp/ffmpeg pipeline,
temporary media files, and public read routes.

## Security architecture (what protects what)

| Layer | Control | Location |
| --- | --- | --- |
| Transport | HTTPS redirect in production (`trust proxy = 1`), HSTS via helmet | `backend/src/app.js`, reverse proxy (see DEPLOY.md) |
| Headers | CSP matched to real inventory, `nosniff`, `SAMEORIGIN` framing + `frame-ancestors 'self'`, `no-referrer`, restrictive `Permissions-Policy`, no `X-Powered-By` | `backend/src/app.js` (`CSP_DIRECTIVES`) |
| Static exposure | No static directory middleware — only `index.html`, `robots.txt`, `sitemap.xml` served by allowlist; backend source, `.env`, temp, docs are unreachable over HTTP | `backend/src/app.js` (`PUBLIC_FILES`) |
| Input validation | Server-authoritative URL/platform/format validation; allowlists; length caps; `Content-Type: application/json` enforcement; 1MB JSON body cap | `backend/src/validators/`, `backend/src/utils/url.js` |
| SSRF | Hostname + DNS-resolved-IP checks (loopback, private v4/v6, link-local, metadata, `.internal`/`.local` refused); no credentials/ports/schemes | `backend/src/utils/ssrf.js` |
| Process execution | `spawn(bin, argv)` with `shell:false`; fail-closed `YTDLP_BIN` allowlist; URL/formatId passed as single argv elements; fixed flags only; timeout kill + shutdown tracking | `backend/src/services/downloadEngine.js`, `infoEngine.js` |
| Path traversal | Server-generated filenames; sanitized title slugs; resolved-path containment checks; 24-hex job IDs; traversal → 404 | `backend/src/utils/ids.js`, `downloadEngine.js`, `downloadController.js` |
| File safety | Temp dir containment, extension allowlist, real-file verification, size cap, TTL expiry + startup/periodic sweeps + post-failure re-sweep, `Content-Disposition: attachment` | `backend/src/services/` |
| Resource limits | Body/URL/size/timeout/concurrency budgets, all env-tunable | `backend/src/config/index.js` |
| Rate limiting | General `/api` 60/min + strict download 10/min + content pages 300/min (all per-IP, env-tunable) | `backend/src/middleware/rateLimit.js` |
| CORS | Explicit origin allowlist (`CORS_ORIGINS`), never `*` | `backend/src/config/index.js` |
| Errors | Central sanitized handler; no stacks/paths/commands/secrets to clients | `backend/src/middleware/errorHandler.js` |
| Logging | JSON lines with request ID + redacted host only; never URLs, tokens, cookies | `backend/src/utils/log.js` |
| XSS | Server escapes all rendered strings; frontend uses `textContent` + one audited `escHtml()` sink; no inline event handlers (`script-src-attr 'none'`); no user HTML anywhere | `backend/src/site/layout.js`, `index.html` |
| Legal | No DRM/auth/paywall/access-control bypasses; restricted content fails closed; limited capabilities stated on-page | `backend/src/platforms/`, `content.js` |

## Content-Security-Policy (documented exceptions)

```
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline';
script-src-attr 'none';
style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline';
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' https: data:;
connect-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'self'; upgrade-insecure-requests
```

`'unsafe-inline'` for scripts/styles is required by the single-file,
no-build frontend architecture. XSS defense therefore rests on output
escaping, `textContent` rendering, and zero inline event handlers — all
covered by automated tests (`test:quality` bans `console.*` debug output
and runs the shipped script; `test:security2` asserts the CSP shape).

## Environment variables

See `backend/.env.example` for the full list (placeholders only — no
secrets). Real `.env` is git-ignored and never committed. There are no API
keys, database passwords, or tokens in this project by design; the only
environment-shaped configuration is paths, origins, and numeric budgets.

## Reporting security vulnerabilities

Do not open public issues for suspected vulnerabilities. Contact the site
operator privately with: affected endpoint, reproduction steps, and impact.
Allow reasonable time for a fix before any disclosure. Automated scanners:
please rate-limit yourself — the abuse budgets exist to protect the shared
download engine, and scan traffic that trips them will simply be 429'd.

## Production security requirements (deployment phase)

1. TLS-terminating reverse proxy with the app's HTTP→HTTPS redirect active
   (`NODE_ENV=production`), `CORS_ORIGINS=https://startdownloading.com` only.
2. `yt-dlp` + `ffmpeg` installed from trusted sources; `YTDLP_BIN` bare name
   or absolute path; writable persistent `TEMP_DIR` with disk monitoring.
3. Review `RATE_LIMIT_*`, `MAX_DOWNLOAD_BYTES`, `DOWNLOAD_TIMEOUT_MS`,
   `MAX_CONCURRENT_JOBS` against host capacity; scrape `/api/metrics`.
4. Rotate nothing (no secrets exist); keep Node ≥ 18 and run `npm audit` on updates.

## Known limitations (honest, not solved by code alone)

- Redirects inside the engine (yt-dlp follows platform redirects with TLS
  verification ON) cannot be pre-validated hop-by-hop; restricted targets
  fail closed instead of being bypassed.
- DNS-rebinding races and live redirect-chain attacks are architecturally
  mitigated (DNS + containment + fail-closed errors) but were NOT TESTED
  live against an adversarial resolver.
- No WAF/bot-management in code; volumetric defense is rate limits +
  concurrency gates only.
- The `temp/` directory relies on OS permissions; production hosts must
  ensure it is not web-served by any other layer.
