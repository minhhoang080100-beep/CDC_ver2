from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class CampaignStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class NominationType(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"
    TEAM = "TEAM"


class NominationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class CampaignCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    type: NominationType = NominationType.INDIVIDUAL
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    targetDepartments: List[str] = []


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[NominationType] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    targetDepartments: Optional[List[str]] = None
    status: Optional[CampaignStatus] = None


class NominationCreate(BaseModel):
    campaignId: str
    nomineeName: str = Field(..., min_length=1)
    nomineeDepartment: str
    reason: str = Field(..., min_length=1)
    achievements: Optional[str] = None
