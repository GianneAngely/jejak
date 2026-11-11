#!/usr/bin/env bash
# Deploy production. Domain sangu-app.vercel.app terpasang di project, otomatis ikut.
set -euo pipefail
cd "$(dirname "$0")/.."
vercel deploy --prod --yes 2>&1 | grep -iE "production|error" | head -3
