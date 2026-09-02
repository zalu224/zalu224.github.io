# Portfolio Access Card Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `zalu224.github.io` as a motion-rich portfolio whose home page is gated behind a draggable ID card that the visitor swipes through a reader, with Work, Projects and Contact pages rendered from plain-JS data files.

**Architecture:** Zero-build static site deployed by `git push` to GitHub Pages. Pure, DOM-free logic lives in `js/core.js` and is unit-tested with Node's built-in test runner; all DOM wiring lives in `js/site.js` and is verified in a browser. Content lives in `data/projects.js` and `data/work.js` as globals, rendered through pure HTML-string builders in `core.js`.

**Tech Stack:** Hand-written HTML5, CSS custom properties, ES5-compatible browser JavaScript (no modules, no bundler, no dependencies). Tests run on Node 24's `node:test` + `node:assert`. Fonts from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-01-portfolio-access-card-design.md`

## Global Constraints

- **No build step, no bundler, no `node_modules`, no `package.json` dependencies.** The site must work when its files are served directly. Node is a local test tool only; nothing it does is required to deploy.
- **No frameworks or CDN libraries.** All JavaScript is hand-written and lives in the repo.
- Scripts are plain `<script src>` globals — **no ES modules, no `import`/`export`** — so pages work from `file://` as well as over HTTP.
- Design tokens are exactly: `--paper: #f6f5f2`, `--surface: #ffffff`, `--ink: #16161a`, `--muted: #5a5a63`, `--faint: #9a9aa3`, `--line: rgba(20, 20, 25, 0.10)`, `--accent: #1f3fd4`, `--led-idle: #c2760b`, `--led: #16a34a`.
- Fonts are exactly: Instrument Serif (display), JetBrains Mono (labels), Inter (body).
- Every animation targets `transform` and `opacity` only. Never animate layout properties.
- **Everything in §4 of the spec is disabled under `prefers-reduced-motion: reduce`**, and the home page loads already unlocked in that mode.
- The visitor must never be trapped: scroll intent, keyboard intent, reduced motion, and JS-disabled all reach full content.
- Copy comes from the spec. Where the old site and `resume.pdf` disagree, the spec's §11 correction table is authoritative. **Do not carry forward** "B.S.", "School of College & Arts", "AlphaBiz … Present", "Rivera … Present", "666,000", or "60% and 88% accuracies".
- Mono eyebrow treatment everywhere: `font-size: 11px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--faint)`.
- OFYE is described in engineering terms only. **Never reproduce its posted return percentages or win-rate claims** on this site.
- Commit after every task.

## File Structure

| File | Responsibility |
|---|---|
| `js/core.js` | Pure functions: geometry, tilt, parallax math, lock state machine, counter parsing, period sorting, HTML-string builders. No DOM, no globals beyond its own export. |
| `js/site.js` | All DOM wiring: renders data, binds pointer/keyboard/scroll handlers, runs the motion system. |
| `data/projects.js` | `window.PROJECTS` and `window.COURSEWORK` records. |
| `data/work.js` | `window.WORK`, `window.EDUCATION`, `window.SKILLS`. |
| `styles.css` | Every style rule for the whole site. Ordered: tokens → reset → type → chrome → motion → hero/card → page sections → responsive → reduced-motion. |
| `index.html` | Home: hero, card, reader, marquee, background, featured work, experience strip. |
| `work.html` | Work timeline, education, skills. |
| `projects.html` | Product cards, project cards, coursework grid. |
| `contact.html` | Contact rows. |
| `work-experience.html`, `assignments.html` | Redirect stubs. |
| `tests/core.test.js` | Unit tests for `js/core.js`. |

**Deviation from spec §1, deliberate:** the spec named a single `site.js`. Splitting pure logic into `js/core.js` is what makes TDD possible without a browser harness. Nothing else about the spec changes.

---

### Task 1: Core geometry and motion math

**Files:**
- Create: `js/core.js`
- Create: `tests/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `Core.clamp(value, min, max) -> number`, `Core.distance(ax, ay, bx, by) -> number`, `Core.centerOf(rect) -> {x, y}`, `Core.isWithinSnapZone(cardRect, slotRect, threshold) -> boolean`, `Core.tiltFromVelocity(velocityX, maxDeg) -> number`, `Core.parallaxOffset(scrollY, rate, maxPx) -> number`. A `rect` is any object with `left`, `top`, `width`, `height` numbers (a `DOMRect` satisfies this). In Node the module is `require`-able and returns the same object as the browser's `window.Core`.

- [ ] **Step 1: Write the failing test**

Create `tests/core.test.js`:

```js
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
  const card = { left: 0, top: 0, width: 100, height: 100 };   // center 50,50
  const near = { left: 90, top: 0, width: 100, height: 100 };  // center 140,50 -> 90 away
  const far = { left: 400, top: 0, width: 100, height: 100 };  // center 450,50 -> 400 away
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../js/core.js'`

- [ ] **Step 3: Write the minimal implementation**

Create `js/core.js`:

