'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

test('clamp holds a value inside its bounds', () => {
  assert.strictEqual(Core.clamp(5, 0, 10), 5);
  assert.strictEqual(Core.clamp(-3, 0, 10), 0);
  assert.strictEqual(Core.clamp(42, 0, 10), 10);
});

test('distance measures a 3-4-5 triangle', () => {
  assert.strictEqual(Core.distance(0, 0, 3, 4), 5);
});

test('centerOf returns the middle of a rect', () => {
  assert.deepStrictEqual(
    Core.centerOf({ left: 10, top: 20, width: 100, height: 50 }),
    { x: 60, y: 45 }
  );
});

test('isWithinSnapZone is true only when centers are close enough', () => {
  const card = { left: 0, top: 0, width: 100, height: 100 };
  const near = { left: 90, top: 0, width: 100, height: 100 };
  const far = { left: 400, top: 0, width: 100, height: 100 };
  assert.strictEqual(Core.isWithinSnapZone(card, near, 100), true);
  assert.strictEqual(Core.isWithinSnapZone(card, far, 100), false);
});

test('isWithinSnapZone is inclusive at exactly the threshold', () => {
  const a = { left: 0, top: 0, width: 0, height: 0 };
  const b = { left: 60, top: 0, width: 0, height: 0 };
  assert.strictEqual(Core.isWithinSnapZone(a, b, 60), true);
});

test('tiltFromVelocity scales velocity and clamps to the max', () => {
  assert.strictEqual(Core.tiltFromVelocity(10, 10), 4);
  assert.strictEqual(Core.tiltFromVelocity(100, 10), 10);
  assert.strictEqual(Core.tiltFromVelocity(-100, 10), -10);
  assert.strictEqual(Core.tiltFromVelocity(0, 10), 0);
});

test('parallaxOffset scales scroll and clamps both directions', () => {
  assert.strictEqual(Core.parallaxOffset(100, 0.3, 200), 30);
  assert.strictEqual(Core.parallaxOffset(10000, 0.3, 200), 200);
  assert.strictEqual(Core.parallaxOffset(-10000, 0.3, 200), -200);
});
