from pos import messages


def test_register_requires_owner(configured_client):
    r = configured_client.post("/api/owner/devices", json={"name": "Quầy", "floor": "floor1"})
    assert r.status_code == 401


def test_register_and_get(owner_client):
    r = owner_client.post("/api/owner/devices", json={"name": "Quầy", "floor": "floor1"})
    assert r.status_code == 201
    dev = r.json()
    assert dev["name"] == "Quầy" and dev["floor"] == "floor1" and dev["id"]
    g = owner_client.get(f"/api/devices/{dev['id']}")
    assert g.status_code == 200
    assert g.json() == dev


def test_get_is_public(owner_client):
    dev = owner_client.post("/api/owner/devices", json={"name": "A", "floor": "floor4"}).json()
    owner_client.post("/api/owner/logout")
    assert owner_client.get(f"/api/devices/{dev['id']}").json()["floor"] == "floor4"


def test_unknown_device_404(client):
    r = client.get("/api/devices/nope")
    assert r.status_code == 404
    assert r.json()["detail"] == "Màn hình chưa được cài đặt" == messages.DEVICE_UNKNOWN


def test_invalid_floor_422(owner_client):
    r = owner_client.post("/api/owner/devices", json={"name": "A", "floor": "floor9"})
    assert r.status_code == 422


def test_change_floor_requires_owner(owner_client):
    dev = owner_client.post("/api/owner/devices", json={"name": "A", "floor": "floor1"}).json()
    ok = owner_client.put(f"/api/owner/devices/{dev['id']}", json={"floor": "floor4"})
    assert ok.status_code == 200 and ok.json()["floor"] == "floor4"
    assert owner_client.get(f"/api/devices/{dev['id']}").json()["floor"] == "floor4"
    owner_client.post("/api/owner/logout")
    r = owner_client.put(f"/api/owner/devices/{dev['id']}", json={"floor": "floor1"})
    assert r.status_code == 401


def test_change_floor_unknown_404(owner_client):
    r = owner_client.put("/api/owner/devices/nope", json={"floor": "floor1"})
    assert r.status_code == 404
