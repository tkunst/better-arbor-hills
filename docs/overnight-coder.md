# Overnight coder loop

A procedure for running an unattended, autonomous coding session against this repo.
Kick-off is a single paste into a fresh `claude` session in this repo — the standard
invocation:

> Follow docs/overnight-coder.md. Goal + full spec: [handoff file path] —
> read that file first, it IS the goal.

This document is then the standing instruction for how the session proceeds without
further check-ins. It is **not** `/loop` (that re-runs a prompt on an interval); this is
one paste, one continuous session that carries the build through to a live deploy.

> **Provenance.** This is the generic overnight-coder process, adapted from the
> `arbor-hills-monitor` version for **this** repo, which is a single-file static site
> (`index.html`, GitHub Pages, no Python, no CI). The review / security / convergence
> discipline is unchanged; only the repo-specific mechanics (test command, "CI",
> deploy, backlog housekeeping) differ, because this repo has different infrastructure.
> Read this repo's `CLAUDE.md` at session start and follow it throughout.

## Standing authorization (read this first)

This loop is **pre-authorized to merge to `main` and push (deploy) without asking**,
provided every gate in Step 8 passes. That is the whole point of an unattended run. It
does **not** authorize:
- merging past an **open medium/high security finding** — ever (Step 6 is a hard stop);
- shipping a **new external integration live** — anything that sends resident data or
  talks to a backend ships **dormant/disabled** (empty config, hidden control) until a
  human turns it on. Building it is fine; enabling it is a separate human step;
- **authoring or altering a factual claim** in a letter — see `CLAUDE.md`'s content rule.
  Facts come only from the handoff / Trisha / already-verified content.

If you are re-reading this later wondering whether a merge was authorized: yes, as long
as this document was in effect and every Step-8 gate was actually met.

## Inputs

- **The goal** — supplied at invocation time (the handoff file). If invoked with no goal,
  stop and say so; don't guess at what to work on. The handoff IS the spec; read it first.
- **This repo's `CLAUDE.md`** — what the repo is, the test/gate, the content rule, the
  voice guide, the security rules, ownership, deploy. Read it at session start and follow
  it throughout. This document only adds the review/merge procedure around those rules.

## Procedure

### 1. Setup
- `cd` into this repo (`/Volumes/Samsung-Pro-2TB/repos/better-arbor-hills`).
- `git status` — the check that matters is **uncommitted changes to tracked files**, or an
  in-progress branch that isn't this loop's own prior work; either means stop and leave a
  note rather than steamrolling it. Unrelated *untracked* files are someone else's
  work-in-progress to leave alone, not a blocker.
- `git fetch origin`, checkout `main`, `git pull --ff-only` — start from a known-good base.

### 2. Create a branch
- Check for an existing open branch/PR for this goal (`gh pr list --state open`,
  `git branch -a`) from an interrupted prior run; if one exists, don't start a competing
  second attempt — that's the human's to resolve.
- Short, descriptive branch name tied to the goal (e.g. `fire-rotation-phase1`). Branch off `main`.

### 3. Iterate on the goal and its checks
- If the goal is multi-step, use `TaskCreate` to keep a long unattended run legible.
- **Cap the iteration at roughly 6 write-test-fix cycles.** If it isn't converging by then,
  stop rather than grinding — that's a Step-3 stop (see "What 'stopped for a human' looks
  like").
- De-risk anything genuinely uncertain with a throwaway spike first; only the real change
  and its checks land in the repo.
- This repo has **no `pytest` and no CI.** The gate here (per `CLAUDE.md`) is: a **JS
  self-test** (Node, no deps) over the pure functions, plus a **browser acceptance
  checklist** you actually run. Write the self-test alongside the change; it must be green
  before moving on. A green self-test alone is not sufficient to merge — the Step 5/6
  subagent reviews still run.
- **Dormant-by-default for anything external.** If the change adds a path that would send
  resident data or hit a backend, it ships behind an empty-config / hidden control (Step 8
  standing-authorization rule). Wiring the client is fine; enabling it is a later human step.
- Stage only the files that belong to this change. `git status` before every `git add`;
  don't sweep in unrelated files.

