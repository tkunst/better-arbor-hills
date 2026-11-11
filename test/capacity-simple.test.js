// Capacity page check (Node, no deps): `node test/capacity-simple.test.js`.
// The page was built and refuted in Lotext (documents/arbor-hills/draft/capacity-simple-alternatives-2026-11-09, alt-A,
// refutation rounds 1-4). This test pins what must not drift on the public copy.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const MODEL_SHA = 'b2089218df04a6b8fee47faa296d82d363ca563c6990933a36e0d7f0fae41798';
const page = fs.readFileSync(path.join(__dirname, '..', 'capacity', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, c) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + name); } };
const block = id => { const m = page.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>')); return m && m[1]; };

// 1. The reviewed model block, byte for byte.
const ms = page.indexOf('<script id="model">'), me = page.indexOf('</script>', ms) + '</script>'.length;
ok('model block sha256 is the reviewed b2089218', crypto.createHash('sha256').update(page.slice(ms, me)).digest('hex') === MODEL_SHA);

// 2. Today at 52 miles reproduces 16.2 years, FY2036, FY2042; the page opens there with Pine Tree Acres off.
const ctx = {module: {exports: {}}, Math, JSON}; vm.createContext(ctx);
vm.runInContext(block('model'), ctx); vm.runInContext(block('simple'), ctx);
const S = ctx.module.exports.simple, a = S.answers(S.simpleState('A'));
ok('Today 52 miles = 16.2 years', a.left.toFixed(1) === '16.2');
ok('Today 52 miles falls below 5.5 years in FY2036', a.below === 2036);
ok('Today 52 miles runs out in FY2042', a.full === 2042);
ok('page opens on Today (Pine Tree Acres off)', /var state = simpleState\('A'\);/.test(page));

// 3. Publication hygiene.
ok('no draft banner', !/class="draft">/.test(page));
ok('legal footer present', /<footer class="legal-footer"/.test(page));
ok('no em or en dashes', !/[–—]/.test(page));
ok('self-contained: no external scripts or stylesheets', !/<script[^>]+src=|<link[^>]+stylesheet/i.test(page));

console.log((fail ? 'FAIL' : 'PASS') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
