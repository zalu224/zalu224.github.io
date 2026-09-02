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
