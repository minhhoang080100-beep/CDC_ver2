from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import logging
from app.core.database import client, init_db_indexes
from app.routers import auth, posts, activities, feedback, documents, users, analytics
import cloudinary
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

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

# Cloudinary Configuration
cloudinary_url = os.getenv("CLOUDINARY_URL")
if cloudinary_url:
    cloudinary.config(
        secure=True
    )
else:
    logger.warning("CLOUDINARY_URL not found in environment variables. Image/Document deletion will not work.")

@app.on_event("startup")
async def startup_db_client():
    await init_db_indexes()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
