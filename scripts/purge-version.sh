#!/usr/bin/env bash
# Purge a fresh version folder down to the workflow kit and a blank app.
#
# next-version.sh runs this for you. It refuses to run anywhere except a
# version folder (a folder named <name>-vN on branch version/portfolio_vN).
# Everything not on a keep list below is removed, then a minimal app shell,
# a neutral CLAUDE.md and the version's isolation settings are written, and
# the result is committed as one purge commit.
set -euo pipefail

die() { echo "purge-version: $*" >&2; exit 1; }

cd "$(git rev-parse --show-toplevel)"
branch=$(git branch --show-current)
n=$(printf '%s' "$branch" | sed -n 's/^version\/portfolio_v\([0-9][0-9]*\)$/\1/p')
[ -n "$n" ] || die "run this on a version/portfolio_vN branch (now on $branch)."
case "$(basename "$PWD")" in
  *-v"$n") ;;
  *) die "run this in the version folder made by next-version.sh, not in $(basename "$PWD")." ;;
esac
[ -z "$(git status --porcelain)" ] || die "the working tree has changes."

# Kept at the root: configuration and the workflow kit. Everything else goes.
KEEP_ROOT=(
  .claude .github scripts workflow
  .gitignore .prettierignore .prettierrc eslint.config.js
  package.json pnpm-lock.yaml pnpm-workspace.yaml skills-lock.json
  tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts
)
# Kept inside .claude: the kit's own agents and skills only.
KEEP_AGENTS=(reference-scout.md design-system.md qa.md)
KEEP_SKILLS=(design-taste-frontend board new-version)
# Kept inside workflow: the rules, the facts and the templates.
KEEP_WORKFLOW=(RULES.md PLAYBOOK.md VERSIONING.md content.md templates)

in_list() { local x=$1; shift; for k in "$@"; do [ "$k" = "$x" ] && return 0; done; return 1; }
remove() { git rm -r -q --ignore-unmatch -- "$1"; rm -rf -- "$1"; }

for p in $(git ls-tree --name-only HEAD); do
  in_list "$p" "${KEEP_ROOT[@]}" || remove "$p"
done
for p in $(git ls-tree --name-only HEAD:.claude/agents 2>/dev/null); do
  in_list "$p" "${KEEP_AGENTS[@]}" || remove ".claude/agents/$p"
done
for p in $(git ls-tree --name-only HEAD:.claude/skills 2>/dev/null); do
  in_list "$p" "${KEEP_SKILLS[@]}" || remove ".claude/skills/$p"
done
for p in $(git ls-tree --name-only HEAD:.claude 2>/dev/null); do
  in_list "$p" agents skills settings.json || remove ".claude/$p"
done
for p in $(git ls-tree --name-only HEAD:workflow 2>/dev/null); do
  in_list "$p" "${KEEP_WORKFLOW[@]}" || remove "workflow/$p"
done
rm -rf .taste-skill

# This version's blank state files.
cp workflow/templates/DIRECTION.template.md workflow/DIRECTION.md
cp workflow/templates/STATE.template.md workflow/STATE.md
mkdir -p workflow/refs workflow/feedback
touch workflow/refs/.gitkeep workflow/feedback/.gitkeep
cp workflow/templates/CLAUDE.version.md CLAUDE.md

# A blank app that builds, lints and passes one test.
mkdir -p src
cat > index.html <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Abdur Rahim</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML
cat > src/main.tsx <<'TSX'
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
TSX
cat > src/app.tsx <<'TSX'
export function App() {
  return (
    <main>
      <h1>Abdur Rahim</h1>
    </main>
  )
}
TSX
cat > src/app.test.tsx <<'TSX'
import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { App } from "./app"

describe("App", () => {
  it("renders the page title", () => {
    render(<App />)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(<App />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
TSX
cat > src/setup-tests.ts <<'TS'
import "@testing-library/jest-dom/vitest"
import { expect } from "vitest"
import * as matchers from "vitest-axe/matchers"

expect.extend(matchers)
TS
printf '/// <reference types="vite/client" />\n' > src/vite-env.d.ts
printf '@import "tailwindcss";\n' > src/index.css
cat > README.md <<'MD'
# Portfolio

The portfolio of Abdur Rahim. Built with the workflow in `workflow/`.
MD

# Isolation for agents working in this folder. Local settings stay out of git.
cat > .claude/settings.local.json <<'JSON'
{
  "permissions": {
    "blockReadsOutsideWorkingDirectories": true,
    "deny": [
      "Bash(git show *)",
      "Bash(git cat-file *)",
      "Bash(git checkout *)",
      "Bash(git restore *)",
      "Bash(git switch *)",
      "Bash(git reset *)",
      "Bash(git stash *)",
      "Bash(git worktree *)",
      "Bash(git archive *)",
      "Bash(git grep *)",
      "Bash(git fetch *)",
      "Bash(git pull *)",
      "Bash(git log -p *)",
      "Bash(git log --patch *)",
      "Bash(git diff HEAD~*)",
      "Bash(git diff HEAD^*)"
    ]
  }
}
JSON
for line in ".claude/settings.local.json" ".taste-skill/"; do
  grep -qxF "$line" .gitignore || printf '%s\n' "$line" >> .gitignore
done

git add -A
if git diff --cached --quiet; then
  echo "purge-version: already a clean slate, nothing to commit."
else
  git commit --quiet -m "chore: purge for portfolio_v${n}, a clean slate

Removes everything from earlier versions except configuration and the
workflow kit, and adds a blank app shell."
  echo "purge-version: committed the purge for portfolio_v${n}."
fi
