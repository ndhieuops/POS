from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import re

from pos import auth, messages, money, timeutil
from pos.bounds import MAX_MONEY, MAX_QTY_MILLI
from pos.models import Device, Product, Sale, SaleLine
from pos.vietqr import build_vietqr_payload, payment_ref


class SaleError(Exception):
    def __init__(self, status: int, detail: str, sale: Sale | None = None):
        self.status, self.detail, self.sale = status, detail, sale


def pending_sale(db: Session, device_id: str) -> Sale | None:
    return db.scalars(
        select(Sale).where(Sale.device_id == device_id, Sale.status == "awaiting_payment")
    ).first()


def lines_of(db: Session, sale_id: int) -> list[SaleLine]:
    return list(db.scalars(select(SaleLine).where(SaleLine.sale_id == sale_id).order_by(SaleLine.id)))


def create_sale(db: Session, device_id: str, service: str, items: list) -> Sale:
    if db.get(Device, device_id) is None:
        raise SaleError(404, messages.DEVICE_UNKNOWN)
    pend = pending_sale(db, device_id)
    if pend is not None:
        raise SaleError(409, messages.PENDING_PAYMENT, pend)
    if not items:
        raise SaleError(422, messages.CART_EMPTY)
    if any(not 0 < i.qty_milli <= MAX_QTY_MILLI for i in items):
        raise SaleError(422, messages.QTY_INVALID)
    # Custom (no product) lines carry their own price: must be > 0 and bounded.
    if any(not 0 < i.unit_price <= MAX_MONEY for i in items if i.product_id is None):
        raise SaleError(422, messages.INVALID_INPUT)
    sale = Sale(device_id=device_id, service=service, status="open", total=0)
    db.add(sale)
    db.flush()
    total = 0
    for i in items:
        if i.product_id is not None:
            p = db.get(Product, i.product_id)
            if p is None or not p.active:
                db.rollback()
                raise SaleError(404, messages.PRODUCT_NOT_FOUND)
            name, unit, price = p.name, p.unit, p.sell_price
        else:
            name, unit, price = i.name.strip(), i.unit.strip(), i.unit_price
        lt = money.line_total(price, i.qty_milli)
        total += lt
        db.add(SaleLine(sale_id=sale.id, product_id=i.product_id, name=name, unit=unit,
                        qty_milli=i.qty_milli, unit_price=price, line_total=lt, note=i.note))
    sale.total = total
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise SaleError(409, messages.PENDING_PAYMENT, pending_sale(db, device_id))
    return sale


def get_sale(db: Session, sale_id: int) -> Sale:
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise SaleError(404, messages.SALE_NOT_FOUND)
    return sale


def _bank(db: Session) -> tuple[str, str]:
    bin_, acc = auth.get_setting(db, "bank_bin"), auth.get_setting(db, "bank_account_no")
    if not (bin_ and re.fullmatch(r"\d{6}", bin_) and acc and re.fullmatch(r"\d{1,19}", acc)):
        raise SaleError(409, messages.BANK_NOT_CONFIGURED)
    return bin_, acc


def request_qr(db: Session, sale_id: int) -> Sale:
    sale = get_sale(db, sale_id)
    if sale.status == "paid":
        raise SaleError(409, messages.SALE_PAID)
    if sale.status == "awaiting_payment":
        return sale
    if sale.total <= 0:
        raise SaleError(422, messages.INVALID_INPUT)
    pend = pending_sale(db, sale.device_id)
    if pend is not None:
        raise SaleError(409, messages.PENDING_PAYMENT, pend)
    bin_, acc = _bank(db)  # validate before any state change
    ref = payment_ref(sale.id)
    sale.status = "awaiting_payment"
    sale.payment_ref = ref
    sale.qr_payload = build_vietqr_payload(bin_, acc, sale.total, ref)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise SaleError(409, messages.PENDING_PAYMENT, pending_sale(db, sale.device_id))
    return sale


def confirm(db: Session, sale_id: int, method: str) -> Sale:
    sale = get_sale(db, sale_id)
    if sale.status == "paid":
        return sale
    other = db.scalars(select(Sale).where(
        Sale.device_id == sale.device_id, Sale.status == "awaiting_payment", Sale.id != sale_id
    )).first()
    if other is not None:
        raise SaleError(409, messages.PENDING_PAYMENT, other)
    if method == "bank_qr" and sale.status != "awaiting_payment":
        raise SaleError(409, messages.QR_NOT_REQUESTED)
    ts = timeutil.now()
    # Atomic claim: only one concurrent confirm flips the row; the loser sees rowcount 0.
    res = db.execute(
        update(Sale).where(Sale.id == sale_id, Sale.status != "paid").values(
            status="paid", payment_method=method,
            confirmed_via="manual" if method == "bank_qr" else "cash",
            paid_at=ts, business_day=timeutil.business_day(ts),
        )
    )
    if res.rowcount == 0:
        db.rollback()
        db.expire_all()
        return get_sale(db, sale_id)
    for ln in lines_of(db, sale_id):
        if ln.product_id is None:
            continue
        p = db.get(Product, ln.product_id)
        ln.unit_cost = p.last_cost
        if p.track_stock:
            db.execute(update(Product).where(Product.id == p.id).values(
                stock_qty_milli=Product.stock_qty_milli - ln.qty_milli))
    db.commit()
    db.refresh(sale)
    return sale
