import pytest
from fastapi.testclient import TestClient

from pos.config import Settings
from pos.main import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(db_path=str(tmp_path / "test.db")))
    with TestClient(app) as c:
        yield c
