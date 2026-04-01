from pydantic import BaseModel, Field
from typing import Optional

class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: str
    username: str
    fullName: str
    unionId: Optional[str] = None
    role: str
    department: str
    avatar: Optional[str] = None
    status: str
    pushToken: Optional[str] = None

class UpdatePushToken(BaseModel):
    token: str

class ChangePassword(BaseModel):
    currentPassword: str = Field(..., min_length=6)
    newPassword: str = Field(..., min_length=6)

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6)
    fullName: str = Field(..., min_length=2, max_length=100)
    unionId: Optional[str] = None
    role: str
    department: str
    avatar: Optional[str] = None

class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    avatar: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    newPassword: str = Field(..., min_length=6)

from typing import List
class BulkUserCreate(BaseModel):
    users: List[UserCreate]
