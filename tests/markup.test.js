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
    [/previously a Computer Science student/i, 'the About copy now leads with the present'],
    [/Software Engineer\s*(&middot;|·)\s*ML/, 'the card now reads Technical Product Manager, not Software Engineer · ML'],
    [/Machine Learning (&amp;|&)\s*Product Engineering/, 'the home title no longer leads with engineering'],
    [/I build machine learning systems and ship the products/, 'the old engineering-first hero line was replaced'],
    [/Design (&amp;|&)\s*build/, "project roles now read 'Product & engineering'"],
    [/building Pok(&eacute;|é)cha<\/span>/, "the Current stat now reads 'Technical PM', not a build-status label"]
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

test('the mobile hero stacks the card above the name, not beside it', () => {
  // .hero has no flex-direction (defaults to row) and only .hero-name is
  // in-flow on desktop (card-stage is absolutely positioned there). On
  // mobile, card-stage switches to position:relative and becomes a second
  // in-flow flex item — without an explicit column direction the two would
  // lay out side by side, and without an explicit width, an absolutely-
  // positioned-only card-stage has zero intrinsic width, collapsing every
  // percentage-based offset inside it (id-card, card-reader, hints).
  const css = read('styles.css');
  const mobile = /@media \(max-width: 768px\) \{([\s\S]*?)\n\}/.exec(css)[1];

  const heroRule = /\.hero\s*\{[^}]*\}/.exec(mobile);
  assert.ok(heroRule, '.hero must be overridden in the mobile block');
  assert.match(heroRule[0], /flex-direction:\s*column/, 'mobile .hero must stack its children in a column');

  const stageRule = /\.card-stage\s*\{[^}]*\}/.exec(mobile);
  assert.ok(stageRule, '.card-stage must be overridden in the mobile block');
  assert.match(stageRule[0], /width:\s*100%/, 'mobile .card-stage needs an explicit width or it collapses to zero');
});

test('the mobile card stack fits without overlapping the fixed nav or itself', () => {
  // Fixed-pixel geometry, modeled and verified before implementation:
  // nav bottom edge ~62px, card top 80px (18px clear), card bottom 256px,
  // reader top 288px (32px gap), reader bottom 384px, stage 424px tall
  // (40px left for the hint/readout text below the reader).
  const css = read('styles.css');
  const mobile = /@media \(max-width: 768px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  const px = (block, prop) => {
    const m = new RegExp(prop + ':\\s*(-?[\\d.]+)(px|rem)').exec(block);
    if (!m) { return null; }
    return m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
  };

  const stage = /\.card-stage\s*\{[^}]*\}/.exec(mobile)[0];
  const card = /\.id-card\s*\{[^}]*\}/.exec(mobile)[0];
  const reader = /\.card-reader\s*\{[^}]*\}/.exec(mobile)[0];

  const stageHeight = px(stage, 'height');
  const cardTop = px(card, 'top');
  const cardHeight = px(card, 'height');
  const readerTop = px(reader, 'top');
  const readerHeight = px(reader, 'height');

  const NAV_BOTTOM_EDGE = 62; // approx: 1rem top offset + pill height
  assert.ok(cardTop > NAV_BOTTOM_EDGE, `card top (${cardTop}px) must clear the fixed nav (~${NAV_BOTTOM_EDGE}px)`);
  assert.ok(readerTop >= cardTop + cardHeight, `reader (top ${readerTop}px) must not overlap the card (bottom ${cardTop + cardHeight}px)`);
  assert.ok(stageHeight >= readerTop + readerHeight, `card-stage (${stageHeight}px) must be tall enough to contain the reader (bottom ${readerTop + readerHeight}px)`);
});

test('the hero bio line balances its line breaks for even reading', () => {
  const css = read('styles.css');
  const rule = /\.hero-line\s*\{[^}]*\}/.exec(css)[0];
  assert.match(rule, /text-wrap:\s*balance/);
});

test('the site is positioned as a Technical Product Manager', () => {
  const home = read('index.html');
  assert.match(home, /<title>Aaron Lu — Technical Product Manager<\/title>/);
  assert.match(home, /Technical Product Manager/, 'the id-card must carry the new role label');
  assert.match(home, /Product\s*&middot;\s*Strategy\s*&middot;\s*AI/, 'the hero eyebrow leads with Product');
});

test('resume-sourced job titles are never rewritten when repositioning the site', () => {
  // The positioning pass (engineer -> technical PM) may reframe surrounding
  // copy, but the actual employment history is a factual record and must
  // stay exactly as the resume states it, company and title both.
  const work = read('data/work.js');
  const realRoles = [
    ["company: 'AlphaBiz'", "role: 'AI Intern'"],
    ["company: 'Interesting World'", "role: 'Machine Learning Intern'"],
    ["company: 'Rivera Food Service Inc.'", "role: 'Project Manager, part-time'"]
  ];
  for (const [company, role] of realRoles) {
    assert.ok(work.includes(company), `missing or renamed: ${company}`);
    assert.ok(work.includes(role), `missing or renamed: ${role}`);
  }
});

test('the skills list leads with product skills, grounded in the real work bullets', () => {
  const work = read('data/work.js');
  const site = read('js/site.js');
  assert.match(work, /product:\s*\[/, 'data/work.js must define a product skills group');
  const order = /skillGroupHtml\('Product[^']*'.*?\n.*?skillGroupHtml\('Machine learning/s;
  assert.match(site, order, 'Product & collaboration must render before Machine learning & AI');
});
