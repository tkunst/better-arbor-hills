// Meeting card + meeting-date mentions (Node, no deps).
//
//   node tools/meeting-card.js          rewrite the card and date mentions in every page
//   node tools/meeting-card.js --check  exit 1 if any page is out of date
//
// Configured in ONE place, meeting-card.json: a `body` (e.g. MMPC) and a list of
// `meetings`, oldest first, each with a date (YYYY-MM-DD, America/Detroit), an optional
// `ends` (HH:MM, 24-hour; without it the meeting counts as over at midnight), and the
// display time, location and links (null = not supplied yet, renders a visible TODO).
//
// The card is written between <!-- meeting-card:start --> and <!-- meeting-card:end -->
// as one block per period: before meeting 1; between each meeting and the next (a
// thank-you for the one just held plus the next one); and after the last meeting
// (thank-you only). The block that is true at build time is visible, the rest are
// `hidden`. Every <span data-next-meeting>...</span> in a page names the next meeting
// ("the Nov. 18 meeting"), or "the next meeting" once none is configured.
// A small inline script (CLIENT_SCRIPT) re-checks the time in the reader's browser,
// so the card and the date mentions roll forward on their own even if nobody
// rebuilds. With JavaScript off, the build-time version shows.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'meeting-card.json');
const PAGES = ['materials.html'];
const START = '<!-- meeting-card:start -->';
const END = '<!-- meeting-card:end -->';

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.',
  'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday'];

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) throw new Error('meeting date must be YYYY-MM-DD, got ' + JSON.stringify(s));
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error('not a real date: ' + s);
  }
  return { y, mo, d, weekday: dt.getUTCDay() };
}

// "Wednesday, Nov. 18, 2026" (weekday computed from the date, never typed by hand)
function longDate(s) {
  const p = parseDate(s);
  return WEEKDAYS[p.weekday] + ', ' + MONTHS[p.mo - 1] + ' ' + p.d + ', ' + p.y;
}

// "Nov. 18"
function shortDate(s) {
  const p = parseDate(s);
  return MONTHS[p.mo - 1] + ' ' + p.d;
}

// Today's calendar date in America/Detroit, as YYYY-MM-DD.
// Built from formatToParts, not a locale's formatted string, so a browser that
// formats en-CA dates differently can never break the comparison.
function detroitToday(now) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).forEach((x) => { parts[x.type] = x.value; });
  return parts.year + '-' + parts.month + '-' + parts.day;
}

// Now in America/Detroit as "YYYY-MM-DD HH:MM" (24-hour), from formatToParts.
function detroitStamp(now) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).forEach((x) => { parts[x.type] = x.value; });
  return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
}

// "YYYY-MM-DD HH:MM" moment the card swaps; "24:00" (end of day) when no end time.
function endStamp(meetingDate, ends) {
  parseDate(meetingDate);
  if (ends != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ends)) {
    throw new Error('ends must be HH:MM (24-hour), got ' + JSON.stringify(ends));
  }
  return meetingDate + ' ' + (ends || '24:00');
}

