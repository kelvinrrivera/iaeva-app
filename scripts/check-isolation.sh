#!/usr/bin/env bash
# IAEVA — Pre-action isolation check
# Exits 1 if any sign of Domicita contamination is found.

set -euo pipefail

FAIL=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔍 IAEVA isolation check..."

# 1. Git remote check
cd "$REPO_ROOT"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "⚠️  No git repo here (skipping remote check)"
else
  REMOTES=$(git remote -v 2>/dev/null || true)
  if echo "$REMOTES" | grep -iE "domicita|barbershop" > /dev/null; then
    echo "❌ Git remote contains 'domicita' or 'barbershop' — STOP"
    FAIL=1
  else
    echo "✅ Git remotes OK"
  fi
fi

# 2. .env.local check (only if present)
if [ -f "$REPO_ROOT/.env.local" ]; then
  if grep -iE "domicita\.com|domicita\.do|barbershop" "$REPO_ROOT/.env.local" > /dev/null; then
    echo "❌ .env.local contains references to Domicita — STOP"
    FAIL=1
  else
    echo "✅ .env.local clean of Domicita refs"
  fi
else
  echo "ℹ️  No .env.local present (skipping)"
fi

# 3. Check that NEXT_PUBLIC_APP_URL (if set) does NOT point to domicita domain
if [ -f "$REPO_ROOT/.env.local" ]; then
  APP_URL=$(grep -E "^NEXT_PUBLIC_APP_URL=" "$REPO_ROOT/.env.local" | cut -d= -f2- || true)
  if [ -n "$APP_URL" ] && echo "$APP_URL" | grep -iE "domicita" > /dev/null; then
    echo "❌ NEXT_PUBLIC_APP_URL points to domicita — STOP"
    FAIL=1
  fi
fi

# 4. Stripe CLI default profile check (warning only — only blocks if iaeva profile missing)
if command -v stripe > /dev/null 2>&1; then
  DEFAULT_NAME=$(stripe config --list 2>/dev/null | grep -E "^display_name" | head -1 | cut -d"'" -f2 || true)
  if echo "$DEFAULT_NAME" | grep -iE "domicita" > /dev/null; then
    echo "⚠️  Stripe CLI default profile = '$DEFAULT_NAME' (Domicita). When using stripe commands, ALWAYS pass --project-name iaeva."
  fi

  IAEVA_NAME=$(stripe config --list --project-name iaeva 2>/dev/null | grep -E "^display_name" | head -1 | cut -d"'" -f2 || true)
  if [ -z "$IAEVA_NAME" ]; then
    echo "ℹ️  Stripe CLI 'iaeva' profile not configured yet. Run: stripe login --project-name iaeva"
  else
    echo "✅ Stripe CLI 'iaeva' profile present: '$IAEVA_NAME'"
  fi
fi

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "🛑 Isolation check FAILED. Do not push/deploy/migrate."
  exit 1
fi

echo ""
echo "✅ Isolation check passed."
