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

test('the name and card never share a column: they are separate, oppositely-ordered flex items', () => {
  // The card used to be absolutely positioned with inset:0 over the whole
  // hero, sharing space with the bottom-anchored .hero-name and colliding
  // with it on realistic content heights (the eyebrow line in particular).
  // Fixed by making card-stage its own explicitly-sized flex column,
  // structurally separate from .hero-name rather than sharing its box.
  const css = read('styles.css');

  const heroBlock = /\.hero\s*\{[^}]*\}/.exec(css)[0];
  assert.match(heroBlock, /display:\s*flex/);

  const stageBlock = /\.card-stage\s*\{[^}]*\}/.exec(css)[0];
  assert.doesNotMatch(stageBlock, /inset:\s*0/, 'card-stage must not span the full hero any more');
  assert.match(stageBlock, /width:\s*\d/, 'card-stage needs its own explicit width to form a real column');
  assert.match(stageBlock, /height:\s*\d/, 'card-stage needs its own explicit height to form a real column');
  assert.match(stageBlock, /margin:.*auto.*auto/, 'card-stage should center in the remaining space, not hug the viewport edge');

  const nameOrder = parseFloat(/order:\s*(\d+)/.exec(/\.hero-name\s*\{[^}]*\}/.exec(css)[0])[1]);
  const stageOrder = parseFloat(/order:\s*(\d+)/.exec(stageBlock)[1]);
  assert.ok(nameOrder < stageOrder, 'on the wide layout, the name column must render before the card column');
});


test('the location is reported as Los Angeles everywhere it appears', () => {
  const home = read('index.html');
  const contact = read('contact.html');
  assert.ok(!/Arcadia/.test(home + contact), 'stale Arcadia reference remains');
  assert.match(home, /Los Angeles, CA/);
  assert.match(contact, /Los Angeles, CA/);
});

test('below the two-column threshold, the card stacks above the name with swapped order', () => {
  const css = read('styles.css');
  const stacked = /@media \(max-width: 1180px\) \{([\s\S]*?)\n\}/.exec(css)[1];

  const heroRule = /\.hero\s*\{[^}]*\}/.exec(stacked);
  assert.ok(heroRule, '.hero must be overridden below the two-column threshold');
  assert.match(heroRule[0], /flex-direction:\s*column/, 'stacked .hero must lay its children out in a column');

  const stageRule = /\.card-stage\s*\{[^}]*\}/.exec(stacked);
  assert.ok(stageRule, '.card-stage must be overridden below the two-column threshold');
  assert.match(stageRule[0], /width:\s*100%/, 'stacked .card-stage needs an explicit width or it collapses to zero');

  const nameOrder = parseFloat(/order:\s*(\d+)/.exec(/\.hero-name\s*\{[^}]*\}/.exec(stacked)[0])[1]);
  const stageOrder = parseFloat(/order:\s*(\d+)/.exec(stageRule[0])[1]);
  assert.ok(stageOrder < nameOrder, 'stacked: the card column must render before (above) the name');
});

