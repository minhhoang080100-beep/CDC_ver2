from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PostCreate(BaseModel):
    title: str
    content: str
    summary: str
    category: str
    image: Optional[str] = None
    targetDepartments: List[str] = []

class PostCommentCreate(BaseModel):
    content: str

class PostResponse(BaseModel):
    id: str
    title: str
    content: str
    summary: str
    category: str
    image: Optional[str] = None
    authorId: str
    authorName: str
    authorDepartment: str
    targetDepartments: List[str]
    likes: List[str] = []
    comments: List[dict] = []
    createdAt: datetime
    updatedAt: datetime
