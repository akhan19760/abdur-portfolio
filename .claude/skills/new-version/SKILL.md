---
name: new-version
description: The orchestrator's playbook for building one version of the portfolio in a version folder, from the content check to the finished page. Runs the scout, the finalists and direction boards, the design system, every section with the owner's review, and the whole-page check, keeping workflow/STATE.md current so a new session can resume. Use when the owner types /new-version or asks to start, continue or resume a version.
---

# New version

You are the orchestrator: the main session. You run one version of the portfolio, one
step at a time, and the owner approves every step. Workers (subagents) do the
building; you brief them, show the owner their work, and keep the record.

Read `workflow/RULES.md`, `workflow/PLAYBOOK.md` and `workflow/STATE.md` before
anything else. The rules there hold throughout; this file says in which order things
happen and how.

## How workers and the owner meet

A subagent cannot stop and wait for the owner. So every worker step that needs the
owner's approval is two turns:

1. **Turn 1.** Spawn the worker (Agent tool, `subagent_type` = its name) with "Write
   your brief and stop." Show the owner the brief it returns, in full. Note the
   worker's agent id in STATE.md under Notes.
2. **Turn 2.** When the owner approves, resume the same worker with `SendMessage` to
   its agent id: "Approved, build it." If the owner changes the brief, send the
   changes instead and show the revised brief before anything is built.

Steering after a build works the same way: resume the same worker with the owner's
feedback. Never let a worker skip its brief, and never approve anything on the
owner's behalf.

**Agents created during the session.** Claude Code watches `.claude/agents/`, and a
version folder always has that folder, so a worker file you write mid-session can be
spawned a few seconds later in the same session. If a spawn still answers "Agent type
... not found", tell the owner to restart with `claude --continue` and type
`/new-version`; the session resumes from STATE.md.

**Agent ids do not outlive a session.** After a restart, a worker from the old session
cannot be resumed. Start a fresh worker for the same job and tell it what has already
happened: the approved brief (in its feedback file or your notes), the files it built,
and `workflow/feedback/<slug>.md`.

## Keep STATE.md current

After every step, update `workflow/STATE.md`: tick the step in **Steps**, keep the
**Sections** table exact (Section, Folder, Status, Rounds, Commit), and write in
**Notes** whatever the next session needs (worker ids, effort raises, a step half
done). A section's Status is one of: pending, brief approved, in review, approved.

**On start, and on every /new-version**, read STATE.md and resume from the first
unticked step. Inside **Sections**, resume at the first section that is not approved,
at its status: pending means its brief, brief approved means its build, in review
means its review.

## 1. Check the folder

Run `git branch --show-current` and look at the folder name. Continue only when the
branch is `version/portfolio_vN` and the folder name ends in `-vN`, with the same N.
Otherwise stop and explain, without touching anything:

> This runs only in a version folder. From the main folder, on `main` with a clean
> working tree, run `bash scripts/next-version.sh`. It makes `../abdur-portfolio-vN`
> on `version/portfolio_vN` and purges it to a clean slate. Then
> `node scripts/leak-scan.mjs ../abdur-portfolio-vN`, `cd ../abdur-portfolio-vN`,
> `pnpm install`, `claude`, and `/new-version` there. `workflow/VERSIONING.md` has
> the details.

## 2. Content check

Read `workflow/content.md` and list `workflow/content-assets/`. Tell the owner what
is missing, as a short list:

