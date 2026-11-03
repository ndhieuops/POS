#!/usr/bin/env bash
# Static checks only: install.sh must never be executed by tests.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
for f in "$D"/*.sh; do bash -n "$f"; done
need() { grep -q -- "$1" "$D/install.sh" || { echo "FAIL: install.sh lacks: $1"; exit 1; }; }
need 'set -euo pipefail'
need 'python3-venv nodejs npm'
need 'useradd'
need 'id -u pos'
need 'python3 -m venv'
need 'run_migrations'
need 'npm run build'
need 'pos.service'
need 'pos-backup.timer'
need 'systemctl enable --now'
grep -q -- '--factory' "$D/pos.service" || { echo "FAIL: --factory"; exit 1; }
grep -q 'Persistent=true' "$D/pos-backup.timer" || { echo "FAIL: Persistent"; exit 1; }
grep -q '02:30' "$D/pos-backup.timer" || { echo "FAIL: 02:30"; exit 1; }
echo "PASS test_install"
