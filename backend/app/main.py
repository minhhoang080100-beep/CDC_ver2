from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
import logging
import time
import uuid
import cloudinary
import os
import sentry_sdk
from bson.errors import InvalidId

from app.core.database import client, db, init_db_indexes
from app.routers import (
    auth, posts, activities, feedback, documents, users,
    analytics, union_members, surveys, honors, elearning,
    comments, notifications, search, export, websocket
)

# ─── Structured Logging ─────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ─── Cloudinary Configuration ────────────────────────────────
cloudinary_url = os.getenv("CLOUDINARY_URL")
if cloudinary_url:
    cloudinary.config(secure=True)
else:
    logger.warning("CLOUDINARY_URL not found. Image/Document deletion will not work.")

# ─── Sentry Error Monitoring (optional) ──────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "production"),
    )
    logger.info("✅ Sentry error monitoring initialized")
else:
    logger.info("ℹ️  SENTRY_DSN not set — error monitoring disabled")


# ─── Lifespan ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db_indexes()
    logger.info("✅ Database indexes initialized")
    yield
    # Shutdown
    client.close()
    logger.info("🔴 Database connection closed")


# ─── App Instance ────────────────────────────────────────────
app = FastAPI(
    title="Công Đoàn Cảng Nghệ Tĩnh API",
    description="API cho ứng dụng quản lý Công Đoàn Cảng Nghệ Tĩnh",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ═══════════════════════════════════════════════════════════════
#  GLOBAL ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic validation errors to Vietnamese-friendly messages."""
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append(f"{field}: {error['msg']}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Dữ liệu không hợp lệ",
            "errors": errors,
        },
    )


@app.exception_handler(InvalidId)
async def bson_invalid_id_handler(request: Request, exc: InvalidId):
    """Catch invalid MongoDB ObjectId strings — return 400 instead of 500."""
    return JSONResponse(
        status_code=400,
        content={"detail": "ID không hợp lệ"},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions — log and return safe error message."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi hệ thống. Vui lòng thử lại sau."},
    )


# ═══════════════════════════════════════════════════════════════
#  MIDDLEWARE
# ═══════════════════════════════════════════════════════════════

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({duration}ms)"
    )
    response.headers["X-Request-ID"] = request_id
    return response


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://cdc-ver2.vercel.app",
        "https://congdoan.nghetinhport.vn",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)


# ═══════════════════════════════════════════════════════════════
#  ROUTERS — API v1
# ═══════════════════════════════════════════════════════════════

_V1 = "/api/v1"

app.include_router(auth.router,          prefix=f"{_V1}/auth",          tags=["auth"])
app.include_router(posts.router,         prefix=f"{_V1}/posts",         tags=["posts"])
app.include_router(activities.router,    prefix=f"{_V1}/activities",    tags=["activities"])
app.include_router(feedback.router,      prefix=f"{_V1}/feedback",      tags=["feedback"])
app.include_router(documents.router,     prefix=f"{_V1}/documents",     tags=["documents"])
app.include_router(users.router,         prefix=f"{_V1}/users",         tags=["users"])
app.include_router(analytics.router,     prefix=f"{_V1}/analytics",     tags=["analytics"])
app.include_router(union_members.router, prefix=f"{_V1}/union-members", tags=["union_members"])
app.include_router(surveys.router,       prefix=f"{_V1}/surveys",       tags=["surveys"])
app.include_router(honors.router,        prefix=f"{_V1}/honors",        tags=["honors"])
app.include_router(elearning.router,     prefix=f"{_V1}/elearning",     tags=["elearning"])
app.include_router(comments.router,      prefix=f"{_V1}/comments",      tags=["comments"])
app.include_router(notifications.router, prefix=f"{_V1}/notifications", tags=["notifications"])
app.include_router(search.router,        prefix=f"{_V1}/search",        tags=["search"])
app.include_router(export.router,        prefix=f"{_V1}/export",        tags=["export"])
app.include_router(websocket.router,     prefix=f"{_V1}",              tags=["websocket"])

# ─── Backward-compatible: /api/* → /api/v1/* redirect ────────
# Also mount at /api/* so existing frontend continues to work without changes
app.include_router(auth.router,          prefix="/api/auth",          tags=["auth"], include_in_schema=False)
app.include_router(posts.router,         prefix="/api/posts",         tags=["posts"], include_in_schema=False)
app.include_router(activities.router,    prefix="/api/activities",    tags=["activities"], include_in_schema=False)
app.include_router(feedback.router,      prefix="/api/feedback",      tags=["feedback"], include_in_schema=False)
app.include_router(documents.router,     prefix="/api/documents",     tags=["documents"], include_in_schema=False)
app.include_router(users.router,         prefix="/api/users",         tags=["users"], include_in_schema=False)
app.include_router(analytics.router,     prefix="/api/analytics",     tags=["analytics"], include_in_schema=False)
app.include_router(union_members.router, prefix="/api/union-members", tags=["union_members"], include_in_schema=False)
app.include_router(surveys.router,       prefix="/api/surveys",       tags=["surveys"], include_in_schema=False)
app.include_router(honors.router,        prefix="/api/honors",        tags=["honors"], include_in_schema=False)
app.include_router(elearning.router,     prefix="/api/elearning",     tags=["elearning"], include_in_schema=False)
app.include_router(comments.router,      prefix="/api/comments",      tags=["comments"], include_in_schema=False)
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"], include_in_schema=False)
app.include_router(search.router,        prefix="/api/search",        tags=["search"], include_in_schema=False)
app.include_router(export.router,        prefix="/api/export",        tags=["export"], include_in_schema=False)


# ═══════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint — verifies API is running and DB is reachable."""
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "version": "2.0.0",
    }
