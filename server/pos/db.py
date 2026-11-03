from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

SERVER_DIR = Path(__file__).resolve().parent.parent


def make_engine(db_path: str):
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return engine


def run_migrations(db_path: str) -> None:
    cfg = Config(str(SERVER_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(SERVER_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    command.upgrade(cfg, "head")


def make_sessionmaker(engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def get_db(request: Request):
    with request.app.state.sessionmaker() as session:
        yield session
