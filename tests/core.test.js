'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');
require('../data/projects.js');
require('../data/work.js');

test('clamp holds a value inside its bounds', () => {
  assert.strictEqual(Core.clamp(5, 0, 10), 5);
  assert.strictEqual(Core.clamp(-3, 0, 10), 0);
  assert.strictEqual(Core.clamp(42, 0, 10), 10);
});

test('distance measures a 3-4-5 triangle', () => {
  assert.strictEqual(Core.distance(0, 0, 3, 4), 5);
});

test('swipeThreshold scales with the card but never gets trivially short', () => {
  assert.strictEqual(Core.swipeThreshold(340), 153);
  assert.strictEqual(Core.swipeThreshold(280), 126);
  assert.strictEqual(Core.swipeThreshold(200), 90, 'floored so a small card still needs a deliberate swipe');
  assert.strictEqual(Core.swipeThreshold(0), 90);
});

test('swipeProgress reports 0 to 1 across the threshold', () => {
  assert.strictEqual(Core.swipeProgress(0, 150), 0);
  assert.strictEqual(Core.swipeProgress(75, 150), 0.5);
  assert.strictEqual(Core.swipeProgress(150, 150), 1);
  assert.strictEqual(Core.swipeProgress(400, 150), 1, 'clamped past the end');
  assert.strictEqual(Core.swipeProgress(-90, 150), 0, 'dragging left is no progress');
});

