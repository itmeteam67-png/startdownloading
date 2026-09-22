'use strict';

/* Site routes: every IA path serves exactly one real page with the global
   header/footer. Mounted before static + 404 so content pages resolve. */

const express = require('express');
const { PAGES, ARTICLES, CATEGORY_OF, articlesIn } = require('./siteMap');
const { rich, renderPage, relatedBlock, downloaderBlock } = require('./layout');
const { LIMIT_NOTES, DOWNLOADER_STEPS, PLATFORM_FAQ, ARTICLE_CONTENT } = require('./content');

const PLATFORM_DOWNLOADERS = {
  youtube: '/youtube-downloader',
  tiktok: '/tiktok-downloader',
  instagram: '/instagram-downloader',
  twitter: '/twitter-video-downloader',
};

const PLATFORM_ARTICLES = {
  youtube: [
    { href: '/knowledge/how-to-download-youtube-videos', label: 'How to Download YouTube Videos' },
    { href: '/knowledge/how-to-download-youtube-shorts', label: 'How to Download YouTube Shorts' },
    { href: '/knowledge/how-to-download-videos-in-hd', label: 'How to Download Videos in HD' },
  ],
  tiktok: [
    { href: '/knowledge/how-to-download-tiktok-videos', label: 'How to Download TikTok Videos' },
    { href: '/knowledge/how-to-download-tiktok-videos-without-watermark', label: 'TikTok Videos and Watermarks' },
  ],
  instagram: [
    { href: '/knowledge/how-to-download-instagram-videos', label: 'How to Download Instagram Videos' },
    { href: '/knowledge/how-to-download-instagram-reels', label: 'How to Download Instagram Reels' },
  ],
  twitter: [
    { href: '/knowledge/how-to-download-twitter-videos', label: 'How to Download Twitter Videos' },
  ],
};

function downloaderBody(page) {
  const plat = page.platform || 'generic';
  let html = '';
  const note = page.limited ? LIMIT_NOTES[page.limited] : null;
  if (note) html += `<div class="notice" role="note"><strong>${note.title}</strong>${note.text}</div>`;
  html += downloaderBlock();
  html += '<div class="prose"><h2>How it works</h2><ul>'
    + DOWNLOADER_STEPS.map((s) => `<li><strong>${s.h.replace(/^\d+\.\s*/, '')}</strong> — ${s.p}</li>`).join('')
    + '</ul></div>';
  const faqs = PLATFORM_FAQ[plat] || PLATFORM_FAQ.generic;
  html += '<div class="prose faq"><h2>Common questions</h2>'
    + faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('') + '</div>';
  // Related: sibling downloaders (same platform, max 4) + platform articles.
  const siblings = PAGES.filter((p) => p.kind === 'downloader' && (p.platform || null) === (page.platform || null) && p.path !== page.path)
    .slice(0, 4).map((p) => ({ href: p.path, label: p.nav }));
  const arts = PLATFORM_ARTICLES[plat] || [{ href: '/knowledge/how-to-download-videos', label: 'How to Download Videos' }];
  html += relatedBlock([...siblings, ...arts].slice(0, 6));
  return html;
}

function categoryBody(page) {
  const kids = articlesIn(page.category);
  const cards = kids.map((a) => `<a class="card" href="${a.path}"><strong>${a.nav}</strong><span>${a.description}</span></a>`).join('');
  let html = `<div class="card-grid">${cards}</div>`;
  const others = PAGES.filter((p) => p.kind === 'category' && p.path !== page.path)
    .map((p) => ({ href: p.path, label: p.nav }));
  html += relatedBlock([{ href: '/knowledge', label: 'Knowledge Center' }, ...others]);
  return html;
}

function hubBody() {
  const cats = PAGES.filter((p) => p.kind === 'category');
  const cards = cats.map((c) => {
    const n = articlesIn(c.category).length;
    return `<a class="card" href="${c.path}"><strong>${c.nav}</strong><span>${c.description} (${n} articles)</span></a>`;
  }).join('');
  return `<div class="card-grid">${cards}</div>`
    + relatedBlock([{ href: '/video-downloader', label: 'Video Downloader' }, { href: '/', label: 'Home' }]);
}

function articleBody(article) {
  const c = ARTICLE_CONTENT[article.slug];
  let html = '';
  if (c) {
    html += '<div class="prose">' + c.sections.map((s) => `<h2>${s.h}</h2>` + s.p.map((p) => `<p>${rich(p)}</p>`).join('')).join('') + '</div>';
  } else {
    // Internal marker: structure exists, content pending (never fake it).
    html += '<div class="notice" role="note"><strong>Content in progress</strong>This guide’s outline is live so navigation never breaks; the full text is being written.</div>';
  }
  const sibs = articlesIn(article.category).filter((a) => a.slug !== article.slug).slice(0, 3)
    .map((a) => ({ href: a.path, label: a.nav }));
  const dl = Object.entries(PLATFORM_DOWNLOADERS).find(([k]) => articleBodyPlatformHint(article) === k);
  const links = [
    ...(dl ? [{ href: dl[1], label: 'Open the downloader' }] : [{ href: '/video-downloader', label: 'Open the Video Downloader' }]),
    { href: CATEGORY_OF[article.category], label: 'All in this section' },
    ...sibs,
  ].slice(0, 5);
  html += relatedBlock(links);
  return html;
}

function articleBodyPlatformHint(article) {
  const s = article.slug;
  if (s.includes('youtube') || s.includes('shorts')) return 'youtube';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('instagram') || s.includes('reels')) return 'instagram';
  if (s.includes('twitter')) return 'twitter';
  return null;
}

function createSiteRouter() {
  const router = express.Router();
  const send = (page, body, sectionPath) => (req, res) => {
    res.status(200).type('html').send(renderPage(page, { body, downloader: page.kind === 'downloader', sectionPath: sectionPath || null }));
  };
  for (const page of PAGES) {
    let body;
    if (page.kind === 'downloader') body = downloaderBody(page);
    else if (page.kind === 'category') body = categoryBody(page);
    else body = hubBody();
    router.get(page.path, send(page, body));
  }
  for (const a of ARTICLES) {
    const catPath = CATEGORY_OF[a.category];
    const catPage = PAGES.find((p) => p.path === catPath);
    a.crumbs = [
      { label: 'Home', href: '/' },
      { label: 'Knowledge Center', href: '/knowledge' },
      { label: catPage ? catPage.nav : 'Guides', href: catPath },
      { label: a.nav },
    ];
    router.get(a.path, send(a, articleBody(a), catPath));
  }
  return router;
}

module.exports = { createSiteRouter };
