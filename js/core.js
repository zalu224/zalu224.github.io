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
    createLockState: createLockState
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
