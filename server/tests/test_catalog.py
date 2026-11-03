from pos import messages


def mk(c, **kw):
    body = {"barcode": "8934563138165", "name": "Mì Hảo Hảo", "unit": "gói",
            "sell_price": 4500, "location": "grocery", "track_stock": True}
    body.update(kw)
    return c.post("/api/owner/products", json=body)


def test_lookup_found(owner_client):
    p = mk(owner_client).json()
    owner_client.post("/api/owner/logout")
    r = owner_client.get("/api/products/by-barcode/8934563138165?location=grocery")
    assert r.status_code == 200
    assert r.json() == {"id": p["id"], "barcode": "8934563138165", "name": "Mì Hảo Hảo",
                        "unit": "gói", "sell_price": 4500, "track_stock": True,
                        "stock_qty_milli": 0}


def test_lookup_not_found_vietnamese(client):
    r = client.get("/api/products/by-barcode/999?location=grocery")
    assert r.status_code == 404
    assert r.json()["detail"] == "Không tìm thấy sản phẩm" == messages.PRODUCT_NOT_FOUND


def test_lookup_hides_cost(owner_client):
    mk(owner_client)
    r = owner_client.get("/api/products/by-barcode/8934563138165?location=grocery")
    assert "last_cost" not in r.json()


def test_owner_out_has_last_cost(owner_client):
    assert mk(owner_client).json()["last_cost"] is None


def test_lookup_respects_location(owner_client):
    mk(owner_client, location="floor4")
    r = owner_client.get("/api/products/by-barcode/8934563138165?location=grocery")
    assert r.status_code == 404
    r = owner_client.get("/api/products/by-barcode/8934563138165?location=floor4")
    assert r.status_code == 200


def test_leading_zero_barcode(owner_client):
    mk(owner_client, barcode="0123456789012")
    r = owner_client.get("/api/products/by-barcode/0123456789012?location=grocery")
    assert r.status_code == 200 and r.json()["barcode"] == "0123456789012"
    assert owner_client.get("/api/products/by-barcode/123456789012?location=grocery").status_code == 404


def test_lookup_strips_whitespace(owner_client):
    mk(owner_client)
    r = owner_client.get("/api/products/by-barcode/%208934563138165%20?location=grocery")
    assert r.status_code == 200


def test_duplicate_barcode_409(owner_client):
    assert mk(owner_client).status_code == 201
    r = mk(owner_client, name="Khác")
    assert r.status_code == 409
    assert r.json()["detail"] == "Mã vạch đã tồn tại" == messages.BARCODE_EXISTS


def test_no_barcode_allowed_multiple(owner_client):
    assert mk(owner_client, barcode=None, name="A").status_code == 201
    assert mk(owner_client, barcode="", name="B").status_code == 201


def test_inactive_not_found(owner_client):
    p = mk(owner_client).json()
    r = owner_client.put(f"/api/owner/products/{p['id']}", json={"active": False})
    assert r.status_code == 200 and r.json()["active"] is False
    r = owner_client.get("/api/products/by-barcode/8934563138165?location=grocery")
    assert r.status_code == 404


def test_update_fields(owner_client):
    p = mk(owner_client).json()
    r = owner_client.put(f"/api/owner/products/{p['id']}",
                         json={"name": "Mì mới", "unit": "thùng", "sell_price": 99000})
    j = r.json()
    assert j["name"] == "Mì mới" and j["unit"] == "thùng" and j["sell_price"] == 99000


def test_update_unknown_404(owner_client):
    assert owner_client.put("/api/owner/products/999", json={"name": "x"}).status_code == 404


def test_owner_endpoints_require_owner(configured_client):
    assert configured_client.post("/api/owner/products", json={}).status_code == 401
    assert configured_client.get("/api/owner/products").status_code == 401
    assert configured_client.put("/api/owner/products/1", json={}).status_code == 401


def test_list_filters(owner_client):
    mk(owner_client, barcode="111", name="Coca")
    mk(owner_client, barcode="222", name="Bia Tiger", location="floor4")
    assert len(owner_client.get("/api/owner/products").json()) == 2
    r = owner_client.get("/api/owner/products?location=floor4").json()
    assert [p["name"] for p in r] == ["Bia Tiger"] and "last_cost" in r[0]
    assert [p["name"] for p in owner_client.get("/api/owner/products?q=coc").json()] == ["Coca"]
    assert [p["name"] for p in owner_client.get("/api/owner/products?q=222").json()] == ["Bia Tiger"]


def test_negative_price_422(owner_client):
    assert mk(owner_client, sell_price=-1).status_code == 422


def test_same_barcode_both_locations(owner_client):
    a = mk(owner_client, barcode="8934588012228", location="grocery")
    b = mk(owner_client, barcode="8934588012228", location="floor4")
    assert a.status_code == 201 and b.status_code == 201
    g = owner_client.get("/api/products/by-barcode/8934588012228?location=grocery").json()
    f = owner_client.get("/api/products/by-barcode/8934588012228?location=floor4").json()
    assert g["id"] == a.json()["id"] and f["id"] == b.json()["id"] and g["id"] != f["id"]
    assert mk(owner_client, barcode="8934588012228", location="floor4").status_code == 409


def test_migration_allows_same_barcode_two_locations(tmp_path):
    import sqlite3

    from pos.db import run_migrations

    path = str(tmp_path / "m.db")
    run_migrations(path)
    con = sqlite3.connect(path)
    sql = ("INSERT INTO products (barcode,name,unit,sell_price,location,track_stock,"
           "stock_qty_milli,active) VALUES ('X1','n','u',1,'%s',0,0,1)")
    con.execute(sql % "grocery")
    con.execute(sql % "floor4")
    try:
        con.execute(sql % "grocery")
        raise AssertionError("duplicate in same location accepted")
    except sqlite3.IntegrityError:
        pass
    con.close()
