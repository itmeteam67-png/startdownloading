# StartDownloading — Backend (Phase 4)

Real API + download engine behind the unchanged Phase 2/3 frontend.
Only public, permitted content is processed. No DRM / auth / paywall /
access-control bypasses — restricted links return an honest controlled error.

## Stack

- Node.js ≥ 18, Express 4, helmet, cors, express-rate-limit (see `package.json`)
- Download engine: `yt-dlp` executable (isolated in `src/services/downloadEngine.js`).
  If it is not installed, `/api/download` returns an honest `502 PROCESSING_FAILED`
  instead of faking a download.

## Layout (Phase 5 hardened + footer/nav site)

```
backend/
  src/
    config/        env-driven limits (port, sizes, timeouts, concurrency, dual rate limits)
    platforms/     registry: matchers, per-platform formats, failure classifier (single source of truth)
    utils/         url.js (structural parse + public-URL policy), ssrf.js, ids.js, log.js (redacted)
    validators/    downloadValidator.js, videoValidator.js (two-step flow)
    middleware/    rateLimit.js (general + strict download budgets), errorHandler.js
    services/      downloadEngine.js (safe spawn, ext allowlist, shutdown tracking),
                   infoEngine.js (real metadata + curated qualities), spawnTracker.js,
                   jobStore.js, cleanup.js (startup + periodic stale sweep)
    controllers/   downloadController.js (POST /api/download, GET /api/file/:id),
                   videoController.js (POST /api/video/info, POST /api/video/download)
    site/          siteMap.js (official IA — single source of truth, 57 routes),
                   layout.js (shared header + GlobalFooter + SEO),
                   content.js (honest page content, limited capabilities stated),
                   siteRoutes.js (one real page per route)
    routes/        downloadRoutes.js
    app.js         express app + X-Request-Id + maintenance init (serves ../index.html in dev)
    server.js      listen + graceful shutdown (kills engine children)
  temp/            (created at runtime, git-ignored by convention)
  tests/           runTests.js (security), runPhase6Tests.js (quality),
                   runE2E.js (flow), runSiteAudit.js (57 routes + every footer link)
.env.example
.gitignore
```

Content site: 24 downloader pages + Knowledge hub + 5 categories + 27
articles = 57 routes (+ homepage). Every footer link resolves (see
`npm run test:site`). Downloader pages embed the working two-step analyzer;
limited capabilities (playlists, MP3 re-encoding, photos, stories,
watermarks, GIFs) are stated plainly on the page itself. `sitemap.xml`
lists all 58 URLs.

## API

### POST /api/video/info (Phase 7 — Stage 1: analyze)

Request:

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Success — `200` (all fields are REAL engine output, never invented):

```json
{
  "success": true,
  "data": {
    "platform": "youtube",
    "title": "...",
    "thumbnail": "https://...",
    "duration": "10:35",
    "durationSec": 635,
    "uploader": "...",
    "formats": [
      {
        "formatId": "231",
        "quality": "480p",
        "qualityLabel": "480p",
        "height": 480,
        "format": "mp4",
        "extension": "mp4",
        "filesize": 28207144,
        "hasVideo": true,
        "hasAudio": false,
        "needsMerge": true
      }
    ]
  }
}
```

One option per genuinely-available height (best MP4 variant) + best
audio-only track, sorted 2160p → 144p, audio last. Video-only entries set
`needsMerge: true` (the download step merges best audio via ffmpeg).

Error codes: same table as below, plus `VIDEO_NOT_FOUND` (404, no
downloadable formats) and honest `504 PROCESSING_TIMEOUT` for slow analyses.

### POST /api/video/download (Phase 7 — Stage 2: selected quality)

Request:

```json
{ "url": "https://www.youtube.com/watch?v=...", "formatId": "231" }
```

The `formatId` is validated against a fresh engine dump for the SAME
canonical URL (cached 10 min). Unknown/forged ids → `422
FORMAT_NOT_AVAILABLE`. Video-only selections are downloaded as
`<id>+bestaudio/b` with `--merge-output-format mp4`.

