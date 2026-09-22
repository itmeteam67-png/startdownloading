# StartDownloading — Fast, Easy, Free Video Downloader

Production site: https://startdownloading.com

Single static frontend (`index.html` + `robots.txt` + `sitemap.xml`) served by a
Node.js/Express backend (`backend/`) with a real `yt-dlp` + `ffmpeg` download engine.
No database, no auth, no payments by design.

## Local development

```bash
cd backend
cp .env.example .env   # adjust YTDLP_BIN / FFMPEG_LOCATION to your machine
npm install
npm test               # security + quality + E2E (needs internet for real-download asserts)
npm start              # http://localhost:3001 (serves the frontend too)
```

## Production (Render / Railway / Fly.io + startdownloading.com)

1. Push this repo to GitHub (see below).
2. Create a Docker service from this repo:
   - Dockerfile: `backend/Dockerfile` (build from repo root)
   - Health check path: `/api/health`
   - `render.yaml` is included as a Render blueprint.
3. Set environment variables in the provider dashboard (never commit `.env`):

   | Variable | Production value |
   | -------- | ---------------- |
   | `NODE_ENV` | `production` |
   | `PORT` | provided by host (Render sets `$PORT` automatically) |
   | `CORS_ORIGINS` | `https://startdownloading.com` only |
   | `YTDLP_BIN` | `yt-dlp` |
   | `TEMP_DIR` | `./temp` |

4. Point DNS for `startdownloading.com` at the provider (see provider's
   "Custom Domain" panel for the exact `A`/`CNAME` values — do not invent them),
   then verify `https://startdownloading.com/api/health` → `{ "ok": true }`.

Full details: `DEPLOY.md`. Security model: `SECURITY.md`.

## GitHub push (first time)

```bash
git init
git add .
git status            # verify no .env / temp / node_modules is listed
git commit -m "StartDownloading production-ready (Node + static frontend)"
git branch -M main
git remote add origin https://github.com/<you>/startdownloading.git
git push -u origin main
```

`.env`, `backend/temp/`, and `node_modules/` are git-ignored and never pushed.
