// Meeting card test (Node, no deps): `node test/meeting-card.test.js`.
// Covers the date formatting, the America/Detroit "is the meeting over" rule, the
// build-time render, and the inline script that actually ships in each page (run in a
// sandbox with a fake clock and a fake document).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const mc = require('../tools/meeting-card.js');

const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name); }
}

// Formatting: the weekday comes from the date (Nov. 18, 2026 is a Wednesday).
ok('long date', mc.longDate('2026-11-18') === 'Wednesday, Nov. 18, 2026');
ok('short date', mc.shortDate('2026-11-18') === 'Nov. 18');
ok('AP month style (Sept.)', mc.longDate('2026-09-09') === 'Wednesday, Sept. 9, 2026');
ok('AP month style (March, no period)', mc.longDate('2027-03-02') === 'Tuesday, March 2, 2027');
let threw = false; try { mc.longDate('2026-02-30'); } catch (e) { threw = true; }
ok('rejects an impossible date', threw);
threw = false; try { mc.longDate('2026-11-18T18:00'); } catch (e) { threw = true; }
ok('rejects a date-time (date only)', threw);

// The swap happens at the end of the meeting day in America/Detroit (EST, UTC-5, in Nov.).
ok('upcoming the day before', !mc.isPast('2026-11-18', new Date('2026-11-17T12:00:00Z')));
ok('upcoming on the day, late evening ET', !mc.isPast('2026-11-18', new Date('2026-11-19T04:59:00Z')));
ok('past at 12:00 a.m. ET on Nov. 19', mc.isPast('2026-11-18', new Date('2026-11-19T05:00:00Z')));
ok('past a week later', mc.isPast('2026-11-18', new Date('2026-11-25T12:00:00Z')));
// With an end time (Nov. 18, 2026 is EST, UTC-5): swaps at 11:30 a.m. ET.
ok('ends: upcoming during the meeting (11:29 a.m. ET)', !mc.isPast('2026-11-18', new Date('2026-11-18T16:29:00Z'), '11:30'));
ok('ends: past at 11:30 a.m. ET', mc.isPast('2026-11-18', new Date('2026-11-18T16:30:00Z'), '11:30'));
ok('ends: upcoming the evening before', !mc.isPast('2026-11-18', new Date('2026-11-18T03:00:00Z'), '11:30'));
ok('ends: daylight time (July 1, 11:30 a.m. EDT = 15:30Z)',
  !mc.isPast('2026-07-01', new Date('2026-07-01T15:29:00Z'), '11:30') &&
  mc.isPast('2026-07-01', new Date('2026-07-01T15:30:00Z'), '11:30'));
threw = false; try { mc.endStamp('2026-11-18', '11:30 a.m.'); } catch (e) { threw = true; }
ok('ends must be 24-hour HH:MM', threw);
ok('midnight is 00, not 24 (hourCycle h23)', mc.detroitStamp(new Date('2026-11-19T05:00:00Z')) === '2026-11-19 00:00');

// Build-time render: exactly one state visible.
const cfg = { body: 'MMPC', date: '2026-11-18', time: null, location: null, agenda_url: null, followup_url: null };
const before = mc.renderCard(cfg, new Date('2026-11-12T12:00:00Z'));
const after = mc.renderCard(cfg, new Date('2026-11-20T12:00:00Z'));
ok('before: upcoming shown, past hidden',
  before.includes('<div data-state="upcoming">') && before.includes('<div data-state="past" hidden>'));
ok('after: past shown, upcoming hidden',
  after.includes('<div data-state="upcoming" hidden>') && after.includes('<div data-state="past">'));
ok('copy: next meeting line', before.includes('MMPC &middot; Wednesday, Nov. 18, 2026'));
ok('copy: thank-you line', before.includes('Thank you for attending the Nov. 18 MMPC meeting.'));
ok('unset time/location/links render as visible TODOs',
  (before.match(/class="todo"/g) || []).length === 4);
const filled = mc.renderCard(Object.assign({}, cfg, { time: '6:30 p.m.', location: 'Room <A>',
  agenda_url: 'https://example.org/a?x=1&y=2' }), new Date('2026-11-12T12:00:00Z'));
