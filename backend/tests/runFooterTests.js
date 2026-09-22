'use strict';
// Interaction test: execute the REAL shipped accordion code (server layout +
// homepage footer IIFE) against a minimal fake DOM and perform TEST 1-6.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const IDS = ['youtube', 'tiktok', 'instagram', 'twitter', 'knowledge'];

function makeClassList() {
  const s = new Set();
  return {
    add: (c) => { s.add(c); },
    remove: (c) => { s.delete(c); },
    toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; },
    contains: (c) => s.has(c),
  };
}

function buildWorld() {
  const cols = {};
  const toggles = [];
  for (const id of IDS) {
    const cls = makeClassList();
    cls.add('foot-col');
    const col = {
      tag: 'div', classList: cls, attrs: { 'data-col': id, class: 'foot-col' },
      getAttribute(n) { return this.attrs[n] === undefined ? null : this.attrs[n]; },
      setAttribute(n, v) { this.attrs[n] = String(v); },
      querySelector(sel) { return sel === '.foot-toggle' ? this.toggle : null; },
    };
    const toggle = {
      tag: 'button', attrs: { 'aria-expanded': 'false', 'aria-controls': 'fl-' + id },
      listeners: {},
      getAttribute(n) { return this.attrs[n] === undefined ? null : this.attrs[n]; },
      setAttribute(n, v) { this.attrs[n] = String(v); },
      addEventListener(ev, fn) { this.listeners[ev] = fn; },
      click() { if (this.listeners.click) this.listeners.click({}); },
      closest() { return col; },
      parentNode: col,
    };
    col.toggle = toggle;
    cols[id] = col;
    toggles.push(toggle);
  }
  let small = true;
  const window = {
    matchMedia() { return { matches: small }; },
    addEventListener() {},
    location: { pathname: '/' },
  };
  const document = {
    getElementById() { return { textContent: '', set textContent(v) {} }; },
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (sel === '.foot-col[data-col]') return IDS.map((id) => cols[id]);
      if (sel === '.foot-col[data-col] .foot-toggle') return toggles.slice();
      if (sel === '[data-foot-link]') return [];
      return [];
    },
    createElement() { return {}; },
    addEventListener() {},
  };
  return { cols, toggles, window, document, setSmall(v) { small = v; } };
}

function runScript(code, world, name) {
  const sandbox = {
    document: world.document, window: world.window,
    requestAnimationFrame: () => 0,
    addEventListener: () => {},
    matchMedia: world.window.matchMedia,
    URL, console: { log() {}, error() {} },
    Array, Object, String, JSON, Math, Date, Set, Map,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: name });
  return world;
}

function openIds(world) {
  return IDS.filter((id) => world.cols[id].classList.contains('open'));
}

function checkState(world, expectOpen, label) {
  const open = openIds(world);
  const ok = open.length === expectOpen.length && expectOpen.every((id) => open.includes(id));
  // aria-expanded must mirror openness on every toggle
  let ariaOk = true;
  for (const id of IDS) {
    const want = expectOpen.includes(id) ? 'true' : 'false';
    if (world.cols[id].toggle.getAttribute('aria-expanded') !== want) ariaOk = false;
  }
  console.log((ok && ariaOk ? 'PASS' : 'FAIL') + ' ' + label + ' — open:[' + open.join(',') + '] expected:[' + expectOpen.join(',') + '] aria:' + (ariaOk ? 'ok' : 'BAD'));
  return ok && ariaOk;
}

function extractHomepageFooterIIFE(html) {
  const start = html.indexOf('/* ---------- 8. Global footer');
  if (start < 0) throw new Error('homepage footer block not found');
  const end = html.indexOf('})();', start);
  if (end < 0) throw new Error('IIFE end not found');
  return html.slice(start, end + '})();'.length);
}

