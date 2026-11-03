import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from pos import auth, messages, timeutil
from pos.db import get_db
from pos.models import PinAttempt

router = APIRouter(prefix="/api")

BANK_KEYS = ("bank_bin", "bank_account_no", "bank_account_name")
PUBLIC_KEYS = ("shop_name", *BANK_KEYS)


class SetupIn(BaseModel):
    shop_name: str
    owner_pin: str
    bank_bin: str = Field(pattern=r"^\d{6}$")
    bank_account_no: str = Field(pattern=r"^\d{1,19}$")
    bank_account_name: str


class LoginIn(BaseModel):
    pin: str
    device_id: str = Field(pattern=r"^[A-Za-z0-9-]{1,64}$")


class SettingsIn(BaseModel):
    shop_name: str | None = None
    bank_bin: str | None = Field(default=None, pattern=r"^\d{6}$")
    bank_account_no: str | None = Field(default=None, pattern=r"^\d{1,19}$")
    bank_account_name: str | None = None


@router.get("/setup/status")
def setup_status(db: Session = Depends(get_db)):
    return {"configured": auth.get_setting(db, "owner_pin_hash") is not None}


@router.post("/setup", status_code=201)
def do_setup(body: SetupIn, db: Session = Depends(get_db)):
    if auth.get_setting(db, "owner_pin_hash") is not None:
        raise HTTPException(409, messages.SETUP_DONE)
    if not re.fullmatch(r"[0-9]{4,6}", body.owner_pin):
        raise HTTPException(422, messages.PIN_FORMAT)
    auth.set_setting(db, "owner_pin_hash", auth.hash_pin(body.owner_pin))
    for k in PUBLIC_KEYS:
        auth.set_setting(db, k, getattr(body, k))
    db.commit()
    auth.session_secret(db)
    return {"configured": True}


@router.post("/owner/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    if auth.lock_state(db, body.device_id):
        raise HTTPException(429, messages.PIN_LOCKED)
    if auth.global_lock_state(db):
        raise HTTPException(429, messages.PIN_LOCKED_GLOBAL)
    stored = auth.get_setting(db, "owner_pin_hash")
    ok = stored is not None and auth.verify_pin(body.pin, stored)
    db.add(PinAttempt(device_id=body.device_id, at=timeutil.now(), ok=ok))
    db.commit()
    if not ok:
        raise HTTPException(401, messages.PIN_WRONG)
    auth.issue_session(db, response, body.device_id)
    return {"ok": True}


@router.post("/owner/logout")
def logout(response: Response):
    auth.clear_session(response)
    return {"ok": True}


def _settings(db: Session) -> dict:
    return {k: auth.get_setting(db, k) for k in PUBLIC_KEYS}


@router.get("/owner/settings", dependencies=[Depends(auth.require_owner)])
def get_settings(db: Session = Depends(get_db)):
    return _settings(db)


@router.put("/owner/settings", dependencies=[Depends(auth.require_owner)])
def put_settings(body: SettingsIn, db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        auth.set_setting(db, k, v)
    db.commit()
    return _settings(db)
