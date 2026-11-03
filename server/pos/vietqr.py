"""VietQR (EMVCo merchant-presented, NAPAS 247) payload, built locally."""


def crc16_ccitt(data: bytes) -> int:
    """CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, xorout 0."""
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def _f(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def payment_ref(sale_id: int) -> str:
    return f"POS{sale_id:06d}"


def build_vietqr_payload(bank_bin: str, account_no: str, amount: int, ref: str) -> str:
    beneficiary = _f("00", bank_bin) + _f("01", account_no)
    merchant = _f("00", "A000000727") + _f("01", beneficiary) + _f("02", "QRIBFTTA")
    body = (
        _f("00", "01") + _f("01", "12") + _f("38", merchant) + "5303704"
        + _f("54", str(amount)) + "5802VN" + _f("62", _f("08", ref)) + "6304"
    )
    return body + f"{crc16_ccitt(body.encode()):04X}"
