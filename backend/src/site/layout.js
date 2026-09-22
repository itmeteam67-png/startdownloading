'use strict';

/* Shared layout: global header + GlobalFooter + SEO head.
   Single source of truth for all navigation — the footer markup here is
   mirrored verbatim into index.html (homepage). Same design tokens. */

const { SITE_ORIGIN, PAGES, ARTICLES, CATEGORY_LABEL, articlesIn } = require('./siteMap');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Resolve [label](/path) mini-links into anchors. */
function rich(text) {
  return esc(text).replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

const FOOTER_COLS = [
  {
    id: 'brand', title: 'StartDownloading', links: [
      { href: '/', label: 'Home' },
      { href: '/video-downloader', label: 'Video Downloader' },
    ],
    blurb: 'Fast, simple and free video downloading tools.',
  },
  {
    id: 'youtube', title: 'YouTube', links: [
      { href: '/youtube-downloader', label: 'YouTube Downloader' },
      { href: '/youtube-video-downloader', label: 'YouTube Video Downloader' },
      { href: '/youtube-to-mp4', label: 'YouTube to MP4' },
      { href: '/youtube-shorts-downloader', label: 'YouTube Shorts Downloader' },
      { href: '/youtube-playlist-downloader', label: 'YouTube Playlist Downloader' },
      { href: '/youtube-to-mp3', label: 'YouTube to MP3' },
    ],
  },
  {
    id: 'tiktok', title: 'TikTok', links: [
      { href: '/tiktok-downloader', label: 'TikTok Downloader' },
      { href: '/tiktok-video-downloader', label: 'TikTok Video Downloader' },
      { href: '/tiktok-no-watermark', label: 'TikTok No Watermark' },
      { href: '/tiktok-mp4', label: 'TikTok MP4' },
      { href: '/tiktok-mp3', label: 'TikTok MP3' },
      { href: '/tiktok-photo-downloader', label: 'TikTok Photo Downloader' },
    ],
  },
  {
    id: 'instagram', title: 'Instagram', links: [
      { href: '/instagram-downloader', label: 'Instagram Downloader' },
      { href: '/instagram-video-downloader', label: 'Instagram Video Downloader' },
      { href: '/instagram-reels-downloader', label: 'Instagram Reels Downloader' },
      { href: '/instagram-story-downloader', label: 'Instagram Story Downloader' },
      { href: '/instagram-photo-downloader', label: 'Instagram Photo Downloader' },
      { href: '/instagram-thumbnail-downloader', label: 'Instagram Thumbnail Downloader' },
    ],
  },
  {
    id: 'twitter', title: 'Twitter / X', links: [
      { href: '/twitter-video-downloader', label: 'Twitter Video Downloader' },
      { href: '/x-video-downloader', label: 'X Video Downloader' },
      { href: '/twitter-gif-downloader', label: 'Twitter GIF Downloader' },
      { href: '/twitter-mp4-downloader', label: 'Twitter MP4 Downloader' },
      { href: '/download-twitter-videos', label: 'Download Twitter Videos' },
    ],
  },
  {
    id: 'knowledge', title: 'Knowledge Center', links: [
      { href: '/knowledge/how-to-guides', label: 'How-To Guides' },
      { href: '/knowledge/video-guides', label: 'Video Guides' },
      { href: '/knowledge/formats-quality', label: 'Formats & Quality' },
      { href: '/knowledge/troubleshooting', label: 'Troubleshooting' },
      { href: '/knowledge/guides', label: 'Guides' },
    ],
  },
];

const CSS = `
:root{--bg-0:#060b1c;--bg-1:#080e22;--surface:#0d1640;--text:#fff;--muted:#b9c6dc;--muted-2:#9aa9c2;--cyan:#2fb3ff;--blue:#2aa9f8;--purple:#7a4df5;--pink:#c03ff0;--border-soft:rgba(255,255,255,.07);--font:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg-0);color:var(--text);overflow-x:hidden;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;min-height:100vh}
a{text-decoration:none}
img{max-width:100%}
.skip-link{position:absolute;left:16px;top:-48px;z-index:200;background:#fff;color:#0a1230;font-weight:700;font-size:14px;padding:10px 18px;border-radius:999px;transition:top .15s ease}
.skip-link:focus{top:12px}
.site-header{background:rgba(7,12,29,.9);border-bottom:1px solid var(--border-soft);position:relative;z-index:50;backdrop-filter:blur(12px)}
.navbar{height:72px;max-width:1280px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.logo-mark{width:34px;height:34px;border-radius:11px 11px 11px 4px;background:linear-gradient(135deg,#2ea6ff 0%,#4a5cf5 55%,#7a35f5 100%);display:inline-flex;align-items:center;justify-content:center;transform:skewX(-5deg);box-shadow:0 0 20px rgba(60,120,255,.5)}
.logo-word{font-size:22px;font-weight:800;letter-spacing:-.5px;white-space:nowrap;color:#fff}
.logo-word .g{background:linear-gradient(90deg,#2aa9f8 0%,#6a5cff 45%,#c040f0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.main-nav ul{display:flex;align-items:center;gap:32px;list-style:none}
.main-nav a{color:#c2cddf;font-size:15px;font-weight:500;padding:10px 2px}
.main-nav a:hover{color:#fff}
.main-nav a[aria-current="page"]{color:var(--cyan)}
.navbar-toggler{display:none}
main{flex:1;width:100%}
.page{max-width:860px;margin:0 auto;padding:40px 24px 64px}
.crumbs{font-size:13.5px;color:var(--muted-2);margin-bottom:18px;line-height:1.8}
.crumbs a{color:var(--cyan)}
.crumbs a:hover{text-decoration:underline}
.crumbs .sep{margin:0 8px;color:#5b6b87}
.page h1{font-size:clamp(30px,4.5vw,44px);font-weight:900;letter-spacing:-1px;line-height:1.1;margin-bottom:14px}
.page .lede{font-size:18px;color:var(--muted);line-height:1.6;margin-bottom:26px}
.prose h2{font-size:21px;font-weight:800;margin:30px 0 10px;letter-spacing:-.3px}
.prose p{color:var(--muted);font-size:16px;line-height:1.65;margin-bottom:12px}
.prose a{color:var(--cyan)}
.prose a:hover{text-decoration:underline}
.prose ul{margin:6px 0 16px 22px;color:var(--muted);font-size:16px;line-height:1.65}
.notice{margin:22px 0;padding:16px 18px;border-radius:14px;background:rgba(42,169,248,.08);border:1px solid rgba(80,140,255,.4);font-size:14.5px;line-height:1.6;color:#d3dcec}
.notice strong{display:block;margin-bottom:4px;color:#fff}
.faq{margin-top:8px}
.faq h3{font-size:16.5px;font-weight:700;margin:18px 0 6px}
.faq p{color:var(--muted);font-size:15px;line-height:1.6}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:18px}
.card{display:block;padding:16px 18px;border-radius:14px;background:rgba(13,22,46,.92);border:1px solid rgba(80,140,255,.25);color:var(--text)}
.card:hover{border-color:rgba(90,160,255,.7)}
.card strong{display:block;font-size:15.5px;margin-bottom:4px}
.card span{font-size:13.5px;color:var(--muted-2);line-height:1.5}
.related{margin-top:44px;padding-top:24px;border-top:1px solid var(--border-soft)}
.related h2{font-size:18px;font-weight:800;margin-bottom:12px}
.related ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.related a{display:inline-block;padding:9px 16px;min-height:44px;line-height:26px;border-radius:999px;font-size:14px;font-weight:600;color:#cdd7e8;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14)}
.related a:hover{color:#fff;border-color:rgba(90,160,255,.7)}
/* downloader (mirrors homepage tokens) */
.dl-box{margin:26px 0;padding:20px;border-radius:20px;background:rgba(13,22,46,.92);border:1px solid rgba(80,140,255,.45);box-shadow:0 10px 50px rgba(0,20,80,.5),0 0 30px rgba(60,120,255,.18)}
.dl-row{display:flex;gap:10px;align-items:center;background:rgba(13,22,46,.92);border:1px solid rgba(80,140,255,.45);border-radius:999px;padding:10px 10px 10px 22px}
.dl-row input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font-size:16px;font-family:inherit}
.dl-row input::placeholder{color:#8494ad}
.sd-btn{display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;color:#fff;font-weight:700;border-radius:999px;background:linear-gradient(90deg,#22a8fd 0%,#5b5bf5 55%,#b44cf0 100%);font-size:16px;padding:13px 30px;white-space:nowrap;font-family:inherit}
.sd-btn:hover{filter:brightness(1.08)}
.sd-btn[disabled]{cursor:not-allowed;opacity:.75}
.dl-status{min-height:22px;margin-top:10px;font-size:13.5px;color:var(--muted);text-align:center}
.dl-status.err{color:#ff9aa8}.dl-status.ok{color:#8fe3c0}.dl-status.info{color:#8ecbff}
.spinner{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;animation:spin .7s linear infinite;display:inline-block;vertical-align:-4px;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.vr{margin-top:16px;display:flex;gap:14px;align-items:flex-start}
.vr[hidden]{display:none}
.vr img{width:168px;height:94px;border-radius:12px;object-fit:cover;background:#0a1230;border:1px solid rgba(255,255,255,.1)}
.vr .t{font-size:15.5px;font-weight:700;line-height:1.4}
.vr .m{font-size:13px;color:var(--muted);margin-top:4px}
.quals{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.quals label{position:relative}
.quals input{position:absolute;opacity:0}
.quals span{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:700;color:#cdd7e8;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);cursor:pointer}
.quals small{font-weight:500;color:#9aa9c2;margin-left:6px;font-size:12px}
.quals input:checked+span{color:#fff;border-color:rgba(90,160,255,.8);background:linear-gradient(90deg,rgba(34,168,253,.25),rgba(90,91,245,.25),rgba(180,76,240,.25))}
.quals input:focus-visible+span{outline:2px solid var(--cyan);outline-offset:2px}
/* footer */
.site-footer{background:#05081a;border-top:1px solid var(--border-soft);margin-top:auto}
.foot-grid{max-width:1280px;margin:0 auto;padding:52px 32px 8px;display:grid;grid-template-columns:1.3fr repeat(5,1fr);gap:32px}
.foot-brand p{color:var(--muted-2);font-size:14px;line-height:1.6;margin:12px 0 16px;max-width:230px}
.foot-logo{margin-bottom:2px}
.foot-logo .logo-word{font-size:22px}
.foot-col h2{font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#8fa0bd;margin-bottom:4px}
.foot-col ul{list-style:none}
.foot-col a{display:inline-flex;align-items:center;min-height:44px;color:#c2cddf;font-size:14.5px;font-weight:500;line-height:1.4;padding:6px 0}
.foot-col a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}
.foot-col a[aria-current="page"]{color:var(--cyan);font-weight:700}
.foot-toggle{display:none}
.foot-bottom{border-top:1px solid var(--border-soft);margin-top:28px}
.foot-bottom-in{max-width:1280px;margin:0 auto;padding:20px 32px;display:flex;justify-content:center;color:#7d8ca8;font-size:13.5px}
:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
@media(max-width:1100px){.foot-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:991.98px){
.navbar{height:auto;min-height:64px;padding:12px 16px}
.navbar-toggler{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);border-radius:12px;cursor:pointer;color:#dbe6f7;font-size:20px;font-family:inherit}
.navbar-collapse{display:none;width:100%;flex-direction:column;align-items:stretch;background:rgba(10,18,48,.98);border-bottom:1px solid var(--border-soft);padding:14px 4px 18px}
.navbar-collapse.open{display:flex}
.main-nav ul{flex-direction:column;align-items:stretch;gap:2px}
.main-nav a{display:block;min-height:44px;line-height:44px}
}
@media(max-width:767.98px){
.foot-grid{grid-template-columns:1fr;gap:0;padding:32px 20px 8px}
.foot-col{border-bottom:1px solid var(--border-soft)}
.foot-brand{border-bottom:1px solid var(--border-soft);padding-bottom:20px;margin-bottom:8px}
.foot-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;background:none;border:0;color:#fff;font-size:15px;font-weight:800;min-height:52px;cursor:pointer;font-family:inherit;text-align:left}
.foot-toggle .chev{color:var(--cyan);font-size:18px;transition:transform .2s ease}
.foot-col.open .foot-toggle .chev{transform:rotate(180deg)}
.foot-col .foot-links{display:block;max-height:0;overflow:hidden;visibility:hidden;padding-bottom:0;transition:max-height .25s ease,visibility 0s linear .25s}
.foot-col.open .foot-links{max-height:480px;visibility:visible;padding-bottom:12px;transition:max-height .28s ease,visibility 0s}
.dl-row{flex-wrap:wrap;border-radius:26px;padding:14px}
.dl-row input{flex-basis:100%;min-height:44px;padding:10px 8px}
.sd-btn{width:100%;justify-content:center;min-height:52px}
.vr{flex-direction:column}.vr img{width:100%;height:160px}
.page{padding:28px 18px 48px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}html{scroll-behavior:auto}}
`;

function header(activePath) {
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/video-downloader', label: 'Video Downloader' },
    { href: '/knowledge', label: 'Knowledge Center' },
  ];
  const items = nav.map((n) => {
    const cur = n.href === activePath ? ' aria-current="page"' : '';
    return `<li><a href="${n.href}"${cur}>${esc(n.label)}</a></li>`;
  }).join('');
  return `<header class="site-header"><div class="navbar" style="flex-wrap:wrap">
<a class="logo" href="/" aria-label="StartDownloading — home"><span class="logo-mark" aria-hidden="true"><svg width="15" height="16" viewBox="0 0 14 16" fill="none"><path d="M1 1.8v12.4c0 .9 1 1.5 1.8 1L13.4 9a1.2 1.2 0 0 0 0-2L2.8.8c-.8-.5-1.8.1-1.8 1z" fill="#fff"/></svg></span><span class="logo-word">Start<span class="g">Downloading</span></span></a>
<button class="navbar-toggler" id="menuToggler" type="button" aria-controls="mainMenu" aria-expanded="false" aria-label="Toggle navigation">☰</button>
<div class="navbar-collapse" id="mainMenu"><nav class="main-nav" aria-label="Main navigation"><ul>${items}</ul></nav></div>
</div></header>`;
}

