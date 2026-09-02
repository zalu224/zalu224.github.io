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

  function init() {
    renderProjects();
    initReveals();
  }

  global.Site = {
    prefersReducedMotion: prefersReducedMotion,
    initReveals: initReveals,
    renderProjects: renderProjects,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
