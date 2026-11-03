"""Input bounds. Keep values far below SQLite's signed 64-bit limit so no overflow reaches the DB."""

from typing import Annotated

from fastapi import Path

MAX_MONEY = 1_000_000_000  # đồng, per unit price / cost
MAX_QTY_MILLI = 1_000_000_000  # sale line quantity in thousandths
MAX_RECEIPT_QTY = 1_000_000  # whole units per stock receipt
MAX_ID = 2**62

PathId = Annotated[int, Path(ge=1, le=MAX_ID)]
