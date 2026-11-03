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
