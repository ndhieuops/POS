#!/usr/bin/env bash
# Install POS on Ubuntu 24.04. Run: sudo bash deploy/install.sh (from the repo). Safe to re-run.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Hãy chạy bằng sudo: sudo bash deploy/install.sh"; exit 1; }

SRC="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
. "$SRC/deploy/lib.sh"
APP=/opt/pos
DATA=/var/lib/pos
BACKUPS=/var/backups/pos

# Web build: use a ready web/dist, else build only with a new enough Node (apt Node 18 is too old for Vite 8).
if [ ! -f "$SRC/web/dist/index.html" ]; then
  if have_usable_node && command -v npm >/dev/null 2>&1; then
    (cd "$SRC/web" && npm ci --legacy-peer-deps && npm run build)
  else
    echo "Lỗi: chưa có thư mục web/dist và máy này không có Node 20.19 trở lên để tạo ra nó." >&2
    echo "Trên máy tính của bạn (đã cài Node 22), chạy: cd web && npm ci --legacy-peer-deps && npm run build" >&2
    echo "Sau đó chép lại cả thư mục POS (có web/dist) sang máy chủ và chạy lại: sudo bash deploy/install.sh" >&2
    exit 1
  fi
fi

apt-get update
apt-get install -y python3-venv rsync

id -u pos >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin pos

# rsync --delete removes stale files on update. Its target is only ever /opt/pos; data and
# backups live outside it, and are also excluded so they can never be deleted.
[ "$APP" = /opt/pos ] || { echo "Lỗi: thư mục cài đặt phải là /opt/pos" >&2; exit 1; }
case "$DATA/" in "$APP"/*) echo "Lỗi: dữ liệu nằm trong $APP" >&2; exit 1 ;; esac
case "$BACKUPS/" in "$APP"/*) echo "Lỗi: sao lưu nằm trong $APP" >&2; exit 1 ;; esac
case "$SRC/" in "$DATA"/*|"$BACKUPS"/*|/) echo "Lỗi: thư mục nguồn không hợp lệ: $SRC" >&2; exit 1 ;; esac

mkdir -p "$APP" "$DATA" "$BACKUPS"
if [ "$SRC" != "$APP" ]; then
  rsync -a --delete \
      --exclude=.git --exclude=.superpowers --exclude=node_modules --exclude=.venv \
      --exclude=__pycache__ --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
      --exclude=/var/lib/pos --exclude=/var/backups/pos \
      "$SRC/" "$APP/"
fi

[ -x "$APP/server/.venv/bin/python" ] || python3 -m venv "$APP/server/.venv"
"$APP/server/.venv/bin/python" -m pip install --upgrade pip
# Pinned to the versions the tests ran with.
"$APP/server/.venv/bin/python" -m pip install -c "$APP/server/requirements.lock" -e "$APP/server"

chown -R pos:pos "$DATA" "$BACKUPS"
chmod 750 "$DATA" "$BACKUPS"
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
