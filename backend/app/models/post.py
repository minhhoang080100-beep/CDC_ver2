from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class PostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=10)
    summary: str = Field(..., max_length=500)
    category: str
    image: Optional[str] = None
    targetDepartments: List[str] = []

    @field_validator('title', 'content', 'summary', mode='before')
    @classmethod
    def strip_whitespace(cls, v):
        return v.strip() if isinstance(v, str) else v

class PostCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)

    @field_validator('content', mode='before')
    @classmethod
    def strip_whitespace(cls, v):
        return v.strip() if isinstance(v, str) else v

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
