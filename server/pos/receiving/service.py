from sqlalchemy.orm import Session

from pos.catalog import service as catalog
from pos.models import Product, StockReceipt


class NewProductFieldsMissing(Exception):
    pass


class BarcodeConflict(Exception):
    pass


def receive(db: Session, *, barcode: str, location: str, qty: int, unit_cost: int,
            name: str | None, sell_price: int | None, unit: str) -> tuple[Product, bool]:
    """Add stock and write the receipt in one transaction. Returns (product, created)."""
    code = catalog.normalize_barcode(barcode)
    p = catalog.find_by_barcode(db, code, location)
    created = p is None
    if created:
        if not (name or "").strip() or sell_price is None or sell_price < 0:
            raise NewProductFieldsMissing
        if catalog.barcode_taken(db, code, location):
            raise BarcodeConflict  # inactive product owns this barcode
        p = Product(barcode=code, name=name.strip(), unit=unit, sell_price=sell_price,
                    location=location, track_stock=True, stock_qty_milli=0, active=True)
        db.add(p)
        db.flush()
    p.stock_qty_milli += qty * 1000
    p.last_cost = unit_cost
    db.add(StockReceipt(product_id=p.id, qty_milli=qty * 1000, unit_cost=unit_cost))
    db.commit()
    return p, created
