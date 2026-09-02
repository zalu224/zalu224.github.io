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
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
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

// Reads the last point of the rendered cord path, i.e. where the badge hangs.
function endOfPath(path) {
  const pts = (path._attrs.d || '').split(/[ML]/).filter(Boolean);
  const last = pts[pts.length - 1].split(',');
  return { x: parseFloat(last[0]), y: parseFloat(last[1]) };
}

function bootstrap(opts) {
  const options = opts || {};
  const card = makeEl('id-card', { left: 200, top: 300, width: 340, height: 214 });
  const reader = makeEl('card-reader', { left: 1000, top: 280, width: 96, height: 260 });
  const led = makeEl('reader-led', { left: 0, top: 0, width: 8, height: 8 });
  const readout = makeEl('readout', { left: 0, top: 0, width: 0, height: 0 });
  const hint = makeEl('drag-hint', { left: 0, top: 0, width: 0, height: 0 });
  const nameTag = makeEl('name-tag', { left: 0, top: 0, width: 156, height: 200 });
  const lanyard = makeEl('lanyard', { left: 0, top: 0, width: 1400, height: 900 });
  const cordPath = makeEl('lanyard-path', { left: 0, top: 0, width: 0, height: 0 });
  const hero = makeEl('hero', { left: 0, top: 0, width: 1400, height: 900 });
  const stage = makeEl('card-stage', { left: 800, top: 300, width: 480, height: 380 });
  const byId = {
    'id-card': card, 'card-reader': reader, 'reader-led': led,
    readout: readout, 'drag-hint': hint, 'name-tag': nameTag,
    lanyard: lanyard, 'lanyard-path': cordPath, hero: hero, 'card-stage': stage
  };
  const frames = [];

  const sandbox = {
    console, setTimeout, setInterval, clearInterval, Date, Math,
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    document: {
      // 'loading' keeps site.js from auto-running init() and double-binding listeners
      readyState: 'loading',
      getElementById: (id) => byId[id] || null,
      querySelectorAll: () => [],
      addEventListener() {},
      body: { classList: { contains: () => false } }
    },
    matchMedia: () => ({ matches: !!options.reducedMotion }),
    IntersectionObserver: null,
    addEventListener() {}
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'), sandbox);

  // Run one queued animation frame (the loop re-queues itself).
  sandbox._tick = () => {
    const queued = frames.splice(0);
    queued.forEach((fn) => fn(16));
  };

  return { sandbox, card, reader, led, readout, nameTag, lanyard, path: cordPath, hero, stage, hint, frames };
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

  await new Promise((r) => setTimeout(r, 2400));

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
  await new Promise((r) => setTimeout(r, 2400));
  assert.strictEqual(accepted, 1);
  assert.strictEqual(readout.textContent, 'Access granted · Welcome');
});

test('initCard is inert on a page with no card', () => {
  const { sandbox } = bootstrap();
  sandbox.document.getElementById = () => null;
  assert.strictEqual(sandbox.Site.initCard(() => {}), null);
});

test('initLanyard is inert when the lanyard markup is absent', () => {
  const { sandbox } = bootstrap();
  sandbox.document.getElementById = () => null;
  assert.strictEqual(sandbox.Site.initLanyard(), null);
});

test('drop() reveals the lanyard, relabels the hint, and starts the simulation', () => {
  const { sandbox, lanyard, nameTag, hint, frames } = bootstrap();
  const api = sandbox.Site.initLanyard();

  assert.strictEqual(api.isDropped(), false);
  assert.strictEqual(lanyard._classes.has('is-dropped'), false);

  api.drop();

  assert.strictEqual(api.isDropped(), true);
  assert.strictEqual(lanyard._classes.has('is-dropped'), true);
  assert.strictEqual(hint.textContent, 'Drag the badge', 'the hint should now point at the badge');
  assert.ok(frames.length > 0, 'the physics loop should be running');

  // advance a few frames: the badge should be positioned and rotated by the rope
  for (let i = 0; i < 30; i++) { sandbox._tick(); }
  assert.match(nameTag.style.transform, /translate3d\([\d.-]+px,[\d.-]+px,0\) rotate\(-?[\d.]+deg\)/);
});

