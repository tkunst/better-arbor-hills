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

// Build-time render: two meetings -> three periods, exactly one visible.
const M1 = { date: '2026-11-18', time: '10 to 11:30 a.m.', ends: '11:30', location: null, agenda_url: null, followup_url: null };
const M2 = { date: '2026-12-09', time: null, ends: null, location: null, agenda_url: null, followup_url: null };
const cfg = { body: 'MMPC', meetings: [M1, M2] };
const visible = (html) => (html.match(/<div data-from="[^"]*" data-until="[^"]*" data-next="[^"]*">/g) || []);
const T_BEFORE = new Date('2026-11-12T12:00:00Z');
const T_BETWEEN = new Date('2026-11-18T16:30:00Z');   // 11:30 a.m. ET Nov. 18
const T_AFTER = new Date('2026-12-10T05:00:00Z');     // midnight ET after Dec. 9
const before = mc.renderCard(cfg, T_BEFORE), between = mc.renderCard(cfg, T_BETWEEN), after = mc.renderCard(cfg, T_AFTER);
ok('three periods for two meetings', (before.match(/data-from=/g) || []).length === 3);
ok('exactly one period visible at each time', [before, between, after].every((h) => visible(h).length === 1));
ok('before: Nov. 18 is next', visible(before)[0].includes('data-next="the Nov. 18 meeting"'));
ok('between: Dec. 9 is next', visible(between)[0].includes('data-next="the Dec. 9 meeting"'));
ok('after the last: "the next meeting"', visible(after)[0].includes('data-next="the next meeting"'));
ok('still Nov. 18 at 11:29 a.m. ET', mc.currentPeriod(cfg, new Date('2026-11-18T16:29:00Z')).next.date === '2026-11-18');
ok('Dec. 9 (no end time) is next until midnight ET', mc.currentPeriod(cfg, new Date('2026-12-10T04:59:00Z')).next.date === '2026-12-09');
ok('copy: next meeting line (weekday from the date)', before.includes('MMPC &middot; Wednesday, Nov. 18, 2026') && before.includes('MMPC &middot; Wednesday, Dec. 9, 2026'));
ok('copy: thank-you lines', before.includes('Thank you for attending the Nov. 18 MMPC meeting.') && before.includes('Thank you for attending the Dec. 9 MMPC meeting.'));
ok('between period: thank-you for Nov. 18 and next meeting Dec. 9 in one block',
  /data-until="2026-12-09 24:00"[^>]*>\n<p class="clab">After the meeting<\/p>\n<p class="mtg">Thank you for attending the Nov. 18 MMPC meeting\.<\/p>[\s\S]*?Wednesday, Dec\. 9, 2026/.test(before));
ok('unset values render as visible TODOs', before.includes('TODO: meeting location') && before.includes('TODO: meeting time'));
let threwOrder = false;
try { mc.renderCard({ body: 'MMPC', meetings: [M2, M1] }, T_BEFORE); } catch (e) { threwOrder = true; }
ok('meetings out of date order are refused', threwOrder);
const filled = mc.renderCard({ body: 'MMPC', meetings: [Object.assign({}, M1, { location: 'Room <A>',
  agenda_url: 'https://example.org/a?x=1&y=2' })] }, T_BEFORE);
let threwScheme = false;
try { mc.renderCard({ body: 'MMPC', meetings: [Object.assign({}, M1, { agenda_url: 'javascript:alert(1)' })] }, T_BEFORE); } catch (e) { threwScheme = true; }
ok('non-https link in config is refused', threwScheme);
ok('daylight time: still upcoming late on the day (July 1, 11:30 p.m. EDT)',
  !mc.isPast('2026-07-01', new Date('2026-07-02T03:30:00Z')));
ok('daylight time: past just after midnight EDT (July 2, 12:30 a.m.)',
  mc.isPast('2026-07-01', new Date('2026-07-02T04:30:00Z')));
ok('supplied values are escaped', filled.includes('Room &lt;A&gt;') && filled.includes('a?x=1&amp;y=2'));
const page = '<h2>three things before <span data-next-meeting>old</span></h2>';
ok('date mentions rewritten', mc.renderMentions(page, cfg, T_BETWEEN).includes('<span data-next-meeting>the Dec. 9 meeting</span>'));

// Every page carries the card and mentions the config describes, on any date.
const config = mc.loadConfig();
for (const m of config.meetings) {
  ok('config: ' + m.date + ' is date-only', /^\d{4}-\d{2}-\d{2}$/.test(m.date));
  if (m.ends && m.time) {
    // The end time the card swaps at must be the one the card advertises.
    const [h, mm] = m.ends.split(':').map(Number);
    const shown = ((h % 12) || 12) + ':' + String(mm).padStart(2, '0');
    ok('config: ' + m.date + ' displayed time ends at `ends` (' + shown + ')', m.time.includes(shown));
  }
}
for (const rel of mc.PAGES) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  ok(rel + ': one card', html.split(mc.START).length === 2 && html.split(mc.END).length === 2);
  const a = html.indexOf(mc.START), b = html.indexOf(mc.END) + mc.END.length;
  const shipped = html.slice(a, b);
  // The shipped card equals a render for SOME moment (one per period), so the test
  // stays true across the meetings; --check pins it to today.
  const candidates = mc.periods(config).map((p) => p.from
    ? new Date(Date.parse(p.from.slice(0, 10) + 'T12:00:00-05:00') + 86400000)
    : new Date(Date.parse(config.meetings[0].date + 'T12:00:00-05:00') - 86400000));
  ok(rel + ': whole card matches meeting-card.json', candidates.some((t) => shipped === mc.renderCard(config, t)));
  ok(rel + ': date mentions match the card',
    candidates.some((t) => shipped === mc.renderCard(config, t) && mc.renderMentions(html, config, t) === html));
  ok(rel + ': no hand-typed meeting date outside the card and mentions',
    !/Nov\. 18|Dec\. 9/.test(html.slice(0, a).replace(/<span data-next-meeting>[^<]*<\/span>/g, '') +
      html.slice(b).replace(/<span data-next-meeting>[^<]*<\/span>/g, '')));
  ok(rel + ': ships the tested inline script', html.includes(mc.CLIENT_SCRIPT));
  ok(rel + ': no innerHTML', !/innerHTML/.test(html));
}

