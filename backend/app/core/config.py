import os
import logging
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load env variables
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')

_DEFAULT_JWT_SECRET = "your-secret-key-change-in-production"

class Settings:
    MONGO_URL: str = os.environ.get('MONGO_URL', "mongodb://localhost:27017")
    DB_NAME: str = os.environ.get('DB_NAME', "cong_doan_db")
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", _DEFAULT_JWT_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours (giảm từ 7 ngày)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # Refresh token 7 ngày

settings = Settings()

# Security warning
if settings.JWT_SECRET_KEY == _DEFAULT_JWT_SECRET:
    logger.warning(
        "⚠️  SECURITY WARNING: JWT_SECRET_KEY is using the default value! "
        "Please set a strong, unique JWT_SECRET_KEY in your .env file for production."
    )