test('isSwipeComplete only fires once the card has travelled far enough right', () => {
  assert.strictEqual(Core.isSwipeComplete(149, 150), false);
  assert.strictEqual(Core.isSwipeComplete(150, 150), true);
  assert.strictEqual(Core.isSwipeComplete(600, 150), true);
  assert.strictEqual(Core.isSwipeComplete(-600, 150), false, 'a leftward drag never completes');
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

test('escapeHtml neutralises every injection character', () => {
  assert.strictEqual(
    Core.escapeHtml('<img src=x onerror="a&b\'c">'),
    '&lt;img src=x onerror=&quot;a&amp;b&#39;c&quot;&gt;'
  );
  assert.strictEqual(Core.escapeHtml(null), '');
  assert.strictEqual(Core.escapeHtml(undefined), '');
});

test('parsePeriod converts months and years to comparable numbers', () => {
  const a = Core.parsePeriod('Jul 2025 - Dec 2025');
  assert.strictEqual(a.start, 2025 * 12 + 6);
  assert.strictEqual(a.end, 2025 * 12 + 11);

  const b = Core.parsePeriod('2026 - Present');
  assert.strictEqual(b.start, 2026 * 12);
  assert.strictEqual(b.end, Infinity);

  const c = Core.parsePeriod('2024');
  assert.strictEqual(c.start, 2024 * 12);
  assert.strictEqual(c.end, 2024 * 12);
});

test('parsePeriod accepts an en dash as the separator', () => {
  const p = Core.parsePeriod('Sep 2021 – Jul 2026');
  assert.strictEqual(p.start, 2021 * 12 + 8);
  assert.strictEqual(p.end, 2026 * 12 + 6);
});

test('sortWork orders by most recent start, matching the spec order', () => {
  const entries = [
    { company: 'Rivera Food Service Inc.', period: 'Sep 2021 – Jul 2026' },
    { company: 'AlphaBiz', period: 'Jul 2025 – Dec 2025' },
    { company: 'Interesting World', period: 'Jun 2024 – Aug 2024' }
  ];
  assert.deepStrictEqual(
    Core.sortWork(entries).map((e) => e.company),
    ['AlphaBiz', 'Interesting World', 'Rivera Food Service Inc.']
  );
});

test('sortWork does not mutate its input', () => {
  const entries = [
    { company: 'A', period: '2020' },
    { company: 'B', period: '2026' }
  ];
  Core.sortWork(entries);
  assert.deepStrictEqual(entries.map((e) => e.company), ['A', 'B']);
});

test('featuredProjects and projectsByKind filter the shipped data', () => {
  const featured = Core.featuredProjects(globalThis.PROJECTS);
  assert.deepStrictEqual(featured.map((p) => p.id), ['pokecha', 'ofye']);
  assert.strictEqual(Core.projectsByKind(globalThis.PROJECTS, 'product').length, 2);
  assert.strictEqual(Core.projectsByKind(globalThis.PROJECTS, 'project').length, 5);
});

test('projectCardHtml renders title, meta, bullets, chips and an external link', () => {
  const html = Core.projectCardHtml({
    id: 'demo', kind: 'project', title: 'Demo', tagline: 'A tagline.',
    url: 'https://example.com', period: '2024', role: 'Solo',
    stack: ['Python'], bullets: ['Did a thing.']
  });
  assert.ok(html.includes('id="demo"'));
  assert.ok(html.includes('<h3 class="serif">Demo</h3>'));
  assert.ok(html.includes('Solo · 2024'));
  assert.ok(html.includes('<li>Did a thing.</li>'));
  assert.ok(html.includes('<li class="chip">Python</li>'));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener"'));
});

test('projectCardHtml omits the link and tagline when absent', () => {
  const html = Core.projectCardHtml({
    id: 'x', title: 'X', period: '2024', role: 'Solo', stack: [], bullets: []
  });
  assert.ok(!html.includes('<a class="card-link'));
  assert.ok(!html.includes('class="tagline"'));
});

test('projectCardHtml escapes hostile content', () => {
  const html = Core.projectCardHtml({
    id: 'x', title: '<script>alert(1)</script>', period: '2024', role: 'r',
    stack: [], bullets: []
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('workEntryHtml renders role, company, period and location', () => {
  const html = Core.workEntryHtml({
    company: 'AlphaBiz', role: 'AI Intern', period: 'Jul 2025 – Dec 2025',
    location: 'Remote', bullets: ['Shipped it.']
  });
  assert.ok(html.includes('AI Intern'));
  assert.ok(html.includes('AlphaBiz'));
  assert.ok(html.includes('Jul 2025 – Dec 2025 · Remote'));
  assert.ok(html.includes('<li>Shipped it.</li>'));
});

test('workEntryHtml omits the separator when there is no location', () => {
  const html = Core.workEntryHtml({
    company: 'C', role: 'R', period: '2024', bullets: []
  });
  assert.ok(html.includes('>2024<'));
  assert.ok(!html.includes('2024 ·'));
});

test('courseworkRowHtml renders the index badge and repo link', () => {
  const html = Core.courseworkRowHtml({
    index: 'A0', title: 'Warm-up', url: 'https://github.com/zalu224/zlu224-assignment-0'
  });
  assert.ok(html.includes('>A0<'));
  assert.ok(html.includes('Warm-up'));
  assert.ok(html.includes('href="https://github.com/zalu224/zlu224-assignment-0"'));
});

test('shipped work data carries no stale "Present" dates', () => {
  const periods = globalThis.WORK.map((w) => w.period).join(' ');
  assert.ok(!/Present/.test(periods), 'no role should still say Present');
});

test('shipped education data uses the corrected BU degree', () => {
  const bu = globalThis.EDUCATION.find((e) => /Boston/.test(e.school));
  assert.match(bu.degree, /^B\.A\./);
  assert.match(bu.division, /College of Arts and Sciences/);
});

test('every coursework link is preserved and unique', () => {
  assert.strictEqual(globalThis.COURSEWORK.length, 12);
  const urls = globalThis.COURSEWORK.map((c) => c.url);
  assert.strictEqual(new Set(urls).size, 12);
  urls.forEach((u) => assert.match(u, /^https:\/\/github\.com\/zalu224\//));
});

test('bulletsHtml marks the first number for the counter animation', () => {
  const html = Core.bulletsHtml(['Achieved 96% accuracy on the test set.']);
  assert.ok(html.includes('<span class="stat-num" data-count>96%</span>'));
});

test('bulletsHtml leaves numberless bullets alone', () => {
  const html = Core.bulletsHtml(['Shipped the thing.']);
  assert.ok(!html.includes('data-count'));
  assert.ok(html.includes('<li>Shipped the thing.</li>'));
});
