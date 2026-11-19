'use strict';
// Browsers keep styles.css and the scripts cached after a deploy, so a page
// can load fresh HTML against stale CSS/JS and render broken. Every page
// therefore references its assets as file?v=<hash of all assets>; a change to
// any asset changes the hash, and so the URL, and the cache is bypassed.
//
// Run `node scripts/stamp-assets.js` after editing any asset.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const ASSETS = ['styles.css', 'js/core.js', 'js/site.js', 'data/projects.js', 'data/work.js'];
const PAGES = ['index.html', 'work.html', 'projects.html', 'contact.html'];

function assetVersion() {
  const hash = crypto.createHash('sha256');
  for (const file of ASSETS) { hash.update(fs.readFileSync(path.join(ROOT, file))); }
  return hash.digest('hex').slice(0, 10);
}

function stamp(html, version) {
  return html.replace(
    /((?:href|src)=")((?:styles\.css|js\/[\w-]+\.js|data\/[\w-]+\.js))(?:\?v=[\w]+)?(")/g,
    (_, open, file, close) => open + file + '?v=' + version + close
  );
}

if (require.main === module) {
  const version = assetVersion();
  for (const page of PAGES) {
    const file = path.join(ROOT, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = stamp(html, version);
    if (next !== html) { fs.writeFileSync(file, next); }
  }
  console.log('assets stamped v=' + version);
}

module.exports = { ASSETS, PAGES, assetVersion, stamp };
