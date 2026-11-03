from sqlalchemy import select

from pos import auth, messages
from pos.db import make_engine, make_sessionmaker
from pos.models import PinAttempt
from pos.reset_pin import main
from tests.helpers import SETUP


def _inputs(*vals):
    it = iter(vals)
    return lambda prompt="": next(it)


def _db(c):
    return make_sessionmaker(make_engine(c.app.state.settings.db_path))()


def test_reset_pin_sets_new_pin_and_clears_attempts(configured_client, monkeypatch):
    c = configured_client
    for i in range(10):
        c.post("/api/owner/login", json={"pin": "0000", "device_id": f"d{i}"})
    assert c.post("/api/owner/login", json={"pin": SETUP["owner_pin"], "device_id": "x"}).status_code == 429
    monkeypatch.setenv("POS_DB_PATH", c.app.state.settings.db_path)
    out = []
    assert main(getpass=_inputs("135790", "135790"), out=out.append) == 0
    assert any("Đã đặt lại" in line for line in out)
    with _db(c) as s:
        assert s.scalars(select(PinAttempt)).all() == []
        assert auth.verify_pin("135790", auth.get_setting(s, "owner_pin_hash"))
    assert c.post("/api/owner/login", json={"pin": "135790", "device_id": "x"}).status_code == 200
    assert c.post("/api/owner/login", json={"pin": SETUP["owner_pin"], "device_id": "y"}).status_code == 401


def test_reset_pin_rejects_mismatch_and_bad_format(configured_client, monkeypatch):
    c = configured_client
    monkeypatch.setenv("POS_DB_PATH", c.app.state.settings.db_path)
    out = []
    assert main(getpass=_inputs("1357", "2468"), out=out.append) == 1
    assert any("không khớp" in line for line in out)
    out.clear()
    assert main(getpass=_inputs("12ab", "12ab"), out=out.append) == 1
    assert messages.PIN_FORMAT in out
    with _db(c) as s:
        assert auth.verify_pin(SETUP["owner_pin"], auth.get_setting(s, "owner_pin_hash"))


def test_reset_pin_missing_db(tmp_path, monkeypatch):
    missing = tmp_path / "none.db"
    monkeypatch.setenv("POS_DB_PATH", str(missing))
    out = []
    assert main(getpass=_inputs("1357", "1357"), out=out.append) == 1
    assert not missing.exists()
