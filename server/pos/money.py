"""Money helpers. Amounts are integer đồng; quantities are integer milli-units."""


def round_to_500(amount: int) -> int:
    """Round half-up to the nearest 500đ."""
    return (amount + 250) // 500 * 500


def line_total(unit_price: int, qty_milli: int) -> int:
    """Price of qty_milli/1000 units. Fractional quantities round to 500đ."""
    if qty_milli % 1000 == 0:
        return unit_price * qty_milli // 1000
    return round_to_500((unit_price * qty_milli + 500) // 1000)


def format_vnd(amount: int) -> str:
    return f"{amount:,}".replace(",", ".") + "đ"
