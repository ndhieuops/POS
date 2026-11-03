from pos.money import format_vnd, line_total, round_to_500


def test_round_to_500():
    assert round_to_500(17250) == 17500  # half-up to nearest 500đ
    assert round_to_500(17240) == 17000
    assert round_to_500(18000) == 18000


def test_line_total_weight():
    assert line_total(15000, 1200) == 18000  # 1,2 kg × 15.000đ
    assert line_total(15000, 1150) == 17500  # 17.250 → 17.500


def test_line_total_count():
    assert line_total(4500, 3000) == 13500  # 3 items, not rounded away


def test_format_vnd():
    assert format_vnd(37500) == "37.500đ"
    assert format_vnd(0) == "0đ"
    assert format_vnd(1250000) == "1.250.000đ"
