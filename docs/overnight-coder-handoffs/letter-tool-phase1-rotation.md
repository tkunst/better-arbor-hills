# Handoff — Phase-1 fire-only letter + rotation engine

**Follow `docs/overnight-coder.md`.** Goal + full spec: this file — read it first, it IS
the goal. Also read this repo's `CLAUDE.md` (content rule, voice, security, ownership,
deploy) and follow it throughout. Written 2026-08-23.

## Goal in one paragraph

`index.html` currently offers seven issues, each with one fixed subject + one fixed "ask."
Refactor it to **Phase 1: the fire letter only**, and give that letter a **rotation
engine** — a list of paired `{subject, supporting-fact}` entries, one chosen per visit, so
letters reaching the Board of Commissioners carry variety across senders instead of one
identical fact. Split the fire body into three paragraphs (¶1 static intro, ¶2 static ask,
¶3 = rotating fact + static close). Add a thank-you moment on send, and a dormant email
signup. Ship it live and correct so Trisha can email her Washtenaw friends the link.

## What "done" means, and the deadline

- **Deadline: ~7:00pm ET today (2026-08-23).**
- **"Send tonight" = Trisha personally emails her friends the tool's LINK.** The tool sends
  nothing itself. So the only thing that gates 7pm is: the tool is **live, correct, and not
  embarrassing** at <https://tkunst.github.io/better-arbor-hills/>.
- **Done = the Critical Path below is live, on the starter content in §Content.** It does
  NOT need Trisha's expanded content or any signup backend — those are non-blocking.

## Critical path (build in this order; each step leaves the tool shippable)

1. **Phase-1 = fire only.** Comment out (do NOT delete) the other six `ISSUES` entries
   (water, pfas, methane, accountability, wetlands, sixmile) — Phase 2 restores them. With a
   single issue, hide the issue-picker fieldset; keep the render code so re-enabling is a
   data change, not a rebuild.
2. **Split the fire letter into ¶1/¶2/¶3 and wire the rotation engine** (§Data model),
   seeded with the **starter rotations** in §Content. This is the core of the task.
3. **Rotation UX = visible + controllable** (§Rotation UX) — REQUIRED, not optional. This is
   the authenticity mitigation; do not ship a hidden random.
4. **Thank-you moment** on send (§Thank-you).
5. **(Non-blocking) Email signup** (§Signup) — dormant link, ships hidden.

## Data model (replace the fire entry's flat `ask`)

```js
var OPEN = "<unchanged — the shared ¶1 intro already in the file>";
var FIRE = {
  ask:   "<static ask sentence — see §Content ¶2>",
  close: "Once this plan is approved, the opportunity to require these protections is gone.",
  rotations: [
    { subject: "<subject A>", fact: "<supporting fact A>" },
    { subject: "<subject B>", fact: "<supporting fact B>" }
    // Trisha appends more — see §Content
  ]
};
// ¶1..¶3 boiler, before the resident's own words + signature:
function letterBody(rot) { return [OPEN, FIRE.ask, rot.fact + " " + FIRE.close].join("\n\n"); }
```

Keep the existing `body()` composition (own-words paragraph + signature) exactly. Only the
boiler (¶1..¶3) changes.

## Rotation UX — visible + controllable (REQUIRED — authenticity mitigation)

