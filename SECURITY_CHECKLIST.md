# StartDownloading — Security Checklist

Verified by automated tests where marked. Commands run from `backend/`.

- [x] Environment secrets protected (no secrets exist by design; `.env` git-ignored) — `test:security2` A2
- [x] `.env` excluded from Git (root + backend `.gitignore`) — inspected
- [x] Security headers configured (CSP, nosniff, SAMEORIGIN framing, referrer, permissions, HSTS, no powered-by) — `test:security2` B1–B3
- [x] HTTPS required in production (redirect + HSTS; proxy terminates TLS) — code + DEPLOY.md
- [x] Input validation implemented (URLs, bodies, format IDs, lengths, content types) — `npm test` + `test:security2` C1–C4
- [x] SSRF protection implemented (hostname + resolved-IP, literals + DNS) — `npm test` + `test:security2` C6
- [x] Redirect validation implemented (engine-internal with TLS ON, fail-closed; hop-by-hop pre-validation NOT TESTED — see SECURITY.md)
- [x] Safe process execution (`spawn` argv, `shell:false`, fixed flags) — inspected + `npm test`
- [x] Command injection protection (formatId allowlist + membership check) — `test:security2` C4
- [x] Path traversal protection (server filenames, containment, 24-hex IDs) — `npm test` + `test:security2` A3/C5
- [x] File security (ext allowlist, verification, attachment disposition) — code + real-download probes (Phase 7)
- [x] Download size limits (`MAX_DOWNLOAD_BYTES`) — config + engine enforces
- [x] Timeouts (socket, info, download, ffmpeg via engine timeout) — config + `test:security2` honors 504 path
- [x] Rate limiting (general + strict download + site budgets) — `npm test` + `test:security2` D2
- [x] Concurrency limits (gate saturates/releases) — `test:security2` D1
- [x] CORS configured (explicit allowlist, never `*`) — config + code
- [x] XSS protection (escaping, textContent, no inline handlers, audited sink) — `test:quality` + inspection
- [x] SQL injection protection if DB exists — N/A (no database; none added)
- [x] CSRF protection where applicable — N/A (no auth/cookies/sessions; documented)
- [x] Secure cookies where applicable — N/A (no cookies set; documented)
- [x] Error sanitization (central handler, no stacks/paths/commands) — `npm test` + `test:security2` C3/C7
- [x] Safe logging (request ID + redacted host only) — code + log inspection
- [x] Dependency audit (`npm audit`: 0 vulnerabilities; minimal mainstream set + lockfile) — executed 2026-09-16
- [x] Debug disabled in production (no debug endpoints, panels, source maps, verbose errors) — inspected
- [x] robots.txt reviewed (`Allow: /`, `Disallow: /api/`, `/backend/`, sitemap) — `test:security2` E1
- [x] sitemap.xml reviewed (58 public URLs only, no internals) — `test:site`
- [x] Private endpoints protected (no private endpoints exist; `/api/file/:id` is unguessable + TTL-bound) — `test:security2` C5
- [x] Temporary files cleaned (TTL + sweeps + post-failure re-sweep) — code + `npm test` cleanup test
- [x] Unauthorized file access blocked (containment + 404, no cross-user access) — `test:security2` C5
- [x] Security tests executed (`test:security` 28 + `test:security2` 16 + `test:quality` 17 + `test:site` 117 + `test:footer`) — all PASS
