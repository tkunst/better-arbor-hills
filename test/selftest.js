// Self-test for the letter tool (Node, no deps, NO code execution): `node test/selftest.js`.
// Verifies the letter composition and the security/voice invariants from CLAUDE.md by
// reading index.html as text. This is the repo's gate (there is no CI); see docs/overnight-coder.md.
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// index.html with /* */ block comments stripped, so content checks validate LIVE code, not
// the preserved PHASE 2 comment (which contains the original issue text verbatim).
const htmlNB = html.replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// --- Composition: letter = P1(OPEN) + "\n\n" + P2(ask) + "\n\n" + P3(fact + " " + close) ---
// Asserted by matching letterBody's exact source rather than executing it.
ok('letterBody composes OPEN + ask + (fact + close), joined by single blank lines',
   html.includes('return [OPEN.trim(), FIRE.ask, rot.fact + " " + FIRE.close].join("\\n\\n"); }'));

// --- Paragraph content (traceable-to-record anchors) ---
ok('P1 (OPEN) names the minimum-criteria lever + Theo Eggermont',
   html.includes('minimum siting criteria') && html.includes('Theo Eggermont'));
ok('P2 (ask) is the static temperature-monitoring ask',
   /ask:\s*"I am asking you to urge the committee[^"]*continuous automated temperature monitoring/.test(htmlNB));
ok('close line is present and static',
   html.includes('close: "Once this plan is approved, the opportunity to require these protections is gone."'));

// --- Rotations: extract the FIRE.rotations block and check pairing/distinctness ---
// Extract from block-comment-stripped source, and drop `//` line comments so the commented
// TRISHA placeholder ({subject:"",fact:""}) is ignored.
const rotBlock = ((htmlNB.match(/rotations:\s*\[([\s\S]*?)\n\s*\]\s*\n\s*\};/) || [, ''])[1])
  .replace(/\/\/[^\n]*/g, '');
const subjects = [...rotBlock.matchAll(/subject:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
const facts = [...rotBlock.matchAll(/fact:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
ok('at least 2 rotations', subjects.length >= 2 && facts.length >= 2);
ok('subjects and facts are paired 1:1', subjects.length === facts.length);
ok('every subject and fact is non-empty', subjects.every(Boolean) && facts.every(Boolean));
ok('subjects are distinct', new Set(subjects).size === subjects.length);
ok('facts are distinct', new Set(facts).size === facts.length);

// --- Phase 1: fire only (the multi-issue ISSUES array must be commented out) ---
ok('no live ISSUES array (fire-only Phase 1)', !/^\s*var ISSUES\s*=/m.test(htmlNB));
ok('rotation engine is wired at load', /applyRotation\(initialRotation\(\)\)/.test(htmlNB));
ok('shuffle control is wired', /getElementById\("btn-shuffle"\)\.addEventListener/.test(htmlNB));

// --- Security invariants (CLAUDE.md) ---
ok('compose URLs encodeURIComponent the subject and body',
   html.includes('encodeURIComponent(subject())') && html.includes('encodeURIComponent(body())'));
ok('no innerHTML assignment anywhere', !/\.innerHTML\s*=/.test(html));
ok('no insertAdjacentHTML / document.write', !/insertAdjacentHTML|document\.write/.test(html));
ok('DOM text set via textContent (not raw HTML)', /\.textContent\s*=/.test(html));

// --- Voice: no em-dash in user-visible text (block comments already stripped; drop // lines too) ---
const visibleEmDash = htmlNB.split('\n').some(l => /—|&mdash;/.test(l) && !/^\s*\/\//.test(l));
ok('no em-dash in user-visible text', !visibleEmDash);

// --- Signup is empty (dormant) or a valid https Google Form URL; email field was removed ---
ok('SIGNUP_FORM_URL is empty or a valid https Google Form URL',
   /var SIGNUP_FORM_URL = "(|https:\/\/(forms\.gle|docs\.google\.com\/forms)\/[^"]+)";/.test(html));
ok('the unused "Your email" field is gone', !/id="email"/.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
