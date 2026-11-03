from contextlib import asynccontextmanager

from fastapi import FastAPI

from pos.config import Settings
from pos.db import make_engine, make_sessionmaker, run_migrations
from pos.setup.routes import router as setup_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        run_migrations(settings.db_path)
        app.state.engine = make_engine(settings.db_path)
        app.state.sessionmaker = make_sessionmaker(app.state.engine)
        yield
        app.state.engine.dispose()

    app = FastAPI(title="POS", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(setup_router)
    return app