// True once the meeting has ended in America/Detroit.
function isPast(meetingDate, now, ends) {
  return detroitStamp(now) >= endStamp(meetingDate, ends);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todo(label) {
  return '<span class="todo">TODO: ' + esc(label) + '</span>';
}

function link(url, text, todoLabel) {
  if (url && !/^https:\/\//.test(url)) throw new Error('link must be https: ' + JSON.stringify(url));
  if (url) return '<a href="' + esc(url) + '">' + esc(text) + '</a>';
  return esc(text) + ' ' + todo(todoLabel);
}

// The inline script. Kept in one constant so the test can run exactly what ships.
const CLIENT_SCRIPT = [
  '(function () {',
  '  function run() {',
  '  var c = document.getElementById("meeting-card");',
  '  if (!c || typeof Intl === "undefined" || typeof Intl.DateTimeFormat.prototype.formatToParts !== "function") return;',
  '  var p = {};',
  '  new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });',
  '  if (!p.hour || p.dayPeriod) return;',
  '  var now = p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute;',
  '  var blocks = c.querySelectorAll("[data-from]"), shown = null, i;',
  '  for (i = 0; i < blocks.length; i++) {',
  '    var f = blocks[i].getAttribute("data-from"), u = blocks[i].getAttribute("data-until");',
  '    if (!shown && (!f || now >= f) && (!u || now < u)) shown = blocks[i];',
  '  }',
  '  if (!shown) return;',
  '  for (i = 0; i < blocks.length; i++) blocks[i].hidden = blocks[i] !== shown;',
  '  var next = shown.getAttribute("data-next"), spans = document.querySelectorAll("[data-next-meeting]");',
  '  for (i = 0; i < spans.length; i++) spans[i].textContent = next;',
  '  }',
  '  // Date mentions can sit below the card, so wait for the whole page.',
  '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);',
  '  else run();',
  '})();',
].join('\n');

const NO_NEXT = 'the next meeting';

function nextPhrase(m) {
  return m ? 'the ' + shortDate(m.date) + ' meeting' : NO_NEXT;
}

// Validated meetings, oldest first, each with its end stamp.
function meetingsOf(cfg) {
  const list = cfg.meetings;
  if (!Array.isArray(list) || !list.length) throw new Error('meeting-card.json needs a non-empty `meetings` list');
  return list.map((m, i) => {
    const end = endStamp(m.date, m.ends);
    if (i && end <= endStamp(list[i - 1].date, list[i - 1].ends)) {
      throw new Error('meetings must be in date order: ' + m.date);
    }
    return Object.assign({}, m, { end });
  });
}

// One block per period: [from, until). Block i < n leads up to meeting i.
function periods(cfg) {
  const ms = meetingsOf(cfg);
  return ms.concat([null]).map((m, i) => ({
    from: i ? ms[i - 1].end : '',
    until: m ? m.end : '',
    prev: i ? ms[i - 1] : null,
    next: m,
  }));
}

function currentPeriod(cfg, now) {
  const stamp = detroitStamp(now);
  return periods(cfg).find((b) => (!b.from || stamp >= b.from) && (!b.until || stamp < b.until));
}

function renderBlock(cfg, b, visible) {
  const body = esc(cfg.body);
  const out = ['<div data-from="' + esc(b.from) + '" data-until="' + esc(b.until) +
    '" data-next="' + esc(nextPhrase(b.next)) + '"' + (visible ? '' : ' hidden') + '>'];
  if (b.prev) {
    out.push('<p class="clab">After the meeting</p>',
      '<p class="mtg">Thank you for attending the ' + shortDate(b.prev.date) + ' ' + body + ' meeting.</p>',
      '<p class="cline">' + link(b.prev.followup_url, 'Follow-up notes and next steps',
        'follow-up notes link') + '</p>');
  }
  if (b.next) {
    const m = b.next;
    out.push('<p class="clab"' + (b.prev ? ' style="margin-top:1rem"' : '') + '>Next meeting</p>',
      '<p class="mtg">' + body + ' &middot; ' + longDate(m.date) + '</p>',
      '<p class="cline">' + (m.time ? esc(m.time) : todo('meeting time')) + ' &middot; ' +
        (m.location ? esc(m.location) : todo('meeting location')) + ' &middot; ' +
        link(m.agenda_url, 'Agenda', 'agenda link') + '</p>');
  }
  out.push('</div>');
  return out.join('\n');
}

function renderCard(cfg, now) {
  const cur = currentPeriod(cfg, now);
  return [START, '<div id="meeting-card">']
    .concat(periods(cfg).map((b) => renderBlock(cfg, b, b.from === cur.from)))
    .concat(['</div>', '<script>', CLIENT_SCRIPT, '</script>', END]).join('\n');
}

const MENTION = /<span data-next-meeting>[^<]*<\/span>/g;

function renderMentions(html, cfg, now) {
  const phrase = esc(nextPhrase(currentPeriod(cfg, now).next));
  return html.replace(MENTION, '<span data-next-meeting>' + phrase + '</span>');
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function replaceCard(html, card, file) {
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a || html.indexOf(START, a + 1) >= 0) {
    throw new Error(file + ': needs exactly one meeting-card start/end marker pair');
  }
  return html.slice(0, a) + card + html.slice(b + END.length);
}

function main(argv) {
  const check = argv.includes('--check');
  const cfg = loadConfig(), now = new Date();
  const card = renderCard(cfg, now);
  let stale = 0;
  for (const rel of PAGES) {
    const file = path.join(ROOT, rel);
    const html = fs.readFileSync(file, 'utf8');
    const out = renderMentions(replaceCard(html, card, rel), cfg, now);
    if (out === html) continue;
    if (check) { stale++; console.log('  STALE  ' + rel + ' (run node tools/meeting-card.js)'); }
    else { fs.writeFileSync(file, out); console.log('  wrote  ' + rel); }
  }
  if (check) console.log('meeting-card --check: ' + (stale ? stale + ' stale' : 'all pages current'));
  return stale ? 1 : 0;
}

module.exports = { longDate, shortDate, detroitToday, detroitStamp, endStamp, isPast,
  periods, currentPeriod, renderCard, renderMentions, replaceCard, nextPhrase, meetingsOf,
  CLIENT_SCRIPT, PAGES, START, END, NO_NEXT, loadConfig };

if (require.main === module) process.exit(main(process.argv.slice(2)));