Success — `200`:

```json
{
  "success": true,
  "platform": "youtube",
  "downloadUrl": "/api/file/<jobId>",
  "filename": "startdownloading-youtube-<sanitized-title>-480p.mp4",
  "formatId": "231",
  "quality": "480p"
}
```

Extra error codes: `FORMAT_NOT_AVAILABLE` (422), `MERGE_FAILED` (502,
ffmpeg merge failed — try a lower quality).

### POST /api/download (legacy single-step, kept for compatibility)

Request:

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Success — `200`:

```json
{
  "success": true,
  "platform": "youtube",
  "downloadUrl": "/api/file/<jobId>",
  "filename": "startdownloading-youtube-....mp4"
}
```

Error — status varies:

```json
{ "success": false, "error": { "code": "UNSUPPORTED_PLATFORM", "message": "This platform is not currently supported." } }
```

| HTTP | Code | Meaning |
| ---- | ---- | ------- |
| 400 | INVALID_REQUEST / INVALID_URL | missing / malformed URL, bad Content-Type (415), bad port/credentials/scheme |
| 422 | UNSUPPORTED_PLATFORM | unknown host, SSRF-blocked, engine-reported unsupported |
| 422 | PRIVATE_CONTENT | login-walled, private, DRM/premium/age-gated — never bypassed |
| 413 | OUTPUT_TOO_LARGE | output exceeded `MAX_DOWNLOAD_BYTES` |
| 429 | RATE_LIMITED | per-IP budget spent or server at `MAX_CONCURRENT_JOBS` |
| 502 | PROCESSING_FAILED / NETWORK_ERROR | engine failed, missing, or platform unreachable |
| 504 | PROCESSING_TIMEOUT | exceeded `DOWNLOAD_TIMEOUT_MS` |
| 503 | TEMPORARY_FAILURE | transient backend problem (reserved) |
| 500 | SERVER_ERROR | unexpected (sanitized) |

Every response carries `X-Request-Id`; logs carry timestamp, request ID,
method, path, redacted host (never full URLs/query strings), platform,
duration, outcome, and error category. No passwords/cookies/tokens logged.

Validation order: Content-Type → body → URL shape → public-URL policy
(no credentials/ports/odd schemes) → backend platform detection →
SSRF/DNS check → strict download rate limit → concurrency gate → engine
(`spawn` argv, no shell, fail-closed `YTDLP_BIN`).

### GET /api/file/:id

Streams the processed file (`jobId` = 24 hex chars). Files expire after
`FILE_TTL_MS` and are deleted.

### GET /api/health

`{ "ok": true, ... }` — liveness only.

### GET /api/ready

Readiness: `{ ok, checks: { tempWritable, engine } }` — 503 only when the
temp dir is unwritable. A missing engine stays *ready* (it degrades to
honest 502s, not downtime).

### GET /api/metrics

Aggregate-only observability (uptime, request classes, download outcomes,
rate-limited count, active jobs, temp file count). No URLs, IPs, or user
content — safe to scrape.

## Security (hardened; full policy in `../SECURITY.md`)

Public HTTP serves ONLY `index.html`/`robots.txt`/`sitemap.xml` by
allowlist (no static directory — backend source is unreachable), CSP
matches the real CDN/font/image inventory, content pages carry their own
300/min budget, and `tests/runSecurityAudit.js` (`npm run test:security2`,
16 tests) locks all of this in.

## Security (Phase 5, retained)

- Server-side URL/platform validation; frontend guess never trusted.
- Platform registry (`src/platforms`): anchored matchers defeat
  `evil-youtube.com` / `youtube.com.evil.com` lookalikes.
- Public-URL policy: no credentials, no explicit ports, http(s) only,
  hostname length cap; canonical https upgrade server-side.
