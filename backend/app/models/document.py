from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    category: str
    fileSize: str
    fileUrl: Optional[str] = None
    targetDepartments: List[str] = []

class DocumentResponse(BaseModel):
    id: str
    title: str
    category: str
    fileSize: str
    fileUrl: Optional[str] = None
    uploadedBy: str
    targetDepartments: List[str] = []
    createdAt: datetime
