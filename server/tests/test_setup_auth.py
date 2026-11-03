from datetime import datetime, timedelta

from pos import messages, timeutil
from tests.helpers import SETUP

LOGIN = {"pin": "2468", "device_id": "d1"}
BAD = {"pin": "0000", "device_id": "d1"}
T0 = datetime(2026, 11, 3, 10, 0, tzinfo=timeutil.TZ)


def test_setup_then_status(client):
    assert client.get("/api/setup/status").json() == {"configured": False}
    assert client.post("/api/setup", json=SETUP).status_code == 201
    assert client.get("/api/setup/status").json() == {"configured": True}
    r = client.post("/api/setup", json=SETUP)
    assert r.status_code == 409 and r.json()["detail"] == messages.SETUP_DONE


def test_pin_format(client):
    for pin in ("12a4", "123", "1234567", ""):
        r = client.post("/api/setup", json={**SETUP, "owner_pin": pin})
        assert r.status_code == 422 and r.json()["detail"] == messages.PIN_FORMAT
    assert client.get("/api/setup/status").json() == {"configured": False}


def test_login_and_owner_route(configured_client):
    c = configured_client
    r = c.get("/api/owner/settings")
    assert r.status_code == 401 and r.json()["detail"] == messages.OWNER_REQUIRED
    r = c.post("/api/owner/login", json=LOGIN)
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    assert c.get("/api/owner/settings").json()["shop_name"] == SETUP["shop_name"]


def test_logout(owner_client):
    assert owner_client.post("/api/owner/logout").status_code == 200
    assert owner_client.get("/api/owner/settings").status_code == 401


def test_update_settings(owner_client):
    r = owner_client.put("/api/owner/settings", json={"shop_name": "Quán mới", "bank_bin": "970415"})
    assert r.status_code == 200
    s = owner_client.get("/api/owner/settings").json()
    assert s["shop_name"] == "Quán mới" and s["bank_bin"] == "970415"
    assert s["bank_account_no"] == SETUP["bank_account_no"]
    assert "owner_pin_hash" not in s and "session_secret" not in s


def test_pin_lockout(configured_client):
    c = configured_client
    for _ in range(5):
        assert c.post("/api/owner/login", json=BAD).status_code == 401
    r = c.post("/api/owner/login", json=LOGIN)
    assert r.status_code == 429 and r.json()["detail"] == messages.PIN_LOCKED


def test_lockout_is_per_device_and_expires(configured_client, set_now):
    c = configured_client
    set_now(T0)
    for _ in range(5):
        c.post("/api/owner/login", json=BAD)
    assert c.post("/api/owner/login", json={**LOGIN, "device_id": "d2"}).status_code == 200
    c.post("/api/owner/logout")
    set_now(T0 + timedelta(minutes=4))
    assert c.post("/api/owner/login", json=LOGIN).status_code == 429
    set_now(T0 + timedelta(minutes=5, seconds=1))
    assert c.post("/api/owner/login", json=LOGIN).status_code == 200


def test_session_idle_expiry(configured_client, set_now):
    c = configured_client
    set_now(T0)
    assert c.post("/api/owner/login", json=LOGIN).status_code == 200
    set_now(T0 + timedelta(minutes=6))
    assert c.get("/api/owner/settings").status_code == 401


def test_session_renewed_on_activity(configured_client, set_now):
    c = configured_client
    set_now(T0)
    c.post("/api/owner/login", json=LOGIN)
    set_now(T0 + timedelta(minutes=4))
    assert c.get("/api/owner/settings").status_code == 200
    set_now(T0 + timedelta(minutes=8))
    assert c.get("/api/owner/settings").status_code == 200


def test_tampered_cookie_rejected(configured_client):
    c = configured_client
    c.cookies.set("owner_session", "1.d1.deadbeef")
    assert c.get("/api/owner/settings").status_code == 401


def test_errors_are_vietnamese(configured_client):
    r = configured_client.post("/api/owner/login", json=BAD)
    assert r.json()["detail"] == "Mã PIN không đúng"


def test_login_before_setup(client):
    assert client.post("/api/owner/login", json=LOGIN).status_code == 401
