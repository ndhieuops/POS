from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="POS_")

    db_path: str = "pos.db"
    backup_dir: str = "backups"
    # Built SPA directory; defaults to <repo>/web/dist.
    web_dist: str = str(Path(__file__).resolve().parents[2] / "web" / "dist")
    tz: str = "Asia/Ho_Chi_Minh"