function footer(activePath, year, sectionPath) {
  const cols = FOOTER_COLS.map((col) => {
    const links = col.links.map((l) => {
      let cur = '';
      if (l.href === activePath) cur = ' aria-current="page"';
      // Article pages highlight their parent category as the current section.
      else if (sectionPath && l.href === sectionPath) cur = ' aria-current="true"';
      return `<li><a href="${l.href}"${cur}>${esc(l.label)}</a></li>`;
    }).join('');
    if (col.id === 'brand') {
      return `<div class="foot-col foot-brand">`
        + `<a class="logo foot-logo" href="/" aria-label="StartDownloading — home"><span class="logo-mark" aria-hidden="true"><svg width="15" height="16" viewBox="0 0 14 16" fill="none"><path d="M1 1.8v12.4c0 .9 1 1.5 1.8 1L13.4 9a1.2 1.2 0 0 0 0-2L2.8.8c-.8-.5-1.8.1-1.8 1z" fill="#fff"/></svg></span><span class="logo-word">Start<span class="g">Downloading</span></span></a>`
        + `<p>${esc(col.blurb)}</p><ul class="foot-links" id="fl-brand">${links}</ul></div>`;
    }
    return `<div class="foot-col" data-col="${col.id}"><h2><button class="foot-toggle" type="button" aria-expanded="true" aria-controls="fl-${col.id}">${esc(col.title)}<span class="chev" aria-hidden="true">⌄</span></button><span class="foot-h" aria-hidden="true">${esc(col.title)}</span></h2><ul class="foot-links" id="fl-${col.id}">${links}</ul></div>`;
  }).join('');
  return `<footer class="site-footer"><nav aria-label="Footer"><div class="foot-grid">${cols}</div></nav>`
    + `<div class="foot-bottom"><div class="foot-bottom-in"><span>© ${year} StartDownloading. All rights reserved.</span></div></div></footer>`;
}

