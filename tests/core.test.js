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

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    _map: map
  };
}

function throwingStorage() {
  return {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); }
  };
}

test('isUnlockKey accepts scroll and keyboard intent keys', () => {
  [' ', 'ArrowDown', 'PageDown', 'Tab', 'Enter'].forEach((k) => {
    assert.strictEqual(Core.isUnlockKey(k), true, k + ' should unlock');
  });
  ['a', 'ArrowUp', 'Escape', 'Shift'].forEach((k) => {
    assert.strictEqual(Core.isUnlockKey(k), false, k + ' should not unlock');
  });
});

test('readUnlockFlag reads a set flag and survives a throwing storage', () => {
  assert.strictEqual(Core.readUnlockFlag(fakeStorage({ 'aaronlu.unlocked': '1' })), true);
  assert.strictEqual(Core.readUnlockFlag(fakeStorage()), false);
  assert.strictEqual(Core.readUnlockFlag(throwingStorage()), false);
});

test('writeUnlockFlag persists and reports failure without throwing', () => {
  const s = fakeStorage();
  assert.strictEqual(Core.writeUnlockFlag(s), true);
  assert.strictEqual(s.getItem('aaronlu.unlocked'), '1');
  assert.strictEqual(Core.writeUnlockFlag(throwingStorage()), false);
});

test('a fresh lock state starts locked', () => {
  const lock = Core.createLockState({ storage: fakeStorage() });
  assert.strictEqual(lock.isUnlocked(), false);
  assert.strictEqual(lock.reason(), null);
});

test('unlock is idempotent and notifies listeners exactly once', () => {
  const lock = Core.createLockState({ storage: fakeStorage() });
  const seen = [];
  lock.onUnlock((why) => seen.push(why));

  assert.strictEqual(lock.unlock('swipe'), true);
  assert.strictEqual(lock.unlock('scroll'), false);
  assert.strictEqual(lock.unlock('keyboard'), false);

  assert.deepStrictEqual(seen, ['swipe']);
  assert.strictEqual(lock.isUnlocked(), true);
  assert.strictEqual(lock.reason(), 'swipe');
});

test('unlock persists the flag to storage', () => {
  const s = fakeStorage();
  Core.createLockState({ storage: s }).unlock('swipe');
  assert.strictEqual(s.getItem('aaronlu.unlocked'), '1');
});

test('a stored flag restores the unlocked state on load', () => {
  const lock = Core.createLockState({ storage: fakeStorage({ 'aaronlu.unlocked': '1' }) });
  assert.strictEqual(lock.isUnlocked(), true);
  assert.strictEqual(lock.reason(), 'restored');
});

test('reduced motion starts unlocked regardless of storage', () => {
  const lock = Core.createLockState({ storage: fakeStorage(), reducedMotion: true });
  assert.strictEqual(lock.isUnlocked(), true);
  assert.strictEqual(lock.reason(), 'reduced-motion');
});

test('a throwing storage still yields a usable lock', () => {
  const lock = Core.createLockState({ storage: throwingStorage() });
  assert.strictEqual(lock.isUnlocked(), false);
  assert.strictEqual(lock.unlock('scroll'), true);
  assert.strictEqual(lock.isUnlocked(), true);
});

test('a missing storage is tolerated', () => {
  const lock = Core.createLockState({});
  assert.strictEqual(lock.isUnlocked(), false);
  assert.strictEqual(lock.unlock('scroll'), true);
});

test('parseCountable splits a plain percentage', () => {
  assert.deepStrictEqual(Core.parseCountable('88%'), {
    prefix: '', value: 88, suffix: '%', decimals: 0, grouped: false
  });
});

test('parseCountable handles grouped digits and a trailing plus', () => {
  assert.deepStrictEqual(Core.parseCountable('650,000+'), {
    prefix: '', value: 650000, suffix: '+', decimals: 0, grouped: true
  });
});

test('parseCountable keeps trailing words in the suffix', () => {
  const spec = Core.parseCountable('97% F1');
  assert.strictEqual(spec.value, 97);
  assert.strictEqual(spec.suffix, '% F1');
});

test('parseCountable preserves decimal places', () => {
  const spec = Core.parseCountable('1.5x');
  assert.strictEqual(spec.value, 1.5);
  assert.strictEqual(spec.decimals, 1);
});

test('parseCountable returns null when there is no number', () => {
  assert.strictEqual(Core.parseCountable('Present'), null);
  assert.strictEqual(Core.parseCountable(''), null);
});

test('formatCount round-trips every countable string we ship', () => {
  ['88%', '650,000+', '96%', '97% F1', '30%', '1.5x'].forEach((text) => {
    const spec = Core.parseCountable(text);
    assert.strictEqual(Core.formatCount(spec.value, spec), text, 'round trip for ' + text);
  });
});

test('formatCount groups intermediate values during the animation', () => {
  const spec = Core.parseCountable('650,000+');
  assert.strictEqual(Core.formatCount(325000, spec), '325,000+');
  assert.strictEqual(Core.formatCount(0, spec), '0+');
});

test('easeOutCubic starts at 0, ends at 1, and clamps out-of-range input', () => {
  assert.strictEqual(Core.easeOutCubic(0), 0);
  assert.strictEqual(Core.easeOutCubic(1), 1);
  assert.strictEqual(Core.easeOutCubic(-5), 0);
  assert.strictEqual(Core.easeOutCubic(5), 1);
  assert.ok(Core.easeOutCubic(0.5) > 0.5, 'ease-out is ahead of linear at the midpoint');
});