// Run the shipped inline script with a fake clock and fake document built from the
// real render, then check which period shows and what the date mentions say.
function runClient(nowIso, conf) {
  const blocks = mc.periods(conf).map((p) => ({
    hidden: false,
    attrs: { 'data-from': p.from, 'data-until': p.until, 'data-next': mc.nextPhrase(p.next) },
    getAttribute(n) { return this.attrs[n]; },
  }));
  const spans = [{ textContent: 'x' }, { textContent: 'y' }];
  const card = { querySelectorAll: (sel) => (sel === '[data-from]' ? blocks : []) };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(nowIso); }
  }
  vm.runInNewContext(mc.CLIENT_SCRIPT, {
    document: {
      readyState: 'complete',
      getElementById: (id) => (id === 'meeting-card' ? card : null),
      querySelectorAll: (sel) => (sel === '[data-next-meeting]' ? spans : []),
    },
    Intl, Date: FakeDate,
  });
  return { shown: blocks.findIndex((x) => !x.hidden), hiddenCount: blocks.filter((x) => x.hidden).length, spans };
}
let r = runClient('2026-11-18T16:29:00Z', cfg);
ok('client: 11:29 a.m. ET Nov. 18 shows period 0, mentions "the Nov. 18 meeting"',
  r.shown === 0 && r.hiddenCount === 2 && r.spans.every((x) => x.textContent === 'the Nov. 18 meeting'));
r = runClient('2026-11-18T16:30:00Z', cfg);
ok('client: 11:30 a.m. ET Nov. 18 rolls to period 1, mentions "the Dec. 9 meeting"',
  r.shown === 1 && r.hiddenCount === 2 && r.spans.every((x) => x.textContent === 'the Dec. 9 meeting'));
r = runClient('2026-12-10T05:00:00Z', cfg);
ok('client: after Dec. 9 shows the last period, mentions "the next meeting"',
  r.shown === 2 && r.spans.every((x) => x.textContent === 'the next meeting'));

console.log(`\nmeeting-card: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
