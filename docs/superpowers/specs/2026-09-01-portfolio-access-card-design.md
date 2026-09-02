# Portfolio Redesign: Access Card Site

**Date:** 2026-09-01
**Status:** Approved design, ready for implementation planning

## Goal

Rebuild `zalu224.github.io` as a portfolio that reads as intentional and personal rather than
templated. The home page borrows its structure and rhythm from `franklin.rocks` — full-viewport
hero, floating pill nav, keyword marquee, centered background section — but replaces that site's
draggable badge with a **draggable ID/access card** that the visitor slides through a card reader
to enter the site. Work, Projects, and Contact get their own pages.

The site must feel alive — real motion, not a static document — and must be cheap to extend, since
case studies for Pokécha and OFYE and further resume content are coming later.

## Constraints

- **No build step.** GitHub Pages user site, deployed by `git push`. Hand-written HTML, one
  stylesheet, one script, plus plain-JS data files. No framework, no bundler, no `node_modules`.
- Motion is expected, but must degrade: everything works on touch, on keyboard, and under
  `prefers-reduced-motion`.
- Content comes from the resume (`resume.pdf`), the existing site, and the two live products.
  Where the resume and the old site disagree, **the resume wins** (see §11).

## Non-goals

- No CMS, blog, analytics, or dark-mode toggle.
- No WebGL. The reference site's hero canvas is replaced with a CSS scan-grid.
- No long-form MDX case studies yet — the data model leaves room for them (§3).

---

## 1. File structure

```
index.html              Home — hero, card, marquee, background, featured work
work.html               Work  (new filename; work-experience.html redirects)
projects.html           Projects + folded-in coursework
contact.html            Contact
work-experience.html    Redirect stub → work.html
assignments.html        Redirect stub → projects.html#coursework
styles.css              Single shared stylesheet
site.js                 Nav, lock/unlock, card drag, motion, rendering
data/projects.js        Project records
data/work.js            Roles, education, skills
img/image.png           Badge photo (existing headshot, neutral gray backdrop)
resume.pdf              Existing file — see §11 note
```

Both redirect stubs are meta-refresh + canonical link rather than deletions, so existing links
still land somewhere useful.

Every page loads `styles.css`, its data files, then `site.js`. `site.js` feature-detects what each
page contains, so card logic is inert where there is no card.

## 2. Type and color

Fonts, loaded from Google Fonts in a single stylesheet request:

| Role | Family | Usage |
|---|---|---|
| Display | Instrument Serif (400, 400 italic) | `h1`/`h2`, name, page titles |
| Mono | JetBrains Mono (300–600) | Eyebrows, dates, IDs, chips, readouts, counters |
| Body | Inter (400, 500) | Paragraphs, list items, links |

Custom properties on `:root`:

```css
--paper:   #f6f5f2;   /* page ground */
--surface: #ffffff;   /* cards, nav glass */
--ink:     #16161a;   /* headings, body */
--muted:   #5a5a63;   /* secondary copy */
--faint:   #9a9aa3;   /* mono eyebrows, timestamps */
--line:    rgba(20, 20, 25, 0.10);
--accent:  #1f3fd4;   /* card header bar, italic surname, scanline, GRANTED */
--led-idle:#c2760b;   /* reader LED, locked state */
--led:     #16a34a;   /* reader LED, granted state only */
```

Single light theme, committed to deliberately. `body` sets `background: var(--paper)` explicitly
and declares `color-scheme: light`.

Mono eyebrow treatment throughout: `font-size: 11px; text-transform: uppercase;
letter-spacing: 0.3em; color: var(--faint)`.

## 3. Content model

Content lives in two plain-JS files that assign to globals — no modules, no imports, works from
`file://`. Adding a project or a job is adding one object.

```js
// data/projects.js
window.PROJECTS = [
  {
    id: 'pokecha',
    kind: 'product',          // 'product' | 'project' | 'coursework'
    featured: true,           // surfaces on the home page
    title: 'Pokécha',
    tagline: 'Real graded cards. Published odds. Verifiable openings.',
    url: 'https://pokecha.xyz',
    period: '2026',
    role: 'Design & build',
    stack: ['Next.js', 'TypeScript', 'Supabase'],
    bullets: [ /* … */ ],
    caseStudy: null           // reserved for later long-form write-ups
  },
  // …
];
```

```js
// data/work.js
window.WORK      = [ { company, role, period, location, bullets: [] }, … ];
window.EDUCATION = [ { school, division, degree, period } , … ];
window.SKILLS    = { languages: [], ml: [], data: [] };
```

