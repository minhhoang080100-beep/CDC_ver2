from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LessonType(str, Enum):
    VIDEO = "VIDEO"
    PDF = "PDF"
    TEXT = "TEXT"


class CourseStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class CourseType(str, Enum):
    MANDATORY = "MANDATORY"
    OPTIONAL = "OPTIONAL"


class QuizQuestionType(str, Enum):
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"


# ─── Lessons ──────────────────────────────────────────────

class LessonCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    type: LessonType
    content: Optional[str] = None       # text/markdown content
    url: Optional[str] = None           # video/pdf URL
    duration: Optional[int] = None      # minutes


# ─── Courses ──────────────────────────────────────────────

class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None      # e.g. "An toàn lao động", "Nghiệp vụ"
    courseType: CourseType = CourseType.OPTIONAL
    targetDepartments: List[str] = []
    lessons: List[LessonCreate] = []


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    courseType: Optional[CourseType] = None
    targetDepartments: Optional[List[str]] = None
    status: Optional[CourseStatus] = None
    lessons: Optional[List[LessonCreate]] = None


# ─── Quizzes ──────────────────────────────────────────────

class QuizQuestion(BaseModel):
    content: str = Field(..., min_length=1)
    type: QuizQuestionType
    options: List[str] = []
    correctAnswer: int = 0              # index of correct option (or 0=True/1=False)


class QuizCreate(BaseModel):
    courseId: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    questions: List[QuizQuestion] = []
    timeLimit: Optional[int] = None     # minutes
    passingScore: int = 70              # percentage


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[QuizQuestion]] = None
    timeLimit: Optional[int] = None
    passingScore: Optional[int] = None


# ─── Quiz Submission ──────────────────────────────────────

class QuizSubmission(BaseModel):
    answers: List[int]  # index of selected option for each question
