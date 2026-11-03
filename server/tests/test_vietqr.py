from pos.vietqr import build_vietqr_payload, crc16_ccitt, payment_ref


def test_crc_check_value():
    assert crc16_ccitt(b"123456789") == 0x29B1


def test_payload_shape():
    p = build_vietqr_payload("970436", "0123456789", 37500, "POS000012")
    assert p.startswith("000201010212")
    assert "0010A000000727" in p and "0208QRIBFTTA" in p
    assert "540537500" in p and "5802VN" in p and "0809POS000012" in p
    assert p[-8:-4] == "6304" and p[-4:] == f"{crc16_ccitt(p[:-4].encode()):04X}"


def test_payload_exact_account_block():
    p = build_vietqr_payload("970436", "0123456789", 1000, "POS000001")
    assert "38" + "54" + "0010A000000727" in p
    assert "01" + "24" + "0006970436" + "01100123456789" in p
    assert "5303704" in p


def test_payment_ref():
    assert payment_ref(12) == "POS000012"
