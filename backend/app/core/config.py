import os
import logging
import secrets
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Load env variables
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')

# Generate a strong random default — forces unique key per instance if not set
_DEFAULT_JWT_SECRET = secrets.token_urlsafe(64)


class Settings(BaseSettings):
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "cong_doan_db"
    JWT_SECRET_KEY: str = _DEFAULT_JWT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30   # 30 ngày
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90                # 90 ngày

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / '.env'),
        env_file_encoding='utf-8',
        extra='ignore',
    )


settings = Settings()

# Security warning — if env var not set, random was generated (tokens break on restart)
if not os.environ.get("JWT_SECRET_KEY"):
    logger.warning(
        "⚠️  SECURITY WARNING: JWT_SECRET_KEY not set in environment! "
        "A random key was generated — tokens will be invalidated on each restart. "
        "Set a strong JWT_SECRET_KEY in your .env file for production."
    )

