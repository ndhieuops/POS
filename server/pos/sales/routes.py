from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from pos import messages
from pos.db import get_db
from pos.devices.routes import get_or_404 as get_device_or_404
from pos.sales import service
from pos.sales.service import SaleError

router = APIRouter(prefix="/api")


class LineIn(BaseModel):
    product_id: int | None = None
    name: str
    unit: str
    qty_milli: int
    unit_price: int
    note: str | None = None


class SaleIn(BaseModel):
    device_id: str
    service: Literal["grocery", "tea", "pub"]
    lines: list[LineIn]


class LineOut(BaseModel):  # deliberately no unit_cost: public endpoint
    model_config = ConfigDict(from_attributes=True)
    product_id: int | None
    name: str
    unit: str
    qty_milli: int
    unit_price: int
    line_total: int
    note: str | None


class SaleOut(BaseModel):
    id: int
    status: str
    total: int
    lines: list[LineOut]
    payment_ref: str | None = None
    qr_payload: str | None = None
    payment_method: str | None = None
    confirmed_via: str | None = None
    paid_at: datetime | None = None
    business_day: date | None = None


class ConfirmIn(BaseModel):
    method: Literal["bank_qr", "cash"]


def _out(db: Session, sale) -> SaleOut:
    return SaleOut(
        id=sale.id, status=sale.status, total=sale.total,
        lines=[LineOut.model_validate(x) for x in service.lines_of(db, sale.id)],
        payment_ref=sale.payment_ref, qr_payload=sale.qr_payload if sale.status == "awaiting_payment" else None,
        payment_method=sale.payment_method, confirmed_via=sale.confirmed_via,
        paid_at=sale.paid_at, business_day=sale.business_day,
    )


def _error(db: Session, e: SaleError) -> JSONResponse:
    content = {"detail": e.detail}
    if e.sale is not None:
        content["sale"] = _out(db, e.sale).model_dump(mode="json")
    return JSONResponse(status_code=e.status, content=content)


@router.post("/sales", status_code=201, response_model=SaleOut)
def create_sale(body: SaleIn, db: Session = Depends(get_db)):
    try:
        sale = service.create_sale(db, body.device_id, body.service, body.lines)
        return _out(db, sale)
    except SaleError as e:
        return _error(db, e)


@router.post("/sales/{sale_id}/request-qr", response_model=SaleOut)
def request_qr(sale_id: int, db: Session = Depends(get_db)):
    try:
        return _out(db, service.request_qr(db, sale_id))
    except SaleError as e:
        return _error(db, e)


@router.post("/sales/{sale_id}/confirm", response_model=SaleOut)
def confirm(sale_id: int, body: ConfirmIn, db: Session = Depends(get_db)):
    try:
        return _out(db, service.confirm(db, sale_id, body.method))
    except SaleError as e:
        return _error(db, e)


@router.get("/devices/{device_id}/pending-sale", response_model=SaleOut)
def pending_sale(device_id: str, db: Session = Depends(get_db)):
    get_device_or_404(db, device_id)
    sale = service.pending_sale(db, device_id)
    if sale is None:
        return Response(status_code=204)
    return _out(db, sale)
