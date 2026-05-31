"""FastAPI application factory.

In production this single process serves both the JSON API (under API_PREFIX)
and the built React app (from STATIC_DIR) — one process, one port.
"""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.db.session import get_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    get_logger("boldr").info("startup", env=settings.ENV, model=settings.OPENROUTER_MODEL)
    yield
    # Dispose the lazy async engine's pool so connections close cleanly on shutdown.
    await get_engine().dispose()
    get_logger("boldr").info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        lifespan=lifespan,
        docs_url="/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _add_request_logging(app)
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.API_PREFIX)
    _mount_spa(app, settings)
    return app


def _add_request_logging(app: FastAPI) -> None:
    """Tag each request with a uuid request id and log method/path/status/duration."""
    log = get_logger("boldr.request")

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        log.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 2),
        )
        return response


def _mount_spa(app: FastAPI, settings) -> None:
    """Serve the built React app (single-process prod). Unknown non-API paths fall
    back to index.html so client-side routing works on deep links / refresh.

    STATIC_DIR defaults to the in-repo build output (backend/static); if it
    hasn't been built yet the SPA mount is skipped and the API still runs.
    """
    static_dir = settings.static_path
    index = static_dir / "index.html"
    if not index.exists():
        get_logger("boldr").info("SPA build not found; serving API only", dir=str(static_dir))
        return

    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        candidate = static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
