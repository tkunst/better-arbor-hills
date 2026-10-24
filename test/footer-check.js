// Footer check (Node, no deps): `node test/footer-check.js`.
// Every page on policy.arborhillsmonitor.org (except the redirect stubs) must carry
// the legal footer built from footer-canonical.json: links to the five legal pages on
// arborhillsmonitor.org, the advocacy disclaimer, and the LLC line. footer-canonical.json
// is a vendored copy of tkunst/arbor-hills-monitor footer/canonical-footer.json; the
// footer-drift workflow fails if the two differ.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const C = JSON.parse(fs.readFileSync(path.join(root, 'footer-canonical.json'), 'utf8'));

function pages(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'test' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(pages(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function norm(s) {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&#8217;|’/g, "'").replace(/&amp;/g, '&').replace(/&middot;/g, '·')
    .replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
}

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name); }
}

for (const file of pages(root).sort()) {
  const rel = path.relative(root, file);
  const html = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(html)) continue; // redirect stubs to the Monitor
  const blocks = html.match(/<footer class="legal-footer"[\s\S]*?<\/footer>/g) || [];
  ok(rel + ': exactly one legal footer', blocks.length === 1);
  if (blocks.length !== 1) continue;
  const f = blocks[0];
  for (const l of C.legal_links) {
    ok(rel + ': links ' + l.label, f.includes('href="' + C.legal_links_base_url + l.path + '"'));
  }
  ok(rel + ': advocacy disclaimer matches canon', norm(f).includes(norm(C.policy_disclaimer)));
  ok(rel + ': LLC line', norm(f).includes(norm(C.llc_line)));
}

console.log(`footer-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
