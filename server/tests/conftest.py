from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from pos import timeutil
from pos.config import Settings
from pos.main import create_app
from tests.helpers import SETUP  # noqa: F401  (re-exported for later tasks)


@pytest.fixture
def set_now(monkeypatch):
    """Patch pos.timeutil.now to return a fixed aware datetime; call again to move time."""

    def _set(dt: datetime):
        monkeypatch.setattr(timeutil, "now", lambda: dt)

    return _set


@pytest.fixture
def client(tmp_path):
    # Lifespan runs `alembic upgrade head` on the temp db.
    app = create_app(Settings(db_path=str(tmp_path / "test.db")))
    with TestClient(app) as c:
        yield c


@pytest.fixture
def configured_client(client):
    assert client.post("/api/setup", json=SETUP).status_code == 201
    return client


@pytest.fixture
def owner_client(configured_client):
    r = configured_client.post(
        "/api/owner/login", json={"pin": SETUP["owner_pin"], "device_id": "owner-dev"}
    )
    assert r.status_code == 200
    return configured_client


@pytest.fixture
def device(owner_client):
    """Owner-logged-in client plus a registered floor1 device id."""
    r = owner_client.post("/api/owner/devices", json={"name": "Quầy", "floor": "floor1"})
    assert r.status_code == 201
    owner_client.device_id = r.json()["id"]
    owner_client._db_path = owner_client.app.state.settings.db_path
    return owner_client


@pytest.fixture
def make_product(owner_client):
    def _make(stock_milli=0, sell_price=5000, cost=3600, barcode="8934", **kw):
        body = {"barcode": barcode, "name": "Sữa", "unit": "hộp", "sell_price": sell_price,
                "location": "grocery", "track_stock": True}
        body.update(kw)
        p = owner_client.post("/api/owner/products", json=body).json()
        if stock_milli:
            r = owner_client.post("/api/owner/receipts", json={
                "barcode": body["barcode"], "location": "grocery",
                "qty": stock_milli // 1000, "unit_cost": cost})
            assert r.status_code == 200
        return p

    return _make
