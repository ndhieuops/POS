from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from pos import auth, messages
from pos.catalog import service
from pos.catalog.schemas import (  # noqa: F401  (re-exported for later tasks)
    Location,
    ProductIn,
    ProductOut,
    ProductOwnerOut,
    ProductUpdate,
)
from pos.db import get_db
from pos.models import Product

router = APIRouter(prefix="/api")


@router.get("/products/by-barcode/{code}", response_model=ProductOut)
def lookup(code: str, location: Location = "grocery", db: Session = Depends(get_db)):
    p = service.find_by_barcode(db, code, location)
    if p is None:
        raise HTTPException(404, messages.PRODUCT_NOT_FOUND)
    return p


@router.post(
    "/owner/products",
    status_code=201,
    response_model=ProductOwnerOut,
    dependencies=[Depends(auth.require_owner)],
)
def create_product(body: ProductIn, db: Session = Depends(get_db)):
    code = service.normalize_barcode(body.barcode)
    if code is not None and service.barcode_taken(db, code, body.location):
        raise HTTPException(409, messages.BARCODE_EXISTS)
    p = Product(
        barcode=code,
        name=body.name,
        unit=body.unit,
        sell_price=body.sell_price,
        location=body.location,
        track_stock=body.track_stock,
        stock_qty_milli=0,
        active=True,
    )
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, messages.BARCODE_EXISTS)
    return p


@router.put(
    "/owner/products/{product_id}",
    response_model=ProductOwnerOut,
    dependencies=[Depends(auth.require_owner)],
)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if p is None:
        raise HTTPException(404, messages.PRODUCT_NOT_FOUND)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(p, field, value)
    db.commit()
    return p


@router.get(
    "/owner/products",
    response_model=list[ProductOwnerOut],
    dependencies=[Depends(auth.require_owner)],
)
def list_products(location: Location | None = None, q: str | None = None,
                  db: Session = Depends(get_db)):
    return service.list_products(db, location, q)
