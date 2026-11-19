'use strict';
// 2-opt tour used by the hero route graphic. Pure math, no browser needed.
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

function scatter(n) {
  // deterministic pseudo-random points, shuffled enough to tangle the tour
  const pts = [];
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < n; i++) { pts.push({ x: rnd() * 1000, y: rnd() * 600 }); }
  return pts;
}

test('every 2-opt move shortens the tour, and the search terminates', () => {
  const tour = Core.createTour(scatter(40));
  let last = tour.length();
  let moves = 0;
  let move;
  while ((move = tour.improve()) !== null) {
    const now = tour.length();
    assert.ok(now < last, 'a move must strictly shorten the tour');
    assert.ok(Math.abs((last - now) - move.gain) < 1e-6, 'reported gain matches the real saving');
    last = now;
    assert.ok(++moves < 2000, 'search must terminate');
  }
  assert.ok(moves > 5, 'a scattered tour should need real untangling');
});

test('the tour stays a permutation of every stop', () => {
  const tour = Core.createTour(scatter(30));
  while (tour.improve() !== null) { /* run to the optimum */ }
  assert.deepStrictEqual(tour.order.slice().sort((a, b) => a - b), [...Array(30).keys()]);
});

test('a move reports the two edges it created, as adjacent stops in the new tour', () => {
  const tour = Core.createTour(scatter(20));
  const move = tour.improve();
  const n = tour.order.length;
  for (const [a, b] of move.edges) {
    const at = tour.order.indexOf(a);
    assert.strictEqual(tour.order[(at + 1) % n], b);
  }
});

test('tours too small to cross are left alone', () => {
  const tour = Core.createTour([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  assert.strictEqual(tour.improve(), null);
});