- each project without a link (a live site, a repository or a case study);
- each project without a screenshot in `workflow/content-assets/` (a file whose name
  starts with the project's slug, such as `sceai-platform.png`);
- anything `content.md` itself marks as missing or still to come.

Ask the owner for the missing items. **Do not continue until the owner has answered
or said to skip.** Write the links they give into `content.md` under the project, and
save pictures they provide into `content-assets/` with the project's slug. Then tick
**Content check**.

## 3. Scout and the finalists board

Spawn `reference-scout`. When it reports, check that `workflow/boards/finalists.json`
exists and builds. If the scout says it needs the owner (a site the browser asked
about), ask the owner and resume the scout with the answer.

Then follow the `board` skill: build the finalists board, open it in the owner's
browser, wait for the pasted answers, validate them, and record the two sites in
DIRECTION.md. Tick **Scout and finalists board**.

## 4. Taste prepares the direction board

Load `design-taste-frontend` and do its steps 1 to 4 for this portfolio:

1. **Inventory** from `content.md` and `content-assets/`: the eight to twelve things
   that belong only to this owner.
2. **The argument**: one claim per section, with its proof. The claims give the
   **section list**, in order.
3. **Each category's options**: for type, palette, the hero, every section in the
   list, the footer, motion, scroll scenes and the one live thing, the option each of
   the two sites offers, measured from the scout's briefs and screenshots, each with
   the twist it needs. Add the extras.
4. **Taste's verdict and recommendation** on every option: passes, or the house rule
   it would need waived and why; which option taste recommends in each row, and why.
   Taste advises; it does not remove the owner's options.

Write `workflow/boards/direction.json` as the `board` skill requires: the study
section (one card per site, the principles, what to avoid), every row, and for every
option a live mock (an HTML fragment) with its fonts and palette, filled with the
owner's real content. Every font needs an open licence (RULES.md rule 5). Build the
board, open it, wait for the owner's answers, validate them, and record everything in
DIRECTION.md: the board answers with their site and twist, waived rules and why, the
idea sentence and the live thing, the section list in order, and the mood in four
words. Tick **Direction board**.

## 5. Design system

Run the `design-system` agent in two turns (brief, then build). For the review:

1. Run `pnpm build`, then `pnpm preview` in the background (Bash with
   `run_in_background`). Give the owner the local link it prints (usually
   http://localhost:4173/) and the specimen page's path.
2. The owner answers **Approve** or **Steer**. Steer: resume the worker with the
   feedback. Approve: commit as `feat(design-system): <what it adds>` and tick
   **Design system**.

## 6. Sections

One section at a time, in the section-list order from DIRECTION.md. For each:

1. **Make the worker.** Copy `workflow/templates/section-worker.template.md` to
   `.claude/agents/<slug>.md` and fill in its placeholders: `__SECTION_SLUG__` (the
   slug), `__SECTION_NAME__`, `__SECTION_FOLDER__` (`src/sections/<slug>/`),
   `__ROWS__` (this section's board answer, plus the type, palette and motion answers
   it must follow) and `__HERO_FLAG__` (` --hero` for the first section on the page,
   empty for every other).
2. **Add its row** to STATE.md: the section, its folder, status pending, rounds 0.
3. **Two turns.** Turn 1: spawn it for its brief and show the owner. On approval, set
   the status to brief approved and resume it: "Approved, build it." When it reports,
   check that its gate passed (0 section-level FAIL) and set the status to in review.
4. **Review.**
   - Run `pnpm build`, then `pnpm preview` in the background, and
     `node scripts/shoot-section.mjs <preview url> <slug>`. Give the owner the local
     link and the two screenshots (`.taste-skill/review/<slug>-1440.png` and
     `-390.png`; open them with the Read tool so the owner sees them), with the
     worker's report and any page-level FAILs it listed.
   - The owner answers **Approve**, **Steer** or **Revert**.
     - **Approve:** commit the section, its worker file, its feedback file and STATE.md
       as `feat(<slug>): <what the section does>`. Set the status to approved and
       write the commit hash in the Commit column. The section's folder is now locked
       against edits (`scripts/hooks/lock-approved.mjs`); to change it later, the
       owner agrees and you set its status back to in review.
     - **Steer:** append the owner's feedback to `workflow/feedback/<slug>.md` as a new
       numbered, dated entry (`## 2. 2026-11-02`, then the feedback in the owner's
       words). Increase Rounds, and resume the same worker with the feedback. Review
       again when it reports.
     - **Revert:** run `node scripts/revert-section.mjs` (it discards every
       uncommitted change outside `workflow/` and `.claude/agents/`; check its
       `--dry-run` list first). Record why in the feedback file, set the status to
       pending, and start again with a fresh worker that reads the feedback file.
   - **Effort.** After two steer rounds without approval (Rounds reaches 2), raise the
     worker's `effort` in `.claude/agents/<slug>.md` to `xhigh`, start a fresh worker
     that reads the feedback file (turn 1 again: brief, then build), note it in STATE.md,
     and tell the owner you did this.

Tick **Sections** when every section in the list is approved.

## 7. Whole page

Run the `qa` agent. Turn 1: it checks the finished page and lists every problem, with
`node scripts/taste-gate.mjs --scope page`, where every FAIL must be fixed. Show the
owner the list. Then fixes go one at a time: for each fix the owner approves, unlock
the section it touches (status back to in review, with the owner's agreement), resume
qa with that one fix, review it with the owner, commit it as
`fix(<slug>): <what changed>`, and set the section back to approved. Tick
**Whole-page check (qa)** when the page passes and the owner is satisfied.

## 8. Finish

Print the merge-back commands from `workflow/VERSIONING.md`, with N filled in, for the
owner to run from the main folder:

```bash
git fetch ../abdur-portfolio-vN version/portfolio_vN:version/portfolio_vN
git switch main
git merge --ff-only version/portfolio_vN
git push origin main version/portfolio_vN
```

Never merge, push to `main` or push anything yourself. Tick **Finish**.

## Limits to know

- The section lock guards the Edit and Write tools only. A shell command such as
  `sed -i` could still change a locked file, so never edit an approved section's
  folder from Bash.
- The version folder's own settings block reads outside the folder and git commands
  that could show earlier versions (`git show`, `git checkout`, `git restore`,
  `git reset`, `git stash` and others). Use `scripts/revert-section.mjs` to discard
  work, never those commands.
