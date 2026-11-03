from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
DAY_CUTOFF_HOUR = 2  # the pub's business day ends at 02:00


def now() -> datetime:
    """Single source of current time (aware, local tz); tests patch this."""
    return datetime.now(TZ)


def business_day(ts: datetime) -> date:
    return (ts.astimezone(TZ) - timedelta(hours=DAY_CUTOFF_HOUR)).date()
