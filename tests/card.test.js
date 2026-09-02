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
  const nameTag = makeEl('name-tag', { left: 30, top: -260, width: 150, height: 190 });
  const byId = {
    'id-card': card, 'card-reader': reader, 'reader-led': led,
    readout: readout, 'drag-hint': hint, 'name-tag': nameTag
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

  return { sandbox, card, reader, led, readout, nameTag };
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

test('initNameTag is inert on a page with no name tag', () => {
  const { sandbox } = bootstrap();
  sandbox.document.getElementById = (id) => (id === 'name-tag' ? null : null);
  assert.strictEqual(sandbox.Site.initNameTag(), null);
});

test('dragging the name tag tilts it like the card', () => {
  const { sandbox, nameTag } = bootstrap();
  sandbox.Site.initNameTag();
  nameTag.fire('pointerdown', { clientX: 100, clientY: 50, pointerId: 1 });
  nameTag.fire('pointermove', { clientX: 220, clientY: 60, pointerId: 1 });
  assert.match(nameTag.style.transform, /translate3d\(120px,10px,0\) rotate\(-?[\d.]+deg\)/);
});

test('releasing the name tag leaves it exactly where it was dropped, no spring-back', () => {
  const { sandbox, nameTag } = bootstrap();
  sandbox.Site.initNameTag();
  nameTag.fire('pointerdown', { clientX: 100, clientY: 50, pointerId: 1 });
  nameTag.fire('pointermove', { clientX: 260, clientY: 140, pointerId: 1 });
  const midDrag = nameTag.style.transform;
  nameTag.fire('pointerup', { clientX: 260, clientY: 140, pointerId: 1 });
  assert.strictEqual(nameTag.style.transform, midDrag, 'the id-card springs back; the name tag must not');
  assert.notStrictEqual(nameTag.style.transform, '', 'it should be visibly displaced, not reset');
});

test('drop() reveals the name tag by adding is-dropped', () => {
  const { sandbox, nameTag } = bootstrap();
  const api = sandbox.Site.initNameTag();
  assert.strictEqual(nameTag._classes.has('is-dropped'), false);
  api.drop();
  assert.strictEqual(nameTag._classes.has('is-dropped'), true);
});

test('completing the swipe drops the name tag before the page unlocks', async () => {
  const { sandbox, card, reader, nameTag } = bootstrap();
  const order = [];
  sandbox.Site.initCard(
    () => order.push('accepted'),
    () => order.push('granted')
  );

  card.fire('pointerdown', { clientX: 370, clientY: 400, pointerId: 1 });
  card.fire('pointermove', { clientX: 1048, clientY: 410, pointerId: 1 });
  card.fire('pointerup', { clientX: 1048, clientY: 410, pointerId: 1 });

  await new Promise((r) => setTimeout(r, 2200));

  assert.deepStrictEqual(order, ['granted', 'accepted'], 'the tag must drop before the page scrolls away');
  assert.strictEqual(nameTag._classes.has('is-dropped'), false, 'initCard does not touch the tag directly — init() wires that');
});

test('initCard still works with only one argument, for backward compatibility', async () => {
  const { sandbox, card } = bootstrap();
  let accepted = 0;
  assert.doesNotThrow(() => sandbox.Site.initCard(() => { accepted++; }));

  card.fire('pointerdown', { clientX: 370, clientY: 400, pointerId: 1 });
  card.fire('pointermove', { clientX: 1048, clientY: 410, pointerId: 1 });
  card.fire('pointerup', { clientX: 1048, clientY: 410, pointerId: 1 });
  await new Promise((r) => setTimeout(r, 2200));
  assert.strictEqual(accepted, 1);
});
