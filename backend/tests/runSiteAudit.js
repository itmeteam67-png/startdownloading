'use strict';

/* Global-footer + navigation audit. Verifies EVERY IA route:
   200, exactly one H1, unique title/meta, canonical, footer with real links
   (no "#" / empty hrefs), aria-current on self, breadcrumbs on deep pages,
   and that every internal footer/related link resolves. Exits non-zero on failure.
   Run: npm run test:site */

const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/app');
const { ALL_ROUTES, ARTICLES, CATEGORY_OF } = require('../src/site/siteMap');
const { FOOTER_COLS } = require('../src/site/layout');

const FOOTER_TARGETS = new Set();
for (const c of FOOTER_COLS) for (const l of c.links) FOOTER_TARGETS.add(l.href);
FOOTER_TARGETS.add('/video-downloader');

const ROUTES = ['/', ...ALL_ROUTES];

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    }).on('error', reject);
  });
}

function hrefs(body) {
  const out = [];
  const re = /href="([^"]*)"/g;
  let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

(async () => {
  const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  let pass = 0;
  const fail = [];
  const titles = new Map();
  const descs = new Map();
  const internalTargets = new Set();
  try {
    for (const route of ROUTES) {
      const label = `GET ${route}`;
      try {
        const r = await get(port, route);
        assert.strictEqual(r.status, 200, `expected 200, got ${r.status}`);
        const b = r.body;
        // Exactly one H1.
        const h1s = [...b.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
        assert.strictEqual(h1s.length, 1, `expected 1 H1, got ${h1s.length}`);
        // Unique title + description.
        const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const desc = (b.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
        assert.ok(title.length > 20, 'title present');
        assert.ok(desc.length > 40, 'meta description present');
        if (titles.has(title)) throw new Error(`duplicate title with ${titles.get(title)}`);
        if (descs.has(desc)) throw new Error(`duplicate meta description with ${descs.get(desc)}`);
        titles.set(title, route);
        descs.set(desc, route);
        // Canonical matches route.
        const canon = (b.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
        assert.strictEqual(canon, `https://startdownloading.com${route === '/' ? '/' : route}`, `canonical ${canon}`);
        // Footer hub present with nav landmark.
        assert.ok(b.includes('site-footer'), 'footer present');
        assert.ok(b.includes('aria-label="Footer"'), 'footer nav landmark');
        // No fake links anywhere on the page.
        const hs = hrefs(b);
        assert.ok(!hs.includes('#'), 'no "#" href');
        assert.ok(!hs.includes(''), 'no empty href');
        assert.ok(!hs.some((h) => h === '#' || h.trim() === ''), 'no blank hrefs');
        // Current-page indicator: footer self-link for footer targets;
        // breadcrumb self + parent-section highlight for articles.
        if (route !== '/' && FOOTER_TARGETS.has(route)) {
          assert.ok(b.includes(`href="${route}" aria-current="page"`), 'aria-current on self link');
        }
        if (ARTICLES.some((a) => a.path === route)) {
          const cat = CATEGORY_OF[ARTICLES.find((a) => a.path === route).category];
          assert.ok(b.includes('aria-current="page"'), 'breadcrumb current page');
          assert.ok(b.includes(`href="${cat}" aria-current="true"`), 'parent section highlighted');
        }
        // Breadcrumbs on deep pages (2+ segments, server pages).
        if (route !== '/' && route.split('/').length > 2) {
          assert.ok(b.includes('aria-label="Breadcrumb"'), 'breadcrumbs present');
        }
        // Collect internal targets for resolution check.
        for (const h of hs) {
          if (h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/api/')) internalTargets.add(h.split('#')[0]);
        }
        pass += 1;
        console.log(`PASS ${label} — "${h1s[0][1].slice(0, 44)}"`);
      } catch (e) {
        fail.push(`${label}: ${e.message}`);
        console.log(`FAIL ${label}: ${e.message}`);
      }
    }

    // Every internal link target must resolve to 200.
    for (const target of [...internalTargets].sort()) {
      try {
        const r = await get(port, target);
        assert.strictEqual(r.status, 200, `got ${r.status}`);
        pass += 1;
        console.log(`PASS link ${target} resolves`);
      } catch (e) {
        fail.push(`link ${target}: ${e.message}`);
        console.log(`FAIL link ${target}: ${e.message}`);
      }
    }

    // Sitemap covers all routes.
    const fs = require('fs');
    const path = require('path');
    const sm = fs.readFileSync(path.join(__dirname, '..', '..', 'sitemap.xml'), 'utf8');
    const missing = ROUTES.filter((r) => !sm.includes(`<loc>https://startdownloading.com${r}</loc>`));
    assert.strictEqual(missing.length, 0, `sitemap missing: ${missing.join(', ')}`);
    pass += 1;
    console.log(`PASS sitemap covers all ${ROUTES.length} routes`);

    console.log(`\nSITE AUDIT: ${pass} passed, ${fail.length} failed (${ROUTES.length} routes, ${internalTargets.size} internal link targets)`);
    if (fail.length) {
      console.log('FAILURES:\n- ' + fail.join('\n- '));
      process.exitCode = 1;
    } else {
      console.log('ALL SITE ROUTES PASS — no broken links, no fake links, no missing pages');
    }
  } finally {
    server.close();
  }
})().catch((e) => { console.error('AUDIT FAILURE:', e); process.exit(1); });
