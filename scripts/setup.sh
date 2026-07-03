#!/bin/sh
set -e
# One-command setup for a Reality checkout. Safe to run (and re-run) anytime.
# Installs dependencies and the pre-push guard, then prints the workflow.

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "→ Installing dependencies (npm ci)…"
npm ci

echo "→ Installing the git pre-push guard…"
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

cat <<'EOF'

✓ Ready to work on Reality.

  main is protected & merge-only — you work on a branch and open a PR.
  The pre-push hook blocks pushes to main and runs the gate, so you can't
  push red or to the wrong place.

  Workflow:
    git fetch origin
    git switch -c fix/my-thing origin/main     # feat/ fix/ docs/ chore/ rfc/
    #  …work…
    npm run verify                             # vitest + build — the exact CI gate
    git push -u origin fix/my-thing
    gh pr create --fill                        # CI 'verify' green + up-to-date → squash-merge

  Full contract: AGENTS.md   ·   Contributor guide: CONTRIBUTING.md
EOF
