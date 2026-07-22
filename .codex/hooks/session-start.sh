#!/bin/bash
# SessionStart hook: make a fresh remote-agent checkout test-ready.
# This is deliberately opt-in so an ordinary local session never installs
# dependencies or mutates local Wrangler state merely by starting an agent.
set -euo pipefail

is_true() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES | on | ON) return 0 ;;
    *) return 1 ;;
  esac
}

if ! is_true "${VERISTAT_REMOTE_AGENT:-}" \
  && ! is_true "${CODEX_REMOTE:-}" \
  && ! is_true "${CODEX_CLOUD:-}" \
  && ! is_true "${CLAUDE_CODE_REMOTE:-}"; then
  exit 0
fi

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
project_dir="${CODEX_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"

if [ -z "$project_dir" ]; then
  project_dir="$(CDPATH= cd -- "$script_dir/../.." && pwd -P)"
fi

if [ ! -f "$project_dir/package.json" ] || [ ! -f "$project_dir/wrangler.jsonc" ]; then
  printf 'veristat remote-agent hook: invalid project directory: %s\n' "$project_dir" >&2
  exit 1
fi

cd "$project_dir"

npm ci

# Local D1 schema (idempotent; required before first `wrangler dev`).
# Never touches the remote database.
npx wrangler d1 migrations apply veristat --local || true