let threwScheme = false;
try { mc.renderCard(Object.assign({}, cfg, { agenda_url: 'javascript:alert(1)' }), new Date()); } catch (e) { threwScheme = true; }
ok("non-https link in config is refused", threwScheme);
ok('daylight time: still upcoming late on the day (July 1, 11:30 p.m. EDT)',
  !mc.isPast('2026-07-01', new Date('2026-07-02T03:30:00Z')));
ok('daylight time: past just after midnight EDT (July 2, 12:30 a.m.)',
  mc.isPast('2026-07-01', new Date('2026-07-02T04:30:00Z')));
ok('supplied values are escaped', filled.includes('Room &lt;A&gt;') && filled.includes('a?x=1&amp;y=2'));

// Every page carries the card the config describes (same as `node tools/meeting-card.js --check`
// would report on the build day), and exactly once.
const config = mc.loadConfig();
ok('config date is date-only', /^\d{4}-\d{2}-\d{2}$/.test(config.date));
if (config.ends && config.time) {
  // "11:30" (24-hour) is shown as "11:30" before noon and "1:30" after; the end time
  // the card swaps at must be the one the card advertises.
  const [h, m] = config.ends.split(':').map(Number);
  const shown = ((h % 12) || 12) + ':' + String(m).padStart(2, '0');
  ok('config: displayed time ends at `ends` (' + shown + ')', config.time.includes(shown), config.time);
}
for (const rel of mc.PAGES) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  ok(rel + ': one card', html.split(mc.START).length === 2 && html.split(mc.END).length === 2);
  ok(rel + ': card date matches meeting-card.json', html.includes('data-meeting-date="' + config.date + '"'));
  const a = html.indexOf(mc.START), b = html.indexOf(mc.END) + mc.END.length;
  const shipped = html.slice(a, b);
  ok(rel + ': whole card matches meeting-card.json (either state)',
    shipped === mc.renderCard(config, new Date(Date.parse(config.date + 'T12:00:00-05:00') - 86400000)) ||
    shipped === mc.renderCard(config, new Date(Date.parse(config.date + 'T12:00:00-05:00') + 2 * 86400000)));
  ok(rel + ': ships the tested inline script', html.includes(mc.CLIENT_SCRIPT));
  ok(rel + ': no innerHTML', !/innerHTML/.test(html));
}

// Run the shipped inline script with a fake clock and document.
function runClient(nowIso, date, ends) {
  const states = { upcoming: { hidden: false }, past: { hidden: true } };
  const card = {
    getAttribute: (n) => (n === 'data-meeting-date' ? date
      : n === 'data-meeting-end' ? mc.endStamp(date, ends) : null),
    querySelector: (sel) => states[/data-state=(\w+)/.exec(sel)[1]],
  };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(nowIso); }
  }
  vm.runInNewContext(mc.CLIENT_SCRIPT, {
    document: { getElementById: (id) => (id === 'meeting-card' ? card : null) },
    Intl, Date: FakeDate,
  });
  return states;
}
let s = runClient('2026-11-18T23:00:00Z', '2026-11-18');
ok('client: shows upcoming on meeting day', !s.upcoming.hidden && s.past.hidden);
s = runClient('2026-11-19T05:00:00Z', '2026-11-18');
ok('client: swaps to "after the meeting" at the end of the day ET', s.upcoming.hidden && !s.past.hidden);
s = runClient('2026-11-18T16:29:00Z', '2026-11-18', '11:30');
ok('client: with ends 11:30, still upcoming at 11:29 a.m. ET', !s.upcoming.hidden && s.past.hidden);
s = runClient('2026-11-18T16:30:00Z', '2026-11-18', '11:30');
ok('client: with ends 11:30, swaps at 11:30 a.m. ET', s.upcoming.hidden && !s.past.hidden);
s = runClient('2026-11-10T12:00:00Z', '2026-11-08');
ok('client: a past date (set in the past) shows the after state', s.upcoming.hidden && !s.past.hidden);

console.log(`\nmeeting-card: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
