#!/usr/bin/env bash
# Static checks only: install.sh must never be executed by tests.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
for f in "$D"/*.sh; do bash -n "$f"; done
need() { grep -q -- "$1" "$D/install.sh" || { echo "FAIL: install.sh lacks: $1"; exit 1; }; }
# Fixed-string variant for text with regex metacharacters.
needF() { grep -qF -- "$1" "$D/install.sh" || { echo "FAIL: install.sh lacks: $1"; exit 1; }; }
need 'set -euo pipefail'
need 'install -y python3-venv'
! grep -qE 'apt-get install.*(nodejs|npm)' "$D/install.sh" || { echo 'FAIL: apt node'; exit 1; }
! grep -qi 'nodesource\|curl' "$D/install.sh" || { echo 'FAIL: curl/nodesource'; exit 1; }
need 'web/dist/index.html'
need 'have_usable_node'
need 'exit 1'
need 'useradd'
need 'id -u pos'
need 'python3 -m venv'
need 'run_migrations'
need 'npm run build'
. "$D/lib.sh"
for ok in v20.19.0 v20.20.1 22.12.0 v22.13.1 v24.0.0 v100.0.0; do node_version_ok "$ok" || { echo "FAIL: $ok should pass"; exit 1; }; done
for bad in v18.19.1 v20.18.9 v20.0.0 v21.7.0 v22.11.9 '' garbage v20 v20.19 'v20.19.0-rc'; do ! node_version_ok "$bad" || { echo "FAIL: '$bad' should fail"; exit 1; }; done
need 'pos.service'
need 'pos-backup.timer'
need 'systemctl enable --now'
grep -q -- '--factory' "$D/pos.service" || { echo "FAIL: --factory"; exit 1; }
grep -q 'Persistent=true' "$D/pos-backup.timer" || { echo "FAIL: Persistent"; exit 1; }
grep -q '02:30' "$D/pos-backup.timer" || { echo "FAIL: 02:30"; exit 1; }
# Pinned server dependencies
needF '-c "$APP/server/requirements.lock"'
L="$D/../server/requirements.lock"
[ -s "$L" ] || { echo "FAIL: server/requirements.lock missing"; exit 1; }
for pkg in fastapi uvicorn SQLAlchemy alembic pydantic pydantic-settings starlette; do
  grep -qiE "^${pkg}==[0-9]" "$L" || { echo "FAIL: lock lacks pinned $pkg"; exit 1; }
done
! grep -vE '^(#|$)' "$L" | grep -qvE '^[A-Za-z0-9_.-]+==[^ ]+$' || { echo "FAIL: lock has unpinned lines"; exit 1; }
# Copy: rsync --delete into /opt/pos only, with the same excludes; data/backups protected
need 'install -y python3-venv rsync'
need 'rsync -a --delete'
! grep -qE '^[^#]*tar -C' "$D/install.sh" || { echo 'FAIL: tar copy still present'; exit 1; }
for ex in .git .superpowers node_modules .venv __pycache__ "'*.db'" /var/lib/pos /var/backups/pos; do
  needF "--exclude=$ex"
done
needF '"$SRC/" "$APP/"'
need 'APP=/opt/pos'
needF '[ "$APP" = /opt/pos ]'
! grep -q -- '--delete-excluded' "$D/install.sh" || { echo 'FAIL: --delete-excluded would wipe .venv'; exit 1; }
[ "$(grep -c 'rsync -a' "$D/install.sh")" = 1 ] || { echo 'FAIL: exactly one rsync expected'; exit 1; }
echo "PASS test_install"
