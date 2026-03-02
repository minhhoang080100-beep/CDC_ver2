from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UnionMemberBase(BaseModel):
    fullName: str = Field(..., max_length=150)
    gender: Optional[str] = None
    birthDate: Optional[datetime] = None
    hometown: Optional[str] = None
    permanentAddress: Optional[str] = None
    phoneNumber: Optional[str] = None
    ethnicity: Optional[str] = None
    religion: Optional[str] = None
    isPartyMember: Optional[bool] = None
    partyJoinDate: Optional[datetime] = None
    partyOfficialDate: Optional[datetime] = None
    workUnit: Optional[str] = None
    department: Optional[str] = None
    companyJoinDate: Optional[datetime] = None
    unionJoinDate: Optional[datetime] = None
    familyBackground: Optional[str] = None
    personalBackground: Optional[str] = None
    userId: Optional[str] = None # Link to User account if exists

class UnionMemberCreate(UnionMemberBase):
    pass

class UnionMemberUpdate(BaseModel):
    fullName: Optional[str] = None
    gender: Optional[str] = None
    birthDate: Optional[datetime] = None
    hometown: Optional[str] = None
    permanentAddress: Optional[str] = None
    phoneNumber: Optional[str] = None
    ethnicity: Optional[str] = None
    religion: Optional[str] = None
    isPartyMember: Optional[bool] = None
    partyJoinDate: Optional[datetime] = None
    partyOfficialDate: Optional[datetime] = None
    workUnit: Optional[str] = None
    department: Optional[str] = None
    companyJoinDate: Optional[datetime] = None
    unionJoinDate: Optional[datetime] = None
    familyBackground: Optional[str] = None
    personalBackground: Optional[str] = None
    userId: Optional[str] = None

class UnionMemberResponse(UnionMemberBase):
    id: str