`site.js` renders these into semantic HTML through small template functions.

**Stated trade-off.** Client-side rendering means project and work copy is not in the HTML source,
which weakens SEO and breaks for a visitor with JS disabled. Accepted deliberately in exchange for
one-line content edits, with two mitigations: every page carries a real `<title>` and
`<meta name="description">` in its HTML, and each rendered list is preceded by a `<noscript>` block
listing the titles and their links in plain markup.

## 4. Motion system

Defined once in `site.js`, reused everywhere. All of it is skipped wholesale under
`prefers-reduced-motion: reduce`.

| Behavior | Implementation |
|---|---|
| **Page transitions** | `View Transitions API` where supported, with a fallback: an accent wipe overlay fades in over 220ms, navigation fires, and the new page fades its content up. Intercepts same-origin nav links. |
| **Scroll reveals** | `IntersectionObserver` toggles `.is-visible`; `opacity 0→1`, `translateY(24px)→0` over 600ms. Children of a `.stagger` container get a 60ms incremental delay. |
| **Magnetic hover** | Pill buttons and nav links translate up to 6px toward the cursor on `pointermove`, released on `pointerleave`. Pointer-fine devices only. |
| **Parallax** | Hero scan-grid and the marquee move at 0.3× and 0.6× scroll rate via `transform: translate3d`, driven by a single rAF-throttled scroll listener shared by all parallax elements. |
| **Animated counters** | Stat numbers (88% accuracy, 650k records, 96% accuracy) count up from 0 over 900ms with `requestAnimationFrame` when first revealed, using an ease-out curve. Final value is the element's authored text, so it is correct before and after. |
| **Card physics** | See §6 — velocity-based tilt and a damped spring return. |
| **Marquee** | 30s linear infinite `translateX(-50%)` over a duplicated track; pauses on hover. |

Everything animates `transform` and `opacity` only. No layout-triggering properties.

## 5. Shared chrome

**Nav.** Fixed pill, top-center, `backdrop-filter: blur(20px)` over `rgba(255,255,255,.72)` with a
`--line` border. Links: Home, Work, Projects, Contact. Current page's link is accent-colored. On
the home page it starts locked (§7).

**Footer.** Full-width top border, mono, two ends: `© 2026 Zhong Wen Aaron Lu` at left,
`Built by hand` at right.

## 6. Home hero and the access card

Full viewport height, `position: relative`, `overflow: hidden`.

```
┌────────────────────────────────────────────────────────────┐
│           ( Home  Work  Projects  Contact )  ← dimmed 25%   │
│  ┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼   scan-grid      │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   ← scanline    │
│                                              ╔════╗        │
│              ┌═══════════════┐               ║    ║        │
│              │██ ACCESS CARD │   ⇢ drag ⇢    ║ ▤  ║ READER │
│              │ ▓▓  AARON LU  │               ║    ║        │
│              │ ▓▓  SWE · ML  │               ╚════╝ ● amber │
│              └───────────────┘                             │
│                                                             │
│  SOFTWARE · MACHINE LEARNING · AI          DRAG THE CARD    │
│  Aaron                                                      │
│  Lu   ← italic, accent                                      │
│  M.S. CS (AI) at USC. I build ML systems…                   │
│  [ View Work ]  Get in Touch          ▼ SCROLL              │
└────────────────────────────────────────────────────────────┘
```

**Backdrop (`.scan-grid`).** Two absolutely positioned layers: a perspective grid
(`repeating-linear-gradient` both axes at `rgba(20,20,25,.045)`, `perspective(600px) rotateX(60deg)`,
radial-masked at the horizon), and a 2px accent scanline at 12% opacity sweeping top-to-bottom on
an 8s loop. Both `aria-hidden`; the scanline stops under reduced motion.

**Name block**, absolutely positioned bottom-left (`bottom: 6rem; left: 2rem`, `4rem` at ≥1024px):

- Mono eyebrow: `SOFTWARE · MACHINE LEARNING · AI`
- `<h1>`: `Aaron` / `<span class="italic accent">Lu</span>`, `clamp(3rem, 8vw, 5.5rem)`,
  `line-height: 1.05`
- One-liner, `max-width: 26rem`, muted: *"M.S. Computer Science (AI) at USC, Boston University CS
  '25. I build machine learning systems and ship the products around them."*
- CTAs: `View Work` (bordered pill → `work.html`) and `Get in Touch` (text link → `contact.html`)

**Hints.** `DRAG THE CARD` in mono bottom-right under the reader; `SCROLL` plus a bouncing chevron
bottom-center.

### The card

