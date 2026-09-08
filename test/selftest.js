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

// --- Composition: single fixed letter, no rotation (Trisha, 2026-08-24) ---
ok('LETTER_SUBJECT and LETTER_TEXT are defined',
   /var LETTER_SUBJECT\s*=/.test(htmlNB) && /var LETTER_TEXT\s*=/.test(htmlNB));
ok('no rotation/issue-picker identifiers remain live',
   !/\b(OPEN|FIRE|ISSUES|applyRotation|initialRotation|shuffleRotation|curRot)\b/.test(htmlNB));

// --- Paragraph content (traceable-to-record anchors) ---
ok('names the minimum siting criteria lever',
   html.includes('minimum siting criteria'));
ok('cites the March 14, 2025 AHW272R4 177 degree F wellhead temperature reading',
   html.includes('March 14, 2025') && html.includes('AHW272R4') &&
   html.includes('177°F') && html.includes('wellhead temperature'));
ok('states the 180 degree F HOV compliance-classification gap',
   html.includes('180°F Higher Operating Value') &&
   html.includes('not classified as a temperature exceedance'));
ok('lists the three requested minimum-criteria protections',
   html.includes('Continuous wellhead monitoring') &&
   html.includes('regardless of an approved HOV') &&
   html.includes('Subsurface Elevated-Temperature and Smolder Prevention and Response Plans'));
ok('links the proposed-protections page and the Part 115 minimum-criteria brief',
   html.includes('https://arborhillsmonitor.org/proposed-protections/') &&
   html.includes('https://policy.arborhillsmonitor.org/mmp-minimum-criteria-brief.html'));
ok('states EGLE must independently determine MMP consistency (the independent-oversight ask)',
   html.includes('independently determine whether a proposed facility is consistent') &&
   html.includes('MCL 324.11585'));

// --- Loader: the single letter is wired at load ---
ok('loadLetter() sets subject + boiler from the fixed constants',
   /function loadLetter\(\)\{[\s\S]*?LETTER_SUBJECT[\s\S]*?LETTER_TEXT[\s\S]*?\}/.test(htmlNB));
ok('loadLetter is called at load', /\bloadLetter\(\);/.test(htmlNB));
ok('no shuffle control remains', !/btn-shuffle/.test(html));

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
