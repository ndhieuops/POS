from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from pos.models import Product


def normalize_barcode(code: str | None) -> str | None:
    code = (code or "").strip()
    return code or None


def find_by_barcode(db: Session, code: str, location: str) -> Product | None:
    code = normalize_barcode(code)
    if code is None:
        return None
    return db.scalars(
        select(Product).where(
            Product.barcode == code,
            Product.location == location,
            Product.active.is_(True),
        )
    ).first()


def barcode_taken(db: Session, code: str, exclude_id: int | None = None) -> bool:
    p = db.scalars(select(Product).where(Product.barcode == code)).first()
    return p is not None and p.id != exclude_id


def list_products(db: Session, location: str | None, q: str | None) -> list[Product]:
    stmt = select(Product).order_by(Product.name, Product.id)
    if location:
        stmt = stmt.where(Product.location == location)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.barcode.like(like)))
    return list(db.scalars(stmt))