const FOOT_CSS_EXTRA = `<style>@media(min-width:768px){.foot-toggle{display:none}.foot-links{display:block!important}.foot-h{display:none}}@media(max-width:767.98px){.foot-col h2 .foot-h{display:none}}</style>`;

function crumbsHtml(crumbs) {
  if (!crumbs || !crumbs.length) return '';
  const items = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const inner = c.href && !last ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span aria-current="${last ? 'page' : 'false'}">${esc(c.label)}</span>`;
    return `<span>${inner}</span>${last ? '' : '<span class="sep" aria-hidden="true">›</span>'}`;
  }).join('');
  return `<nav class="crumbs" aria-label="Breadcrumb">${items}</nav>`;
}

function breadcrumbJsonLd(crumbs) {
  if (!crumbs || crumbs.length < 2) return '';
  const items = crumbs.map((c, i) => ({
    '@type': 'ListItem', position: i + 1, name: c.label,
    ...(c.href || i < crumbs.length - 1 ? { item: SITE_ORIGIN + (c.href || '') } : {}),
  }));
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })}</script>`;
}

function downloaderBlock() {
  return `<div class="dl-box" id="dlBox">
<form id="dlForm" autocomplete="off"><div class="dl-row">
<input id="urlInput" type="url" inputmode="url" placeholder="Paste your video link here..." aria-label="Paste your video link here" autocomplete="off" spellcheck="false">
<button class="sd-btn" id="dlBtn" type="submit"><span id="dlBtnLabel">Download</span></button>
</div></form>
<p class="dl-status" id="dlStatus" role="status" aria-live="polite"></p>
<div class="vr" id="vrBox" hidden>
<img id="vrThumb" alt="">
<div style="flex:1;min-width:0"><div class="t" id="vrTitle"></div><div class="m" id="vrMeta"></div>
<div class="quals" id="vrQuals" role="radiogroup" aria-label="Available qualities"></div>
<div style="margin-top:14px"><button class="sd-btn" id="vrGo" type="button"><span id="vrGoLabel">Download</span></button></div>
<p class="m" id="vrNote"></p><p class="dl-status err" id="vrErr" role="alert" hidden></p>
</div></div></div>`;
}

