from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from pos import auth, messages
from pos.catalog import service as catalog
from pos.catalog.schemas import Location, ProductOwnerOut
from pos.db import get_db
from pos.receiving import service

router = APIRouter(prefix="/api/owner", dependencies=[Depends(auth.require_owner)])


class ReceiptIn(BaseModel):
    barcode: str
    location: Location
    qty: int
    unit_cost: int
    name: str | None = None
    sell_price: int | None = None
    unit: str = "cái"


class ReceiptOut(BaseModel):
    product: ProductOwnerOut
    stock_qty_milli: int
    created: bool


@router.post("/receipts", response_model=ReceiptOut)
def receive(body: ReceiptIn, db: Session = Depends(get_db)):
    if not catalog.normalize_barcode(body.barcode) or not body.unit.strip():
        raise HTTPException(422, messages.INVALID_INPUT)
    if body.qty < 1 or body.unit_cost < 0:
        raise HTTPException(422, messages.QTY_INVALID)
    try:
        p, created = service.receive(
            db, barcode=body.barcode, location=body.location, qty=body.qty,
            unit_cost=body.unit_cost, name=body.name, sell_price=body.sell_price,
            unit=body.unit.strip(),
        )
    except service.NewProductFieldsMissing:
        raise HTTPException(422, messages.NEW_PRODUCT_FIELDS)
    except (service.BarcodeConflict, IntegrityError):
        db.rollback()
        raise HTTPException(409, messages.BARCODE_EXISTS)
    return ReceiptOut(product=p, stock_qty_milli=p.stock_qty_milli, created=created)


@router.get("/products/by-barcode/{code}", response_model=ProductOwnerOut)
def owner_lookup(code: str, location: Location = "grocery", db: Session = Depends(get_db)):
    p = catalog.find_by_barcode(db, code, location)
    if p is None:
        raise HTTPException(404, messages.PRODUCT_NOT_FOUND)
    return p
