from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, strip_whitespace=True)
    content: str = Field(..., min_length=10, strip_whitespace=True)
    summary: str = Field(..., max_length=500, strip_whitespace=True)
    category: str
    image: Optional[str] = None
    targetDepartments: List[str] = []

class PostCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000, strip_whitespace=True)

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
