from sqlalchemy import select

from pos import messages
from pos.models import StockReceipt


def _make(c, **kw):
    body = {"barcode": "8934", "name": "Sữa", "unit": "hộp", "sell_price": 5000,
            "location": "grocery", "track_stock": True}
    body.update(kw)
    r = c.post("/api/owner/products", json=body)
    assert r.status_code == 201
    return r.json()


def _recv(c, **kw):
    body = {"barcode": "8934", "location": "grocery", "qty": 12, "unit_cost": 3600}
    body.update(kw)
    return c.post("/api/owner/receipts", json=body)


def test_receive_known_adds_stock(owner_client):
    _make(owner_client)
    assert _recv(owner_client, qty=12).status_code == 200
    r = _recv(owner_client, qty=30)
    j = r.json()
    assert j["stock_qty_milli"] == 42000
    assert j["created"] is False
    assert j["product"]["last_cost"] == 3600


def test_receive_new_requires_name_price(owner_client):
    r = _recv(owner_client)
    assert r.status_code == 422
    assert r.json()["detail"] == messages.NEW_PRODUCT_FIELDS
    r = _recv(owner_client, name="X")
    assert r.json()["detail"] == messages.NEW_PRODUCT_FIELDS


def test_receive_new_creates_product(owner_client):
    r = _recv(owner_client, name="Bia", sell_price=15000, barcode=" 999 ")
    assert r.status_code == 200
    j = r.json()
    assert j["created"] is True
    assert j["product"]["track_stock"] is True
    assert j["product"]["unit"] == "cái"
    assert j["stock_qty_milli"] == 12000
    assert j["product"]["barcode"] == "999"


def test_receive_requires_owner(configured_client):
    r = _recv(configured_client)
    assert r.status_code == 401


def test_receipt_row_written(owner_client, tmp_path):
    p = _make(owner_client)
    _recv(owner_client)
    from pos.db import make_engine, make_sessionmaker
    eng = make_engine(str(tmp_path / "test.db"))
    with make_sessionmaker(eng)() as db:
        rows = db.scalars(select(StockReceipt)).all()
    assert len(rows) == 1
    assert rows[0].unit_cost == 3600 and rows[0].qty_milli == 12000
    assert rows[0].product_id == p["id"]


def test_qty_cost_invalid(owner_client):
    _make(owner_client)
    for kw in ({"qty": 0}, {"qty": -1}, {"unit_cost": -1}):
        r = _recv(owner_client, **kw)
        assert r.status_code == 422
        assert r.json()["detail"] == messages.QTY_INVALID
    assert _recv(owner_client, unit_cost=0).status_code == 200


def test_location_isolated(owner_client):
    _make(owner_client)
    r = _recv(owner_client, location="floor4", name="Sữa", sell_price=7000)
    assert r.json()["created"] is True
    assert r.json()["stock_qty_milli"] == 12000


def test_inactive_barcode_conflict(owner_client):
    p = _make(owner_client)
    owner_client.put(f"/api/owner/products/{p['id']}", json={"active": False})
    assert _recv(owner_client, name="Y", sell_price=1).status_code == 409


def test_owner_by_barcode(owner_client, configured_client):
    _make(owner_client)
    _recv(owner_client)
    r = owner_client.get("/api/owner/products/by-barcode/8934?location=grocery")
    assert r.status_code == 200 and r.json()["last_cost"] == 3600
    r = owner_client.get("/api/owner/products/by-barcode/nope?location=grocery")
    assert r.status_code == 404 and r.json()["detail"] == messages.PRODUCT_NOT_FOUND
    owner_client.cookies.clear()
    assert owner_client.get("/api/owner/products/by-barcode/8934?location=grocery").status_code == 401


def test_receipt_bounds(owner_client):
    _make(owner_client)
    r = _recv(owner_client, qty=1_000_001)
    assert r.status_code == 422 and r.json()["detail"] == messages.QTY_INVALID
    assert _recv(owner_client, qty=1_000_000).status_code == 200
    for kw in ({"unit_cost": 1_000_000_001}, {"unit_cost": 10**30}, {"sell_price": 1_000_000_001},
               {"sell_price": -1}, {"qty": 10**30}, {"unit": "x" * 31}):
        r = _recv(owner_client, **kw)
        assert r.status_code == 422, kw
        assert r.json()["detail"] in (messages.QTY_INVALID, messages.INVALID_INPUT), kw


def test_receipt_new_name_too_long(owner_client):
    r = _recv(owner_client, barcode="999001", name="x" * 201, sell_price=1000)
    assert r.status_code == 422 and r.json()["detail"] == messages.INVALID_INPUT
