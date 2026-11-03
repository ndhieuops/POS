from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="POS_")

    db_path: str = "pos.db"
    backup_dir: str = "backups"
    tz: str = "Asia/Ho_Chi_Minh"
