'use strict';
// Static guards over the shipped HTML/CSS that unit tests of core.js cannot reach.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'work.html', 'projects.html', 'contact.html'];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('every parallax target is free of a CSS transform it would clobber', () => {
  // initParallax assigns element.style.transform outright. If the same element
  // also has a transform in styles.css, one silently destroys the other.
  const css = read('styles.css');
  for (const page of PAGES) {
    const html = read(page);
    for (const m of html.matchAll(/class="([^"]*)"[^>]*data-parallax/g)) {
      for (const cls of m[1].split(/\s+/).filter(Boolean)) {
        const rule = new RegExp('\\.' + cls + '\\s*\\{[^}]*\\btransform\\s*:', 's');
        assert.ok(
          !rule.test(css),
          `.${cls} in ${page} has both data-parallax and a CSS transform`
        );
      }
    }
  }
});

test('every local href and src on every page resolves to a real file', () => {
  for (const page of PAGES) {
    const html = read(page);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const ref = m[1];
      if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) { continue; }
      const target = ref.split('#')[0];
      if (!target) { continue; }
      assert.ok(
        fs.existsSync(path.join(ROOT, target)),
        `${page} references missing file ${ref}`
      );
    }
  }
});

test('every page loads core.js before site.js, and its data before both', () => {
  for (const page of PAGES) {
    const html = read(page);
    const core = html.indexOf('js/core.js');
    const site = html.indexOf('js/site.js');
    assert.ok(core !== -1 && site !== -1, `${page} must load both scripts`);
    assert.ok(core < site, `${page} must load core.js before site.js`);
    for (const data of ['data/projects.js', 'data/work.js']) {
      const at = html.indexOf(data);
      if (at !== -1) {
        assert.ok(at < core, `${page} must load ${data} before core.js`);
      }
    }
  }
});

test('the home page ships gated, with a noscript escape', () => {
  const html = read('index.html');
  assert.match(html, /<body class="locked">/);
  assert.match(html, /<noscript><style>body\.locked\{overflow:auto\}/);
});

test('only the home page is gated', () => {
  for (const page of PAGES.filter((p) => p !== 'index.html')) {
    assert.ok(!read(page).includes('class="locked"'), `${page} must not be gated`);
  }
});

test('every page marks its own nav link as current', () => {
  for (const page of PAGES) {
    const html = read(page);
    const marks = html.match(/aria-current="page"/g) || [];
    assert.strictEqual(marks.length, 1, `${page} needs exactly one current nav link`);
    assert.match(html, new RegExp('href="' + page + '" aria-current="page"'));
  }
});

const SHIPPED = PAGES.concat(['work-experience.html', 'assignments.html'])
  .map(read)
  .concat([read('data/projects.js'), read('data/work.js')])
  .join('\n');

test('no corrected-away facts from the old site survive anywhere', () => {
  const stale = [
    [/B\.S\.? in Computer Science/i, 'BU degree is a B.A., not a B.S.'],
    [/School of College/i, 'BU division is the College of Arts and Sciences'],
    [/666,000/, 'the street-tree figure is 650,000+'],
    [/60% and 88%/, 'that garbled bullet was two separate numbers'],
    [/AlphaBiz[^.]{0,40}Present/i, 'AlphaBiz ended Dec 2025'],
    [/previously a Computer Science student/i, 'the About copy now leads with the present']
  ];
  for (const [re, why] of stale) {
    assert.ok(!re.test(SHIPPED), `stale content found (${why}): ${re}`);
  }
});

test("OFYE's marketing performance claims never appear on this site", () => {
  for (const re of [/win rate/i, /\b363(\.\d+)?%/, /\b177(\.\d+)?%/, /active members/i]) {
    assert.ok(!re.test(SHIPPED), `OFYE claim leaked into the portfolio: ${re}`);
  }
});

test('both legacy URLs redirect instead of 404ing', () => {
  const cases = [
    ['work-experience.html', 'work.html'],
    ['assignments.html', 'projects.html#coursework']
  ];
  for (const [stub, target] of cases) {
    const html = read(stub);
    assert.match(html, new RegExp('http-equiv="refresh"[^>]*url=' + target.replace(/[.#]/g, '\\$&')));
    assert.ok(html.includes(`href="${target}"`), `${stub} needs a clickable fallback link`);
  }
});

test('every page declares a title and description for search results', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<title>[^<]{10,}<\/title>/, `${page} needs a real title`);
    assert.match(html, /<meta name="description" content="[^"]{30,}"/, `${page} needs a description`);
  }
});

test('the USC and BU facts render exactly as the resume states them', () => {
  const work = read('data/work.js');
  assert.ok(work.includes('M.S. Computer Science — Artificial Intelligence'));
  assert.ok(work.includes('Viterbi School of Engineering'));
  assert.ok(work.includes('B.A. Computer Science'));
  assert.ok(work.includes('College of Arts and Sciences'));
});

test('the card/reader stack shares one vertical anchor, above the name block', () => {
  // The card used to sit at top:50% while .hero-name is bottom-anchored, and
  // they collided on common laptop viewport heights. All four elements in the
  // card stack must share --card-anchor so a future tweak can't move one
  // without the others, and the anchor itself must sit in the upper hero
  // rather than dead center.
  const css = read('styles.css');

  const heroBlock = /\.hero\s*\{[^}]*\}/.exec(css)[0];
  const anchorMatch = /--card-anchor:\s*([\d.]+)%/.exec(heroBlock);
  assert.ok(anchorMatch, '.hero must define --card-anchor');
  const anchor = parseFloat(anchorMatch[1]);
  assert.ok(anchor < 40, `--card-anchor (${anchor}%) should sit in the upper hero, not dead center`);

  for (const selector of ['\\.id-card', '\\.card-reader', '\\.drag-hint', '\\.readout']) {
    const rule = new RegExp(selector + '\\s*\\{[^}]*\\}', 's');
    const block = rule.exec(css);
    assert.ok(block, `${selector} rule not found`);
    assert.match(
      block[0], /top:\s*var\(--card-anchor\)/,
      `${selector} must anchor to var(--card-anchor), not a hardcoded top`
    );
  }
});

test('the location is reported as Los Angeles everywhere it appears', () => {
  const home = read('index.html');
  const contact = read('contact.html');
  assert.ok(!/Arcadia/.test(home + contact), 'stale Arcadia reference remains');
  assert.match(home, /Los Angeles, CA/);
  assert.match(contact, /Los Angeles, CA/);
});
