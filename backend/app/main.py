from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import models  # noqa: F401 — регистрирует модели в metadata
from app.api import (
    admin,
    auth,
    catalog,
    estimates,
    finance,
    inventory,
    invoices,
    objects,
    reports,
    requests as requests_api,
    warehouse,
)
from app.core.config import settings
from app.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.seed_on_startup:
        from app.seed import seed_if_empty

        await seed_if_empty()
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"
app.include_router(auth.router, prefix=API)
app.include_router(catalog.router, prefix=API)
app.include_router(objects.router, prefix=API)
app.include_router(warehouse.router, prefix=API)
app.include_router(requests_api.router, prefix=API)
app.include_router(invoices.router, prefix=API)
app.include_router(estimates.router, prefix=API)
app.include_router(finance.router, prefix=API)
app.include_router(inventory.router, prefix=API)
app.include_router(reports.router, prefix=API)
app.include_router(admin.router, prefix=API)


@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    # Бизнес-блокировки (например, движения при активной инвентаризации) -> 409.
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/")
async def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/api/health"}
