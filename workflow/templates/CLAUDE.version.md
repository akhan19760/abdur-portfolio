# Portfolio version

This folder is one version of Abdur Rahim's portfolio, built from a clean slate.

@workflow/RULES.md
@workflow/PLAYBOOK.md

- Facts about the owner: `workflow/content.md`. Use nothing else as content.
- This version's direction, once chosen: `workflow/DIRECTION.md`.
- Progress: `workflow/STATE.md`.
- Design authority: the `design-taste-frontend` skill, as RULES.md section 4 says.

## Working agreement

The owner confirms each step before it happens: post a brief for each section, wait
for approval, build that section with its tests, present it, and wait for sign-off.
Work on one section at a time. Steering changes only the section being reviewed.

## Stack

Use what `package.json` provides: Vite, React, TypeScript, Tailwind CSS, Vitest with
Testing Library and vitest-axe, and pnpm. Adding or removing a dependency is a
decision for the owner.