### 4. Commit (and optionally open a PR)
- Commit message: explain *why*, not just *what* (match recent commits — `git log -5`).
- This is a solo repo with no branch protection and no CI, so a PR is **optional** — its
  only value here is legibility. You may `gh pr create` for a readable record, but there is
  no CI to wait on; the **review of record is the Step 5 subagent review** below, run
  locally on the diff. If you skip the PR, keep the branch and the diff (`git diff main...HEAD`)
  as the review artifact.

### 5. Independent code review (a subagent, run locally on the diff)
- **Spawn a fresh subagent** (`code-reviewer` if registered, else `general-purpose`) and
  give it **only** the diff (`git diff main...HEAD`) and the review task — not this session's
  reasoning. That no-context, diff-only read is what makes it independent. Ask for findings
  as a structured list (file:line, severity, what's wrong, why it matters, most-severe
  first) and to state explicitly when it finds nothing.
- Fix every finding in the branch. Re-review after fixes in the Step 7 loop until clean.
- Record the outcome (a short note in the commit/PR body) so the review is legible later.

### 6. Security review (a subagent on the diff)
- **Do not rely on the `/security-review` skill for this repo** — that skill's cwd is
  hard-pinned to the Lotext workspace root and cannot target this repo. Instead spawn a
  **security-focused subagent** given the same diff, and ask specifically about: XSS via
  resident input in URLs/DOM, any `innerHTML` sink, PII handling, and URL-injection in the
  compose links.
- **Any medium or high finding = hard stop.** Do not fix it yourself, do not merge. Write up
  the finding clearly (what, where, why) and end the iteration for a human. This is the one
  hard escalation in the whole procedure — security severity is always the human's call.
- **Low-severity** findings: fix in the Step 7 loop. **If a finding's severity is uncertain,
  round up and escalate** (fail-safe).

### 7. Convergence loop (3-round cap)
A fix can introduce its own issue, so after applying fixes re-run Steps 5 and 6:
- Re-check → nothing open, no security findings → done, go to Step 8.
- Re-check → new non-security findings → fix, loop again.
- Re-check → any medium/high security finding → stop per Step 6, whatever round it is.
- **Cap at 3 rounds.** If not converged after 3, stop and leave it for a human — a loop that
  can't converge in 3 rounds is telling you the goal is underspecified or the approach is
  wrong, not that a 4th round will fix it.

### 8. Merge and deploy (only reached with zero open items)
- Confirm the JS self-test is green and the browser checklist passed on the latest commit,
  and that Steps 5 and 6 came back clean (or their findings were resolved).
- Merge to `main`: `git checkout main && git merge --ff-only <branch>` (or
  `gh pr merge <n> --rebase --delete-branch` if you opened a PR — always pass an explicit
  merge method so an unattended run never hangs on a prompt). Then `git push`.
- **Verify the deploy live:** GitHub Pages redeploys the root on push. Confirm
  `curl -s -o /dev/null -w "%{http_code}" https://tkunst.github.io/better-arbor-hills/`
  returns 200 and the page reflects the change (allow a minute for CDN propagation; retry).
- Leave a short closing note (commit body or PR comment): what shipped, anything still gated
  behind a dormant flag / manual step a human must do, and any residual risk accepted. This
  is what the human reads first.

### 9. Backlog housekeeping (only if a backlog fed you)
If the goal came from a tracked backlog, update it (mark done / move to an archive) so the
next review doesn't have to. If it was an ad-hoc paste, skip this. Best-effort: a failure
here must never undo the merge — say so in your closing note and stop.

## What "stopped for a human" looks like
Every stop after Step 2 ends the same way, so there's one place to check:
- If real code exists (even incomplete/failing), commit it as-is, clearly marked WIP in the
  message, push the branch, and open a **draft PR** if one isn't open.
- If no code survived (a pure feasibility conclusion), commit a short write-up under `docs/`
  and open that as a draft PR.
- Either way, leave a comment explaining what happened and why it stopped.
- Don't close the PR, don't delete the branch, don't start a fresh competing attempt. One
  open, well-documented PR/branch waiting for a human is the correct end state.

The one exception is Step 1's dirty-tree stop: it happens before this loop touched anything,
so there's nothing of its own to commit — just end the session with a note.
