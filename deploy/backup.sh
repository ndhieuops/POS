#!/usr/bin/env bash
# Nightly SQLite backup (online backup API; safe while the server runs). Keeps 30 days.
set -euo pipefail
: "${POS_DB_PATH:?POS_DB_PATH not set}"
: "${POS_BACKUP_DIR:?POS_BACKUP_DIR not set}"
[ -f "$POS_DB_PATH" ] || { echo "Không thấy cơ sở dữ liệu: $POS_DB_PATH" >&2; exit 1; }
mkdir -p "$POS_BACKUP_DIR"
OUT="$POS_BACKUP_DIR/pos-$(date +%F).db"
"${POS_PYTHON:-/opt/pos/server/.venv/bin/python}" -c 'import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d)' "$POS_DB_PATH" "$OUT"
find "$POS_BACKUP_DIR" -maxdepth 1 -name 'pos-*.db' -type f -mtime +30 -delete
