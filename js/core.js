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
