// Next-meeting card (Node, no deps).
//
//   node tools/meeting-card.js          rewrite the card in every page that carries it
//   node tools/meeting-card.js --check  exit 1 if any page's card is out of date
//
// The card is configured in ONE place, meeting-card.json (date only, YYYY-MM-DD,
// America/Detroit). Each page carries the card between
// <!-- meeting-card:start --> and <!-- meeting-card:end -->. The build writes BOTH
// states (before and after the meeting); the one that is true at build time is
// visible and the other is `hidden`. A small inline script (CLIENT_SCRIPT below)
// re-checks the date in the reader's browser, so the card swaps on its own after the
// meeting day even if nobody rebuilds. With JavaScript off, the build-time state shows.
//
// The swap happens at the END of the meeting day (midnight America/Detroit), because
// the meeting time is not configured yet.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'meeting-card.json');
const PAGES = ['materials.html', 'mmpc/index.html'];
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

// True once the meeting day is over in America/Detroit.
function isPast(meetingDate, now) {
  parseDate(meetingDate);
  return detroitToday(now) > meetingDate;
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
  '  var c = document.getElementById("meeting-card");',
  '  if (!c || typeof Intl === "undefined" || typeof Intl.DateTimeFormat.prototype.formatToParts !== "function") return;',
  '  var d = c.getAttribute("data-meeting-date");',
  '  var p = {};',
  '  new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });',
  '  var past = (p.year + "-" + p.month + "-" + p.day) > d;',
  '  var u = c.querySelector("[data-state=upcoming]"), a = c.querySelector("[data-state=past]");',
  '  if (!u || !a) return;',
  '  u.hidden = past;',
  '  a.hidden = !past;',
  '})();',
].join('\n');

function renderCard(cfg, now) {
  const past = isPast(cfg.date, now);
  const timeTxt = cfg.time ? esc(cfg.time) : todo('meeting time');
  const placeTxt = cfg.location ? esc(cfg.location) : todo('meeting location');
  return [
    START,
    '<div id="meeting-card" data-meeting-date="' + esc(cfg.date) + '">',
    '<div data-state="upcoming"' + (past ? ' hidden' : '') + '>',
    '<p class="clab">Next meeting</p>',
    '<p class="mtg">' + esc(cfg.body) + ' &middot; ' + longDate(cfg.date) + '</p>',
    '<p class="cline">' + timeTxt + ' &middot; ' + placeTxt + ' &middot; ' +
      link(cfg.agenda_url, 'Agenda', 'agenda link') + '</p>',
    '</div>',
    '<div data-state="past"' + (past ? '' : ' hidden') + '>',
    '<p class="clab">After the meeting</p>',
    '<p class="mtg">Thank you for attending the ' + shortDate(cfg.date) + ' ' +
      esc(cfg.body) + ' meeting.</p>',
    '<p class="cline">' + link(cfg.followup_url, 'Follow-up notes and next steps',
      'follow-up notes link') + '</p>',
    '</div>',
    '</div>',
    '<script>',
    CLIENT_SCRIPT,
    '</script>',
    END,
  ].join('\n');
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
  const card = renderCard(loadConfig(), new Date());
  let stale = 0;
  for (const rel of PAGES) {
    const file = path.join(ROOT, rel);
    const html = fs.readFileSync(file, 'utf8');
    const out = replaceCard(html, card, rel);
    if (out === html) continue;
    if (check) { stale++; console.log('  STALE  ' + rel + ' (run node tools/meeting-card.js)'); }
    else { fs.writeFileSync(file, out); console.log('  wrote  ' + rel); }
  }
  if (check) console.log('meeting-card --check: ' + (stale ? stale + ' stale' : 'all pages current'));
  return stale ? 1 : 0;
}

module.exports = { longDate, shortDate, detroitToday, isPast, renderCard, replaceCard,
  CLIENT_SCRIPT, PAGES, START, END, loadConfig };

if (require.main === module) process.exit(main(process.argv.slice(2)));
