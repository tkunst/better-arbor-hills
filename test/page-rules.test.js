// Page rules for the redesigned pages (Node, no deps): `node test/page-rules.test.js`.
// Design handoff 2026-11-12, section 6: referrer + viewport meta, one h1, no em-dashes,
// no mailto links, decorative marks aria-hidden, arrows in link text aria-hidden, and the
// no-first-person-pronoun rule. The pronoun check reports every hit and fails on any hit
// that is not in KNOWN_PRONOUN_HITS (required copy flagged to Trisha in the PR, not
// reworded by the coder).
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PAGES = ['materials.html', 'mmpc/index.html'];

const KNOWN_PRONOUN_HITS = {
  'materials.html': ['your', 'your', 'you'], // "Write your commissioners", "straight from your own email", "Thank you for attending"
  'mmpc/index.html': ['you'], // "Thank you for attending"
};

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name + (extra ? ': ' + extra : '')); }
}

function text(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, "'").replace(/&amp;/g, '&');
}

for (const rel of PAGES) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  ok(rel + ': referrer meta', html.includes('<meta name="referrer" content="no-referrer">'));
  ok(rel + ': viewport meta', html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
  ok(rel + ': exactly one h1', (html.match(/<h1[\s>]/g) || []).length === 1);
  ok(rel + ': no em-dash', !/\u2014|&mdash;|&#8212;/.test(html));
  ok(rel + ': no mailto', !/mailto:/i.test(html));
  const svgs = html.match(/<svg[^>]*>/g) || [];
  ok(rel + ': every svg is aria-hidden', svgs.every((s) => s.includes('aria-hidden="true"')),
    svgs.filter((s) => !s.includes('aria-hidden')).join(' '));
  const arrows = (html.match(/&rarr;|→/g) || []).length;
  const hidden = (html.match(/<span[^>]*aria-hidden="true"[^>]*>\s*(&nbsp;)?(&rarr;|→)\s*<\/span>/g) || []).length;
  ok(rel + ': every arrow is inside an aria-hidden span', arrows === hidden, arrows + ' arrows, ' + hidden + ' hidden');
  ok(rel + ': heading levels never skip', (() => {
    let prev = 1;
    for (const m of html.matchAll(/<h([1-6])[\s>]/g)) { const l = +m[1]; if (l > prev + 1) return false; prev = l; }
    return true;
  })());
  const hits = (text(html).match(/\b(we|our|ours|us|i|me|my|mine|you|your|yours)\b/gi) || [])
    .map((w) => w.toLowerCase());
  console.log('  pronoun hits in ' + rel + ': ' + (hits.length ? hits.join(', ') : 'none'));
  ok(rel + ': pronoun hits are only the known, flagged ones',
    JSON.stringify(hits.slice().sort()) === JSON.stringify(KNOWN_PRONOUN_HITS[rel].slice().sort()),
    hits.join(','));
}

console.log(`page-rules: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
