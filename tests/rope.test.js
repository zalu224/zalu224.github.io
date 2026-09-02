'use strict';
// Verlet rope used by the lanyard badge. Pure math, so it is fully testable
// without a browser: pinning, gravity, distance constraints, drag, settling.
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

const SEG = 16;
function rope(extra) {
  return Core.createRope(Object.assign({
    x: 100, y: 0, segments: 10, segmentLength: SEG
  }, extra || {}));
}

function settle(r, frames, drag) {
  for (let i = 0; i < (frames || 400); i++) { r.step(drag); }
  return r;
}

test('the rope starts collapsed near its anchor, so it falls in from above', () => {
  const r = rope();
  for (const p of r.points) {
    assert.ok(Math.hypot(p.x - 100, p.y - 0) < 10, 'every point starts bunched at the anchor');
  }
});

test('adjacent points are never exactly coincident, or the rope cannot unfurl', () => {
  // Distance constraints need a direction to push along. Coincident points
  // have none, so a rope initialised perfectly collapsed stays collapsed.
  const r = rope();
  for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i];
    const b = r.points[i + 1];
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 0, `points ${i} and ${i + 1} are coincident`);
  }
});

test('gravity pulls the free end downward', () => {
  const r = rope();
  const before = r.end().y;
  settle(r, 5);
  assert.ok(r.end().y > before, 'the end should fall');
});

test('the head stays pinned to the anchor no matter what', () => {
  const r = rope();
  settle(r, 200);
  assert.strictEqual(r.points[0].x, 100);
  assert.strictEqual(r.points[0].y, 0);

  settle(r, 50, { x: 900, y: 900 });
  assert.strictEqual(r.points[0].x, 100, 'even while dragged hard sideways');
  assert.strictEqual(r.points[0].y, 0);
});

test('every segment holds its length once settled', () => {
  const r = settle(rope(), 600);
  for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i];
    const b = r.points[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(d - SEG) < 1.5, `segment ${i} was ${d.toFixed(2)}, expected ~${SEG}`);
  }
});

test('it hangs taut and straight down under gravity alone', () => {
  const r = settle(rope(), 800);
  const expected = (r.points.length - 1) * SEG;
  const drop = r.end().y - r.points[0].y;
  assert.ok(Math.abs(drop - expected) < 3, `hung ${drop.toFixed(1)}px, expected ~${expected}`);
  assert.ok(Math.abs(r.end().x - 100) < 3, 'should hang plumb under the anchor');
});

test('dragging pins the free end to the drag point', () => {
  const r = settle(rope(), 100);
  settle(r, 30, { x: 260, y: 120 });
  assert.ok(Math.abs(r.end().x - 260) < 0.001);
  assert.ok(Math.abs(r.end().y - 120) < 0.001);
});

test('angleDeg is 0 hanging straight down, and negative when pulled right', () => {
  const r = settle(rope(), 800);
  assert.ok(Math.abs(r.angleDeg()) < 2, `hanging angle was ${r.angleDeg()}`);

  settle(r, 40, { x: 100 + 90, y: 90 });
  assert.ok(r.angleDeg() < -10, `pulled right should tilt negative, got ${r.angleDeg()}`);
});

test('angleDeg is positive when pulled left', () => {
  const r = settle(rope(), 200);
  settle(r, 40, { x: 100 - 90, y: 90 });
  assert.ok(r.angleDeg() > 10, `pulled left should tilt positive, got ${r.angleDeg()}`);
});

test('it settles: motion decays once left alone', () => {
  const r = settle(rope(), 60);
  const moving = r.maxSpeed();
  settle(r, 1200);
  const still = r.maxSpeed();
  assert.ok(still < moving, 'should lose energy');
  assert.ok(still < 0.05, `should come to rest, still moving at ${still}`);
});

test('releasing a drag lets it swing back, not freeze in place', () => {
  const r = settle(rope(), 300);
  settle(r, 40, { x: 320, y: 60 });
  const held = { x: r.end().x, y: r.end().y };
  settle(r, 30);
  assert.ok(Math.abs(r.end().x - held.x) > 5, 'it should swing away from where it was released');
});

test('setAnchor moves the whole rope, for layout changes on resize', () => {
  const r = settle(rope(), 400);
  r.setAnchor(500, 0);
  settle(r, 400);
  assert.strictEqual(r.points[0].x, 500);
  assert.ok(Math.abs(r.end().x - 500) < 4, 'the end should hang under the new anchor');
});

test('a rope needs at least two points to have an angle', () => {
  const r = Core.createRope({ x: 0, y: 0, segments: 1, segmentLength: SEG });
  assert.ok(r.points.length >= 2, 'segment count is floored at 2');
});
