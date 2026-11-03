from datetime import datetime

import pytest
from sqlalchemy import select

from pos import messages, timeutil
from pos.db import make_engine, make_sessionmaker
from pos.models import Product, SaleLine
from pos.vietqr import build_vietqr_payload


def _sale(c, lines, **kw):
    body = {"device_id": c.device_id, "service": "grocery", "lines": lines}
    body.update(kw)
    return c.post("/api/sales", json=body)


def _pline(pid, qty=1000, price=1, **kw):
    return {"product_id": pid, "name": "x", "unit": "x", "qty_milli": qty, "unit_price": price, **kw}


def _custom(price=50000, qty=1000, **kw):
    return {"name": "Khác", "unit": "cái", "qty_milli": qty, "unit_price": price, **kw}


def _stock(tmp_path, pid):
    eng = make_engine(str(tmp_path / "test.db"))
    with make_sessionmaker(eng)() as s:
        return s.get(Product, pid).stock_qty_milli


def test_totals_server_side(device, make_product):
    p = make_product(stock_milli=10000, sell_price=5000)
    r = _sale(device, [_pline(p["id"], qty=3000, price=1)])
    assert r.status_code == 201 or r.status_code == 200
    j = r.json()
    assert j["status"] == "open"
    assert j["total"] == 15000
    assert j["lines"][0]["unit_price"] == 5000
    assert j["lines"][0]["name"] == "Sữa" and j["lines"][0]["unit"] == "hộp"
    assert j["lines"][0]["line_total"] == 15000


def test_no_cost_exposed(device, make_product):
    p = make_product(stock_milli=10000)
    j = _sale(device, [_pline(p["id"])]).json()
    assert "unit_cost" not in j["lines"][0]
    assert "last_cost" not in str(j)


def test_custom_price_line(device):
    j = _sale(device, [_custom(note="giảm giá")]).json()
    assert j["total"] == 50000
    assert j["lines"][0]["note"] == "giảm giá"
    assert j["lines"][0]["product_id"] is None


def test_fractional_rounding(device, make_product):
    p = make_product(sell_price=20000, track_stock=False)
    j = _sale(device, [_pline(p["id"], qty=1250)]).json()
    assert j["total"] == 25000


def test_empty_cart(device):
    r = _sale(device, [])
    assert r.status_code == 422 and r.json()["detail"] == messages.CART_EMPTY


@pytest.mark.parametrize("q", [0, -1000])
def test_qty_invalid(device, q):
    r = _sale(device, [_custom(qty=q)])
    assert r.status_code == 422 and r.json()["detail"] == messages.QTY_INVALID


def test_negative_price_rejected(device):
    r = _sale(device, [_custom(price=-1)])
    assert r.status_code == 422


def test_unknown_device(device):
    r = device.post("/api/sales", json={"device_id": "nope", "service": "grocery",
                                         "lines": [_custom()]})
    assert r.status_code == 404 and r.json()["detail"] == messages.DEVICE_UNKNOWN


def test_unknown_or_inactive_product(device, make_product):
    r = _sale(device, [_pline(9999)])
    assert r.status_code == 404 and r.json()["detail"] == messages.PRODUCT_NOT_FOUND
    p = make_product()
    device.put(f"/api/owner/products/{p['id']}", json={"active": False})
    r = _sale(device, [_pline(p["id"])])
    assert r.status_code == 404


def test_sales_need_no_login(device):
    device.cookies.clear()
    sid = _sale(device, [_custom()]).json()["id"]
    assert device.post(f"/api/sales/{sid}/request-qr").status_code == 200
    assert device.get(f"/api/devices/{device.device_id}/pending-sale").status_code == 200
    assert device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"}).status_code == 200


def test_request_qr(device):
    sid = _sale(device, [_custom(37500)]).json()["id"]
    j = device.post(f"/api/sales/{sid}/request-qr").json()
    assert j["status"] == "awaiting_payment"
    assert j["payment_ref"] == f"POS{sid:06d}"
    assert j["qr_payload"] == build_vietqr_payload("970436", "0123456789", 37500, j["payment_ref"])
    # idempotent
    j2 = device.post(f"/api/sales/{sid}/request-qr").json()
    assert j2["qr_payload"] == j["qr_payload"]


