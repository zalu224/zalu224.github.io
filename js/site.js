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

  function educationHtml(entry) {
    return '<article class="edu-item reveal">' +
      '<h3 class="serif">' + Core.escapeHtml(entry.school) + '</h3>' +
      '<p class="meta">' + Core.escapeHtml(entry.division) + ' \u00b7 ' +
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
        skillGroupHtml('Product & collaboration', global.SKILLS.product) +
        skillGroupHtml('Machine learning & AI', global.SKILLS.ml) +
        skillGroupHtml('Languages & web', global.SKILLS.languages) +
        skillGroupHtml('Frameworks & data', global.SKILLS.data));
    }
  }

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

  function initLanyard() {
    var root = document.getElementById('lanyard');
    var tag = document.getElementById('name-tag');
    var path = document.getElementById('lanyard-path');
    var hero = document.getElementById('hero');
    var stage = document.getElementById('card-stage');
    if (!root || !tag || !path || !hero) { return null; }

    var SEGMENT = 16;
    var rope = null;
    var raf = 0;
    var dragging = false;
    var dragPoint = null;
    var grabOffset = { x: 0, y: 0 };
    var dropped = false;

    // Hang the badge over the card stage, so it never crosses the name column.
    function layout() {
      var heroRect = hero.getBoundingClientRect();
      var box = stage ? stage.getBoundingClientRect() : heroRect;
      return {
        x: box.left - heroRect.left + box.width / 2,
        y: 0,
        restY: Math.max(140, box.top - heroRect.top + 56)
      };
    }

    function toHero(event) {
      var heroRect = hero.getBoundingClientRect();
      return { x: event.clientX - heroRect.left, y: event.clientY - heroRect.top };
    }

    function render() {
      var pts = rope.points;
      var d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
      for (var i = 1; i < pts.length; i++) {
        d += ' L' + pts[i].x.toFixed(1) + ',' + pts[i].y.toFixed(1);
      }
      path.setAttribute('d', d);

      var e = rope.end();
      tag.style.transform = 'translate3d(' + e.x.toFixed(1) + 'px,' + e.y.toFixed(1) +
        'px,0) rotate(' + rope.angleDeg().toFixed(2) + 'deg)';
    }

    function frame() {
      rope.step(dragPoint);
      render();
      if (dragging || rope.maxSpeed() > 0.05) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
      }
    }

    function run() {
      if (!raf && rope) { raf = requestAnimationFrame(frame); }
    }

    function restStatic() {
      // Reduced motion: no swinging. Hang it straight, still draggable.
      var at = layout();
      var x = dragPoint ? dragPoint.x : at.x;
      var y = dragPoint ? dragPoint.y : at.restY;
      path.setAttribute('d', 'M' + at.x + ',' + at.y + ' L' + x + ',' + y);
      tag.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }

    tag.addEventListener('pointerdown', function (event) {
      if (!dropped) { return; }
      dragging = true;
      tag.classList.add('is-dragging');
      tag.setPointerCapture(event.pointerId);
      var at = toHero(event);
      var e = rope ? rope.end() : { x: at.x, y: at.y };
      grabOffset = { x: at.x - e.x, y: at.y - e.y };
      dragPoint = { x: e.x, y: e.y };
      if (rope) { run(); } else { restStatic(); }
    });

    tag.addEventListener('pointermove', function (event) {
      if (!dragging) { return; }
      var at = toHero(event);
      dragPoint = { x: at.x - grabOffset.x, y: at.y - grabOffset.y };
      if (!rope) { restStatic(); }
    });

    function release(event) {
      if (!dragging) { return; }
      dragging = false;
      dragPoint = null;
      tag.classList.remove('is-dragging');
      if (tag.hasPointerCapture && tag.hasPointerCapture(event.pointerId)) {
        tag.releasePointerCapture(event.pointerId);
      }
      if (rope) { run(); } else { restStatic(); }
    }
    tag.addEventListener('pointerup', release);
    tag.addEventListener('pointercancel', release);

    global.addEventListener('resize', function () {
      if (!rope || dragging) { return; }
      var at = layout();
      rope.setAnchor(at.x, at.y);
      run();
    }, { passive: true });

    return {
      drop: function () {
        if (dropped) { return; }
        dropped = true;
        root.classList.add('is-dropped');

        var hint = document.getElementById('drag-hint');
        if (hint) { hint.textContent = 'Drag the badge'; }

        var at = layout();
        if (prefersReducedMotion()) {
          restStatic();
          return;
        }
        rope = Core.createRope({
          x: at.x,
          y: at.y,
          segments: Math.max(6, Math.round((at.restY - at.y) / SEGMENT)),
          segmentLength: SEGMENT
        });
        run();
      },
      isDropped: function () { return dropped; }
    };
  }

  function initCard(onAccepted, onGranted) {
    var card = document.getElementById('id-card');
    var readout = document.getElementById('readout');
    if (!card) { return null; }

    var dragging = false;
    var accepted = false;
    var originX = 0, originY = 0;
    var dx = 0, dy = 0;
    var lastX = 0, lastMoveTime = 0, velocityX = 0;

    function threshold() {
      return Core.swipeThreshold(card.getBoundingClientRect().width || 340);
    }

    function paint(tilt) {
      card.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' + tilt + 'deg)';
    }

    function reset() {
      dx = 0; dy = 0;
      card.style.transform = '';
      card.classList.remove('is-ready');
    }

    function accept() {
      if (accepted) { return; }
      accepted = true;
      dragging = false;
      card.classList.remove('is-dragging');
      card.classList.remove('is-ready');

      // Carry the card the rest of the way out to the right and let it go.
      var exit = Math.max(dx, threshold()) + 260;
      card.style.transition = 'transform 420ms ease-in, opacity 420ms ease-in';
      card.style.transform = 'translate3d(' + exit + 'px,' + dy + 'px,0) rotate(-5deg)';
      card.classList.add('is-consumed');

      setTimeout(function () {
        if (onGranted) { onGranted(); }
      }, 420);

      setTimeout(function () {
        if (readout) {
          typeOut(readout, 'Welcome', function () {
            setTimeout(function () { if (onAccepted) { onAccepted(); } }, 700);
          });
        } else if (onAccepted) {
          onAccepted();
        }
      }, 560);
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

      card.classList.toggle('is-ready', Core.isSwipeComplete(dx, threshold()));
    });

    function release(event) {
      if (!dragging || accepted) { return; }
      dragging = false;
      card.classList.remove('is-dragging');
      if (card.hasPointerCapture && card.hasPointerCapture(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      if (Core.isSwipeComplete(dx, threshold())) { accept(); } else { reset(); }
    }

    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);

    card.addEventListener('click', function (event) {
      event.preventDefault();
      if (!accepted) { accept(); }
    });

    return { accept: accept };
  }

  function initGate() {
    var body = document.body;
    if (!body.classList.contains('locked')) { return null; }

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
      // A touch-drag on the card itself fires native touchmove events on window
      // too. Without this check, starting the card drag would unlock instantly
      // via the scroll-intent fallback instead of requiring the actual swipe.
      global.addEventListener('touchmove', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest('#id-card')) { return; }
        lock.unlock('touch');
      }, { passive: true });
      global.addEventListener('keydown', function (event) {
        if (Core.isUnlockKey(event.key)) { lock.unlock('keyboard'); }
      });
    }

    return lock;
  }

  function animateCount(node) {
    var spec = Core.parseCountable(node.textContent);
    if (!spec) { return; }
    var start = null;
    var duration = 900;

    function frame(now) {
      if (start === null) { start = now; }
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

  function init() {
    renderProjects();
    renderWork();
    renderHome();
    var lock = initGate();
    var lanyard = initLanyard();
    initCard(function () {
      if (lock) { lock.unlock('swipe'); }
    }, function () {
      if (lanyard) { lanyard.drop(); }
    });
    initReveals();
    initCounters();
    initParallax();
    initMagnetic();
    initPageTransitions();
  }

  global.Site = {
    prefersReducedMotion: prefersReducedMotion,
    initReveals: initReveals,
    renderProjects: renderProjects,
    renderWork: renderWork,
    renderHome: renderHome,
    initCard: initCard,
    initLanyard: initLanyard,
    initGate: initGate,
    initCounters: initCounters,
    initParallax: initParallax,
    initMagnetic: initMagnetic,
    initPageTransitions: initPageTransitions,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