function baseScripts() {
  return `<script>(function(){"use strict";
var t=document.getElementById("menuToggler"),m=document.getElementById("mainMenu");
if(t&&m){t.addEventListener("click",function(){var o=m.classList.toggle("open");t.setAttribute("aria-expanded",o?"true":"false");});}
// footer accordion (mobile only): single-open state — opening one section
// closes the previous; clicking the open section closes it. Desktop keeps
// all columns open. No-JS keeps everything visible.
var activeSection=null;
function setActiveFoot(id){activeSection=id;
document.querySelectorAll(".foot-col[data-col]").forEach(function(c){
var open=id&&c.getAttribute("data-col")===id;
c.classList.toggle("open",!!open);
var b=c.querySelector(".foot-toggle");if(b)b.setAttribute("aria-expanded",open?"true":"false");});}
function fitFoot(){var small=window.matchMedia("(max-width:767.98px)").matches;
if(!small){document.querySelectorAll(".foot-col[data-col]").forEach(function(c){c.classList.add("open");
var b=c.querySelector(".foot-toggle");if(b)b.setAttribute("aria-expanded","true");});}
else{setActiveFoot(activeSection);}}
document.querySelectorAll(".foot-col[data-col] .foot-toggle").forEach(function(b){b.addEventListener("click",function(){var c=b.closest(".foot-col");
if(!c)return;var id=c.getAttribute("data-col");setActiveFoot(activeSection===id?null:id);});});
fitFoot();window.addEventListener("resize",fitFoot);
})();</script>`;
}