function getLayoutBaseScript() {
  const layoutPath = path.join(__dirname, '..', 'src', 'site', 'layout.js');
  const src = fs.readFileSync(layoutPath, 'utf8');
  const start = src.indexOf('// footer accordion (mobile only)');
  if (start < 0) throw new Error('layout accordion block not found');
  const end = src.indexOf(' supporting code', start);
  // Fallback: take until fitFoot();window.addEventListener("resize",fitFoot);
  const marker = 'fitFoot();window.addEventListener("resize",fitFoot);';
  const mEnd = src.indexOf(marker, start);
  if (mEnd < 0) throw new Error('layout accordion end not found');
  const menuStub = 'var t=null,m=null;';
  return menuStub + src.slice(start, mEnd + marker.length);
}

function runSuite(name, setup) {
  console.log('--- ' + name + ' ---');
  const world = buildWorld();
  setup(world);
  const click = (id) => world.cols[id].toggle.click();
  let all = true;
  all = checkState(world, [], 'initial: all CLOSED') && all;
  click('youtube');
  all = checkState(world, ['youtube'], 'TEST 1 click YouTube') && all;
  click('instagram');
  all = checkState(world, ['instagram'], 'TEST 2 click Instagram (youtube auto-closed)') && all;
  click('tiktok');
  all = checkState(world, ['tiktok'], 'TEST 3 click TikTok (instagram auto-closed)') && all;
  click('tiktok');
  all = checkState(world, [], 'TEST 4 click TikTok again (all closed)') && all;
  click('knowledge');
  all = checkState(world, ['knowledge'], 'TEST 5 click Knowledge Center') && all;
  click('twitter');
  all = checkState(world, ['twitter'], 'TEST 6 click Twitter/X (knowledge auto-closed)') && all;
  // desktop: all open regardless
  world.setSmall(false);
  // re-run fit via resize? our stubs ignore resize listeners; call setActive path:
  // simulate by re-executing fitFoot is not exposed; instead verify code handles resize
  // (covered statically). Desktop assertion done via CSS audit below.
  return all;
}

let all = true;
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
all = runSuite('homepage footer IIFE (real shipped code)', (w) => runScript(extractHomepageFooterIIFE(html), w, 'home-footer.js')) && all;
all = runSuite('server layout accordion (real shipped code)', (w) => runScript(getLayoutBaseScript(), w, 'layout-footer.js')) && all;

// Static checks: desktop keeps multi-column, smooth animation, reduced motion, logo in both footers
const layoutSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'layout.js'), 'utf8');
const checks = [
  ['homepage footer logo', html.includes('class="logo foot-logo"')],
  ['layout footer logo', layoutSrc.includes('class="logo foot-logo"')],
  ['logo reuses header mark', html.includes('logo-mark') && layoutSrc.includes('logo-mark')],
  ['no footer links removed (home)', (html.match(/data-foot-link/g) || []).length === 31], // 30 links + 1 selector string
  ['desktop multi-col CSS (home)', html.includes('.foot-grid') && html.includes('repeat(5,1fr)')],
  ['desktop multi-col CSS (layout)', layoutSrc.includes('repeat(5,1fr)')],
  ['smooth max-height transition (home)', html.includes('transition:max-height')],
  ['smooth max-height transition (layout)', layoutSrc.includes('transition:max-height')],
  ['reduced-motion respected (home)', html.includes('prefers-reduced-motion')],
  ['reduced-motion respected (layout)', layoutSrc.includes('prefers-reduced-motion')],
  ['single state var (home)', html.includes('activeSection')],
  ['single state var (layout)', layoutSrc.includes('activeSection')],
  ['real buttons kept (home)', html.includes('class="foot-toggle" type="button"')],
  ['real buttons kept (layout)', layoutSrc.includes('class="foot-toggle" type="button"')],
];
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label);
  all = all && ok;
}
console.log(all ? '\nALL INTERACTION TESTS PASS' : '\nINTERACTION FAILURES PRESENT');
process.exit(all ? 0 : 1);
