from datetime import date, datetime
from zoneinfo import ZoneInfo

from pos.timeutil import business_day


def test_business_day_after_midnight():
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    assert business_day(datetime(2026, 11, 4, 1, 30, tzinfo=tz)) == date(2026, 11, 3)
    assert business_day(datetime(2026, 11, 4, 2, 0, tzinfo=tz)) == date(2026, 11, 4)
