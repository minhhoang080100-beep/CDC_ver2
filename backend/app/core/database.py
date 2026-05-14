from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

async def close_mongo_connection():
    client.close()

async def init_db_indexes():
    # Users indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("department")
    # Thay thế unionId index bằng cccdNumber index
    try:
        await db.users.drop_index("unionId_1")
    except Exception:
        pass
    await db.users.create_index("cccdNumber", unique=True, sparse=True)
    # Posts indexes
    await db.posts.create_index("createdAt")
    await db.posts.create_index("targetDepartments")
    # Activities indexes
    await db.activities.create_index("createdAt")
    await db.activities.create_index("targetDepartments")
    # Enrollments indexes (compound unique)
    await db.enrollments.create_index(
        [("courseId", 1), ("userId", 1)], unique=True
    )
    # Survey responses indexes (compound unique)
    await db.survey_responses.create_index(
        [("surveyId", 1), ("userId", 1)], unique=True
    )
    await db.surveys.create_index("createdAt")
    # Mini game indexes
    await db.mini_games.create_index("createdAt")
    await db.mini_games.create_index("status")
    await db.mini_games.create_index("targetDepartments")
    await db.mini_game_answers.create_index(
        [("gameId", 1), ("userId", 1), ("questionIndex", 1)], unique=True
    )
    await db.mini_game_answers.create_index([("gameId", 1), ("score", -1)])
    # Nominations indexes
    await db.nominations.create_index("campaignId")
    await db.campaigns.create_index("createdAt")
    # Feedback indexes
    await db.feedback.create_index("senderId")
    await db.feedback.create_index("targetRecipients")
    await db.feedback.create_index("createdAt")
    # Text search indexes
    await db.posts.create_index([
        ("title", "text"), ("content", "text"), ("summary", "text")
    ], default_language="none")
    await db.documents.create_index([
        ("title", "text"), ("category", "text")
    ], default_language="none")
    # Notifications indexes
    await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
    await db.notifications.create_index("read")
    # App settings indexes
    await db.app_settings.create_index("key", unique=True)
    # Comments indexes (separate collection)
    await db.comments.create_index([("postId", 1), ("createdAt", -1)])
    # Rate limiting (TTL auto-cleanup)
    await db.rate_limits.create_index("expiresAt", expireAfterSeconds=0)
    await db.rate_limits.create_index([("key", 1), ("timestamp", 1)])
    # Refresh tokens (TTL auto-cleanup + lookup by userId)
    await db.refresh_tokens.create_index("expiresAt", expireAfterSeconds=0)
    await db.refresh_tokens.create_index("userId")
    await db.refresh_tokens.create_index("token")

