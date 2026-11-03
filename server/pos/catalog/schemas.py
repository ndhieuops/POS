from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from pos.bounds import MAX_MONEY

Location = Literal["grocery", "floor4"]


class ProductOut(BaseModel):
    """Public shape. Never carries last_cost."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    barcode: str | None
    name: str
    unit: str
    sell_price: int
    track_stock: bool
    stock_qty_milli: int


class ProductOwnerOut(ProductOut):
    last_cost: int | None
    location: Location
    active: bool


class ProductIn(BaseModel):
    barcode: str | None = None
    name: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=30)
    sell_price: int = Field(ge=0, le=MAX_MONEY)
    location: Location
    track_stock: bool = False


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    sell_price: int | None = Field(default=None, ge=0, le=MAX_MONEY)
    active: bool | None = None
