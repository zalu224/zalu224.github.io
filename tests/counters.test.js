'use strict';
// Drives js/site.js's initCounters with stubbed IntersectionObserver and rAF.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function bootstrap(texts, opts) {
  const options = opts || {};
  const nodes = texts.map((t) => ({ textContent: t, style: {} }));
  let observed = [];
  const frames = [];

  const sandbox = {
    console, setTimeout, setInterval, clearInterval, Date, Math,
    requestAnimationFrame: (fn) => { frames.push(fn); },
    document: {
      readyState: 'loading',
      getElementById: () => null,
      querySelectorAll: (sel) => (sel === '[data-count]' ? nodes : []),
      addEventListener() {},
      body: { classList: { contains: () => false } }
    },
    matchMedia: () => ({ matches: !!options.reducedMotion }),
    IntersectionObserver: options.noObserver ? null : function (cb) {
      this.observe = (n) => { observed.push(n); this._cb = cb; };
      this.unobserve = () => {};
      this.trigger = () => cb(observed.map((t) => ({ isIntersecting: true, target: t })), this);
      sandbox._observer = this;
    },
    addEventListener() {}
  };
  sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'), sandbox);

  return {
    sandbox, nodes, frames,
    trigger: () => sandbox._observer && sandbox._observer.trigger(),
    // run the queued rAF callbacks with a supplied clock
    tick: (t) => { const queued = frames.splice(0); queued.forEach((fn) => fn(t)); }
  };
}

test('a counter animates up and lands exactly on its printed value', () => {
  const h = bootstrap(['650,000+']);
  h.sandbox.Site.initCounters();
  h.trigger();

  h.tick(0);
  assert.strictEqual(h.nodes[0].textContent, '0+', 'starts from zero');

  h.tick(450);
  const mid = h.nodes[0].textContent;
  assert.ok(/^[\d,]+\+$/.test(mid), 'stays formatted mid-flight: ' + mid);
  assert.ok(parseInt(mid.replace(/[,+]/g, ''), 10) > 0, 'has advanced');
  assert.ok(parseInt(mid.replace(/[,+]/g, ''), 10) < 650000, 'has not finished early');

  h.tick(2000);
  assert.strictEqual(h.nodes[0].textContent, '650,000+', 'settles on the exact value');
});

test('a zero first timestamp does not stall the animation', () => {
  const h = bootstrap(['96%']);
  h.sandbox.Site.initCounters();
  h.trigger();
  h.tick(0);
  h.tick(900);
  assert.strictEqual(h.nodes[0].textContent, '96%');
});

test('percent and suffixed values keep their units throughout', () => {
  const h = bootstrap(['88%', '97% F1']);
  h.sandbox.Site.initCounters();
  h.trigger();
  h.tick(0);
  h.tick(300);
  assert.match(h.nodes[0].textContent, /%$/);
  assert.match(h.nodes[1].textContent, /% F1$/);
  h.tick(5000);
  assert.strictEqual(h.nodes[0].textContent, '88%');
  assert.strictEqual(h.nodes[1].textContent, '97% F1');
});

test('reduced motion leaves the printed values untouched', () => {
  const h = bootstrap(['650,000+'], { reducedMotion: true });
  h.sandbox.Site.initCounters();
  assert.strictEqual(h.nodes[0].textContent, '650,000+');
  assert.strictEqual(h.frames.length, 0, 'no animation is scheduled');
});

test('a browser without IntersectionObserver still shows final values', () => {
  const h = bootstrap(['96%'], { noObserver: true });
  h.sandbox.Site.initCounters();
  assert.strictEqual(h.nodes[0].textContent, '96%');
});
