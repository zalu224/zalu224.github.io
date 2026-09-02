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
        skillGroupHtml('Languages & web', global.SKILLS.languages) +
        skillGroupHtml('Machine learning & AI', global.SKILLS.ml) +
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
    if (!card || !reader) { return null; }

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

  function init() {
    renderProjects();
    renderWork();
    renderHome();
    initCard(function () { /* Task 10 wires unlock here */ });
    initReveals();
  }

  global.Site = {
    prefersReducedMotion: prefersReducedMotion,
    initReveals: initReveals,
    renderProjects: renderProjects,
    renderWork: renderWork,
    renderHome: renderHome,
    initCard: initCard,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