def test_second_sale_blocked_while_pending(device):
    sid = _sale(device, [_custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/request-qr")
    r = _sale(device, [_custom()])
    assert r.status_code == 409
    j = r.json()
    assert j["detail"] == messages.PENDING_PAYMENT
    assert j["sale"]["id"] == sid and j["sale"]["qr_payload"]


def test_other_device_not_blocked(device):
    sid = _sale(device, [_custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/request-qr")
    d2 = device.post("/api/owner/devices", json={"name": "b", "floor": "floor1"}).json()["id"]
    r = device.post("/api/sales", json={"device_id": d2, "service": "grocery", "lines": [_custom()]})
    assert r.status_code in (200, 201)


def test_second_request_qr_blocked(device):
    a = _sale(device, [_custom()]).json()["id"]
    b = _sale(device, [_custom()]).json()["id"]
    assert device.post(f"/api/sales/{a}/request-qr").status_code == 200
    r = device.post(f"/api/sales/{b}/request-qr")
    assert r.status_code == 409 and r.json()["detail"] == messages.PENDING_PAYMENT


def test_pending_sale_restored(device):
    assert device.get(f"/api/devices/{device.device_id}/pending-sale").status_code == 204
    sid = _sale(device, [_custom()]).json()["id"]
    assert device.get(f"/api/devices/{device.device_id}/pending-sale").status_code == 204
    qr = device.post(f"/api/sales/{sid}/request-qr").json()["qr_payload"]
    j = device.get(f"/api/devices/{device.device_id}/pending-sale").json()
    assert j["id"] == sid and j["qr_payload"] == qr
    device.post(f"/api/sales/{sid}/confirm", json={"method": "bank_qr"})
    assert device.get(f"/api/devices/{device.device_id}/pending-sale").status_code == 204


def test_pending_unknown_device(device):
    assert device.get("/api/devices/nope/pending-sale").status_code == 404


def test_confirm_decrements_stock(device, make_product, tmp_path):
    p = make_product(stock_milli=42000)
    sid = _sale(device, [_pline(p["id"], qty=3000)]).json()["id"]
    r = device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"})
    assert r.status_code == 200
    assert _stock(tmp_path, p["id"]) == 39000


def test_stock_can_go_negative(device, make_product, tmp_path):
    p = make_product()
    sid = _sale(device, [_pline(p["id"], qty=1000)]).json()["id"]
    assert device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"}).status_code == 200
    assert _stock(tmp_path, p["id"]) == -1000


def test_untracked_not_decremented(device, make_product, tmp_path):
    p = make_product(track_stock=False)
    sid = _sale(device, [_pline(p["id"], qty=1000)]).json()["id"]
    device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"})
    assert _stock(tmp_path, p["id"]) == 0


def test_confirm_is_idempotent(device, make_product, tmp_path):
    p = make_product(stock_milli=42000)
    sid = _sale(device, [_pline(p["id"], qty=3000)]).json()["id"]
    device.post(f"/api/sales/{sid}/request-qr")
    r1 = device.post(f"/api/sales/{sid}/confirm", json={"method": "bank_qr"})
    r2 = device.post(f"/api/sales/{sid}/confirm", json={"method": "bank_qr"})
    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json()
    assert _stock(tmp_path, p["id"]) == 39000
    # a later cash confirm doesn't change the paid sale either
    r3 = device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"})
    assert r3.json()["payment_method"] == "bank_qr"
    assert _stock(tmp_path, p["id"]) == 39000


def test_cash_sale(device):
    sid = _sale(device, [_custom()]).json()["id"]
    j = device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"}).json()
    assert j["status"] == "paid" and j["payment_method"] == "cash"
    assert j["confirmed_via"] == "cash" and j["paid_at"]


def test_cash_on_awaiting_sale(device):
    sid = _sale(device, [_custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/request-qr")
    j = device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"}).json()
    assert j["status"] == "paid" and j["payment_method"] == "cash"


def test_bank_qr_confirm_manual(device):
    sid = _sale(device, [_custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/request-qr")
    j = device.post(f"/api/sales/{sid}/confirm", json={"method": "bank_qr"}).json()
    assert j["confirmed_via"] == "manual" and j["payment_method"] == "bank_qr"


def test_bank_qr_confirm_on_open_rejected(device, make_product, tmp_path):
    p = make_product(stock_milli=5000)
    sid = _sale(device, [_pline(p["id"])]).json()["id"]
    r = device.post(f"/api/sales/{sid}/confirm", json={"method": "bank_qr"})
    assert r.status_code == 409 and r.json()["detail"] == messages.QR_NOT_REQUESTED
    assert _stock(tmp_path, p["id"]) == 5000


def test_request_qr_on_paid_rejected(device):
    sid = _sale(device, [_custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"})
    r = device.post(f"/api/sales/{sid}/request-qr")
    assert r.status_code == 409 and r.json()["detail"] == messages.SALE_PAID


def test_sale_not_found(device):
    assert device.post("/api/sales/999/confirm", json={"method": "cash"}).status_code == 404
    assert device.post("/api/sales/999/request-qr").status_code == 404


def test_bad_method(device):
    sid = _sale(device, [_custom()]).json()["id"]
    assert device.post(f"/api/sales/{sid}/confirm", json={"method": "x"}).status_code == 422


def test_unit_cost_snapshot(device, make_product, tmp_path):
    p = make_product(stock_milli=5000, cost=3600)
    sid = _sale(device, [_pline(p["id"]), _custom()]).json()["id"]
    device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"})
    eng = make_engine(str(tmp_path / "test.db"))
    with make_sessionmaker(eng)() as s:
        rows = s.scalars(select(SaleLine).where(SaleLine.sale_id == sid).order_by(SaleLine.id)).all()
    assert rows[0].unit_cost == 3600
    assert rows[1].unit_cost is None


def test_business_day_set(device, set_now):
    set_now(datetime(2026, 11, 4, 1, 30, tzinfo=timeutil.TZ))
    sid = _sale(device, [_custom()]).json()["id"]
    j = device.post(f"/api/sales/{sid}/confirm", json={"method": "cash"}).json()
    assert j["business_day"] == "2026-11-03"
