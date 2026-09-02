'use strict';
// Drives js/site.js's initGate against a DOM stub: the four unlock paths,
// session persistence, and resilience to a throwing sessionStorage.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function bootstrap(opts) {
  const options = opts || {};
  const bodyClasses = new Set(options.locked === false ? [] : ['locked']);
  const attrs = { background: { 'aria-hidden': 'true' }, gated: { 'aria-hidden': 'true' } };
  const scrolled = [];
  const winHandlers = {};

  function stubSection(key) {
    return {
      removeAttribute: (a) => { delete attrs[key][a]; },
      getAttribute: (a) => attrs[key][a] || null,
      scrollIntoView: (o) => scrolled.push(o)
    };
  }
  const byId = { background: stubSection('background'), gated: stubSection('gated') };

  const sandbox = {
    console, setTimeout, setInterval, clearInterval, Date, Math,
    requestAnimationFrame: () => {},
    document: {
      readyState: 'loading',
      getElementById: (id) => byId[id] || null,
      querySelectorAll: () => [],
      addEventListener() {},
      body: {
        classList: {
          contains: (c) => bodyClasses.has(c),
          add: (c) => bodyClasses.add(c),
          remove: (c) => bodyClasses.delete(c)
        }
      }
    },
    matchMedia: () => ({ matches: !!options.reducedMotion }),
    IntersectionObserver: null,
    addEventListener: (t, fn) => { (winHandlers[t] = winHandlers[t] || []).push(fn); }
  };

  if (options.storage === 'throwing') {
    Object.defineProperty(sandbox, 'sessionStorage', {
      get() { throw new Error('site data blocked'); }
    });
  } else {
    const map = new Map(Object.entries(options.storage || {}));
    sandbox.sessionStorage = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); }
    };
    sandbox._map = map;
  }

  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'), sandbox);

  return {
    sandbox,
    isLocked: () => bodyClasses.has('locked'),
    attrs,
    scrolled,
    fire: (t, ev) => (winHandlers[t] || []).forEach((f) => f(ev))
  };
}

test('the page starts locked and hides the content below the hero', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  assert.strictEqual(h.isLocked(), true);
  assert.strictEqual(h.attrs.background['aria-hidden'], 'true');
});

test('a wheel event unlocks and scrolls to the background', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  h.fire('wheel', {});
  assert.strictEqual(h.isLocked(), false);
  assert.strictEqual(h.attrs.background['aria-hidden'], undefined, 'content is exposed');
  assert.strictEqual(h.scrolled.length, 1);
  assert.strictEqual(h.scrolled[0].behavior, 'smooth');
});

test('a touchmove unlocks', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  h.fire('touchmove', {});
  assert.strictEqual(h.isLocked(), false);
});

test('Tab unlocks but an unrelated key does not', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  h.fire('keydown', { key: 'q' });
  assert.strictEqual(h.isLocked(), true, 'q is not unlock intent');
  h.fire('keydown', { key: 'Tab' });
  assert.strictEqual(h.isLocked(), false);
});

test('the swipe unlocks through the lock returned to init', () => {
  const h = bootstrap();
  const lock = h.sandbox.Site.initGate();
  lock.unlock('swipe');
  assert.strictEqual(h.isLocked(), false);
  assert.strictEqual(h.scrolled.length, 1);
});

test('unlocking persists a flag for the session', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  h.fire('wheel', {});
  assert.strictEqual(h.sandbox._map.get('aaronlu.unlocked'), '1');
});

test('a restored session loads unlocked and does not auto-scroll', () => {
  const h = bootstrap({ storage: { 'aaronlu.unlocked': '1' } });
  h.sandbox.Site.initGate();
  assert.strictEqual(h.isLocked(), false);
  assert.strictEqual(h.scrolled.length, 0, 'returning visitors are not yanked down the page');
});

test('reduced motion loads unlocked without scrolling', () => {
  const h = bootstrap({ reducedMotion: true });
  h.sandbox.Site.initGate();
  assert.strictEqual(h.isLocked(), false);
  assert.strictEqual(h.scrolled.length, 0);
});

test('a throwing sessionStorage still leaves a working gate', () => {
  const h = bootstrap({ storage: 'throwing' });
  h.sandbox.Site.initGate();
  assert.strictEqual(h.isLocked(), true);
  h.fire('wheel', {});
  assert.strictEqual(h.isLocked(), false, 'blocked site data must never trap the visitor');
});

test('initGate is inert on pages that are not gated', () => {
  const h = bootstrap({ locked: false });
  assert.strictEqual(h.sandbox.Site.initGate(), null);
});

test('a touchmove that starts on the card does not unlock the page', () => {
  // Dragging the card on a touchscreen fires native touchmove events on
  // window too. Without this exemption those would unlock instantly via
  // the scroll-intent fallback, defeating the swipe interaction entirely.
  const h = bootstrap();
  h.sandbox.Site.initGate();
  const cardDescendant = { closest: (sel) => (sel === '#id-card' ? cardDescendant : null) };
  h.fire('touchmove', { target: cardDescendant });
  assert.strictEqual(h.isLocked(), true, 'a touch that began on the card must not unlock');
});

test('a touchmove elsewhere on the page still unlocks', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  const elsewhere = { closest: () => null };
  h.fire('touchmove', { target: elsewhere });
  assert.strictEqual(h.isLocked(), false);
});

test('a touchmove with no target (as a plain scroll gesture) still unlocks', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  h.fire('touchmove', {});
  assert.strictEqual(h.isLocked(), false);
});

test('touchmove unlock is not a one-shot: a card-originated touch does not consume it', () => {
  const h = bootstrap();
  h.sandbox.Site.initGate();
  const cardDescendant = { closest: (sel) => (sel === '#id-card' ? cardDescendant : null) };
  h.fire('touchmove', { target: cardDescendant });
  assert.strictEqual(h.isLocked(), true, 'still locked after the card-originated touch');
  const elsewhere = { closest: () => null };
  h.fire('touchmove', { target: elsewhere });
  assert.strictEqual(h.isLocked(), false, 'a later real scroll touch must still be able to unlock');
});
