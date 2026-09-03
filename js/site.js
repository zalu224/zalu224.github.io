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


  function initLanyard() {
    var root = document.getElementById('lanyard');
    var tag = document.getElementById('name-tag');
    var path = document.getElementById('lanyard-path');
    var hero = document.getElementById('hero');
    var stage = document.getElementById('tag-stage');
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

    var lanyard = initLanyard();
    if (lanyard) {
      // Let the page paint, then let the badge fall in.
      setTimeout(function () { lanyard.drop(); }, 350);
    }

    initReveals();
    initCounters();
    initMagnetic();
    initPageTransitions();
  }

  global.Site = {
    prefersReducedMotion: prefersReducedMotion,
    initReveals: initReveals,
    renderProjects: renderProjects,
    renderWork: renderWork,
    renderHome: renderHome,
    initLanyard: initLanyard,
    initCounters: initCounters,
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
