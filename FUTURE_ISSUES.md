# StartDownloading — Future Issues (non-blocking for MVP)

Recorded during Step 0 Gap Remediation. None of these block Railway MVP
deployment; all are tracked here instead of being fixed now.

## F-1. DNS rebinding TOCTOU between SSRF validation and engine fetch — NOT CRITICAL

- **Location:** `backend/src/utils/ssrf.js` (`assertUrlSafe`) vs.
  `backend/src/services/downloadEngine.js` / `infoEngine.js` (yt-dlp spawn).
- **Finding:** `assertUrlSafe` resolves the hostname via `dns.lookup` at
  request-validation time, but the engine process re-resolves the hostname
  later when it fetches. A hostile DNS owner could theoretically return a
  benign address at validation time and an internal address at fetch time
  (classic DNS-rebinding / TOCTOU race). Redirect chains inside yt-dlp
  likewise cannot be pre-validated hop-by-hop (already disclosed in
  `SECURITY.md`).
- **Realistic impact (why not critical):** every request must first pass the
  server-side platform allowlist (`src/platforms` + `downloadValidator.js` /
  `videoValidator.js`) — only known public video-platform hostnames reach
  the SSRF check at all. Weaponizing the race would require controlling DNS
  for one of those real platform domains, which is outside any realistic
  threat model for this app. Containment (temp-dir jailing, no credentials /
  ports / non-https schemes, fail-closed engine errors) further limits blast
  radius.
- **Recommended action (post-MVP):** re-test against an adversarial resolver;
  consider pinning validated IPs for the fetch (resolved-IP dialing) or
  egress-level deny rules for RFC-1918 / link-local / metadata ranges as
  defense-in-depth. Do not weaken the current checks in the meantime.

## F-2. Single-instance in-memory state under horizontal scaling — NOT CRITICAL

- **Location:** `backend/src/services/jobStore.js` (jobs + `activeCount`
  concurrency gate), `src/services/infoEngine.js` (10-min info cache),
  `src/middleware/rateLimit.js` (per-process in-memory budgets).
- **Finding:** job registry, `MAX_CONCURRENT_JOBS` gate, info cache, and
  rate-limit counters live in process memory. Railway runs a single
  instance for the MVP, so this is correct today — but adding replicas
  later would multiply effective concurrency/rate budgets per instance.
- **Recommended action (post-MVP):** when scaling past one instance,
  re-audit `MAX_CONCURRENT_JOBS` and rate limits per replica or introduce a
  shared coordinator. No change needed while single-instance.

## F-3. OUTPUT_TOO_LARGE (413) path has no live end-to-end coverage — NOT CRITICAL

- **Location:** `backend/src/services/downloadEngine.js:199-201`
  (`stat.size > config.maxDownloadBytes` → 413) and `--max-filesize`
  pre-filter (`downloadEngine.js:93`).
- **Finding (validated live 2026-09-22):** with a 5MB cap against a ~14.8MB
  144p fixture, yt-dlp's `--max-filesize` pre-filter refuses the download
  before any transfer, so the request fails closed with a controlled
  422/502 instead of reaching the post-download 413 guard. Oversized output
  therefore can never leak — but the 413 branch itself was verified by code
  inspection only, never executed. Drive-by observation: a cap-induced
  refusal is currently classified as `PRIVATE_CONTENT`, whose message
  ("isn't publicly downloadable") is slightly misleading for a size-limit
  refusal — cosmetic, still sanitized and fail-closed.
- **Recommended action (post-MVP):** add a unit test that seeds an
  oversized file in `TEMP_DIR` past the engine step (or a test-only size
  hook) to execute the 413 branch; optionally map max-filesize refusals to
  `OUTPUT_TOO_LARGE` for message accuracy.