- SSRF: hostname + resolved-IP checks (loopback incl. `::1`, private v4/v6,
  link-local, `169.254.169.254`, `localhost`, `.internal`/`.local` refused).
  Redirect note: the engine follows platform redirects internally with TLS
  verification ON; restricted targets fail closed (PRIVATE_CONTENT), never bypassed.
- No shell: `spawn(bin, [args…, url])` with `shell: false`; fail-closed
  `YTDLP_BIN` allow-list (bare name or absolute path); no user flags/paths.
- helmet headers, CORS allowlist (`CORS_ORIGINS`), 32kb JSON body cap +
  `application/json` enforcement, dual per-IP rate limits (general 60/min +
  strict download 10/min, env-tunable), concurrency cap, timeout kill +
  shutdown child tracking (no zombies), temp containment + ext allow-list
  (`mp4/webm/mkv/mov/m4a/mp3`) + startup/periodic stale sweep.
- File serving: 24-hex job IDs only, resolved-path containment check,
  TTL expiry; traversal/unknown → 404.
- Sanitized errors only; request-ID logs with redacted hosts.

## Local development

```bash
cd backend
cp .env.example .env   # adjust as needed
npm install
# required for real processing:
#   Windows: python -m pip install yt-dlp  (then set YTDLP_BIN to the exe)
#   ffmpeg: download essentials build, set FFMPEG_LOCATION to its folder
npm test                # security + quality + E2E suites (needs internet for real-download asserts)
npm start               # http://localhost:3001 (serves the frontend too)
```

Manual local test of the two-step flow (needs engine + ffmpeg + internet):

1. `npm start` → open `http://localhost:3001`
2. Paste a public video URL (e.g. Big Buck Bunny `https://www.youtube.com/watch?v=aqz-KE-bpKQ`)
3. Click Download → wait for "Analyzing video…" (indeterminate spinner, no fake %)
4. See real title / thumbnail / duration + real quality pills
5. Select a quality → press Download → real file saves via blob download

Frontend integration: `index.html` → `DownloaderService.prepare()` calls
`POST /api/download` (same-origin in dev) and renders the real
`downloadUrl` via the existing `.dl-save` control. Set `API_BASE` in
`index.html` if the API lives on another origin (and add it to `CORS_ORIGINS`).

## Known limitations

- Real processing needs the `yt-dlp` binary (+ ffmpeg for merges).
  Verified working locally (Windows + Python 3.12): install with
  `python -m pip install yt-dlp`, point `YTDLP_BIN` at it, set
  `FFMPEG_LOCATION` to a dir containing `ffmpeg.exe`, then run
  `npm run test:local` (downloads a CC-BY Blender test video and
  verifies the container). Without the engine the API stays up and
  returns honest 502s.
- In-memory job store (stateless across restarts; no DB by design).
- Single-instance concurrency gate; distributed queue is future work.
- No deployment (later phase).

## Phase 6 — quality gates

- `npm test` runs security suite (28 tests) + quality suite (16 tests:
  12 frontend unit via VM sandbox on the shipped inline script, API
  contract checks, static SEO/a11y/security audits, measured latency,
  full security-suite regression) + production E2E flow.
- Measured (local, real): validation-request avg ~3ms (asserted < 50ms);
  `index.html` ~48KB single file; `npm audit` 0 vulnerabilities.
- Not measured here (no browser harness): field LCP/INP/CLS —
  mitigated by construction (inline CSS, reserved image boxes,
  `display=swap` fonts, lazy below-fold imagery, zero render-blocking
  local scripts). Cross-browser beyond the dev engine: NOT TESTED.
- SEO: canonical/OG/Twitter/JSON-LD (`WebSite`, no invented claims),
  `robots.txt` + `sitemap.xml` for `startdownloading.com`.
- Perf: gzip (`compression`, ≥1KB), HTML `no-cache` + ETag, JSON body
  limit driven by `MAX_BODY_BYTES` config.
- A11y: skip link, `<main>`, labelled input, section headings, live
  regions, focus-visible, `prefers-reduced-motion` — no visual changes.
