'use strict';
// Drives js/site.js's initCard state machine against a minimal DOM stub.
// Covers what a unit test can reach: tilt, spring-back, snap detection,
// the accept sequence, and idempotence. Visual polish still needs a browser.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeEl(id, rect) {
  const handlers = {};
  const classes = new Set();
  return {
    id, style: {}, textContent: '',
    _rect: { ...rect },
    _classes: classes,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => { if (on) { classes.add(c); } else { classes.delete(c); } }
    },
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    fire: (t, ev) => (handlers[t] || []).forEach((f) => f(ev)),
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false,
    getBoundingClientRect() {
      const m = /translate3d\((-?[\d.]+)px,(-?[\d.]+)px/.exec(this.style.transform || '');
      const ox = m ? parseFloat(m[1]) : 0;
      const oy = m ? parseFloat(m[2]) : 0;
      return {
        left: this._rect.left + ox, top: this._rect.top + oy,
        width: this._rect.width, height: this._rect.height
      };
    }
  };
}

function bootstrap() {
  const card = makeEl('id-card', { left: 200, top: 300, width: 340, height: 214 });
  const reader = makeEl('card-reader', { left: 1000, top: 280, width: 96, height: 260 });
  const led = makeEl('reader-led', { left: 0, top: 0, width: 8, height: 8 });
  const readout = makeEl('readout', { left: 0, top: 0, width: 0, height: 0 });
  const hint = makeEl('drag-hint', { left: 0, top: 0, width: 0, height: 0 });
  const byId = {
    'id-card': card, 'card-reader': reader, 'reader-led': led,
    readout: readout, 'drag-hint': hint
  };

  const sandbox = {
    console, setTimeout, setInterval, clearInterval, Date, Math,
    requestAnimationFrame: () => {},
    document: {
      // 'loading' keeps site.js from auto-running init() and double-binding listeners
      readyState: 'loading',
      getElementById: (id) => byId[id] || null,
      querySelectorAll: () => [],
      addEventListener() {},
      body: { classList: { contains: () => false } }
    },
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: null,
    addEventListener() {}
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'), sandbox);

  return { sandbox, card, reader, led, readout };
}

test('a drag released away from the reader springs back and does not unlock', () => {
  const { sandbox, card, reader } = bootstrap();
  let accepted = 0;
  sandbox.Site.initCard(() => { accepted++; });

  card.fire('pointerdown', { clientX: 370, clientY: 400, pointerId: 1 });
  card.fire('pointermove', { clientX: 500, clientY: 400, pointerId: 1 });
  assert.match(card.style.transform, /rotate\(-?[\d.]+deg\)/, 'tilts while dragging');
  assert.strictEqual(reader._classes.has('is-near'), false);

  card.fire('pointerup', { clientX: 500, clientY: 400, pointerId: 1 });
  assert.strictEqual(card.style.transform, '', 'returns to its resting transform');
  assert.strictEqual(accepted, 0);
});

test('dragging onto the reader flags it as near', () => {
  const { sandbox, card, reader } = bootstrap();
  sandbox.Site.initCard(() => {});
  card.fire('pointerdown', { clientX: 370, clientY: 400, pointerId: 1 });
  card.fire('pointermove', { clientX: 1048, clientY: 410, pointerId: 1 });
  assert.strictEqual(reader._classes.has('is-near'), true);
});

test('completing the swipe runs the accept sequence exactly once', async () => {
  const { sandbox, card, reader, led, readout } = bootstrap();
  let accepted = 0;
  sandbox.Site.initCard(() => { accepted++; });

  card.fire('pointerdown', { clientX: 370, clientY: 400, pointerId: 1 });
  card.fire('pointermove', { clientX: 1048, clientY: 410, pointerId: 1 });
  card.fire('pointerup', { clientX: 1048, clientY: 410, pointerId: 1 });
  assert.strictEqual(reader._classes.has('is-near'), false, 'clears the near state');

  await new Promise((r) => setTimeout(r, 1800));

  assert.strictEqual(card._classes.has('is-consumed'), true, 'card is consumed');
  assert.strictEqual(led._classes.has('is-granted'), true, 'LED turns green');
  assert.strictEqual(readout.textContent, 'Access granted · Welcome');
  assert.strictEqual(accepted, 1, 'unlock callback fires once');

  card.fire('pointerdown', { clientX: 300, clientY: 300, pointerId: 2 });
  card.fire('click', { preventDefault() {} });
  assert.strictEqual(accepted, 1, 'further interaction is inert');
});

test('pressing Enter on the focused card accepts without a drag', async () => {
  const { sandbox, readout } = bootstrap();
  let accepted = 0;
  const api = sandbox.Site.initCard(() => { accepted++; });
  assert.ok(api, 'initCard returns its api when the card exists');

  // a <button> fires click for both Enter and Space
  sandbox.document.getElementById('id-card').fire('click', { preventDefault() {} });
  await new Promise((r) => setTimeout(r, 1800));
  assert.strictEqual(accepted, 1);
  assert.strictEqual(readout.textContent, 'Access granted · Welcome');
});

test('initCard is inert on a page with no card', () => {
  const { sandbox } = bootstrap();
  sandbox.document.getElementById = () => null;
  assert.strictEqual(sandbox.Site.initCard(() => {}), null);
});
