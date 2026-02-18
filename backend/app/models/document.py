from pydantic import BaseModel
from typing import List
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    category: str
    fileSize: str
    targetDepartments: List[str] = []

class DocumentResponse(BaseModel):
    id: str
    title: str
    category: str
    fileSize: str
    uploadedBy: str
    targetDepartments: List[str] = []
    createdAt: datetime