A real `<button class="id-card">`, focusable and announced. Accessible name: *"Access card — drag
to the reader, or press Enter, to enter the site."*

340 × 214px desktop (credit-card ratio), `border-radius: 14px`, `--surface` ground, two-layer
shadow, hairline `--line` border. A 20°-angled white highlight sweeps across on hover so it reads
as laminated.

| Region | Content |
|---|---|
| Header bar | Accent-filled, mono white: `ACCESS CARD` left, `USC · VITERBI` right |
| Body left | `img/image.png` in a 72 × 88px rounded well with a hairline border |
| Body right | `ZHONG WEN AARON LU` (mono 600), `SOFTWARE ENGINEER · ML` (mono, faint), `M.S. COMPUTER SCIENCE — AI` and `B.A. COMPUTER SCIENCE · BU '25` (mono, faint, 10px) |
| Footer strip | CSS barcode (`repeating-linear-gradient`, irregular ink bars) with `ID 2025·0506` in mono at right |

**Reader (`.card-reader`).** 96 × 260px slot at `right: 8%`, vertically centered: rounded rect,
`--line` border, inset shadow reading as a channel, a darker inner slit, and an LED dot at
`--led-idle` amber while locked.

**Drag.** One pointer-event path for mouse and touch (`pointerdown`/`pointermove`/`pointerup`,
`setPointerCapture`, `touch-action: none`).

- `pointerdown` — record grab offset, add `.is-dragging`, lift (`scale(1.03)`, deeper shadow).
- `pointermove` — translate to pointer; tilt by `clamp(velocityX * 0.4, -10deg, 10deg)`. Within
  60px of the slot center, add `.is-near` (accent border, LED brightens).
- `pointerup` outside the snap zone — spring home on `cubic-bezier(.34,1.56,.64,1)`, 520ms.
- `pointerup` inside — run the accept sequence.

**Accept sequence** (~1.4s, sequential): card snaps to the slot mouth and straightens (180ms) →
slides down the channel while a 2px accent scanner line crosses it, fading out at 70% travel
(420ms) → LED flips to `--led` green with a glow pulse (150ms) → a mono readout types
`ACCESS GRANTED · WELCOME` (~500ms) → `unlock()`.

## 7. Lock and unlock

Home page `<body>` carries `class="locked"` on load.

**Locked:** `overflow: hidden` on `body`; nav links at `opacity: .25; pointer-events: none`;
everything below the hero at `opacity: 0` and `aria-hidden="true"`.

**Four unlock triggers**, all converging on one idempotent `unlock()`:

1. Completing the card swipe.
2. **Scroll intent** — `wheel`, `touchmove`, or Space / ArrowDown / PageDown. The promised escape
   hatch: ignore the card, scroll, you're in.
3. **Keyboard intent** — `Tab`, or Enter/Space on the focused card. Keyboard users are never
   gated; unlocking this way plays a short auto-swipe so the metaphor still resolves.
4. `prefers-reduced-motion: reduce` — loads already unlocked, card still draggable, animations off.

`unlock()` removes `body.locked`, fades the nav in, drops `aria-hidden` below the hero, writes
`sessionStorage['aaronlu.unlocked'] = '1'`, and smooth-scrolls to `#background`.

**Persistence.** If the flag is already set on load, the page renders unlocked with the card at
rest. Every `sessionStorage` access is wrapped in `try/catch`; if storage throws or is empty the
page must still render correctly and never stick.

**Failure floor.** A `<noscript>` rule removes the locked styles, so the site is readable with JS
off.

**Mobile (≤768px).** Reader rotates to a 260 × 96px horizontal slot below the card; the gesture
becomes a downward drag. Card scales to 280 × 176px. The name block moves to static flow above the
card instead of absolute positioning.

## 8. Home, below the fold

**Marquee.** Full-width strip, `--line` borders top and bottom, duplicated track, mono, faint:

> Python · PyTorch · Next.js · React · Node.js · Java · Transformers · BERT · LoRA · NLP ·
> Supabase · AWS · MongoDB · SQL

**Background section (`#background`).** Centered, `max-width: 48rem`, `padding: 6rem 1.5rem`.

- Mono eyebrow `ABOUT`, serif `<h2>` "Background"
- Two paragraphs leading with the present:

  > I'm a master's student in Computer Science at USC Viterbi, concentrating in Artificial
  > Intelligence, and a 2025 Computer Science graduate of Boston University. My work sits where
  > machine learning meets the product around it — training the model, then building the thing that
  > puts it in front of people.

  > I've built AI document workflows for an M&A valuation platform at AlphaBiz, and a multilingual
  > content-moderation classifier for a mobile gaming platform. On my own I ship products
  > end-to-end: Pokécha, a provably-fair pack-opening platform for graded trading cards, and OFYE,
  > a tiered membership and education platform.