function downloaderScript() {
  return `<script>(function(){"use strict";
var form=document.getElementById("dlForm");if(!form)return;
var input=document.getElementById("urlInput"),btn=document.getElementById("dlBtn"),lbl=document.getElementById("dlBtnLabel"),
st=document.getElementById("dlStatus"),box=document.getElementById("vrBox"),th=document.getElementById("vrThumb"),
ti=document.getElementById("vrTitle"),me=document.getElementById("vrMeta"),qu=document.getElementById("vrQuals"),
go=document.getElementById("vrGo"),gol=document.getElementById("vrGoLabel"),note=document.getElementById("vrNote"),er=document.getElementById("vrErr");
var cur=null,sel=null,busy=false;
function say(m,c){st.textContent=m;st.className="dl-status"+(c?" "+c:"");}
function fmt(n){if(!(n>0))return null;if(n<1024)return n+" B";var u=["KB","MB","GB"],v=n,i=-1;do{v/=1024;i++;}while(v>=1024&&i<u.length-1);return (v>=100?Math.round(v):v.toFixed(1))+" "+u[i];}
function post(p,b,t){var c=null,tid=null;try{c=new AbortController();tid=setTimeout(function(){c.abort();},t||120000);}catch(e){}
return fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b),signal:c?c.signal:undefined}).then(function(r){if(tid)clearTimeout(tid);
return r.json().then(function(d){return{status:r.status,data:d||{}};}).catch(function(){return{status:r.status,data:{}};});}).catch(function(e){if(tid)clearTimeout(tid);
return{status:0,data:{success:false,error:{code:e&&e.name==="AbortError"?"PROCESSING_TIMEOUT":"NETWORK_ERROR"}}};});}
var COPY={INVALID_REQUEST:"Please enter a valid video URL.",INVALID_URL:"That link doesn\\u2019t look valid. Check it and try again.",UNSUPPORTED_PLATFORM:"This platform is not currently supported.",PRIVATE_CONTENT:"This video isn\\u2019t publicly downloadable.",VIDEO_PRIVATE:"This video isn\\u2019t publicly downloadable.",VIDEO_NOT_FOUND:"This video was not found or is unavailable.",FORMAT_NOT_AVAILABLE:"The selected quality is unavailable — pick another.",MERGE_FAILED:"Merging failed — try a lower quality.",PROCESSING_FAILED:"We couldn\\u2019t process this video. Try again.",PROCESSING_TIMEOUT:"The request took too long and was stopped.",OUTPUT_TOO_LARGE:"The file is too large.",FILE_TOO_LARGE:"The file is too large.",RATE_LIMITED:"Too many requests — try again later.",NETWORK_ERROR:"Couldn\\u2019t reach the service. Try again.",SERVER_ERROR:"Something went wrong. Try again."};
function err(c){return COPY[c]||COPY.SERVER_ERROR;}
form.addEventListener("submit",function(e){e.preventDefault();if(busy)return;
var u=input.value.trim();if(!u){say("Please paste a video link first.","err");return;}
busy=true;btn.disabled=true;lbl.innerHTML='<span class="spinner" aria-hidden="true"></span>Analyzing\\u2026';say("Analyzing video\\u2026","info");box.hidden=true;er.hidden=true;
post("/api/video/info",{url:u},100000).then(function(r){busy=false;btn.disabled=false;lbl.textContent="Download";
var d=r.data||{};if(r.status===200&&d.success&&d.data&&Array.isArray(d.data.formats)){var info=d.data;cur={url:u,info:info};
th.src=info.thumbnail||"";th.alt=info.title||"Video thumbnail";th.style.display=info.thumbnail?"":"none";
ti.textContent=info.title||"Untitled video";me.textContent=(info.platform||"")+(info.duration?" \\u2022 "+info.duration:"");
qu.innerHTML="";sel=null;info.formats.forEach(function(f,i){var l=document.createElement("label");var o=document.createElement("input");
o.type="radio";o.name="q";o.value=f.formatId;if(i===0){o.checked=true;sel=f.formatId;}
o.addEventListener("change",function(){sel=o.value;er.hidden=true;});
var s=document.createElement("span");s.textContent=(f.qualityLabel||f.quality)+" "+(f.extension||"").toUpperCase();
var z=fmt(f.filesize);if(z){var sm=document.createElement("small");sm.textContent=z;s.appendChild(sm);}
if(f.needsMerge){var mg=document.createElement("small");mg.textContent="+ audio";s.appendChild(mg);}
l.appendChild(o);l.appendChild(s);qu.appendChild(l);});
note.textContent=info.formats.length+" real qualities found — pick one, then press Download.";
box.hidden=false;say("Video found — choose a quality.","ok");return;}
var code=(d.error&&d.error.code)||"SERVER_ERROR";say(err(code),"err");});});
go.addEventListener("click",function(){if(!cur||!sel||go.disabled)return;er.hidden=true;go.disabled=true;gol.innerHTML='<span class="spinner" aria-hidden="true"></span>Preparing\\u2026';say("Preparing your download\\u2026","info");
post("/api/video/download",{url:cur.url,formatId:sel},130000).then(function(r){go.disabled=false;gol.textContent="Download";
var d=r.data||{};if(r.status===200&&d.success&&d.downloadUrl){say("Download ready — your file has started.","ok");
note.textContent="Download ready ("+(d.quality||"selected quality")+").";
fetch(d.downloadUrl).then(function(rs){if(!rs.ok)throw 0;return rs.blob();}).then(function(b){var u=URL.createObjectURL(b);
var a=document.createElement("a");a.href=u;a.download=d.filename||"video";document.body.appendChild(a);a.click();
setTimeout(function(){URL.revokeObjectURL(u);a.remove();},5000);}).catch(function(){window.location.href=d.downloadUrl;});return;}
var code=(d.error&&d.error.code)||"SERVER_ERROR";er.textContent=err(code);er.hidden=false;say(err(code),"err");});});
})();</script>`;
}

