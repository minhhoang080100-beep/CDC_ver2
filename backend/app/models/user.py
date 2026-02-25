from pydantic import BaseModel
from typing import Optional

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    fullName: str
    unionId: str
    role: str
    department: str
    avatar: Optional[str] = None
    status: str
    pushToken: Optional[str] = None

class UpdatePushToken(BaseModel):
    token: str

class ChangePassword(BaseModel):
    currentPassword: str
    newPassword: str

class UserCreate(BaseModel):
    username: str
    password: str
    fullName: str
    unionId: str
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
    newPassword: str

from typing import List
class BulkUserCreate(BaseModel):
    users: List[UserCreate]
