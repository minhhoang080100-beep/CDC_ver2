from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ActivityCreate(BaseModel):
    name: str
    description: str
    time: str
    location: str
    type: str
    image: Optional[str] = None
    targetDepartments: List[str] = []

class ActivityResponse(BaseModel):
    id: str
    name: str
    description: str
    time: str
    location: str
    type: str
    image: Optional[str] = None
    createdBy: str
    registrations: List[Dict[str, Any]] = []
    createdAt: datetime
