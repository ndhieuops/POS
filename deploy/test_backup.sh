#!/usr/bin/env bash
# Runs backup.sh against a temp DB; checks new backup is made and 31-day-old one is pruned.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export POS_PYTHON=/usr/bin/python3
export POS_DB_PATH="$T/pos.db" POS_BACKUP_DIR="$T/backups"
mkdir -p "$POS_BACKUP_DIR"
python3 -c 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("create table t(x)"); c.execute("insert into t values (42)"); c.commit()' "$POS_DB_PATH"
OLD="$POS_BACKUP_DIR/pos-2000-01-01.db"; KEEP="$POS_BACKUP_DIR/pos-recent.db"
touch -d '31 days ago' "$OLD"; touch -d '5 days ago' "$KEEP"

bash "$HERE/backup.sh"

TODAY="$POS_BACKUP_DIR/pos-$(TZ=Asia/Ho_Chi_Minh date +%F).db"
[ -s "$TODAY" ] || { echo "FAIL: $TODAY missing"; exit 1; }
[ ! -e "$OLD" ] || { echo "FAIL: old backup not deleted"; exit 1; }
[ -e "$KEEP" ] || { echo "FAIL: recent backup deleted"; exit 1; }
v="$(python3 -c 'import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("select x from t").fetchone()[0])' "$TODAY")"
[ "$v" = 42 ] || { echo "FAIL: backup content wrong"; exit 1; }

# Missing DB: non-zero exit, nothing pruned, no empty backup written.
touch -d '31 days ago' "$OLD"
rm -f "$TODAY"
if POS_DB_PATH="$T/nope.db" bash "$HERE/backup.sh" 2>/dev/null; then echo "FAIL: missing DB exited 0"; exit 1; fi
[ -e "$OLD" ] || { echo "FAIL: pruned on failure"; exit 1; }
[ ! -e "$TODAY" ] || { echo "FAIL: empty backup written"; exit 1; }
echo "PASS test_backup"
