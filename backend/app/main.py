from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import logging
from app.core.database import client
from app.routers import auth, posts, activities, feedback, documents, users

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
    allow_origins=["*"],
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
