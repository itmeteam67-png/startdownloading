# StartDownloading — Production Deployment (Phase 7)

All commands below are real for this stack (Node 22 + Express + static
frontend). Nothing here invents providers: pick any host that runs
containers or Node, then follow the reverse-proxy section for TLS.

## 1. Runtime & dependencies

- Runtime: **Node.js ≥ 18** (CI + image pin **Node 22**).
- Engine: **yt-dlp** binary + **ffmpeg** (merges) + **python3**.
  Without them the API stays up and returns honest `502 PROCESSING_FAILED`.
- Install: `cd backend && npm ci --omit=dev`.

## 2. Environment

Copy `backend/.env.example` to `backend/.env` (or provider env) and set:

| Variable | Production value |
| -------- | ---------------- |
| `NODE_ENV` | `production` (enables HTTPS redirect; verbose behavior off) |
| `PORT` | e.g. `3001` (internal; proxy terminates TLS) |
| `CORS_ORIGINS` | `https://startdownloading.com` **only** (never `*`) |
| `YTDLP_BIN` | `yt-dlp` (bare name or absolute path) |
| `TEMP_DIR` | persistent writable dir, e.g. `./temp` |
| `MAX_DOWNLOAD_BYTES` / `DOWNLOAD_TIMEOUT_MS` / `MAX_CONCURRENT_JOBS` | keep defaults unless sized host |
| `RATE_LIMIT_*` | keep defaults; tighten if abused |

Never commit `.env`. No secrets exist in code; nothing secret is logged.

## 3. Build & start

No frontend build step (single static `index.html` + server-rendered content
pages from `backend/src/site/` + `robots.txt` + `sitemap.xml` with all 58 URLs).
The page loads Bootstrap 5.3.3 (CSS + bundle) from jsDelivr CDN — same
availability class as the existing Google Fonts/Unsplash dependencies.
Brand styling lives in the inline stylesheet *after* the CDN link;
`.btn`/`.badge` were renamed to `.sd-btn`/`.sd-badge` to avoid Bootstrap
collisions. If the CDN is unreachable the layout degrades to a static
stacked menu (custom toggler CSS is CDN-independent).

```bash
cd backend
npm ci --omit=dev
npm test            # 26 security + 16 quality tests, must all pass
npm start           # listens on $PORT, serves frontend + API
```

Docker (from repo root):

```bash
docker build -f backend/Dockerfile -t startdownloading:1.0.0 .
docker run -d --name sd --restart unless-stopped -p 127.0.0.1:3001:3001 \
  --env-file backend/.env startdownloading:1.0.0
```

## 4. Domain + HTTPS (`startdownloading.com`)

Terminate TLS at a reverse proxy (Caddy/Nginx). Minimal Caddy example:

```
startdownloading.com {
  reverse_proxy 127.0.0.1:3001
}
```

The app trusts `X-Forwarded-Proto` (single proxy, `trust proxy = 1`) and
301-redirects plain HTTP to HTTPS when `NODE_ENV=production`. Security
headers come from `helmet` (HSTS included). No CSP is applied: the page
is a single file with inline JS/CSS by design, so a nonce/hash CSP would
require a build step (future work, not a silent break).

## 5. Health, readiness, metrics

- Liveness: `GET /api/health` → `{ ok: true }` (container HEALTHCHECK uses it).
- Readiness: `GET /api/ready` → `{ ok, checks: { tempWritable, engine } }`
  (503 if temp unwritable; missing engine degrades to honest 502s, stays ready).
- Metrics: `GET /api/metrics` → aggregate-only counters (uptime, request
  classes, download outcomes, rate-limited count, active jobs, temp files).
  No URLs, IPs, or user content — safe to scrape.

Alert on: health DOWN, repeated 5xx, `PROCESSING_FAILED` spikes, 429 storms,
disk growth under `TEMP_DIR`, readiness 503.

## 6. Storage, cleanup, logs

- Stateless app: **no database, nothing to back up** except `.env`/config.
  Temp media expires via TTL + startup/periodic sweeps — never backed up.
- Logs are single-line JSON to stdout (request ID, method, path, redacted
  host, platform, duration, outcome, code). Rotate via the platform
  (Docker `json-file` limits, journald, or log shipper) — the app never
  writes log files itself.

## 7. Rollback

Deployments are tagged images (or git tags). Rollback:

```bash
docker stop sd && docker rm sd
docker run -d --name sd --restart unless-stopped -p 127.0.0.1:3001:3001 \
  --env-file backend/.env startdownloading:<previous-tag>
```

Config is env-only, so no migration step exists. Verify `/api/health`
and one invalid-URL `POST /api/download` (expect controlled 400) after rollback.

## 8. Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| All downloads `502 PROCESSING_FAILED` | engine missing: install yt-dlp, check `/api/ready` → `engine` |
| `429` bursts | expected under abuse; raise `RATE_LIMIT_DOWNLOAD_MAX` only deliberately |
| `413 OUTPUT_TOO_LARGE` | lower quality cap or raise `MAX_DOWNLOAD_BYTES` |
| Temp dir growth | check sweeps in logs; verify `FILE_TTL_MS` and writability |
| `CORS` errors in browser | `CORS_ORIGINS` must list `https://startdownloading.com` exactly |
