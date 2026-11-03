#!/usr/bin/env bash
# Install POS on Ubuntu 24.04. Run: sudo bash deploy/install.sh (from the repo). Safe to re-run.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Hãy chạy bằng sudo: sudo bash deploy/install.sh"; exit 1; }

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/pos
DATA=/var/lib/pos
BACKUPS=/var/backups/pos

apt-get update
apt-get install -y python3-venv nodejs npm

id -u pos >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin pos

mkdir -p "$APP" "$DATA" "$BACKUPS"
if [ "$SRC" != "$APP" ]; then
  tar -C "$SRC" --exclude=.git --exclude=node_modules --exclude=.venv --exclude=__pycache__ \
      --exclude='*.db' --exclude=web/dist -cf - . | tar -C "$APP" -xf -
fi

[ -x "$APP/server/.venv/bin/python" ] || python3 -m venv "$APP/server/.venv"
"$APP/server/.venv/bin/python" -m pip install --upgrade pip
"$APP/server/.venv/bin/python" -m pip install -e "$APP/server"

(cd "$APP/web" && npm install --legacy-peer-deps && npm run build)

chown -R pos:pos "$DATA" "$BACKUPS"
chown -R root:root "$APP"

# Create / upgrade the database schema.
# (same alembic upgrade head the server runs at start-up)
(cd "$APP/server" && sudo -u pos .venv/bin/python -c 'import sys; from pos.db import run_migrations; run_migrations(sys.argv[1])' "$DATA/pos.db")

install -m 644 "$APP/deploy/pos.service" /etc/systemd/system/pos.service
install -m 644 "$APP/deploy/pos-backup.service" /etc/systemd/system/pos-backup.service
install -m 644 "$APP/deploy/pos-backup.timer" /etc/systemd/system/pos-backup.timer
systemctl daemon-reload
systemctl enable --now pos.service pos-backup.timer
systemctl restart pos.service

echo "Xong. Mở http://<ip-máy-chủ>:8080 trên màn hình."
