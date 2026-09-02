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

  var COUNT_RE = /^([^0-9-]*)(-?[0-9,]*\.?[0-9]+)(.*)$/;

  function parseCountable(text) {
    var match = COUNT_RE.exec(String(text === null || text === undefined ? '' : text).trim());
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
      var text = escapeHtml(b);
      return '<li>' + text.replace(
        /(\d[\d,]*(?:\.\d+)?%?\+?)/,
        '<span class="stat-num" data-count>$1</span>'
      ) + '</li>';
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

  // A verlet rope: a chain of points held together by distance constraints.
  // points[0] is pinned to the anchor; the last point carries the badge. Passing
  // a drag position to step() pins the free end there instead of letting it fall.
  function createRope(options) {
    var opts = options || {};
    var count = Math.max(2, opts.segments || 12);
    var segmentLength = opts.segmentLength || 16;
    var gravity = opts.gravity === undefined ? 0.9 : opts.gravity;
    var friction = opts.friction === undefined ? 0.97 : opts.friction;
    var iterations = Math.max(1, opts.iterations || 14);
    var anchorX = opts.x || 0;
    var anchorY = opts.y || 0;

    // Start collapsed at the anchor so the rope unrolls downward into view.
    // The tiny spread matters: perfectly coincident points give the distance
    // solver no direction to separate along, and the rope never unfurls.
    var points = [];
    for (var n = 0; n < count; n++) {
      var sx = anchorX + (n % 2 === 0 ? 0.4 : -0.4);
      var sy = anchorY + n * 0.8;
      points.push({ x: sx, y: sy, px: sx, py: sy });
    }

    function step(drag) {
      var i, p, vx, vy, a, b, dx, dy, dist, diff, ox, oy;

      for (i = 1; i < points.length; i++) {
        p = points[i];
        vx = (p.x - p.px) * friction;
        vy = (p.y - p.py) * friction;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + gravity;
      }

      for (var k = 0; k < iterations; k++) {
        points[0].x = anchorX;
        points[0].y = anchorY;

        for (i = 0; i < points.length - 1; i++) {
          a = points[i];
          b = points[i + 1];
          dx = b.x - a.x;
          dy = b.y - a.y;
          dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          diff = (segmentLength - dist) / dist * 0.5;
          ox = dx * diff;
          oy = dy * diff;
          if (i !== 0) { a.x -= ox; a.y -= oy; }
          b.x += ox;
          b.y += oy;
        }

        if (drag) {
          var last = points[points.length - 1];
          last.x = drag.x;
          last.y = drag.y;
        }
      }

      return points;
    }

    // Rotation in CSS degrees for something hanging off the free end: 0 when
    // the rope hangs straight down, negative when the end swings right.
    function angleDeg() {
      var n = points.length;
      var a = points[n - 2];
      var b = points[n - 1];
      return Math.atan2(-(b.x - a.x), b.y - a.y) * 180 / Math.PI;
    }

    function maxSpeed() {
      var most = 0;
      for (var i = 1; i < points.length; i++) {
        var p = points[i];
        var vx = p.x - p.px;
        var vy = p.y - p.py;
        var speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > most) { most = speed; }
      }
      return most;
    }

    return {
      points: points,
      segmentLength: segmentLength,
      step: step,
      angleDeg: angleDeg,
      maxSpeed: maxSpeed,
      end: function () { return points[points.length - 1]; },
      setAnchor: function (x, y) { anchorX = x; anchorY = y; }
    };
  }

  var api = {
    clamp: clamp,
    distance: distance,
    centerOf: centerOf,
    isWithinSnapZone: isWithinSnapZone,
    tiltFromVelocity: tiltFromVelocity,
    parallaxOffset: parallaxOffset,
    UNLOCK_KEY: UNLOCK_KEY,
    isUnlockKey: isUnlockKey,
    readUnlockFlag: readUnlockFlag,
    writeUnlockFlag: writeUnlockFlag,
    createLockState: createLockState,
    parseCountable: parseCountable,
    formatCount: formatCount,
    easeOutCubic: easeOutCubic,
    escapeHtml: escapeHtml,
    parsePeriod: parsePeriod,
    sortWork: sortWork,
    featuredProjects: featuredProjects,
    projectsByKind: projectsByKind,
    chipsHtml: chipsHtml,
    bulletsHtml: bulletsHtml,
    projectCardHtml: projectCardHtml,
    workEntryHtml: workEntryHtml,
    courseworkRowHtml: courseworkRowHtml,
    createRope: createRope
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
