# StartDownloading production image.
# Node runtime + yt-dlp engine + ffmpeg (engine dependency for merges).
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Engine dependencies (Debian slim): python + ffmpeg, then yt-dlp.
# Build from the repository root: docker build -f backend/Dockerfile -t startdownloading .
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund

# Application: backend + static frontend (index.html, robots.txt, sitemap.xml).
COPY backend/ ./backend/
COPY index.html robots.txt sitemap.xml ./

# Least privilege: run as non-root; temp dir stays writable.
RUN mkdir -p /app/backend/temp && useradd -m -u 10001 app \
  && chown -R app:app /app
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||3001;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "backend/src/server.js"]
