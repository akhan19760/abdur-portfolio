# Versions

Each version of the portfolio is a ground-up rebuild in its own folder and branch.
Version 1 is the site as it was on `main` before this workflow, kept on
`version/portfolio_v1`.

## Start a version

From the main folder, on `main`, with a clean working tree:

```bash
bash scripts/next-version.sh
node scripts/leak-scan.mjs ../abdur-portfolio-vN
```

`next-version.sh` makes `../abdur-portfolio-vN`, a one-commit clone of `main` on
`version/portfolio_vN`, and runs `purge-version.sh` there. The purge keeps only
configuration and the workflow kit, and commits:

- a neutral `CLAUDE.md` that points at this folder's rules
- blank `DIRECTION.md` and `STATE.md`, and empty `refs/` and `feedback/`
- a blank app shell that builds and passes one test
- `.claude/settings.local.json` (not committed), which blocks reads outside the
  folder and git commands that could show old code

`leak-scan.mjs` compares the new folder with every earlier version branch and fails
on any colour, font name, copy string or distinctive file name carried over.

Then work in the new folder:

```bash
cd ../abdur-portfolio-vN
pnpm install
claude
```

## Finish a version

From the main folder:

```bash
git fetch ../abdur-portfolio-vN version/portfolio_vN:version/portfolio_vN
git switch main
git merge --ff-only version/portfolio_vN
git push origin main version/portfolio_vN
```

The version folder can be deleted afterwards.

## Kept and removed

Kept: `.claude/settings.json`, the kit agents (`reference-scout`, `design-system`,
`qa`), the kit skills (`design-taste-frontend`, `board`, `new-version`), `.github/`,
`scripts/`, `workflow/` rules, facts and templates, and the build, lint, format and
TypeScript configuration with `package.json` and the lock file.

Removed: everything else, including `src/`, `index.html`, `README.md`, the earlier
`CLAUDE.md`, section workers, any other skills, earlier references and feedback.
