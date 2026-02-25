from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class FeedbackCreate(BaseModel):
    subject: str
    content: str
    isAnonymous: bool = False

class FeedbackReply(BaseModel):
    content: str

class FeedbackStatusUpdate(BaseModel):
    status: str

class FeedbackResponse(BaseModel):
    id: str
    subject: str
    content: str
    senderId: Optional[str] = None
    senderName: Optional[str] = None
    senderDepartment: Optional[str] = None
    isAnonymous: bool
    status: str
    targetRecipients: List[str] = []
    replies: List[Dict[str, Any]] = []
    createdAt: datetime
