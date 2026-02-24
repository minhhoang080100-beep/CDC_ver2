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

class ChangePassword(BaseModel):
    currentPassword: str
    newPassword: str
