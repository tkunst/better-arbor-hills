# CLAUDE.md — better-arbor-hills

## What this is
The resident letter-writing tool for Arbor Hills advocacy: a single static page
(`index.html`) that lets a Washtenaw County resident send a letter to the county
commissioners and state legislators from their own email account. Self-owned,
zero-backend, deployed by GitHub Pages from `main` at the repo root, live at
**https://tkunst.github.io/better-arbor-hills/**.

## Relationship to `arbor-hills-monitor` (read this)
This repo is **advocacy**. The `arbor-hills-monitor` repo/site is a deliberately
**neutral, factual** regulatory monitor. Keeping them separate is a standing decision,
not an accident. **Never** merge them, and **never** link this tool from the monitor
site. Work here stays here.

## Architecture
Everything lives in `index.html` — HTML, inline CSS, and vanilla JS. **No build step,
no bundler, no framework, no dependencies, no external scripts or CDNs.** Keep it fully
self-contained so it works on any static host and can never break from a third-party
outage. If you add a JS self-test, it may live under `test/` and run with plain Node.

## Tests / the gate (there is no CI)
This repo has no `pytest`, no GitHub Actions CI. The equivalent-strength gate is:
1. A **JS self-test** (Node, no deps) over the pure functions (letter composition, the
   rotation picker, the active-issue filter, a grep-style check for the security rules
   below). It must pass.
2. A **manual browser acceptance checklist** (documented per change).
3. The **Step 5 independent subagent review** and **Step 6 security subagent review**
   on the diff (see `docs/overnight-coder.md`).
These four together are the gate; a green self-test alone is not enough to merge.

## Content rule (CRITICAL — letters go to elected officials under residents' names)
Every factual claim in a letter (number, date, well ID, temperature, dollar figure)
**must trace to the primary regulatory record.** Never invent, extrapolate, or "improve"
a fact. New facts come only from Trisha or from already-verified content already in the
repo. If you cannot point to a source for a claim, drop it and flag it — never guess.

## Voice
User-visible text (letters and UI) follows the Arbor Hills voice guide: **no em-dashes**
(use commas, periods, or `--`), advocate-not-adversary tone, every figure traceable to
the record, no time-bound news hooks that expire.

## Security (resident free-text flows into URLs and the on-screen preview)
- **Always** `encodeURIComponent` every value that enters a `mailto:`/compose URL.
- **Never** use `innerHTML` (or equivalent) with resident input — build DOM with
  `textContent`/`value`, as the file already does.
- **Never** send a resident's email, name, or address anywhere except their own outbound
  letter — and, only on an opt-in they themselves trigger, a form/endpoint Trisha owns.

## Signup / storage ownership
Any email-signup list, Google Form, or storage for this tool is owned by the
**`kunst.trisha@gmail.com`** Google account — not the daily-driver Gmail, not a
`@trishakunst.com` alias. Ships dormant (no URL) until Trisha provides it. The coder
never provisions a backend or holds a secret.

## Deploy
Push to `main` → GitHub Pages redeploys the repo root. Verify live with
`curl -s -o /dev/null -w "%{http_code}" https://tkunst.github.io/better-arbor-hills/`
(expect 200). Nothing under `docs/` or this `CLAUDE.md` affects the served page.

## Embedding (`thermal-map-embed/`)
`thermal-map-embed/index.html` is a button-free copy of `thermal-map/index.html`
for iframe embedding on an external site (e.g. a Squarespace blog). It removes the
"Write your commissioners" CTA and nothing else. It **shares** the data + Leaflet
assets from `../thermal-map/` (`spatial-data.js`, `parcels.js`, `leaflet.*`), so a
data rebuild in `thermal-map/` auto-propagates to the embed with no edit. The one
thing that is duplicated is the presentation code (inline CSS + the map `<script>`):
if you change the map's styling or logic in `thermal-map/index.html`, mirror it into
`thermal-map-embed/index.html`. Embed URL: `https://tkunst.github.io/better-arbor-hills/thermal-map-embed/`.

## Forbidden
- No backend code, secrets, or credentials committed.
- No analytics, trackers, or external JS/CSS/fonts (self-contained only).
- No committing resident data or any real PII.
- No touching `arbor-hills-monitor`, and no advocacy CTA added to the monitor site.