- Three stat tiles above a `--line` rule, each with an inline accent SVG icon (map pin /
  graduation cap / briefcase), a mono label, and a value:

  | Based in | Education | Current |
  |---|---|---|
  | Arcadia, CA | USC Viterbi, M.S. CS — AI | Graduate student · building Pokécha |

**Featured work.** Two large cards rendered from `PROJECTS.filter(p => p.featured)` — Pokécha and
OFYE — each with title, tagline, stack chips, and a `Visit ↗` link, then a text link
"All projects →". This is the home page's proof, and it is why the featured flag exists in the
data model.

**Experience strip.** Three rows, `space-between`, role and employer at left, mono date at right,
bottom-bordered, then "Full work history →" to `work.html`.

## 9. Inner pages

All three share the nav, footer, a header block (mono eyebrow + serif `<h1>`), a `max-width: 46rem`
column, and staggered reveals.

### Work (`work.html`)

Vertical timeline: 1px `--line` rail at the left, a 9px accent dot per entry. Rendered from
`window.WORK`, newest first, using resume copy verbatim:

1. **AlphaBiz — AI Intern**, Jul 2025 – Dec 2025
   - Integrated AI confidential information memorandum (CIM) enhancement into an M&A platform
     supporting business evaluation and valuation workflows.
   - Built secure, event-driven AI processing workflows using AWS Lambda and Kinesis.
   - Collaborated on translating business requirements into product functionality.
2. **Interesting World — Machine Learning Intern**, Jun 2024 – Aug 2024
   - Developed a 7-class NLP classification system for automated user-generated content
     moderation, achieving **88% accuracy**.
   - Experimented with BERT, LoRA, FastText, Word2Vec and Hugging Face Transformers to compare
     approaches to text representation and classification.
   - Built preprocessing and tokenization pipelines for multilingual and emoji-rich text; reduced
     model training time by **50%** through dynamic padding and LoRA.
3. **Rivera Food Service Inc. — Project Manager (Part-Time)**, Sep 2021 – Jul 2026
   - Worked with vendors and engineers to define technical requirements for business systems
     integrating sales, pricing, inventory and replenishment data.
   - Coordinated data integration and analytics requirements between business stakeholders and
     developers.

Below the timeline, an **Education** block (USC Viterbi, M.S. CS — AI, 2026–Present; Boston
University CAS, B.A. Computer Science, May 2025) and a **Skills** block rendered from
`window.SKILLS` as mono chips in three labelled groups.

The commented-out placeholder job articles in the current file are dropped.

### Projects (`projects.html`)

Cards on `--surface` with a `--line` border, 12px radius, lifting 2px on hover. Order:

**Products** (`kind: 'product'`, both featured)

1. **Pokécha** — `pokecha.xyz` — *Real graded cards. Published odds. Verifiable openings.*
   A pack-opening platform backed by real graded slabs. Published odds and full tier tables shown
   before purchase; each opening commits a server seed hash that the user can verify afterward;
   every opening resolves to a listed tier, with a fallback when a specific slab is unavailable.
   Collection browsing, per-pack vault pages, an authenticated opening flow, and an FAQ covering
   verification. Stack: Next.js, TypeScript, Supabase.
2. **OFYE Group** — `ofye.org` — *Crypto education and tiered community access.*
   A membership platform with four one-time-purchase tiers, Stripe checkout, tier-gated content,
   and Telegram community provisioning on purchase. Stack: Next.js, Stripe.
   *Described in engineering terms — the site's performance claims are not repeated here.*

**Projects** (`kind: 'project'`)

3. **NYC Urban Air Quality Analysis** (2024) — 650,000+ street-tree records joined with pollution
   data; engineered features, heat maps and correlation graphs; a Flask app with interactive
   geographic visualization. Found trees ≥60in diameter correlate with **30% lower PM2.5**.
   Stack: Python, Pandas, Scikit-learn, Flask.
4. **Fake News Detection** (2024) — TF-IDF + logistic regression over 20,000+ articles with a full
   preprocessing and evaluation pipeline. **96% accuracy, 97% recall, 97% F1**.
   Stack: Python, Pandas, Scikit-learn, NLTK, Flask.
5. **Probabilistic AI Agent for Battleship** (Jan–May 2024) — heat-map ship-placement probabilities
   updated per shot, with targeting that reasons over adjacency and remaining configurations.
   Stack: Java.
