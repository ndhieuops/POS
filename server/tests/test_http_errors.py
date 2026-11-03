from pos import messages


def test_unknown_get_is_vietnamese_404(client):
    r = client.get("/api/x")
    assert r.status_code == 404
    assert r.json()["detail"] == messages.NOT_FOUND == "Không tìm thấy"


def test_unknown_post_is_vietnamese(client):
    r = client.post("/api/x")
    # /api/{...} GET routes exist, so Starlette may answer 405 here; either way Vietnamese.
    expected = {404: messages.NOT_FOUND, 405: messages.METHOD_NOT_ALLOWED}
    assert r.status_code in expected
    assert r.json()["detail"] == expected[r.status_code]


def test_wrong_method_is_vietnamese_405(client):
    r = client.delete("/api/health")
    assert r.status_code == 405
    assert r.json()["detail"] == messages.METHOD_NOT_ALLOWED == "Thao tác không hợp lệ"


def test_specific_detail_passes_through(owner_client):
    r = owner_client.get("/api/owner/products/by-barcode/123456789?location=grocery")
    assert r.status_code == 404 and r.json()["detail"] == messages.PRODUCT_NOT_FOUND
