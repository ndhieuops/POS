import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from pos import messages, timeutil
from pos.db import get_db
from pos.models import PinAttempt, Setting

COOKIE = "owner_session"
IDLE = timedelta(minutes=5)
LOCK_WINDOW = timedelta(minutes=5)
MAX_FAILS = 5
GLOBAL_MAX_FAILS = 10


def get_setting(db: Session, key: str) -> str | None:
    row = db.get(Setting, key)
    return row.value if row else None


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${h.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    salt_hex, h_hex = stored.split("$")
    h = hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(h.hex(), h_hex)


def session_secret(db: Session) -> bytes:
    s = get_setting(db, "session_secret")
    if s is None:
        s = secrets.token_hex(32)
        set_setting(db, "session_secret", s)
        db.commit()
    return s.encode()


def _sig(secret: bytes, payload: str) -> str:
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def issue_session(db: Session, response: Response, device_id: str) -> None:
    ts = int(timeutil.now().timestamp())
    payload = f"{ts}.{device_id}"
    token = f"{payload}.{_sig(session_secret(db), payload)}"
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", path="/")


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


def lock_state(db: Session, device_id: str) -> bool:
    """True if device locked: 5 fails (since last success) in 5 min, until 5 min after last fail."""
    now = timeutil.now()
    rows = db.scalars(
        select(PinAttempt)
        .where(PinAttempt.device_id == device_id, PinAttempt.at > now - LOCK_WINDOW)
        .order_by(PinAttempt.id)
    ).all()
    fails = []
    for r in rows:
        fails = [] if r.ok else fails + [r]
    if len(fails) >= MAX_FAILS:
        return now < fails[-1].at + LOCK_WINDOW
    return False


def global_lock_state(db: Session) -> bool:
    """True if 10 failed logins (any device) fell within 5 min; locked until 5 min after the latest."""
    now = timeutil.now()
    fails = db.scalars(
        select(PinAttempt)
        .where(PinAttempt.ok.is_(False))
        .order_by(PinAttempt.at.desc(), PinAttempt.id.desc())
        .limit(GLOBAL_MAX_FAILS)
    ).all()
    if len(fails) < GLOBAL_MAX_FAILS:
        return False
    newest, oldest = fails[0].at, fails[-1].at
    return newest - oldest <= LOCK_WINDOW and now < newest + LOCK_WINDOW


def require_owner(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    token = request.cookies.get(COOKIE)
    try:
        ts_s, device_id, sig = (token or "").split(".")
        payload = f"{ts_s}.{device_id}"
        if not hmac.compare_digest(sig.encode(), _sig(session_secret(db), payload).encode()):
            raise ValueError
        age = timeutil.now().timestamp() - int(ts_s)
        if age < 0 or age > IDLE.total_seconds():
            raise ValueError
    except ValueError:
        raise HTTPException(401, messages.OWNER_REQUIRED)
    issue_session(db, response, device_id)  # sliding idle expiry