6. **Tetris with a Q-Learning Bot** (Jan–May 2024) — a two-hidden-layer network estimating Q-values
   over game-state features, with a reward function on height, line clears, holes and blockades.
   Stack: Java.
7. **Nutrisistant** (Sep–Dec 2023) — nutrition lookup app on the Spoonacular API, with Google auth
   and a Mongo-backed API. Stack: React, Node.js, MongoDB.

Each card: serif title, mono role/period line, an external `↗` link where one exists, muted
bullets, and a wrapped row of mono stack chips. Numeric claims use the animated counter (§4).

**Coursework (`#coursework`)** — bottom-bordered section header `COURSEWORK — CS506`, one muted
line of context, then a two-column grid (single column ≤768px) of the 12 assignments from
`assignments.html`. Each row: mono index badge (`A0`–`A10`, `MID`), title, arrow link. All 12
existing GitHub URLs preserved exactly.

### Contact (`contact.html`)

Oversized serif "Get in touch", one muted invitation line, then five bottom-bordered rows — mono
label left, value in body type, accent `→` right sliding 4px on hover:

| Label | Value | Link |
|---|---|---|
| EMAIL | aaronlu6@gmail.com | `mailto:` |
| PHONE | (626) 348-3399 | `tel:+16263483399` |
| LINKEDIN | linkedin.com/in/aaronlu224 | new tab, `rel="noopener"` |
| GITHUB | github.com/zalu224 | new tab, `rel="noopener"` |
| LOCATION | Arcadia, CA | not a link |

## 10. Responsive and accessibility

- Breakpoints at 768px and 1024px. No horizontal page scroll at any width; wide content collapses
  rather than overflows.
- Visible `:focus-visible` ring in `--accent` on every interactive element.
- The card is a `<button>`; reader, scan-grid, barcode and marquee are `aria-hidden`.
- Body text ≥4.5:1 on `--paper`. `--faint` only for ≥11px uppercase mono at ≥3:1, never prose.
- Under `prefers-reduced-motion: reduce`: no scanline, marquee, parallax, magnetic hover, counters
  (final values render immediately), page transitions, reveals or chevron bounce; page loads
  unlocked; `scroll-behavior: auto`.

## 11. Content corrections

The resume and the old site disagree. The resume wins:

| Field | Old site | Corrected |
|---|---|---|
| USC | (absent) | M.S. Computer Science — Artificial Intelligence, Viterbi, 2026–Present |
| BU degree | "B.S in Computer Science" | **B.A.** in Computer Science |
| BU division | "School of College & Arts" | College of Arts and Sciences |
| AlphaBiz | "July 2025 - Present" | Jul 2025 – **Dec 2025** |
| Rivera | "Sep 2021 – Present" | Sep 2021 – **Jul 2026** |
| Interesting World | "reducing up to 60% and 88% accuracies" | 88% accuracy; separately, 50% training-time reduction |
| NYC records | "over 666,000" | 650,000+ |
| Fake news | "high precision, recall, F1" | 96% accuracy, 97% recall, 97% F1 |

**Note on `resume.pdf`:** the file in the repo is plain text with a `.pdf` extension. It is not
linked from the site in this design. If a resume download is wanted later, it needs to be a real
PDF first.

## 12. Verification

Manual, since there is no test harness:

1. Serve locally (`python3 -m http.server`); every page renders, every nav link and both redirect
   stubs resolve.
2. Card drags with a mouse, springs back short of the reader, completes and unlocks on the reader.
3. Reload, ignore the card, scroll — unlocks. Reload, press Tab — unlocks.
4. Navigate to Work and back — not re-gated.
5. JavaScript disabled — home page scrolls and reads; `<noscript>` lists projects and roles.
6. Emulate `prefers-reduced-motion` — loads unlocked, no animation, counters show final values.
7. 375px / 768px / 1440px — no overflow, mobile reader gesture works on a touch emulator.
8. All 12 coursework links, both product links, and both profile links open correctly.
9. Add a dummy object to `data/projects.js` and confirm it renders without touching HTML.

## Open assumptions

- GitHub profile `github.com/zalu224` inferred from the assignment repo URLs; added to Contact.
- `ID 2025·0506` on the card references CS506, where this site started. Cosmetic.
- Pokécha and OFYE descriptions are written from their live sites, not from your notes. Role is
  recorded as "Design & build" for both — correct me if either was a team effort.
- Pokécha's period is recorded as `2026` and OFYE's as `2026`; exact start dates unknown.
