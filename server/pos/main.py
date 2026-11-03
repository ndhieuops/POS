from fastapi import FastAPI

from pos.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="POS")
    app.state.settings = settings or Settings()

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app
