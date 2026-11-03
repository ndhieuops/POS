from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pos import messages
from pos.config import Settings
from pos.db import make_engine, make_sessionmaker, run_migrations
from pos.catalog.routes import router as catalog_router
from pos.devices.routes import router as devices_router
from pos.setup.routes import router as setup_router
from pos.receiving.routes import router as receiving_router
from pos.sales.routes import router as sales_router


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

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": messages.INVALID_INPUT})

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(setup_router)
    app.include_router(devices_router)
    app.include_router(catalog_router)
    app.include_router(receiving_router)
    app.include_router(sales_router)
    return app
