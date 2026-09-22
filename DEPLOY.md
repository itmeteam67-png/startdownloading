# StartDownloading — Production Deployment on Railway

All commands below are real for this stack (Node 22 + Express + static
frontend + Docker). This project deploys **exclusively on Railway**.

## 1. Runtime & dependencies

- Runtime: **Node.js ≥ 18** (Docker image pins **Node 22**).
- Engine: **yt-dlp** binary + **ffmpeg** (merges) + **python3** — all baked
  into `backend/Dockerfile`. Without them the API stays up and returns
  honest `502 PROCESSING_FAILED`.
- Railway builds with **Dockerfile** at `backend/Dockerfile` (build context:
  repo root). There is no Nixpacks/frontend build step — the frontend is a
  single static `index.html` (+ `robots.txt` + `sitemap.xml`) served by the
  backend itself.

## 2. Create the Railway service

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo.
3. Configure the service:
   - Builder: Dockerfile, path `backend/Dockerfile`.
   - Health check path: `/api/health` (Railway restarts unhealthy containers).
4. No start-command override is needed — the image's `CMD`
   (`node backend/src/server.js`) listens on `$PORT`.

## 3. Environment (Railway Variables panel)

Set these in the service **Variables** panel. Never commit `.env`
(it is git-ignored at repo root and in `backend/`).

| Variable | Production value |
| -------- | ---------------- |
| `NODE_ENV` | `production` (enables HTTPS redirect; verbose behavior off) |
| `PORT` | **do not set** — Railway injects `$PORT` automatically |
| `CORS_ORIGINS` | `https://startdownloading.com` **only** (never `*`) |
| `YTDLP_BIN` | `yt-dlp` (bare name or absolute path) |
| `TEMP_DIR` | `./temp` (ephemeral service filesystem — correct by design, see §6) |
| `MAX_DOWNLOAD_BYTES` / `DOWNLOAD_TIMEOUT_MS` / `MAX_CONCURRENT_JOBS` | keep defaults unless the service plan is sized up |
| `RATE_LIMIT_*` | keep defaults; tighten if abused |
| `FFMPEG_LOCATION` | leave unset (ffmpeg is on `PATH` inside the image) |

No secrets exist in this project by design (no API keys, DB passwords, or
tokens) — Variables hold paths, origins, and numeric budgets only. Nothing
secret is logged.

## 4. Custom domain + HTTPS (`startdownloading.com`)

Railway terminates TLS at its edge — no Caddy/Nginx is needed:

1. Service **Settings → Domains → Add custom domain**:
   `startdownloading.com` (plus `www.startdownloading.com` if desired).
2. Follow Railway's DNS instructions for the exact `A`/`CNAME` values
   (do not invent them).
3. Railway provisions the certificate automatically.

The app sets `trust proxy = 1` and 301-redirects plain HTTP to HTTPS when
`NODE_ENV=production`, so non-TLS hits behind the proxy are still upgraded.
Security headers come from `helmet` (HSTS included). No CSP exception work
is needed: the CSP in `backend/src/app.js` already matches the real
resource inventory.

Verify: `https://startdownloading.com/api/health` → `{ "ok": true }`.

## 5. Health, readiness, metrics

- Liveness: `GET /api/health` → `{ ok: true }` (container HEALTHCHECK and
  the Railway health check use it).
- Readiness: `GET /api/ready` → `{ ok, checks: { tempWritable, engine } }`
  (503 if temp unwritable; missing engine degrades to honest 502s, stays ready).
- Metrics: `GET /api/metrics` → aggregate-only counters (uptime, request
  classes, download outcomes, rate-limited count, active jobs, temp files).
  No URLs, IPs, or user content — safe to scrape.

Alert on: health DOWN, repeated 5xx, `PROCESSING_FAILED` spikes, 429 storms,
disk growth under `TEMP_DIR`, readiness 503. Use Railway **Logs** (stdout
JSON lines: request ID, method, path, redacted host, platform, duration,
outcome, code) and the Metrics tab.

## 6. Storage, cleanup, logs

- Stateless app: **no database, nothing to back up** except Variables.
  Railway's service filesystem is ephemeral, which fits this design: temp
  media expires via TTL + startup/periodic sweeps and is never backed up.
  Do **not** attach a Volume for `TEMP_DIR` — persistence would only
  accumulate expirable files.
- Logs are single-line JSON to stdout (visible in Railway Logs). The app
  never writes log files itself, so no log rotation configuration exists.

## 7. Rollback

In the Railway service **Deployments** tab, find the previous successful
deployment and **Redeploy** it. Config is env-only (Variables), so no
migration step exists. After rollback verify `/api/health` and one
invalid-URL `POST /api/download` (expect controlled 400).

## 8. Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Service won't start / port error | `PORT` must NOT be set manually — Railway injects `$PORT`; the server reads it via config |
| All downloads `502 PROCESSING_FAILED` | engine missing: rebuild from `backend/Dockerfile`, check `/api/ready` → `engine` |
| `429` bursts | expected under abuse; raise `RATE_LIMIT_DOWNLOAD_MAX` only deliberately |
| `413 OUTPUT_TOO_LARGE` | lower quality cap or raise `MAX_DOWNLOAD_BYTES` |
| Temp dir growth | check sweeps in Railway Logs; verify `FILE_TTL_MS` and writability |
| `CORS` errors in browser | `CORS_ORIGINS` must list `https://startdownloading.com` exactly |
