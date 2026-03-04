from fastapi import FastAPI
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
import logging
from app.core.database import client, init_db_indexes
from app.routers import auth, posts, activities, feedback, documents, users, analytics, union_members, surveys, honors, elearning, comments, notifications, search, export
import cloudinary
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Cloudinary Configuration
cloudinary_url = os.getenv("CLOUDINARY_URL")
if cloudinary_url:
    cloudinary.config(
        secure=True
    )
else:
    logger.warning("CLOUDINARY_URL not found in environment variables. Image/Document deletion will not work.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db_indexes()
    logger.info("✅ Database indexes initialized")
    yield
    # Shutdown
    client.close()
    logger.info("🔴 Database connection closed")


app = FastAPI(lifespan=lifespan)


# ─── Request Logging Middleware ─────────────────────────────
import time


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    return response

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://cdc-ver2.vercel.app",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(union_members.router, prefix="/api/union-members", tags=["union_members"])
app.include_router(surveys.router, prefix="/api/surveys", tags=["surveys"])
app.include_router(honors.router, prefix="/api/honors", tags=["honors"])
app.include_router(elearning.router, prefix="/api/elearning", tags=["elearning"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
