import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db():
    """Create a test database connection."""
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[f"{settings.DB_NAME}_test"]
    yield db
    # Cleanup: drop test database
    await client.drop_database(f"{settings.DB_NAME}_test")
    client.close()