test('the wide-layout-only rules do not leak into the general mobile block, and vice versa', () => {
  const css = read('styles.css');
  const general = /@media \(max-width: 768px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  const stacked = /@media \(max-width: 1180px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.ok(!/\.hero\b/.test(general), 'hero stacking rules belong in the 1180px block, not the 768px one');
  assert.ok(!/\.coursework-grid/.test(stacked), 'general component rules belong in the 768px block, not the 1180px one');
});

// Resolve a selector's effective declarations at a given viewport width by
// cascading every matching block in source order, the way a browser would.
// The phone tier only overrides some properties and inherits the rest.
function effectiveRule(css, selector, viewportWidth) {
  const chunks = [];
  let cursor = 0;
  const mediaRe = /@media\s*\(([a-z-]+):\s*(\d+)px\)\s*\{/g;
  let m;
  while ((m = mediaRe.exec(css)) !== null) {
    chunks.push({ query: null, text: css.slice(cursor, m.index) });
    // walk braces to find this block's end
    let depth = 1;
    let i = mediaRe.lastIndex;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') { depth++; }
      if (css[i] === '}') { depth--; }
      i++;
    }
    chunks.push({ query: { prop: m[1], value: parseInt(m[2], 10) }, text: css.slice(mediaRe.lastIndex, i - 1) });
    cursor = i;
    mediaRe.lastIndex = i;
  }
  chunks.push({ query: null, text: css.slice(cursor) });

  const applies = (q) => {
    if (!q) { return true; }
    if (q.prop === 'max-width') { return viewportWidth <= q.value; }
    if (q.prop === 'min-width') { return viewportWidth >= q.value; }
    return false;
  };

  const declarations = {};
  const ruleRe = new RegExp('\\' + selector + '\\s*\\{([^}]*)\\}', 'g');
  for (const chunk of chunks) {
    if (!applies(chunk.query)) { continue; }
    let r;
    const re = new RegExp(ruleRe.source, 'g');
    while ((r = re.exec(chunk.text)) !== null) {
      for (const part of r[1].split(';')) {
        const idx = part.indexOf(':');
        if (idx === -1) { continue; }
        declarations[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
      }
    }
  }
  return declarations;
}

test('the card starts on the left with room to swipe right, at every width', () => {
  // There is no reader any more: the card is swiped rightward past a distance
  // threshold. So at every breakpoint the card must sit toward the left of its
  // stage with at least a full threshold of open space to its right, or the
  // gesture cannot be completed.
  const css = read('styles.css');

  const px = (v) => {
    if (v === undefined || v === null) { return null; }
    if (/^0$/.test(v.trim())) { return 0; }
    const m = /(-?[\d.]+)(px|rem)/.exec(v);
    if (!m) { return null; }
    return m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
  };
  // Mirrors Core.swipeThreshold
  const threshold = (cardWidth) => Math.max(90, cardWidth * 0.45);

  const tiers = [
    { name: 'wide desktop', width: 1440, stage: 540 },
    { name: 'narrow desktop', width: 1100, stage: 1100 },
    { name: 'tablet', width: 800, stage: 800 },
    { name: 'phone', width: 375, stage: 375 },
    { name: 'small phone', width: 320, stage: 320 }
  ];

  for (const tier of tiers) {
    const d = effectiveRule(css, '.id-card', tier.width);
    const width = px(d.width);
    let left;
    if (d.left === '50%') {
      const parts = (d.margin || '').trim().split(/\s+/);
      left = tier.stage / 2 + (parts.length === 4 ? (px(parts[3]) || 0) : 0);
    } else {
      left = px(d.left);
    }
    assert.ok(left !== null, `${tier.name}: could not resolve the card's left edge`);

    const room = tier.stage - (left + width);
    assert.ok(left >= 0, `${tier.name}: card starts off the left edge at ${left}`);
    assert.ok(room >= threshold(width),
      `${tier.name}: only ${room.toFixed(0)}px of swipe room right of the card, ` +
      `needs ${threshold(width).toFixed(0)}px`);
  }
});

test('the reader is gone from the markup, styles and script', () => {
  for (const file of ['index.html', 'styles.css', 'js/site.js']) {
    const text = read(file);
    for (const token of ['card-reader', 'reader-slit', 'reader-led', 'isWithinSnapZone']) {
      assert.ok(!text.includes(token), `${file} still references ${token}`);
    }
  }
});

test('the badge shows the photo and no "access granted" label', () => {
  const home = read('index.html');
  const tag = /<div class="name-tag"[^>]*>([\s\S]*?)<\/div>/.exec(home);
  assert.ok(tag, 'name tag not found');
  assert.match(tag[1], /name-tag-photo/, 'the photo must still be on the badge');
  assert.ok(!/access granted/i.test(tag[1]), 'the badge should not carry an "Access Granted" label');
});

test('the access card header carries no school line', () => {
  const home = read('index.html');
  const head = /<span class="id-card-head[^>]*>([\s\S]*?)<\/span>\s*<span class="id-card-body/.exec(home);
  assert.ok(head, 'card header not found');
  assert.ok(!/Viterbi|USC/.test(head[1]), 'the header should read just "Access Card"');
  assert.match(head[1], /Access Card/);
});

test('the hero bio line is spaced into its own lines, with no trailing "actually use"', () => {
  const home = read('index.html');
  const block = /<div class="hero-line">([\s\S]*?)<\/div>/.exec(home);
  assert.ok(block, 'hero-line must be a container of separate lines, not a single paragraph');

  const lines = [...block[1].matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.deepStrictEqual(lines, [
    'Technical Product Manager with an engineering core',
    'M.S. Computer Science (AI) at USC',
    'Boston University CS &rsquo;25.',
    'I turn ML and engineering depth into products.'
  ]);
  assert.ok(!/actually use/.test(home), 'the trailing "people actually use" phrase should be dropped');

  const css = read('styles.css');
  assert.match(css, /\.hero-line p\s*\{[^}]*margin:/, 'the individual lines need their own spacing rule');
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

test('every page footer reads "Built with intention" at bottom right', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<div>\s*<span>&copy;[^<]*<\/span>\s*<span>Built with intention<\/span>\s*<\/div>/,
      `${page} footer must end with "Built with intention"`);
  }
});
