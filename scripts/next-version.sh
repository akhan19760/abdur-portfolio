#!/usr/bin/env bash
# Start the next portfolio version as a clean slate in its own folder.
#
# Run from the main folder, on main, with a clean working tree:
#   bash scripts/next-version.sh
#
# It makes a one-commit clone of main next to this folder
# (../<folder>-vN), creates version/portfolio_vN there, and runs
# purge-version.sh in it, which removes everything from earlier versions.
set -euo pipefail

die() { echo "next-version: $*" >&2; exit 1; }

cd "$(git rev-parse --show-toplevel)"
main_dir=$PWD

branch=$(git branch --show-current)
[ "$branch" = "main" ] || die "run this on main (now on $branch)."
[ -z "$(git status --porcelain)" ] || die "the working tree has changes. Commit or stash them first."

git fetch --quiet origin 2>/dev/null || echo "next-version: could not fetch origin; using local branches." >&2

last=$(git for-each-ref --format='%(refname:short)' \
    'refs/heads/version/portfolio_v*' 'refs/remotes/*/version/portfolio_v*' \
  | sed -n 's/.*portfolio_v\([0-9][0-9]*\)$/\1/p' | sort -n | tail -1)
[ -n "$last" ] || die "no version/portfolio_v* branch found. Create version/portfolio_v1 first."
next=$((last + 1))
new_branch="version/portfolio_v${next}"
dest="$(dirname "$main_dir")/$(basename "$main_dir")-v${next}"
[ ! -e "$dest" ] || die "$dest already exists."

origin_url=$(git remote get-url origin 2>/dev/null || true)

# --no-local makes git copy over its normal transport, so --depth applies and
# the new folder holds only main's latest commit.
git clone --quiet --no-local --depth 1 --single-branch --branch main "$main_dir" "$dest"

cd "$dest"
git switch --quiet -c "$new_branch"
# Leave no ref that points at the old code, except the base commit itself.
git update-ref -d refs/remotes/origin/main 2>/dev/null || true
git update-ref -d refs/heads/main 2>/dev/null || true
git remote remove origin
if [ -n "$origin_url" ]; then
  git remote add origin "$origin_url"
  git config remote.origin.fetch "+refs/heads/${new_branch}:refs/remotes/origin/${new_branch}"
fi

bash scripts/purge-version.sh

cat <<MSG

Created $dest on $new_branch, purged to a clean slate.

Next:
  1. In this main folder, check nothing leaked:
       node scripts/leak-scan.mjs "$dest"
  2. Then:
       cd "$dest"
       pnpm install
       claude
     and start the version with /new-version.

When the version is finished, merge it back from this main folder:
  git fetch "$dest" ${new_branch}:${new_branch}
  git switch main && git merge --ff-only ${new_branch}
MSG
