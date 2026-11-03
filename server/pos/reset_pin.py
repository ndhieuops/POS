"""Reset the owner PIN from the server console.

    sudo -u pos env POS_DB_PATH=/var/lib/pos/pos.db /opt/pos/server/.venv/bin/python -m pos.reset_pin
"""

import getpass as _getpass
import re
import secrets
import sys
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import delete

from pos import auth, messages
from pos.config import Settings
from pos.db import make_engine, make_sessionmaker
from pos.models import PinAttempt

PROMPT = "Nhập mã PIN chủ quán mới (4–6 chữ số): "
PROMPT_AGAIN = "Nhập lại mã PIN mới: "
NO_DB = "Không tìm thấy cơ sở dữ liệu: {path}. Kiểm tra biến POS_DB_PATH."
NOT_SETUP = "Cửa hàng chưa được thiết lập. Hãy mở phần mềm và làm thiết lập lần đầu."
MISMATCH = "Hai lần nhập mã PIN không khớp. Chưa thay đổi gì."
DONE = "Đã đặt lại mã PIN chủ quán. Các lần nhập sai trước đó đã được xóa."


def main(getpass: Callable[[str], str] = _getpass.getpass, out: Callable[[str], None] = print) -> int:
    path = Settings().db_path  # reads POS_DB_PATH
    if not Path(path).is_file():
        out(NO_DB.format(path=path))
        return 1
    pin = getpass(PROMPT).strip()
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        out(messages.PIN_FORMAT)
        return 1
    if getpass(PROMPT_AGAIN).strip() != pin:
        out(MISMATCH)
        return 1
    engine = make_engine(path)
    try:
        with make_sessionmaker(engine)() as db:
            if auth.get_setting(db, "owner_pin_hash") is None:
                out(NOT_SETUP)
                return 1
            auth.set_setting(db, "owner_pin_hash", auth.hash_pin(pin))
            db.execute(delete(PinAttempt))
            # New secret: owner sessions signed before the reset stop working.
            auth.set_setting(db, "session_secret", secrets.token_hex(32))
            db.commit()
    finally:
        engine.dispose()
    out(DONE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