```js
(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function distance(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function isWithinSnapZone(cardRect, slotRect, threshold) {
    var c = centerOf(cardRect);
    var s = centerOf(slotRect);
    return distance(c.x, c.y, s.x, s.y) <= threshold;
  }

  function tiltFromVelocity(velocityX, maxDeg) {
    return clamp(velocityX * 0.4, -maxDeg, maxDeg);
  }

  function parallaxOffset(scrollY, rate, maxPx) {
    return clamp(scrollY * rate, -maxPx, maxPx);
  }

  var api = {
    clamp: clamp,
    distance: distance,
    centerOf: centerOf,
    isWithinSnapZone: isWithinSnapZone,
    tiltFromVelocity: tiltFromVelocity,
    parallaxOffset: parallaxOffset
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`
Expected: PASS — 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add core geometry and motion math"
```

---

### Task 2: Lock state machine

**Files:**
- Modify: `js/core.js` (add before the `api` object)
- Modify: `tests/core.test.js` (append)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `Core.UNLOCK_KEY -> 'aaronlu.unlocked'`; `Core.isUnlockKey(key) -> boolean`; `Core.readUnlockFlag(storage) -> boolean`; `Core.writeUnlockFlag(storage) -> boolean`; `Core.createLockState({storage, reducedMotion}) -> {isUnlocked(), reason(), onUnlock(fn), unlock(why)}`. `unlock(why)` returns `true` the first time and `false` on every later call. `storage` is any object with `getItem`/`setItem`; a throwing storage must never propagate. Task 10 wires this to the DOM.

- [ ] **Step 1: Write the failing test**

Append to `tests/core.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`
Expected: FAIL — `Core.isUnlockKey is not a function`

- [ ] **Step 3: Write the minimal implementation**

In `js/core.js`, insert before the `var api = {` line:

```js
  var UNLOCK_KEY = 'aaronlu.unlocked';
  var UNLOCK_KEYS = [' ', 'Spacebar', 'ArrowDown', 'PageDown', 'Tab', 'Enter'];

  function isUnlockKey(key) {
    return UNLOCK_KEYS.indexOf(key) !== -1;
  }

  function readUnlockFlag(storage) {
    try {
      return storage.getItem(UNLOCK_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function writeUnlockFlag(storage) {
    try {
      storage.setItem(UNLOCK_KEY, '1');
      return true;
    } catch (err) {
      return false;
    }
  }

  function createLockState(options) {
    var opts = options || {};
    var storage = opts.storage || null;
    var listeners = [];
    var unlocked = false;
    var reason = null;

    if (opts.reducedMotion) {
      unlocked = true;
      reason = 'reduced-motion';
    } else if (storage && readUnlockFlag(storage)) {
      unlocked = true;
      reason = 'restored';
    }

    return {
      isUnlocked: function () { return unlocked; },
      reason: function () { return reason; },
      onUnlock: function (fn) { listeners.push(fn); },
      unlock: function (why) {
        if (unlocked) { return false; }
        unlocked = true;
        reason = why || 'unknown';
        if (storage) { writeUnlockFlag(storage); }
        for (var i = 0; i < listeners.length; i++) { listeners[i](reason); }
        return true;
      }
    };
  }
```

Then add these keys to the `api` object: `UNLOCK_KEY: UNLOCK_KEY, isUnlockKey: isUnlockKey, readUnlockFlag: readUnlockFlag, writeUnlockFlag: writeUnlockFlag, createLockState: createLockState`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`
Expected: PASS — 16 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add idempotent lock state machine with storage fallback"
```

---

### Task 3: Animated counter parsing

**Files:**
- Modify: `js/core.js`
- Modify: `tests/core.test.js` (append)

**Interfaces:**
- Consumes: `clamp` from Task 1.
- Produces: `Core.parseCountable(text) -> {prefix, value, suffix, decimals, grouped} | null`; `Core.formatCount(value, spec) -> string` where `spec` is a `parseCountable` result; `Core.easeOutCubic(t) -> number` clamped to `[0, 1]`. Round-trip invariant: `formatCount(spec.value, spec) === text.trim()`. Task 11 uses these to animate stat numbers.

- [ ] **Step 1: Write the failing test**

Append to `tests/core.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`
Expected: FAIL — `Core.parseCountable is not a function`

- [ ] **Step 3: Write the minimal implementation**

In `js/core.js`, insert before the `var api = {` line:

```js
  var COUNT_RE = /^([^0-9-]*)(-?[0-9,]*\.?[0-9]+)(.*)$/;

  function parseCountable(text) {
    var match = COUNT_RE.exec(String(text == null ? '' : text).trim());
    if (!match) { return null; }
    var raw = match[2];
    var value = parseFloat(raw.replace(/,/g, ''));
    if (isNaN(value)) { return null; }
    var dot = raw.indexOf('.');
    return {
      prefix: match[1],
      value: value,
      suffix: match[3],
      decimals: dot === -1 ? 0 : raw.length - dot - 1,
      grouped: raw.indexOf(',') !== -1
    };
  }

  function formatCount(value, spec) {
    var fixed = value.toFixed(spec.decimals);
    if (spec.grouped) {
      var parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      fixed = parts.join('.');
    }
    return spec.prefix + fixed + spec.suffix;
  }

  function easeOutCubic(t) {
    var c = clamp(t, 0, 1);
    return 1 - Math.pow(1 - c, 3);
  }
```

Add to the `api` object: `parseCountable: parseCountable, formatCount: formatCount, easeOutCubic: easeOutCubic`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`
Expected: PASS — 24 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add js/core.js tests/core.test.js
git commit -m "feat: add countable parsing and easing for animated stats"
```

---

### Task 4: Content data files and HTML builders

**Files:**
- Create: `data/projects.js`
- Create: `data/work.js`
- Modify: `js/core.js`
- Modify: `tests/core.test.js` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `window.PROJECTS` — array of `{id, kind, featured, title, tagline, url, period, role, stack, bullets, caseStudy}`. `kind` is `'product'` or `'project'`.
  - `window.COURSEWORK` — array of `{index, title, url}`.
  - `window.WORK` — array of `{company, role, period, location, bullets}`.
  - `window.EDUCATION` — array of `{school, division, degree, period}`.
  - `window.SKILLS` — `{languages: [], ml: [], data: []}`.
  - `Core.escapeHtml(value) -> string`, `Core.parsePeriod(period) -> {start, end}` in absolute months, `Core.sortWork(entries) -> entries` newest-start-first, `Core.featuredProjects(list)`, `Core.projectsByKind(list, kind)`, `Core.chipsHtml(stack)`, `Core.bulletsHtml(bullets)`, `Core.projectCardHtml(project)`, `Core.workEntryHtml(entry)`, `Core.courseworkRowHtml(item)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/core.test.js`:

```js
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
  assert.ok(!html.includes('<a class="card-link"'));
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
```

Add this near the top of `tests/core.test.js`, immediately after the `Core` require, so the data files populate globals for the tests above:

```js
require('../data/projects.js');
require('../data/work.js');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../data/projects.js'`

- [ ] **Step 3: Write the data files**

Create `data/projects.js`:

```js
(function (global) {
  'use strict';

  global.PROJECTS = [
    {
      id: 'pokecha',
      kind: 'product',
      featured: true,
      title: 'Pokécha',
      tagline: 'Real graded cards. Published odds. Verifiable openings.',
      url: 'https://pokecha.xyz',
      period: '2026',
      role: 'Design & build',
      stack: ['Next.js', 'TypeScript', 'Supabase'],
      bullets: [
        'Built a pack-opening platform backed by real graded trading-card slabs, where every opening resolves to a listed prize tier.',
        'Published full odds and tier tables before purchase, and committed a server seed hash per opening so a user can verify the draw afterward.',
        'Shipped collection browsing, per-pack vault pages, an authenticated opening flow, and a fallback path for when a specific slab is unavailable.'
      ],
      caseStudy: null
    },
    {
      id: 'ofye',
      kind: 'product',
      featured: true,
      title: 'OFYE Group',
      tagline: 'Crypto education and tiered community access.',
      url: 'https://ofye.org',
      period: '2026',
      role: 'Design & build',
      stack: ['Next.js', 'Stripe'],
      bullets: [
        'Built a membership platform with four one-time-purchase tiers and Stripe checkout.',
        'Gated educational content and community access per tier, with Telegram provisioning triggered on successful purchase.',
        'Designed the tier comparison and checkout flow around a single-purchase model rather than recurring subscriptions.'
      ],
      caseStudy: null
    },
    {
      id: 'nyc-air-quality',
      kind: 'project',
      featured: false,
      title: 'NYC Urban Air Quality Analysis',
      tagline: null,
      url: null,
      period: '2024',
      role: 'Data analysis',
      stack: ['Python', 'Pandas', 'Scikit-learn', 'Flask'],
      bullets: [
        'Processed 650,000+ records from NYC’s street-tree dataset alongside pollution data to analyze the relationship between urban forestry and air quality.',
        'Engineered features and built heat maps and correlation graphs to identify relationships between environmental variables.',
        'Built a Flask application with interactive geographic visualization, finding that trees with diameters of 60 inches or more correlate with 30% lower PM2.5 levels.'
      ],
      caseStudy: null
    },
    {
      id: 'fake-news',
      kind: 'project',
      featured: false,
      title: 'Fake News Detection',
      tagline: null,
      url: null,
      period: '2024',
      role: 'Machine learning',
      stack: ['Python', 'Pandas', 'Scikit-learn', 'NLTK', 'Flask'],
      bullets: [
        'Built an NLP classification system trained on 20,000+ real-world news articles using TF-IDF and logistic regression.',
        'Implemented preprocessing, normalization, feature extraction and model evaluation pipelines.',
        'Achieved 96% accuracy, with 97% recall and 97% F1.'
      ],
      caseStudy: null
    },
    {
      id: 'battleship',
      kind: 'project',
      featured: false,
      title: 'Probabilistic AI Agent for Battleship',
      tagline: null,
      url: null,
      period: 'Jan 2024 – May 2024',
      role: 'Game AI',
      stack: ['Java'],
      bullets: [
        'Built an agent that maintains a heat map of ship-placement probabilities and updates it after every shot based on the remaining fleet and board state.',
        'Implemented targeting that reasons over adjacency, cardinal directions and prior outcomes to prioritize high-probability coordinates.',
        'Adapted probability weights across possible ship configurations while continuing to explore unsearched regions of the board.'
      ],
      caseStudy: null
    },
    {
      id: 'tetris-q-learning',
      kind: 'project',
      featured: false,
      title: 'Tetris with a Q-Learning Bot',
      tagline: null,
      url: null,
      period: 'Jan 2024 – May 2024',
      role: 'Reinforcement learning',
      stack: ['Java'],
      bullets: [
        'Implemented a Q-learning agent that predicts the best action for a given board state.',
        'Designed a two-hidden-layer network that outputs a Q-value scoring each action from a feature vector of the game state.',
        'Built a reward function over stack height, line completions, holes and blockades to balance exploration against exploitation.'
      ],
      caseStudy: null
    },
    {
      id: 'nutrisistant',
      kind: 'project',
      featured: false,
      title: 'Nutrisistant',
      tagline: null,
      url: null,
      period: 'Sep 2023 – Dec 2023',
      role: 'Full stack, group project',
      stack: ['React', 'Node.js', 'MongoDB'],
      bullets: [
        'Built an app that reports nutritional facts for a food item, sourcing data from the Spoonacular API.',
        'Implemented the backing database, Google authentication and the API routes from front to back.',
        'Built the frontend in React and the backend in Node.js with Axios for API calls and data transfer.'
      ],
      caseStudy: null
    }
  ];

  global.COURSEWORK = [
    { index: 'A0', title: 'Python warm-up: summing two numbers', url: 'https://github.com/zalu224/zlu224-assignment-0' },
    { index: 'A1', title: 'Elevators analysis with Python', url: 'https://github.com/zalu224/zlu224-assignment-1' },
    { index: 'A2', title: 'K-means clustering visualizer', url: 'https://github.com/zalu224/zlu224-assignment-2' },
    { index: 'A3', title: 'SVD preprocessing on MNIST with logistic regression', url: 'https://github.com/zalu224/zlu224-assignment-3' },
    { index: 'A4', title: 'Latent semantic analysis search engine, 20 Newsgroups', url: 'https://github.com/zalu224/zlu224-assignment-4' },
    { index: 'A5', title: 'K-nearest neighbors Kaggle competition', url: 'https://github.com/zalu224/zlu224-assignment-5' },
    { index: 'MID', title: 'Amazon movie review rating prediction', url: 'https://github.com/zalu224/CS506-Midterm' },
    { index: 'A6', title: 'Interactive linear regression assumptions', url: 'https://github.com/zalu224/zlu224-assignment-6' },
    { index: 'A7', title: 'Linear regression simulations with hypothesis tests', url: 'https://github.com/zalu224/zlu224-assignment-7' },
    { index: 'A8', title: 'Logistic regression with shifting clusters', url: 'https://github.com/zalu224/zlu224-assignment-8' },
    { index: 'A9', title: 'Neural networks', url: 'https://github.com/zalu224/zlu224-assignment-9' },
    { index: 'A10', title: 'Image search', url: 'https://github.com/zalu224/zlu224-assignment-10' }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

Create `data/work.js`:

```js
(function (global) {
  'use strict';

  global.WORK = [
    {
      company: 'AlphaBiz',
      role: 'AI Intern',
      period: 'Jul 2025 – Dec 2025',
      location: null,
      bullets: [
        'Integrated AI confidential information memorandum (CIM) enhancement into an M&A platform supporting business evaluation and valuation workflows.',
        'Built secure, event-driven AI processing workflows using AWS Lambda and Kinesis.',
        'Collaborated on translating business requirements into product functionality.'
      ]
    },
    {
      company: 'Interesting World',
      role: 'Machine Learning Intern',
      period: 'Jun 2024 – Aug 2024',
      location: 'Hangzhou, Zhejiang',
      bullets: [
        'Developed a 7-class NLP classification system for automated user-generated content moderation, achieving 88% accuracy.',
        'Experimented with BERT, LoRA, FastText, Word2Vec and Hugging Face Transformers to compare approaches to text representation and classification.',
        'Built preprocessing and tokenization pipelines for multilingual and emoji-rich text, reducing model training time by 50% through dynamic padding and LoRA.'
      ]
    },
    {
      company: 'Rivera Food Service Inc.',
      role: 'Project Manager, part-time',
      period: 'Sep 2021 – Jul 2026',
      location: null,
      bullets: [
        'Worked with vendors and engineers to define technical requirements for business systems integrating sales, pricing, inventory and replenishment data.',
        'Coordinated data integration and analytics requirements between business stakeholders and developers.'
      ]
    }
  ];

  global.EDUCATION = [
    {
      school: 'University of Southern California',
      division: 'Viterbi School of Engineering',
      degree: 'M.S. Computer Science — Artificial Intelligence',
      period: '2026 – Present'
    },
    {
      school: 'Boston University',
      division: 'College of Arts and Sciences',
      degree: 'B.A. Computer Science',
      period: 'Graduated May 2025'
    }
  ];

  global.SKILLS = {
    languages: ['Java', 'Python', 'JavaScript', 'C', 'HTML', 'SQL'],
    ml: ['PyTorch', 'Scikit-learn', 'BERT', 'LoRA', 'Transformers', 'NLTK', 'Vectorization', 'Q-Learning'],
    data: ['React', 'Node.js', 'Next.js', 'MongoDB', 'MySQL', 'XML', 'AWS', 'Google APIs']
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Write the builders**

In `js/core.js`, insert before the `var api = {` line:

```js
  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value).replace(/[&<>"']/g, function (ch) { return ESCAPES[ch]; });
  }

  var MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  function parseMoment(text) {
    var t = String(text === undefined ? '' : text).trim().toLowerCase();
    if (t === 'present') { return Infinity; }
    var withMonth = /^([a-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(t);
    if (withMonth) { return Number(withMonth[2]) * 12 + (MONTHS[withMonth[1]] || 0); }
    var yearOnly = /(\d{4})/.exec(t);
    if (yearOnly) { return Number(yearOnly[1]) * 12; }
    return -Infinity;
  }

  function parsePeriod(period) {
    var parts = String(period).split(/\s*[–—-]\s*/);
    var startText = parts[0];
    var endText = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    return { start: parseMoment(startText), end: parseMoment(endText) };
  }

  function sortWork(entries) {
    return entries.slice().sort(function (a, b) {
      var pa = parsePeriod(a.period);
      var pb = parsePeriod(b.period);
      if (pb.start !== pa.start) { return pb.start - pa.start; }
      if (pb.end === pa.end) { return 0; }
      return pb.end - pa.end;
    });
  }

  function featuredProjects(list) {
    return list.filter(function (p) { return p.featured === true; });
  }

  function projectsByKind(list, kind) {
    return list.filter(function (p) { return p.kind === kind; });
  }

  function chipsHtml(stack) {
    if (!stack || !stack.length) { return ''; }
    return '<ul class="chips">' + stack.map(function (s) {
      return '<li class="chip">' + escapeHtml(s) + '</li>';
    }).join('') + '</ul>';
  }

  function bulletsHtml(bullets) {
    if (!bullets || !bullets.length) { return ''; }
    return '<ul class="bullets">' + bullets.map(function (b) {
      return '<li>' + escapeHtml(b) + '</li>';
    }).join('') + '</ul>';
  }

  function projectCardHtml(project) {
    var link = project.url
      ? '<a class="card-link mono" href="' + escapeHtml(project.url) +
        '" target="_blank" rel="noopener">Visit <span aria-hidden="true">↗</span></a>'
      : '';
    var tagline = project.tagline
      ? '<p class="tagline">' + escapeHtml(project.tagline) + '</p>'
      : '';
    return '<article class="project-card reveal" id="' + escapeHtml(project.id) + '">' +
      '<header class="project-head">' +
        '<h3 class="serif">' + escapeHtml(project.title) + '</h3>' +
        '<p class="meta mono">' + escapeHtml(project.role) + ' · ' + escapeHtml(project.period) + '</p>' +
      '</header>' +
      tagline + bulletsHtml(project.bullets) + chipsHtml(project.stack) + link +
    '</article>';
  }

  function workEntryHtml(entry) {
    var meta = escapeHtml(entry.period);
    if (entry.location) { meta += ' · ' + escapeHtml(entry.location); }
    return '<article class="timeline-item reveal">' +
      '<h3 class="serif">' + escapeHtml(entry.role) +
        ' <span class="at">at</span> ' + escapeHtml(entry.company) + '</h3>' +
      '<p class="meta mono">' + meta + '</p>' +
      bulletsHtml(entry.bullets) +
    '</article>';
  }

  function courseworkRowHtml(item) {
    return '<li class="course-row">' +
      '<span class="course-index mono">' + escapeHtml(item.index) + '</span>' +
      '<span class="course-title">' + escapeHtml(item.title) + '</span>' +
      '<a class="course-link mono" href="' + escapeHtml(item.url) +
        '" target="_blank" rel="noopener">GitHub <span aria-hidden="true">→</span></a>' +
    '</li>';
  }
```

Add to the `api` object: `escapeHtml: escapeHtml, parsePeriod: parsePeriod, sortWork: sortWork, featuredProjects: featuredProjects, projectsByKind: projectsByKind, chipsHtml: chipsHtml, bulletsHtml: bulletsHtml, projectCardHtml: projectCardHtml, workEntryHtml: workEntryHtml, courseworkRowHtml: courseworkRowHtml`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test`
Expected: PASS — 39 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add data/ js/core.js tests/core.test.js
git commit -m "feat: add content data files and pure HTML builders"
```

---

### Task 5: Design tokens, shared chrome, and the Contact page

Contact is the simplest real page, so it proves the tokens, nav, footer and reveal machinery end to end before anything harder is built on them.

**Files:**
- Create: `styles.css` (replaces the existing file wholesale)
- Create: `contact.html`
- Create: `js/site.js`
- Delete: nothing yet

**Interfaces:**
- Consumes: `Core` (Task 1).
- Produces: the `.nav`, `.site-footer`, `.page-head`, `.column`, `.reveal`, `.mono`, `.serif` class contract every later page uses; `Site.prefersReducedMotion() -> boolean`; `Site.initReveals()`.

- [ ] **Step 1: Write the stylesheet**

Create `styles.css`:

```css
/* ---------- tokens ---------- */
:root {
  --paper: #f6f5f2;
  --surface: #ffffff;
  --ink: #16161a;
  --muted: #5a5a63;
  --faint: #9a9aa3;
  --line: rgba(20, 20, 25, 0.10);
  --accent: #1f3fd4;
  --led-idle: #c2760b;
  --led: #16a34a;

  --serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --column: 46rem;
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  color-scheme: light;
}

/* ---------- reset ---------- */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
img { max-width: 100%; display: block; }
ul { margin: 0; padding: 0; list-style: none; }
a { color: inherit; }

/* ---------- type ---------- */
.serif { font-family: var(--serif); font-weight: 400; letter-spacing: -0.01em; }
.mono { font-family: var(--mono); }
.eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: var(--faint);
  margin: 0 0 0.75rem;
}
h1, h2, h3 { font-family: var(--serif); font-weight: 400; margin: 0; }
h1 { font-size: clamp(2.5rem, 6vw, 4rem); line-height: 1.05; }
h2 { font-size: clamp(1.75rem, 4vw, 2.5rem); line-height: 1.15; }
h3 { font-size: 1.35rem; line-height: 1.25; }
p { margin: 0 0 1rem; color: var(--muted); }
.accent { color: var(--accent); }
.italic { font-style: italic; }

/* ---------- layout ---------- */
.column { max-width: var(--column); margin: 0 auto; padding: 0 1.5rem; }
.page-head { padding: 9rem 0 3rem; }
.page-main { padding-bottom: 6rem; }

/* ---------- nav ---------- */
.nav {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 0.7rem 1.75rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  transition: opacity 500ms ease;
}
.nav a {
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  color: var(--muted);
  transition: color 200ms ease, transform 200ms ease;
}
.nav a:hover { color: var(--ink); }
.nav a[aria-current="page"] { color: var(--accent); }

/* ---------- footer ---------- */
.site-footer {
  border-top: 1px solid var(--line);
  padding: 2rem 1.5rem;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--faint);
}
.site-footer > div {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

/* ---------- contact rows ---------- */
.contact-list { border-top: 1px solid var(--line); }
.contact-row {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
}
.contact-label {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--faint);
  flex: 0 0 6.5rem;
}
.contact-value { flex: 1; color: var(--ink); }
.contact-arrow { color: var(--accent); transition: transform 200ms ease; }
a.contact-row:hover .contact-arrow { transform: translateX(4px); }

/* ---------- reveals ---------- */
.reveal { opacity: 0; transform: translateY(24px); }
.reveal.is-visible {
  opacity: 1;
  transform: none;
  transition: opacity 600ms ease, transform 600ms ease;
}

/* ---------- focus ---------- */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}

/* ---------- responsive ---------- */
@media (max-width: 768px) {
  .nav { gap: 1.1rem; padding: 0.6rem 1.1rem; }
  .nav a { font-size: 0.8rem; }
  .page-head { padding: 7rem 0 2rem; }
  .contact-row { flex-wrap: wrap; gap: 0.5rem 1rem; }
  .contact-label { flex-basis: 100%; }
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
  .reveal { opacity: 1; transform: none; }
}
```

- [ ] **Step 2: Write the site script**

Create `js/site.js`:

```js
(function (global) {
  'use strict';

  var Core = global.Core;

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function initReveals() {
    var nodes = document.querySelectorAll('.reveal');
    if (prefersReducedMotion() || !global.IntersectionObserver) {
      for (var i = 0; i < nodes.length; i++) { nodes[i].classList.add('is-visible'); }
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    for (var j = 0; j < nodes.length; j++) { observer.observe(nodes[j]); }
  }

  function init() {
    initReveals();
  }

  global.Site = {
    prefersReducedMotion: prefersReducedMotion,
    initReveals: initReveals,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
```

- [ ] **Step 3: Write the Contact page**

Create `contact.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contact — Aaron Lu</title>
<meta name="description" content="Get in touch with Aaron Lu — email, phone, LinkedIn and GitHub.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav">
  <a href="index.html">Home</a>
  <a href="work.html">Work</a>
  <a href="projects.html">Projects</a>
  <a href="contact.html" aria-current="page">Contact</a>
</nav>

<main class="page-main">
  <header class="page-head column">
    <p class="eyebrow">Contact</p>
    <h1>Get in touch</h1>
    <p>Open to conversations about machine learning, product engineering, and anything I have shipped.</p>
  </header>

  <div class="column">
    <ul class="contact-list">
      <li><a class="contact-row reveal" href="mailto:aaronlu6@gmail.com">
        <span class="contact-label">Email</span>
        <span class="contact-value">aaronlu6@gmail.com</span>
        <span class="contact-arrow" aria-hidden="true">&rarr;</span>
      </a></li>
      <li><a class="contact-row reveal" href="tel:+16263483399">
        <span class="contact-label">Phone</span>
        <span class="contact-value">(626) 348-3399</span>
        <span class="contact-arrow" aria-hidden="true">&rarr;</span>
      </a></li>
      <li><a class="contact-row reveal" href="https://www.linkedin.com/in/aaronlu224/" target="_blank" rel="noopener">
        <span class="contact-label">LinkedIn</span>
        <span class="contact-value">linkedin.com/in/aaronlu224</span>
        <span class="contact-arrow" aria-hidden="true">&rarr;</span>
      </a></li>
      <li><a class="contact-row reveal" href="https://github.com/zalu224" target="_blank" rel="noopener">
        <span class="contact-label">GitHub</span>
        <span class="contact-value">github.com/zalu224</span>
        <span class="contact-arrow" aria-hidden="true">&rarr;</span>
      </a></li>
      <li><div class="contact-row reveal">
        <span class="contact-label">Location</span>
        <span class="contact-value">Arcadia, CA</span>
      </div></li>
    </ul>
  </div>
</main>

<footer class="site-footer">
  <div>
    <span>&copy; 2026 Zhong Wen Aaron Lu</span>
    <span>Built by hand</span>
  </div>
</footer>

<script src="js/core.js"></script>
<script src="js/site.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify in a browser**

Run: `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000/contact.html`.

Confirm: paper background, serif "Get in touch", floating pill nav with Contact in accent, five rows that fade up as they enter view, arrows sliding right on hover, and a bordered footer. Tab through the page and confirm a visible accent focus ring on every link. Resize to 375px and confirm no horizontal scrollbar.

- [ ] **Step 5: Run the unit tests to confirm nothing regressed**

Run: `node --test`
Expected: PASS — 39 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add styles.css js/site.js contact.html
git commit -m "feat: add design tokens, shared chrome, and contact page"
```

---

### Task 6: Projects page with data-driven rendering

**Files:**
- Create: `projects.html`
- Modify: `styles.css` (append the project and coursework blocks)
- Modify: `js/site.js` (add `renderProjects`)

**Interfaces:**
- Consumes: `Core.projectsByKind`, `Core.projectCardHtml`, `Core.courseworkRowHtml` (Task 4); `Site.initReveals` (Task 5).
- Produces: `Site.renderProjects()`, which fills `#products`, `#project-list` and `#coursework-list` if they exist.

- [ ] **Step 1: Append the styles**

Append to `styles.css`, before the `@media (max-width: 768px)` block:

```css
/* ---------- project cards ---------- */
.section-head { padding: 3rem 0 1.5rem; }
.card-grid { display: grid; gap: 1.25rem; }
.project-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.75rem;
  transition: transform 250ms ease, box-shadow 250ms ease;
}
.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(20, 20, 25, 0.07);
}
.project-head { margin-bottom: 0.75rem; }
.project-card .meta {
  font-size: 0.75rem;
  color: var(--faint);
  margin: 0.35rem 0 0;
  letter-spacing: 0.05em;
}
.project-card .tagline { color: var(--ink); font-style: italic; }
.bullets { margin: 0 0 1rem; }
.bullets li {
  position: relative;
  padding-left: 1.1rem;
  margin-bottom: 0.5rem;
  color: var(--muted);
  font-size: 0.95rem;
}
.bullets li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
.chip {
  font-family: var(--mono);
  font-size: 11px;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
}
.card-link {
  font-size: 0.8rem;
  text-decoration: none;
  color: var(--accent);
  display: inline-block;
  transition: transform 200ms ease;
}
.card-link:hover { transform: translateX(3px); }

/* ---------- coursework ---------- */
.coursework-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 2rem;
  border-top: 1px solid var(--line);
}
.course-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--line);
}
.course-index {
  font-size: 10px;
  color: var(--accent);
  flex: 0 0 2.5rem;
  letter-spacing: 0.1em;
}
.course-title { flex: 1; font-size: 0.875rem; color: var(--muted); }
.course-link { font-size: 11px; color: var(--faint); text-decoration: none; }
.course-link:hover { color: var(--accent); }
.noscript-note { border: 1px solid var(--line); padding: 1rem; border-radius: 8px; }
```

Add inside the existing `@media (max-width: 768px)` block:

```css
  .coursework-grid { grid-template-columns: 1fr; gap: 0; }
  .project-card { padding: 1.25rem; }
```

- [ ] **Step 2: Add the renderer**

In `js/site.js`, add before `function init()`:

```js
  function fill(id, html) {
    var node = document.getElementById(id);
    if (node) { node.innerHTML = html; }
    return node;
  }

  function renderProjects() {
    if (!global.PROJECTS) { return; }

    fill('products', Core.projectsByKind(global.PROJECTS, 'product')
      .map(Core.projectCardHtml).join(''));

    fill('project-list', Core.projectsByKind(global.PROJECTS, 'project')
      .map(Core.projectCardHtml).join(''));

    if (global.COURSEWORK) {
      fill('coursework-list', global.COURSEWORK.map(Core.courseworkRowHtml).join(''));
    }
  }
```

Change `init` to:

```js
  function init() {
    renderProjects();
    initReveals();
  }
```

and add `renderProjects: renderProjects` to the `global.Site` object.

Rendering must run **before** `initReveals`, because the observer has to see the cards that rendering created.

- [ ] **Step 3: Write the page**

Create `projects.html`. It is identical to `contact.html` in head, nav and footer except for the `<title>`, the description, and which nav link carries `aria-current="page"` — copy that structure, set `<a href="projects.html" aria-current="page">`, use `<title>Projects — Aaron Lu</title>` and `<meta name="description" content="Products and projects by Aaron Lu — Pokécha, OFYE, and machine learning work.">`. Add `<script src="data/projects.js"></script>` before `js/core.js`. The `<main>` is:

```html
<main class="page-main">
  <header class="page-head column">
    <p class="eyebrow">Selected work</p>
    <h1>Projects</h1>
    <p>Products I have shipped end to end, and the machine learning work behind them.</p>
  </header>

  <div class="column">
    <section>
      <header class="section-head">
        <p class="eyebrow">Products</p>
        <h2>Live and in use</h2>
      </header>
      <div class="card-grid" id="products"></div>
    </section>

    <section>
      <header class="section-head">
        <p class="eyebrow">Projects</p>
        <h2>Machine learning &amp; systems</h2>
      </header>
      <div class="card-grid" id="project-list"></div>
    </section>

    <noscript>
      <div class="noscript-note">
        <p>This page renders its content with JavaScript. Direct links:</p>
        <ul>
          <li><a href="https://pokecha.xyz">Pok&eacute;cha</a> — graded-card pack openings with published odds</li>
          <li><a href="https://ofye.org">OFYE Group</a> — tiered membership and education platform</li>
          <li>NYC Urban Air Quality Analysis, Fake News Detection, Battleship AI, Tetris Q-Learning bot, Nutrisistant</li>
          <li><a href="https://github.com/zalu224">All repositories on GitHub</a></li>
        </ul>
      </div>
    </noscript>

    <section id="coursework">
      <header class="section-head">
        <p class="eyebrow">Coursework — CS506</p>
        <h2>Boston University</h2>
        <p>Assignments from CS506, Data Science Tools and Applications.</p>
      </header>
      <ul class="coursework-grid" id="coursework-list"></ul>
    </section>
  </div>
</main>
```

- [ ] **Step 4: Verify in a browser**

Reload `http://localhost:8000/projects.html`.

Confirm: Pokécha and OFYE render first as cards with stack chips and a `Visit ↗` link; five project cards follow; twelve coursework rows render in two columns. Click one coursework link and one product link and confirm both open in a new tab. Confirm **no return percentages or win rates appear anywhere** in the OFYE card.

- [ ] **Step 5: Verify the no-JS floor**

Disable JavaScript in DevTools and reload. Confirm the `<noscript>` block appears with working links, and the page still has nav, footer and header.

- [ ] **Step 6: Commit**

```bash
git add projects.html styles.css js/site.js
git commit -m "feat: add data-driven projects page with coursework grid"
```

---

### Task 7: Work page

**Files:**
- Create: `work.html`
- Modify: `styles.css` (append timeline, education, skills)
- Modify: `js/site.js` (add `renderWork`)

**Interfaces:**
- Consumes: `Core.sortWork`, `Core.workEntryHtml`, `Core.escapeHtml` (Task 4).
- Produces: `Site.renderWork()`, filling `#timeline`, `#education-list` and `#skills-list`.

- [ ] **Step 1: Append the styles**

Append to `styles.css`, before the `@media (max-width: 768px)` block:

```css
/* ---------- timeline ---------- */
.timeline { border-left: 1px solid var(--line); padding-left: 2rem; margin-left: 0.5rem; }
.timeline-item { position: relative; padding-bottom: 2.5rem; }
.timeline-item::before {
  content: "";
  position: absolute;
  left: -2.3rem;
  top: 0.6rem;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--paper);
}
.timeline-item .at { color: var(--faint); font-style: italic; }
.timeline-item .meta {
  font-size: 0.75rem;
  color: var(--faint);
  letter-spacing: 0.05em;
  margin: 0.35rem 0 0.9rem;
}

/* ---------- education & skills ---------- */
.edu-item { padding: 1rem 0; border-bottom: 1px solid var(--line); }
.edu-item h3 { font-size: 1.15rem; }
.edu-item .meta { font-family: var(--mono); font-size: 0.75rem; color: var(--faint); margin: 0.2rem 0 0; }
.edu-item .degree { color: var(--muted); margin: 0.35rem 0 0; }
.skill-group { padding: 1rem 0; border-bottom: 1px solid var(--line); }
.skill-group h3 {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--faint);
  margin-bottom: 0.6rem;
}
```

Add inside the `@media (max-width: 768px)` block:

```css
  .timeline { padding-left: 1.25rem; margin-left: 0.35rem; }
  .timeline-item::before { left: -1.55rem; }
```

- [ ] **Step 2: Add the renderer**

In `js/site.js`, add before `function init()`:

```js
  function educationHtml(entry) {
    return '<article class="edu-item reveal">' +
      '<h3 class="serif">' + Core.escapeHtml(entry.school) + '</h3>' +
      '<p class="meta">' + Core.escapeHtml(entry.division) + ' · ' +
        Core.escapeHtml(entry.period) + '</p>' +
      '<p class="degree">' + Core.escapeHtml(entry.degree) + '</p>' +
    '</article>';
  }

  function skillGroupHtml(label, items) {
    return '<div class="skill-group reveal">' +
      '<h3>' + Core.escapeHtml(label) + '</h3>' +
      Core.chipsHtml(items) +
    '</div>';
  }

  function renderWork() {
    if (global.WORK) {
      fill('timeline', Core.sortWork(global.WORK).map(Core.workEntryHtml).join(''));
    }
    if (global.EDUCATION) {
      fill('education-list', global.EDUCATION.map(educationHtml).join(''));
    }
    if (global.SKILLS) {
      fill('skills-list',
        skillGroupHtml('Languages & web', global.SKILLS.languages) +
        skillGroupHtml('Machine learning & AI', global.SKILLS.ml) +
        skillGroupHtml('Frameworks & data', global.SKILLS.data));
    }
  }
```

Change `init` to call `renderProjects(); renderWork(); initReveals();` in that order, and add `renderWork: renderWork` to `global.Site`.

- [ ] **Step 3: Write the page**

Create `work.html` with the same head/nav/footer structure as `contact.html`, with `<title>Work — Aaron Lu</title>`, `<meta name="description" content="Work experience, education and skills — Aaron Lu, M.S. Computer Science (AI) at USC.">`, `aria-current="page"` on the Work link, and `<script src="data/work.js"></script>` before `js/core.js`. The `<main>` is:

```html
<main class="page-main">
  <header class="page-head column">
    <p class="eyebrow">Experience</p>
    <h1>Work</h1>
    <p>Machine learning and product engineering, most recent first.</p>
  </header>

  <div class="column">
    <div class="timeline" id="timeline"></div>

    <noscript>
      <div class="noscript-note">
        <p>This page renders its content with JavaScript.</p>
        <ul>
          <li>AlphaBiz — AI Intern, Jul 2025 – Dec 2025</li>
          <li>Interesting World — Machine Learning Intern, Jun 2024 – Aug 2024</li>
          <li>Rivera Food Service Inc. — Project Manager, part-time, Sep 2021 – Jul 2026</li>
          <li>USC Viterbi — M.S. Computer Science, Artificial Intelligence, 2026 – Present</li>
          <li>Boston University CAS — B.A. Computer Science, May 2025</li>
        </ul>
      </div>
    </noscript>

    <section>
      <header class="section-head">
        <p class="eyebrow">Education</p>
        <h2>Schools</h2>
      </header>
      <div id="education-list"></div>
    </section>

    <section>
      <header class="section-head">
        <p class="eyebrow">Toolkit</p>
        <h2>Skills</h2>
      </header>
      <div id="skills-list"></div>
    </section>
  </div>
</main>
```

- [ ] **Step 4: Verify in a browser**

Reload `http://localhost:8000/work.html`.

Confirm the timeline order is **AlphaBiz, Interesting World, Rivera** with accent dots on the rail. Confirm no entry says "Present" except the USC education row. Confirm the BU entry reads "B.A. Computer Science" and "College of Arts and Sciences". Confirm the Interesting World bullets say 88% accuracy and, separately, 50% training-time reduction.

- [ ] **Step 5: Run the unit tests**

Run: `node --test`
Expected: PASS — 39 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add work.html styles.css js/site.js
git commit -m "feat: add work page with timeline, education and skills"
```

---

### Task 8: Home page structure below the hero

Builds everything on the home page except the card and the gate, so the content is reviewable before the interaction is layered on.

**Files:**
- Create: `index.html` (replaces the existing file wholesale)
- Modify: `styles.css`
- Modify: `js/site.js` (add `renderHome`)

**Interfaces:**
- Consumes: `Core.featuredProjects`, `Core.sortWork`, `Core.escapeHtml`.
- Produces: `Site.renderHome()`, filling `#featured` and `#experience-strip`. Establishes `#background` as the scroll target Task 10's `unlock()` uses.

- [ ] **Step 1: Append the styles**

Append to `styles.css`, before the `@media (max-width: 768px)` block:

```css
/* ---------- marquee ---------- */
.marquee {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 1.25rem 0;
  overflow: hidden;
}
.marquee-track {
  display: flex;
  width: max-content;
  animation: marquee-scroll 30s linear infinite;
}
.marquee:hover .marquee-track { animation-play-state: paused; }
.marquee span {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: var(--faint);
  white-space: nowrap;
  padding: 0 1rem;
}
@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ---------- background section ---------- */
.background { padding: 6rem 1.5rem; max-width: 48rem; margin: 0 auto; text-align: center; }
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  padding-top: 1.5rem;
  margin: 2.5rem auto;
  border-top: 1px solid var(--line);
  max-width: 34rem;
}
.stat { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.stat svg { color: var(--accent); }
.stat-label {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--faint);
}
.stat-value { font-size: 0.875rem; color: var(--muted); }

/* ---------- featured & experience strip ---------- */
.featured-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; text-align: left; }
.exp-strip { max-width: 34rem; margin: 3rem auto 0; text-align: left; }
.exp-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--line);
}
.exp-role { font-size: 0.9rem; color: var(--ink); }
.exp-company { font-size: 0.75rem; color: var(--faint); }
.exp-date { font-family: var(--mono); font-size: 0.7rem; color: var(--faint); white-space: nowrap; }
.text-link { font-family: var(--mono); font-size: 0.75rem; color: var(--accent); text-decoration: none; }
.text-link:hover { text-decoration: underline; }
```

Add inside the `@media (max-width: 768px)` block:

```css
  .featured-grid { grid-template-columns: 1fr; }
  .stat-grid { grid-template-columns: 1fr; gap: 1.5rem; }
  .background { padding: 4rem 1.5rem; }
```

- [ ] **Step 2: Add the renderer**

In `js/site.js`, add before `function init()`:

```js
  function expRowHtml(entry) {
    return '<div class="exp-row reveal">' +
      '<div>' +
        '<p class="exp-role">' + Core.escapeHtml(entry.role) + '</p>' +
        '<p class="exp-company">' + Core.escapeHtml(entry.company) + '</p>' +
      '</div>' +
      '<span class="exp-date">' + Core.escapeHtml(entry.period) + '</span>' +
    '</div>';
  }

  function renderHome() {
    if (global.PROJECTS) {
      fill('featured', Core.featuredProjects(global.PROJECTS).map(Core.projectCardHtml).join(''));
    }
    if (global.WORK) {
      fill('experience-strip', Core.sortWork(global.WORK).map(expRowHtml).join(''));
    }
  }
```

Note `.exp-row` carries `<p>` elements, which the base stylesheet gives `margin: 0 0 1rem`. Add this override to the featured/strip block in `styles.css`:

```css
.exp-row p { margin: 0; }
```

Change `init` to `renderProjects(); renderWork(); renderHome(); initReveals();` and add `renderHome: renderHome` to `global.Site`.

- [ ] **Step 3: Write the page**

Create `index.html`, replacing the existing file. Same head as `contact.html` but `<title>Aaron Lu — Machine Learning & Product Engineering</title>`, `<meta name="description" content="Aaron Lu — M.S. Computer Science (AI) at USC, Boston University CS '25. Machine learning systems and the products around them.">`, `aria-current="page"` on Home, and both data files loaded before `js/core.js`. The hero is a placeholder in this task — Task 9 replaces its inner markup.

```html
<body>
<nav class="nav">
  <a href="index.html" aria-current="page">Home</a>
  <a href="work.html">Work</a>
  <a href="projects.html">Projects</a>
  <a href="contact.html">Contact</a>
</nav>

<main>
  <section class="hero" id="hero">
    <div class="hero-name">
      <p class="eyebrow">Software &middot; Machine Learning &middot; AI</p>
      <h1>Aaron<br><span class="italic accent">Lu</span></h1>
      <p class="hero-line">M.S. Computer Science (AI) at USC, Boston University CS &rsquo;25. I build machine learning systems and ship the products around them.</p>
      <div class="hero-cta">
        <a class="pill" href="work.html">View Work</a>
        <a class="text-link" href="contact.html">Get in Touch</a>
      </div>
    </div>
  </section>

  <div class="marquee" aria-hidden="true">
    <div class="marquee-track">
      <span>Python &middot; PyTorch &middot; Next.js &middot; React &middot; Node.js &middot; Java &middot; Transformers &middot; BERT &middot; LoRA &middot; NLP &middot; Supabase &middot; AWS &middot; MongoDB &middot; SQL &middot;</span>
      <span>Python &middot; PyTorch &middot; Next.js &middot; React &middot; Node.js &middot; Java &middot; Transformers &middot; BERT &middot; LoRA &middot; NLP &middot; Supabase &middot; AWS &middot; MongoDB &middot; SQL &middot;</span>
    </div>
  </div>

  <section class="background" id="background">
    <p class="eyebrow">About</p>
    <h2 class="reveal">Background</h2>
    <p class="reveal">I&rsquo;m a master&rsquo;s student in Computer Science at USC Viterbi, concentrating in Artificial Intelligence, and a 2025 Computer Science graduate of Boston University. My work sits where machine learning meets the product around it &mdash; training the model, then building the thing that puts it in front of people.</p>
    <p class="reveal">I&rsquo;ve built AI document workflows for an M&amp;A valuation platform at AlphaBiz, and a multilingual content-moderation classifier for a mobile gaming platform. On my own I ship products end to end: Pok&eacute;cha, a provably-fair pack-opening platform for graded trading cards, and OFYE, a tiered membership and education platform.</p>

    <div class="stat-grid reveal">
      <div class="stat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="stat-label">Based in</span>
        <span class="stat-value">Arcadia, CA</span>
      </div>
      <div class="stat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
        <span class="stat-label">Education</span>
        <span class="stat-value">USC Viterbi, M.S. CS &mdash; AI</span>
      </div>
      <div class="stat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
        <span class="stat-label">Current</span>
        <span class="stat-value">Graduate student &middot; building Pok&eacute;cha</span>
      </div>
    </div>

    <header class="section-head">
      <p class="eyebrow">Featured</p>
      <h2>Shipped products</h2>
    </header>
    <div class="featured-grid" id="featured"></div>
    <p style="margin-top:1.25rem"><a class="text-link" href="projects.html">All projects &rarr;</a></p>

    <div class="exp-strip">
      <p class="eyebrow">Experience</p>
      <div id="experience-strip"></div>
      <p style="margin-top:1rem"><a class="text-link" href="work.html">Full work history &rarr;</a></p>
    </div>

    <noscript>
      <div class="noscript-note" style="text-align:left;margin-top:2rem">
        <p>Featured work: <a href="https://pokecha.xyz">Pok&eacute;cha</a> and <a href="https://ofye.org">OFYE Group</a>. See <a href="projects.html">Projects</a> and <a href="work.html">Work</a>.</p>
      </div>
    </noscript>
  </section>
</main>

<footer class="site-footer">
  <div>
    <span>&copy; 2026 Zhong Wen Aaron Lu</span>
    <span>Built by hand</span>
  </div>
</footer>

<script src="data/projects.js"></script>
<script src="data/work.js"></script>
<script src="js/core.js"></script>
<script src="js/site.js"></script>
</body>
```

Add the hero scaffolding styles to `styles.css` before the `@media` block:

```css
.hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}
.hero-name { position: relative; z-index: 10; max-width: 32rem; padding: 0 2rem 6rem; }
.hero-name h1 { font-size: clamp(3rem, 8vw, 5.5rem); line-height: 1.05; }
.hero-line { max-width: 26rem; margin-top: 1rem; font-size: 0.95rem; }
.hero-cta { display: flex; align-items: center; gap: 1rem; margin-top: 1.5rem; }
.pill {
  padding: 0.65rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  color: var(--ink);
  transition: transform 200ms ease, box-shadow 200ms ease;
}
.pill:hover { box-shadow: 0 8px 20px rgba(20, 20, 25, 0.08); }
@media (min-width: 1024px) { .hero-name { padding-left: 4rem; } }
```

- [ ] **Step 4: Verify in a browser**

Reload `http://localhost:8000/`.

Confirm: full-height hero with the name bottom-left and the surname in accent italic, a marquee scrolling beneath it that pauses on hover, the Background section, three stat tiles, two featured cards (Pokécha, OFYE) and a three-row experience strip in AlphaBiz → Interesting World → Rivera order. The page scrolls freely — the gate arrives in Task 10.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css js/site.js
git commit -m "feat: add home page structure, marquee and background section"
```

---

### Task 9: The access card and reader

**Files:**
- Modify: `index.html` (add card and reader inside `.hero`)
- Modify: `styles.css`
- Modify: `js/site.js` (add `initCard`)

**Interfaces:**
- Consumes: `Core.isWithinSnapZone`, `Core.tiltFromVelocity`, `Core.clamp` (Task 1).
- Produces: `Site.initCard(onAccepted)` — binds drag on `#id-card` against `#card-reader` and invokes `onAccepted()` once the accept sequence finishes. Task 10 passes `unlock`.

- [ ] **Step 1: Add the markup**

In `index.html`, inside `<section class="hero" id="hero">`, before `<div class="hero-name">`:

```html
<div class="scan-grid" aria-hidden="true">
  <div class="scan-grid-lines"></div>
  <div class="scan-line"></div>
</div>

<div class="card-stage">
  <button type="button" class="id-card" id="id-card"
          aria-label="Access card. Drag it to the reader, or press Enter, to enter the site.">
    <span class="id-card-head mono"><span>Access Card</span><span>USC &middot; Viterbi</span></span>
    <span class="id-card-body">
      <img class="id-photo" src="img/image.png" alt="" width="72" height="88">
      <span class="id-fields mono">
        <span class="id-name">Zhong Wen Aaron Lu</span>
        <span class="id-role">Software Engineer &middot; ML</span>
        <span class="id-line">M.S. Computer Science &mdash; AI</span>
        <span class="id-line">B.A. Computer Science &middot; BU &rsquo;25</span>
      </span>
    </span>
    <span class="id-card-foot"><span class="barcode"></span><span class="id-num mono">ID 2025&middot;0506</span></span>
  </button>

  <div class="card-reader" id="card-reader" aria-hidden="true">
    <div class="reader-slit"></div>
    <div class="reader-led" id="reader-led"></div>
  </div>

  <p class="drag-hint eyebrow" id="drag-hint">Drag the card</p>
  <p class="readout mono" id="readout" role="status" aria-live="polite"></p>
</div>
```

- [ ] **Step 2: Add the styles**

Append to `styles.css` before the `@media` block:

```css
/* ---------- scan grid ---------- */
.scan-grid { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.scan-grid-lines {
  position: absolute;
  inset: -50% 0 0;
  background-image:
    repeating-linear-gradient(to right, rgba(20,20,25,.045) 0 1px, transparent 1px 60px),
    repeating-linear-gradient(to bottom, rgba(20,20,25,.045) 0 1px, transparent 1px 60px);
  transform: perspective(600px) rotateX(60deg);
  transform-origin: center bottom;
  -webkit-mask-image: radial-gradient(ellipse at 50% 80%, #000 20%, transparent 72%);
  mask-image: radial-gradient(ellipse at 50% 80%, #000 20%, transparent 72%);
}
.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  opacity: 0.12;
  box-shadow: 0 0 24px 4px var(--accent);
  animation: scan-sweep 8s linear infinite;
}
@keyframes scan-sweep {
  from { transform: translateY(0); }
  to { transform: translateY(100vh); }
}

/* ---------- card stage ---------- */
.card-stage { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.card-stage > * { pointer-events: auto; }

/* ---------- id card ---------- */
.id-card {
  position: absolute;
  top: 50%;
  left: 22%;
  width: 340px;
  height: 214px;
  margin: -107px 0 0 -170px;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 2px 6px rgba(20,20,25,.06), 0 18px 40px rgba(20,20,25,.10);
  cursor: grab;
  overflow: hidden;
  touch-action: none;
  text-align: left;
  transition: transform 520ms var(--ease-spring), box-shadow 250ms ease, opacity 300ms ease;
}
.id-card.is-dragging {
  cursor: grabbing;
  transition: none;
  box-shadow: 0 8px 16px rgba(20,20,25,.10), 0 32px 60px rgba(20,20,25,.18);
}
.id-card::after {
  content: "";
  position: absolute;
  top: -60%;
  left: -30%;
  width: 40%;
  height: 220%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
  transform: rotate(20deg) translateX(-260%);
  transition: transform 700ms ease;
  pointer-events: none;
}
.id-card:hover::after { transform: rotate(20deg) translateX(340%); }
.id-card-head {
  display: flex;
  justify-content: space-between;
  padding: 0.55rem 0.9rem;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
.id-card-body { display: flex; gap: 0.9rem; padding: 0.9rem; flex: 1; }
.id-photo { width: 72px; height: 88px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
.id-fields { display: flex; flex-direction: column; gap: 0.22rem; }
.id-name { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.id-role { font-size: 10px; color: var(--faint); text-transform: uppercase; letter-spacing: 0.12em; }
.id-line { font-size: 9px; color: var(--faint); text-transform: uppercase; letter-spacing: 0.08em; }
.id-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.9rem 0.65rem;
  border-top: 1px solid var(--line);
}
.barcode {
  flex: 1;
  height: 20px;
  background-image: repeating-linear-gradient(90deg,
    var(--ink) 0 2px, transparent 2px 4px,
    var(--ink) 4px 5px, transparent 5px 9px,
    var(--ink) 9px 12px, transparent 12px 14px);
  opacity: 0.75;
}
.id-num { font-size: 9px; color: var(--faint); letter-spacing: 0.1em; }

/* ---------- reader ---------- */
.card-reader {
  position: absolute;
  top: 50%;
  right: 8%;
  width: 96px;
  height: 260px;
  margin-top: -130px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: inset 0 2px 12px rgba(20,20,25,.10);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.card-reader.is-near {
  border-color: var(--accent);
  box-shadow: inset 0 2px 12px rgba(20,20,25,.10), 0 0 0 4px rgba(31,63,212,.10);
}
.reader-slit {
  position: absolute;
  top: 14px;
  left: 12px;
  right: 12px;
  height: 8px;
  border-radius: 4px;
  background: rgba(20,20,25,.55);
  box-shadow: inset 0 2px 4px rgba(0,0,0,.5);
}
.reader-led {
  position: absolute;
  bottom: 14px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--led-idle);
  box-shadow: 0 0 8px var(--led-idle);
  transition: background 200ms ease, box-shadow 200ms ease;
}
.reader-led.is-granted { background: var(--led); box-shadow: 0 0 14px var(--led); }

.drag-hint { position: absolute; top: 50%; right: 8%; margin-top: 145px; text-align: right; }
.readout {
  position: absolute;
  top: 50%;
  right: 8%;
  margin-top: 170px;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  min-height: 1em;
}
.id-card.is-consumed { opacity: 0; }
```

Add inside the `@media (max-width: 768px)` block:

```css
  .hero { align-items: flex-start; }
  .card-stage { position: relative; height: 62vh; }
  .id-card { left: 50%; top: 34%; width: 280px; height: 176px; margin: -88px 0 0 -140px; }
  .card-reader { top: auto; bottom: 4%; right: 50%; width: 260px; height: 96px; margin: 0 -130px 0 0; }
  .reader-slit { top: 12px; left: 14px; right: 14px; }
  .reader-led { bottom: 12px; }
  .drag-hint, .readout { right: 50%; top: auto; bottom: 0; margin: 0 -130px 0 0; text-align: center; }
  .hero-name { position: relative; padding: 7rem 1.5rem 2rem; }
```

- [ ] **Step 3: Add the drag logic**

In `js/site.js`, add before `function init()`:

```js
  var SNAP_THRESHOLD = 60;
  var MAX_TILT = 10;

  function typeOut(node, text, done) {
    var i = 0;
    node.textContent = '';
    var timer = setInterval(function () {
      i += 1;
      node.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(timer);
        if (done) { done(); }
      }
    }, Math.max(12, Math.round(500 / text.length)));
  }

  function initCard(onAccepted) {
    var card = document.getElementById('id-card');
    var reader = document.getElementById('card-reader');
    var led = document.getElementById('reader-led');
    var readout = document.getElementById('readout');
    if (!card || !reader) { return; }

    var dragging = false;
    var accepted = false;
    var originX = 0, originY = 0;
    var dx = 0, dy = 0;
    var lastX = 0, lastMoveTime = 0, velocityX = 0;

    function paint(tilt) {
      card.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' + tilt + 'deg)';
    }

    function reset() {
      dx = 0; dy = 0;
      card.style.transform = '';
      reader.classList.remove('is-near');
    }

    function accept() {
      if (accepted) { return; }
      accepted = true;
      dragging = false;
      card.classList.remove('is-dragging');
      reader.classList.remove('is-near');

      var cardRect = card.getBoundingClientRect();
      var slotRect = reader.getBoundingClientRect();
      var toSlotX = dx + (slotRect.left + slotRect.width / 2) - (cardRect.left + cardRect.width / 2);
      var toSlotY = dy + (slotRect.top + 20) - (cardRect.top + cardRect.height / 2);

      card.style.transition = 'transform 180ms ease-out';
      card.style.transform = 'translate3d(' + toSlotX + 'px,' + toSlotY + 'px,0) rotate(0deg)';

      setTimeout(function () {
        card.style.transition = 'transform 420ms ease-in, opacity 420ms ease-in';
        card.style.transform = 'translate3d(' + toSlotX + 'px,' + (toSlotY + 160) + 'px,0) scale(.94)';
        card.classList.add('is-consumed');
      }, 180);

      setTimeout(function () {
        if (led) { led.classList.add('is-granted'); }
      }, 600);

      setTimeout(function () {
        var hint = document.getElementById('drag-hint');
        if (hint) { hint.style.opacity = '0'; }
        if (readout) {
          typeOut(readout, 'Access granted · Welcome', onAccepted);
        } else if (onAccepted) {
          onAccepted();
        }
      }, 760);
    }

    card.addEventListener('pointerdown', function (event) {
      if (accepted) { return; }
      dragging = true;
      originX = event.clientX - dx;
      originY = event.clientY - dy;
      lastX = event.clientX;
      lastMoveTime = Date.now();
      velocityX = 0;
      card.classList.add('is-dragging');
      card.setPointerCapture(event.pointerId);
    });

    card.addEventListener('pointermove', function (event) {
      if (!dragging || accepted) { return; }
      var now = Date.now();
      var elapsed = Math.max(1, now - lastMoveTime);
      velocityX = (event.clientX - lastX) / elapsed * 16;
      lastX = event.clientX;
      lastMoveTime = now;

      dx = event.clientX - originX;
      dy = event.clientY - originY;
      paint(Core.tiltFromVelocity(velocityX, MAX_TILT));

      var near = Core.isWithinSnapZone(
        card.getBoundingClientRect(), reader.getBoundingClientRect(), SNAP_THRESHOLD
      );
      reader.classList.toggle('is-near', near);
    });

    function release(event) {
      if (!dragging || accepted) { return; }
      dragging = false;
      card.classList.remove('is-dragging');
      if (card.hasPointerCapture && card.hasPointerCapture(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      var near = Core.isWithinSnapZone(
        card.getBoundingClientRect(), reader.getBoundingClientRect(), SNAP_THRESHOLD
      );
      if (near) { accept(); } else { reset(); }
    }

    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);

    card.addEventListener('click', function (event) {
      event.preventDefault();
      if (!accepted) { accept(); }
    });

    return { accept: accept };
  }
```

Call it from `init`, after `renderHome()`:

```js
    initCard(function () { /* Task 10 replaces this with unlock */ });
```

and add `initCard: initCard` to `global.Site`.

The `click` handler covers Enter and Space on the focused button, since a `<button>` fires `click` for both.

- [ ] **Step 4: Verify in a browser**

Reload `http://localhost:8000/`.

Confirm: the card sits left of center over a faint perspective grid with a scanline sweeping down. Drag it — it follows the cursor and tilts with the direction of motion. Release it away from the reader — it springs back. Drag it onto the reader — the reader outlines in accent, the card snaps in, slides down and fades, the LED turns green, and `ACCESS GRANTED · WELCOME` types out. Reload, focus the card with Tab, press Enter — the same sequence runs.

Then open DevTools, switch to a touch-emulating device at 375px, and confirm the reader is a horizontal slot below the card and a downward drag completes the swipe.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css js/site.js
git commit -m "feat: add draggable access card and reader with accept sequence"
```

---

### Task 10: The gate

**Files:**
- Modify: `index.html` (add `class="locked"` and the noscript escape)
- Modify: `styles.css`
- Modify: `js/site.js` (add `initGate`)

**Interfaces:**
- Consumes: `Core.createLockState`, `Core.isUnlockKey` (Task 2); `Site.initCard` (Task 9).
- Produces: `Site.initGate()` — wires all four unlock triggers to one lock state and applies the locked/unlocked classes.

- [ ] **Step 1: Add the markup**

Change the opening body tag in `index.html` to `<body class="locked">`, and add immediately after it:

```html
<noscript><style>body.locked{overflow:auto}body.locked .nav{opacity:1;pointer-events:auto}body.locked .marquee,body.locked #background{opacity:1}</style></noscript>
```

Add `id="gated"` to the marquee div and confirm `#background` already has its id from Task 8.

- [ ] **Step 2: Add the styles**

Append to `styles.css` before the `@media` block:

```css
body.locked { overflow: hidden; }
body.locked .nav { opacity: 0.25; pointer-events: none; }
body.locked #gated,
body.locked #background { opacity: 0; }
#gated, #background { transition: opacity 600ms ease; }
.scroll-cue {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: var(--faint);
}
.scroll-cue span {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
.scroll-cue svg { animation: cue-bounce 1.6s ease-in-out infinite; }
@keyframes cue-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
body:not(.locked) .scroll-cue { opacity: 0; pointer-events: none; }
```

Add the cue markup inside `.hero` in `index.html`, after `.card-stage`:

```html
<div class="scroll-cue" aria-hidden="true">
  <span>Scroll</span>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
</div>
```

- [ ] **Step 3: Add the gate logic**

In `js/site.js`, add before `function init()`:

```js
  function initGate() {
    var body = document.body;
    if (!body.classList.contains('locked')) { return; }

    var storage = null;
    try { storage = global.sessionStorage; } catch (err) { storage = null; }

    var lock = Core.createLockState({
      storage: storage,
      reducedMotion: prefersReducedMotion()
    });

    function applyUnlocked(reason) {
      body.classList.remove('locked');
      var below = document.getElementById('background');
      if (below) { below.removeAttribute('aria-hidden'); }
      var gated = document.getElementById('gated');
      if (gated) { gated.removeAttribute('aria-hidden'); }
      if (reason !== 'restored' && reason !== 'reduced-motion' && below) {
        below.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    }

    lock.onUnlock(applyUnlocked);

    if (lock.isUnlocked()) {
      applyUnlocked(lock.reason());
    } else {
      var byIntent = function (reason) {
        return function () { lock.unlock(reason); };
      };
      global.addEventListener('wheel', byIntent('scroll'), { passive: true, once: true });
      global.addEventListener('touchmove', byIntent('touch'), { passive: true, once: true });
      global.addEventListener('keydown', function (event) {
        if (Core.isUnlockKey(event.key)) { lock.unlock('keyboard'); }
      });
    }

    return lock;
  }
```

Rewrite `init` to:

```js
  function init() {
    renderProjects();
    renderWork();
    renderHome();
    var lock = initGate();
    initCard(function () {
      if (lock) { lock.unlock('swipe'); }
    });
    initReveals();
  }
```

and add `initGate: initGate` to `global.Site`.

Note the ordering: `initGate` runs before `initCard` so the card's accept callback has a live lock to call.

- [ ] **Step 4: Verify all four unlock paths**

Reload `http://localhost:8000/` for each, using a fresh tab or clearing session storage between runs (`sessionStorage.clear()` in the console).

1. Page loads with the nav dimmed and no scrollbar. Swipe the card — the page unlocks and scrolls to Background.
2. Fresh session: ignore the card and scroll the wheel — unlocks immediately.
3. Fresh session: press Tab — unlocks.
4. Navigate to Work and back to Home — the page renders unlocked, the card resting in place, with no auto-scroll.
5. DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, fresh session — the page loads unlocked with no animation.
6. Disable JavaScript, reload — the page scrolls and every section is visible.
7. In the console run `Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked')}})` before load via a DevTools override, or test in a browser with site data blocked, and confirm the page still loads and unlocks normally.

- [ ] **Step 5: Run the unit tests**

Run: `node --test`
Expected: PASS — 39 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css js/site.js
git commit -m "feat: gate the home page behind the card with four unlock paths"
```

---

### Task 11: The rest of the motion system

**Files:**
- Modify: `js/site.js`
- Modify: `styles.css`
- Modify: `index.html` (mark countable stats)

**Interfaces:**
- Consumes: `Core.parseCountable`, `Core.formatCount`, `Core.easeOutCubic` (Task 3); `Core.parallaxOffset`, `Core.clamp` (Task 1).
- Produces: `Site.initCounters()`, `Site.initParallax()`, `Site.initMagnetic()`, `Site.initPageTransitions()`.

- [ ] **Step 1: Add the styles**

Append to `styles.css` before the `@media` block:

```css
.stagger > .reveal:nth-child(1) { transition-delay: 0ms; }
.stagger > .reveal:nth-child(2) { transition-delay: 60ms; }
.stagger > .reveal:nth-child(3) { transition-delay: 120ms; }
.stagger > .reveal:nth-child(4) { transition-delay: 180ms; }
.stagger > .reveal:nth-child(5) { transition-delay: 240ms; }
.stagger > .reveal:nth-child(6) { transition-delay: 300ms; }
.stagger > .reveal:nth-child(7) { transition-delay: 360ms; }

.wipe {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--accent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}
.wipe.is-active { opacity: 1; }
```

Add `class="card-grid stagger"` to `#products`, `#project-list` and `#featured`, and `class="stagger"` to `#timeline`, `#experience-strip` and `.contact-list`.

- [ ] **Step 2: Add the counters, parallax, magnetic hover and page transitions**

In `js/site.js`, add before `function init()`:

```js
  function animateCount(node) {
    var spec = Core.parseCountable(node.textContent);
    if (!spec) { return; }
    var start = 0;
    var duration = 900;

    function frame(now) {
      if (!start) { start = now; }
      var t = Core.clamp((now - start) / duration, 0, 1);
      node.textContent = Core.formatCount(spec.value * Core.easeOutCubic(t), spec);
      if (t < 1) { requestAnimationFrame(frame); }
      else { node.textContent = Core.formatCount(spec.value, spec); }
    }
    requestAnimationFrame(frame);
  }

  function initCounters() {
    var nodes = document.querySelectorAll('[data-count]');
    if (!nodes.length || prefersReducedMotion() || !global.IntersectionObserver) { return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        observer.unobserve(entry.target);
        animateCount(entry.target);
      });
    }, { threshold: 0.6 });
    for (var i = 0; i < nodes.length; i++) { observer.observe(nodes[i]); }
  }

  function initParallax() {
    var nodes = document.querySelectorAll('[data-parallax]');
    if (!nodes.length || prefersReducedMotion()) { return; }
    var ticking = false;

    function update() {
      var y = global.pageYOffset || document.documentElement.scrollTop;
      for (var i = 0; i < nodes.length; i++) {
        var rate = parseFloat(nodes[i].getAttribute('data-parallax')) || 0.3;
        nodes[i].style.transform = 'translate3d(0,' + Core.parallaxOffset(y, rate, 200) + 'px,0)';
      }
      ticking = false;
    }

    global.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function initMagnetic() {
    if (prefersReducedMotion() || !global.matchMedia ||
        !global.matchMedia('(pointer: fine)').matches) { return; }
    var nodes = document.querySelectorAll('.pill, .nav a');

    for (var i = 0; i < nodes.length; i++) {
      (function (node) {
        node.addEventListener('pointermove', function (event) {
          var rect = node.getBoundingClientRect();
          var mx = Core.clamp((event.clientX - rect.left - rect.width / 2) * 0.3, -6, 6);
          var my = Core.clamp((event.clientY - rect.top - rect.height / 2) * 0.3, -6, 6);
          node.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        });
        node.addEventListener('pointerleave', function () { node.style.transform = ''; });
      })(nodes[i]);
    }
  }

  function initPageTransitions() {
    if (prefersReducedMotion()) { return; }

    var wipe = document.createElement('div');
    wipe.className = 'wipe';
    document.body.appendChild(wipe);

    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) { return; }
      if (link.target === '_blank' || link.origin !== global.location.origin) { return; }
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 ||
          href.indexOf('tel:') === 0) { return; }

      event.preventDefault();
      if (document.startViewTransition) {
        document.startViewTransition(function () { global.location.href = href; });
        return;
      }
      wipe.classList.add('is-active');
      setTimeout(function () { global.location.href = href; }, 220);
    });
  }
```

Add all four to `init`, after `initReveals()`:

```js
    initCounters();
    initParallax();
    initMagnetic();
    initPageTransitions();
```

and add them to `global.Site`.

Note `.nav a` gets an inline `transform` from magnetic hover, which would fight the nav's own centering — that is why the magnetic transform is applied to the links, not the `.nav` container.

- [ ] **Step 3: Mark the countable stats**

The counters animate numbers that live in project bullets. Wrap them in `data/projects.js` by changing these three bullet strings to include a span. In `Core.bulletsHtml` the text is escaped, so instead add a dedicated field. Change `bulletsHtml` in `js/core.js` to allow a marked number:

```js
  function bulletsHtml(bullets) {
    if (!bullets || !bullets.length) { return ''; }
    return '<ul class="bullets">' + bullets.map(function (b) {
      var text = escapeHtml(b);
      return '<li>' + text.replace(
        /(\d[\d,]*(?:\.\d+)?%?\+?)/,
        '<span class="stat-num" data-count>$1</span>'
      ) + '</li>';
    }).join('') + '</ul>';
  }
```

Add the matching test to `tests/core.test.js`:

```js
test('bulletsHtml marks the first number for the counter animation', () => {
  const html = Core.bulletsHtml(['Achieved 96% accuracy on the test set.']);
  assert.ok(html.includes('<span class="stat-num" data-count>96%</span>'));
});

test('bulletsHtml leaves numberless bullets alone', () => {
  const html = Core.bulletsHtml(['Shipped the thing.']);
  assert.ok(!html.includes('data-count'));
  assert.ok(html.includes('<li>Shipped the thing.</li>'));
});
```

Add the parallax hooks in `index.html`: `data-parallax="0.3"` on `.scan-grid-lines` and `data-parallax="0.6"` on the `.marquee-track`.

- [ ] **Step 4: Run the tests**

Run: `node --test`
Expected: PASS — 41 tests, 0 failures.

- [ ] **Step 5: Verify in a browser**

Reload the site and confirm: project cards stagger in rather than appearing together; numbers in bullets count up when scrolled into view and settle on the exact printed value (96%, 88%, 650,000+, 30%, 50%, 20,000+); the grid and marquee drift at different rates while scrolling; pills and nav links lean toward the cursor and snap back on leave; clicking a nav link plays a transition rather than a hard cut.

Then emulate `prefers-reduced-motion: reduce` and confirm every one of those is off and the numbers show their final values immediately.

- [ ] **Step 6: Commit**

```bash
git add js/core.js js/site.js styles.css index.html data/projects.js tests/core.test.js
git commit -m "feat: add counters, parallax, magnetic hover and page transitions"
```

---

### Task 12: Redirects, metadata, and the full verification pass

**Files:**
- Modify: `work-experience.html` (replaced with a redirect stub)
- Modify: `assignments.html` (replaced with a redirect stub)
- Modify: `styles.css` (final responsive and reduced-motion audit)

**Interfaces:**
- Consumes: everything.
- Produces: the finished site.

- [ ] **Step 1: Write the redirect stubs**

Replace the entire contents of `work-experience.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=work.html">
<link rel="canonical" href="https://zalu224.github.io/work.html">
<title>Redirecting to Work — Aaron Lu</title>
</head>
<body>
<p>This page has moved. <a href="work.html">Continue to Work</a>.</p>
</body>
</html>
```

Replace the entire contents of `assignments.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=projects.html#coursework">
<link rel="canonical" href="https://zalu224.github.io/projects.html">
<title>Redirecting to Coursework — Aaron Lu</title>
</head>
<body>
<p>Assignments have moved. <a href="projects.html#coursework">Continue to Coursework</a>.</p>
</body>
</html>
```

- [ ] **Step 2: Run the full test suite**

Run: `node --test`
Expected: PASS — 41 tests, 0 failures.

- [ ] **Step 3: Walk the spec's verification checklist**

Serve with `python3 -m http.server 8000` and confirm each of these, fixing anything that fails before moving on:

1. Every page renders; every nav link resolves; both redirect stubs land correctly.
2. The card drags, springs back short of the reader, and completes on the reader.
3. Fresh session: scrolling unlocks. Fresh session: Tab unlocks.
4. Home → Work → Home is not re-gated.
5. JS disabled: the home page scrolls, and both `<noscript>` blocks show real links.
6. `prefers-reduced-motion`: loads unlocked, no animation, counters at final values.
7. 375px, 768px, 1440px: no horizontal scrollbar on any page. Run this in the console on each page and expect `false`:
   ```js
   document.documentElement.scrollWidth > document.documentElement.clientWidth
   ```
8. All 12 coursework links, both product links, and both profile links open correctly.
9. Add a throwaway object to `data/projects.js` with `kind: 'project'`, reload `projects.html`, confirm it renders without touching any HTML, then remove it.
10. Tab through every page start to finish: focus is always visible and never lands on something invisible.
11. Grep for stale content and expect **no matches**:
    ```bash
    grep -rniE "B\.S in Computer Science|School of College|666,000|60% and 88%" \
      --include=*.html --include=*.js . | grep -v docs/
    ```
12. Grep for OFYE claims that must not appear and expect **no matches**:
    ```bash
    grep -rniE "win rate|363|177|active members" --include=*.html --include=*.js . | grep -v docs/
    ```

- [ ] **Step 4: Commit**

```bash
git add work-experience.html assignments.html styles.css
git commit -m "feat: add redirect stubs and complete verification pass"
```

- [ ] **Step 5: Report what remains**

Report to the user, without acting on any of it:

- `resume.pdf` is plain text with a `.pdf` extension and is not linked from the site. It needs converting to a real PDF before a resume link can be added.
- The four open assumptions from the spec still stand: solo authorship of Pokécha and OFYE, both dated 2026, `github.com/zalu224`, and the `ID 2025·0506` card number.
- Deploying is `git push` to `origin main`, which the plan does **not** do. Ask before pushing.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: §1 file structure → Tasks 5–12; §2 type and color → Task 5; §3 content model → Task 4; §4 motion → Tasks 5, 9, 11; §5 chrome → Task 5; §6 hero and card → Tasks 8, 9; §7 lock and unlock → Tasks 2, 10; §8 below the fold → Task 8; §9 inner pages → Tasks 5, 6, 7; §10 responsive and a11y → Tasks 5–12, audited in 12; §11 content corrections → Task 4 data, asserted by tests, grepped in Task 12; §12 verification → Task 12.

**Naming consistency.** `Core.*` names used in `js/site.js` all originate in Tasks 1–4: `clamp`, `isWithinSnapZone`, `tiltFromVelocity`, `parallaxOffset`, `createLockState`, `isUnlockKey`, `parseCountable`, `formatCount`, `easeOutCubic`, `escapeHtml`, `sortWork`, `featuredProjects`, `projectsByKind`, `chipsHtml`, `bulletsHtml`, `projectCardHtml`, `workEntryHtml`, `courseworkRowHtml`. Element ids referenced by `js/site.js` (`products`, `project-list`, `coursework-list`, `timeline`, `education-list`, `skills-list`, `featured`, `experience-strip`, `id-card`, `card-reader`, `reader-led`, `readout`, `drag-hint`, `background`, `gated`) are each created in Tasks 6–10.

**Known ordering hazards, called out where they occur.** Rendering must precede `initReveals` (Task 6). `initGate` must precede `initCard` (Task 10). `Core` must load before `site.js`, and the data files before both, on every page.
