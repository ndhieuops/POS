import pytest
from fastapi.testclient import TestClient

from pos.config import Settings
from pos.main import create_app


@pytest.fixture
def spa_client(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>POS</title><div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(Settings(db_path=str(tmp_path / "t.db"), web_dist=str(dist)))
    with TestClient(app) as c:
        yield c


def test_spa_fallback_serves_index(spa_client):
    r = spa_client.get("/grocery")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "<div id=root>" in r.text


def test_root_serves_index(spa_client):
    assert spa_client.get("/").status_code == 200


def test_static_asset_served(spa_client):
    r = spa_client.get("/assets/app.js")
    assert r.status_code == 200 and "console.log" in r.text


def test_unknown_api_is_json_404(spa_client):
    r = spa_client.get("/api/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_api_still_works(spa_client):
    assert spa_client.get("/api/health").json() == {"ok": True}


def test_path_traversal_not_served(spa_client, tmp_path):
    (tmp_path / "secret.txt").write_text("secret")
    r = spa_client.get("/..%2fsecret.txt")
    assert "secret" not in r.text


def test_missing_dist_is_ok(tmp_path):
    app = create_app(Settings(db_path=str(tmp_path / "t.db"), web_dist=str(tmp_path / "nope")))
    with TestClient(app) as c:
        assert c.get("/api/health").status_code == 200
        assert c.get("/grocery").status_code == 404


def test_unknown_api_detail_is_vietnamese(spa_client):
    from pos import messages
    r = spa_client.get("/api/x")
    assert r.status_code == 404 and r.json()["detail"] == messages.NOT_FOUND
    r = spa_client.post("/api/x")
    assert r.status_code in (404, 405)
    assert r.json()["detail"] in (messages.NOT_FOUND, messages.METHOD_NOT_ALLOWED)