test('drop() is idempotent', () => {
  const { sandbox, hint } = bootstrap();
  const api = sandbox.Site.initLanyard();
  api.drop();
  hint.textContent = 'touched';
  api.drop();
  assert.strictEqual(hint.textContent, 'touched', 'a second drop should do nothing');
});

test('the badge falls from the anchor down into view', () => {
  const { sandbox, path } = bootstrap();
  const api = sandbox.Site.initLanyard();
  api.drop();

  sandbox._tick();
  const firstEnd = endOfPath(path);
  for (let i = 0; i < 120; i++) { sandbox._tick(); }
  const laterEnd = endOfPath(path);

  assert.ok(laterEnd.y > firstEnd.y + 40, `badge should fall (from ${firstEnd.y} to ${laterEnd.y})`);
});

test('the cord is drawn as a polyline from the anchor to the badge', () => {
  const { sandbox, path } = bootstrap();
  sandbox.Site.initLanyard().drop();
  for (let i = 0; i < 60; i++) { sandbox._tick(); }

  const d = path._attrs.d;
  assert.ok(d.startsWith('M'), 'path must start with a moveto');
  assert.ok((d.match(/L/g) || []).length >= 5, 'the cord should have several segments');
});

test('dragging the badge before it drops does nothing', () => {
  const { sandbox, nameTag } = bootstrap();
  sandbox.Site.initLanyard();
  nameTag.fire('pointerdown', { clientX: 200, clientY: 200, pointerId: 1 });
  assert.strictEqual(nameTag._classes.has('is-dragging'), false);
});

test('dragging the badge pulls the cord end to the pointer', () => {
  const { sandbox, nameTag, path } = bootstrap();
  sandbox.Site.initLanyard().drop();
  for (let i = 0; i < 200; i++) { sandbox._tick(); }

  const resting = endOfPath(path);
  nameTag.fire('pointerdown', { clientX: resting.x, clientY: resting.y, pointerId: 1 });
  assert.strictEqual(nameTag._classes.has('is-dragging'), true);

  nameTag.fire('pointermove', { clientX: resting.x + 220, clientY: resting.y + 40, pointerId: 1 });
  for (let i = 0; i < 20; i++) { sandbox._tick(); }

  const dragged = endOfPath(path);
  assert.ok(dragged.x > resting.x + 150, `badge should follow the pointer (${resting.x} -> ${dragged.x})`);
});

test('releasing the badge lets it swing back under gravity', () => {
  const { sandbox, nameTag, path } = bootstrap();
  sandbox.Site.initLanyard().drop();
  for (let i = 0; i < 200; i++) { sandbox._tick(); }
  const resting = endOfPath(path);

  nameTag.fire('pointerdown', { clientX: resting.x, clientY: resting.y, pointerId: 1 });
  nameTag.fire('pointermove', { clientX: resting.x + 240, clientY: resting.y, pointerId: 1 });
  for (let i = 0; i < 20; i++) { sandbox._tick(); }
  const held = endOfPath(path);

  nameTag.fire('pointerup', { clientX: resting.x + 240, clientY: resting.y, pointerId: 1 });
  assert.strictEqual(nameTag._classes.has('is-dragging'), false);
  for (let i = 0; i < 40; i++) { sandbox._tick(); }

  assert.ok(endOfPath(path).x < held.x - 20, 'it should swing back toward plumb, not freeze');
});

test('under reduced motion the badge hangs statically with no physics loop', () => {
  const { sandbox, path, frames } = bootstrap({ reducedMotion: true });
  sandbox.Site.initLanyard().drop();

  assert.strictEqual(frames.length, 0, 'no animation loop should start');
  const d = path._attrs.d;
  assert.strictEqual((d.match(/L/g) || []).length, 1, 'a straight cord, not a simulated one');
});

test('completing the swipe drops the name tag before the page unlocks', async () => {
  const { sandbox, card, lanyard } = bootstrap();
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
  assert.strictEqual(lanyard._classes.has('is-dropped'), false, 'initCard does not touch the lanyard directly — init() wires that');
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
