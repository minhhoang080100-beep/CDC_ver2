from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

class DonationCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=1000)
    category: str
    condition: str
    images: List[str] = Field(default=[], max_length=5)
    priority: str = "FIRST_COME"

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = ["CLOTHING", "ELECTRONICS", "SCHOOL_SUPPLIES", "BABY", "HOUSEHOLD", "OTHER"]
        if v not in valid_categories:
            raise ValueError(f"Category must be one of {valid_categories}")
        return v

    @field_validator('condition')
    @classmethod
    def validate_condition(cls, v):
        valid_conditions = ["90%", "70%", "GOOD"]
        if v not in valid_conditions:
            raise ValueError(f"Condition must be one of {valid_conditions}")
        return v

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        valid_priorities = ["FIRST_COME", "MOST_NEEDED"]
        if v not in valid_priorities:
            raise ValueError(f"Priority must be one of {valid_priorities}")
        return v

    @field_validator('title', 'description', mode='before')
    @classmethod
    def strip_whitespace(cls, v):
        return v.strip() if isinstance(v, str) else v

class DonationRequestCreate(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)

class DonationRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class DonationCompleteRequest(BaseModel):
    thankYouMessage: Optional[str] = Field(None, max_length=500)

class DonationCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
