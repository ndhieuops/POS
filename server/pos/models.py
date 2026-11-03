from datetime import date, datetime, timezone
from typing import Literal

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, String, TypeDecorator,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from pos import timeutil


class UTCDateTime(TypeDecorator):
    """Stored as naive UTC in SQLite; always returned timezone-aware."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime not allowed")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc).astimezone(timeutil.TZ)


class Base(DeclarativeBase):
    pass


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    floor: Mapped[Literal["floor1", "floor4"]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=timeutil.now)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    barcode: Mapped[str | None] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    unit: Mapped[str] = mapped_column(String)
    sell_price: Mapped[int] = mapped_column(Integer)
    location: Mapped[Literal["grocery", "floor4"]] = mapped_column(String)
    track_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_qty_milli: Mapped[int] = mapped_column(Integer, default=0)
    last_cost: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class StockReceipt(Base):
    __tablename__ = "stock_receipts"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    qty_milli: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[int] = mapped_column(Integer)
    received_at: Mapped[datetime] = mapped_column(UTCDateTime, default=timeutil.now)


class Sale(Base):
    __tablename__ = "sales"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"))
    service: Mapped[Literal["grocery", "tea", "pub"]] = mapped_column(String)
    status: Mapped[Literal["open", "awaiting_payment", "paid"]] = mapped_column(String)
    total: Mapped[int] = mapped_column(Integer, default=0)
    payment_method: Mapped[Literal["bank_qr", "cash"] | None] = mapped_column(String)
    confirmed_via: Mapped[Literal["manual", "auto", "cash"] | None] = mapped_column(String)
    payment_ref: Mapped[str | None] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=timeutil.now)
    paid_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    business_day: Mapped[date | None] = mapped_column(Date)


class SaleLine(Base):
    __tablename__ = "sale_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String)
    unit: Mapped[str] = mapped_column(String)
    qty_milli: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)
    line_total: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String)


class PinAttempt(Base):
    __tablename__ = "pin_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(String, index=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=timeutil.now)
    ok: Mapped[bool] = mapped_column(Boolean)
