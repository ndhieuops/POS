import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from pos import auth, messages
from pos.db import get_db
from pos.models import Device

router = APIRouter(prefix="/api")

Floor = Literal["floor1", "floor4"]


class DeviceIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    floor: Floor


class DeviceFloorIn(BaseModel):
    floor: Floor


def _out(d: Device) -> dict:
    return {"id": d.id, "name": d.name, "floor": d.floor}


def get_or_404(db: Session, device_id: str) -> Device:
    d = db.get(Device, device_id)
    if d is None:
        raise HTTPException(404, messages.DEVICE_UNKNOWN)
    return d


@router.post("/owner/devices", status_code=201, dependencies=[Depends(auth.require_owner)])
def register_device(body: DeviceIn, db: Session = Depends(get_db)):
    d = Device(id=str(uuid.uuid4()), name=body.name, floor=body.floor)
    db.add(d)
    db.commit()
    return _out(d)


@router.get("/devices/{device_id}")
def get_device(device_id: str, db: Session = Depends(get_db)):
    return _out(get_or_404(db, device_id))


@router.put("/owner/devices/{device_id}", dependencies=[Depends(auth.require_owner)])
def set_device_floor(device_id: str, body: DeviceFloorIn, db: Session = Depends(get_db)):
    d = get_or_404(db, device_id)
    d.floor = body.floor
    db.commit()
    return _out(d)
