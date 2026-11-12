#!/bin/bash
# Prepares a Claude Code cloud session so `pnpm check`, `pnpm lint` and `pnpm test:unit` work.
# Its output lands in the session's context, so it stays quiet unless the install fails.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

corepack enable >/dev/null 2>&1 || true
if ! log=$(pnpm install --frozen-lockfile 2>&1); then
  echo "$log" >&2
  exit 1
fi
# Static env variables (src/env.ts) need every variable defined; the placeholders in .env.example are enough for check and build.
[ -f .env ] || cp .env.example .env
echo "Dependencies installed."
