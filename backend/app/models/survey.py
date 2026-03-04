from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class QuestionType(str, Enum):
    SINGLE_CHOICE = "SINGLE_CHOICE"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    STAR_RATING = "STAR_RATING"
    OPEN_TEXT = "OPEN_TEXT"


class SurveyStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class SurveyQuestionCreate(BaseModel):
    content: str = Field(..., min_length=1)
    type: QuestionType
    options: List[str] = []
    isRequired: bool = True


class SurveyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    questions: List[SurveyQuestionCreate] = []
    isAnonymous: bool = False
    deadline: Optional[str] = None
    targetDepartments: List[str] = []


class SurveyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[SurveyQuestionCreate]] = None
    isAnonymous: Optional[bool] = None
    deadline: Optional[str] = None
    targetDepartments: Optional[List[str]] = None
    status: Optional[SurveyStatus] = None


class SurveySubmission(BaseModel):
    answers: List[dict]  # [{questionIndex: 0, answer: "A" | ["A","B"] | 4 | "text"}]
