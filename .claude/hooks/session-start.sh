#!/bin/bash
# SessionStart hook: make a fresh Claude Code on the web container test-ready.
# Installs npm deps and applies D1 migrations locally so `npm test`,
# `npm run typecheck`, and `wrangler dev` work immediately.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install

# Local D1 schema (idempotent; required before first `wrangler dev`).
# Never touches the remote database.
npx wrangler d1 migrations apply veristat --local || true