A hidden per-load random would make a real constituent sign a fact they never saw, which
reads as *more* astroturfed, not less — the opposite of what gives this tool weight (see the
file's own nudge: "Identical form letters get counted and set aside. One honest, personal
reason from a real resident is what actually moves a commissioner."). So:

- On load, pick one rotation and **show it**: chosen subject fills the editable Subject
  field; chosen ¶3 fact is visible in the editable letter textarea + the finished-letter preview.
- Add a small **"Show a different version"** control that re-rolls to another rotation (new
  subject + fact) and updates the fields. Don't repeat the same one twice in a row when >1 exists.
- Keep the existing **"Add a sentence or two in your own words"** nudge + field exactly as is.
- One short line near the shuffle control, e.g.: "This letter highlights one fact about the
  fire risk. Show a different version, or edit it below. The words are yours." (No em-dash.)

## Thank-you

On any successful send (mailto click, Gmail/Outlook open, either copy button), show a clear
inline thank-you (reuse page styling; no blocking modal) — more than the existing 4-second
status flash. E.g.: "Thank you for writing the board. Your letter is on its way from your own
email. Every letter helps get these protections written into the minimum criteria while there
is still time." No backend.

## Signup (NON-BLOCKING — client only, dormant; owned by <kunst.trisha@gmail.com>)

Residents can opt into monitor updates; **Trisha owns the emails via the
`kunst.trisha@gmail.com` account.** Ship the client dormant; she provisions the destination.
Do NOT stand up a backend, hold a secret, or POST resident PII (per `CLAUDE.md`).

- Add a config near the top of the script:
  `var SIGNUP_FORM_URL = ""; // paste a Google Form owned by kunst.trisha@gmail.com; empty = hidden`
- If set, render a small "Get updates from the monitor" link (opens the Form in a new tab);
  if empty, render nothing. Zero backend, zero secret, the response Sheet lives in that account.
- Design note for later (do NOT build now): the tool also collects a "Your email" field that
  is currently unused (the letter sends from the resident's own account, so reply-to is
  automatic). Phase 2 may repurpose that field as the opt-in capture. Leave it as-is for now.

## Content — PROVIDED. Do NOT author facts. (See CLAUDE.md's content rule.)

Use the starter set below (split verbatim from the live tool's already-verified fire `ask`)
plus whatever Trisha adds. Never invent/alter a number, date, or claim. If Trisha's block is
empty at build time, ship the starter set — it is a correct, live tool on its own.

**¶2 — the ask (static; verbatim split from the current fire `ask`):**
> I am asking you to urge the committee to require, as a minimum condition of any approval,
> continuous automated temperature monitoring on the gas-extraction wells and a written
> subsurface-temperature-event and smolder-prevention plan, with an independent,
> county-selected expert to interpret the record.

**¶3 close (static tail after every rotating fact):**
> Once this plan is approved, the opportunity to require these protections is gone.

**Starter rotations (verbatim-verified; Trisha expands):**

```js
rotations: [
  {
    subject: "Please put continuous temperature monitoring in the Arbor Hills minimum criteria",
    fact: "The site's clearest overheating event, well AHW272R4 at 177 degrees Fahrenheit, was only reconstructed months later from a semi-annual report, and 28 wells sat at or above 131 degrees in 2025."
  },
  {
    subject: "Monthly temperature spot checks are not enough at Arbor Hills",
    fact: "Monthly single readings cannot catch an event that begins the week after a sampling round, and the operator's at-depth temperature profiling has not been filed since early 2023."
  }
]
```

**Trisha's content block (leave a clearly-labeled empty slot after the starters):**

```js
// -- TRISHA: paste additional {subject, fact} pairs below. Each fact must trace to the
//    primary regulatory record. Voice guide: no em-dashes, advocate not adversary. --
//   { subject: "", fact: "" },
```

If she has already pasted content there by build time, keep it — do not overwrite.

## Task-specific hard stops (on top of CLAUDE.md and overnight-coder.md)

1. **Do not author or alter factual claims** (CLAUDE.md content rule). Facts come only from
   §Content or Trisha's block.
2. **Signup ships dormant** — a link to a Form owned by `kunst.trisha@gmail.com`. No backend,
   no secret, no resident PII POSTed.
3. **Rotation must be visible + re-rollable + editable** — never a hidden random. Keep the
   "your own words" nudge + field.
4. Voice + security per CLAUDE.md (no em-dashes in user-visible text; `encodeURIComponent` on
   every compose-URL value; never `innerHTML` with resident input).

## Gates (per overnight-coder.md Steps 5-8)

Branch `fire-rotation-phase1`. Write `test/selftest.js` (Node, no deps) asserting:
`letterBody(rot) === OPEN + "\n\n" + FIRE.ask + "\n\n" + rot.fact + " " + FIRE.close`; exactly
one active issue (`fire`); the rotation picker returns a valid `{subject,fact}` and shuffling
changes it when `rotations.length > 1`; and a grep-style check that the file has no
`innerHTML`-from-input and uses `encodeURIComponent` on every compose URL. Then the browser
acceptance checklist (no console errors; fire letter shows with a rotation; picker hidden;
"Show a different version" re-rolls into Subject/letter/preview; edits reflect in preview +
send links; mailto/Gmail/Outlook carry To=Chair, Cc=8 commissioners + 4 legislators, right
subject+body; copy buttons work; thank-you shows on each send path; signup renders nothing and
errors nothing when `SIGNUP_FORM_URL=""`; dark mode + ~360px mobile look right). Then Step 5
subagent review + Step 6 security subagent, converge (3-round cap), merge to `main`, push,
and verify the live 200 shows the fire letter with a rotation.

## Phase 2 / Phase 3 (context only — NOT this run)

- **Phase 2:** more recipients; re-enable the six commented issues, each optionally with its
  own `rotations[]`; upgrade signup to an inline Cloudflare Worker capture (storage owned by
  <kunst.trisha@gmail.com>) so residents don't leave the page; possibly repurpose the unused
  "Your email" field as the opt-in.
- **Phase 3:** different letter sets per audience — already a data change given `active` + per-issue `rotations[]`.
