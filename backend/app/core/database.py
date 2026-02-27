from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

async def close_mongo_connection():
    client.close()

async def init_db_indexes():
    # Users indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("unionId", unique=True)
    await db.users.create_index("department")
    # Posts indexes
    await db.posts.create_index("createdAt")
    await db.posts.create_index("targetDepartments")