function renderPage(page, opts) {
  const o = opts || {};
  const year = new Date().getFullYear();
  const canonical = SITE_ORIGIN + page.path;
  const desc = esc(page.description);
  const body = o.body || '';
  const extraScripts = o.downloader ? downloaderScript() : '';
  const sectionPath = o.sectionPath || null;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">`
    + `<title>${esc(page.title)}</title><meta name="description" content="${desc}">`
    + `<link rel="canonical" href="${canonical}"><meta name="robots" content="index, follow">`
    + `<meta property="og:type" content="website"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${canonical}">`
    + `<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(page.title)}"><meta name="twitter:description" content="${desc}">`
    + `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 34'%3E%3Crect width='34' height='34' rx='10' fill='%234a5cf5'/%3E%3Cpath d='M12 9.5v15l12-7.5z' fill='%23fff'/%3E%3C/svg%3E">`
    + `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`
    + breadcrumbJsonLd(page.crumbs)
    + `<style>${CSS}</style>${FOOT_CSS_EXTRA}`
    + `<noscript><style>@media(max-width:767.98px){.foot-col .foot-links{max-height:none!important;visibility:visible!important}.foot-toggle{display:none!important}.foot-col h2 .foot-h{display:inline!important}}</style></noscript></head><body>`
    + `<a class="skip-link" href="#content">Skip to content</a>`
    + header(page.path)
    + `<main id="content"><div class="page">${crumbsHtml(page.crumbs)}<h1>${esc(page.h1)}</h1><p class="lede">${esc(page.intro)}</p>${body}</div></main>`
    + footer(page.path, year, sectionPath)
    + baseScripts() + extraScripts + `</body></html>`;
}

function relatedBlock(links) {
  if (!links || !links.length) return '';
  const items = links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join('');
  return `<div class="related"><h2>Related</h2><ul>${items}</ul></div>`;
}

module.exports = { esc, rich, renderPage, relatedBlock, downloaderBlock, FOOTER_COLS, SITE_ORIGIN };
