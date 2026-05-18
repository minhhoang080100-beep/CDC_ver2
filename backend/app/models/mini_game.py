from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class MiniGameStatus(str, Enum):
    DRAFT = "DRAFT"
    WAITING = "WAITING"
    LIVE = "LIVE"
    FINISHED = "FINISHED"


class MiniGameQuestion(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    options: List[str] = Field(..., min_length=2, max_length=6)
    correctOptionIndex: int = Field(..., ge=0)
    timeLimitSeconds: int = Field(default=20, ge=5, le=120)
    points: int = Field(default=1000, ge=100, le=1000)


class MiniGameCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    questions: List[MiniGameQuestion] = Field(default_factory=list)
    targetDepartments: List[str] = Field(default_factory=list)
    totalTimeSeconds: int = Field(default=300, ge=30, le=7200)


class MiniGameUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    questions: Optional[List[MiniGameQuestion]] = None
    targetDepartments: Optional[List[str]] = None
    status: Optional[MiniGameStatus] = None
    totalTimeSeconds: Optional[int] = Field(default=None, ge=30, le=7200)


class MiniGameAnswerCreate(BaseModel):
    optionIndex: int = Field(..., ge=0)
    questionIndex: Optional[int] = Field(default=None, ge=0)


class MiniGameSettingsUpdate(BaseModel):
    enabled: bool
