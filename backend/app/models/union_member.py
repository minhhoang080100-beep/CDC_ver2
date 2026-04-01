from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union
from datetime import datetime

class UnionMemberBase(BaseModel):
    employeeId: str = Field(..., max_length=50) # Mã nhân viên
    fullName: str = Field(..., max_length=150) # Tên nhân viên
    gender: Optional[str] = None # Giới tính
    birthDate: Optional[datetime] = None # Ngày sinh
    workUnit: Optional[str] = None # Đơn vị Công tác
    department: Optional[str] = None # Bộ phận
    position: Optional[str] = None # Chức vụ
    hometown: Optional[str] = None # Quê quán
    permanentAddress: Optional[str] = None # Đại chỉ thường trú
    email: Optional[str] = None # Email
    phoneNumber: Optional[str] = None # SĐT
    
    # Trình độ
    educationLevel: Optional[str] = None # Trình độ văn hóa
    qualification: Optional[str] = None # Trình độ
    professionalQualification: Optional[str] = None # Trình độ chuyên môn
    major: Optional[str] = None # Chuyên ngành
    
    # Đảng / Công đoàn
    isPartyMember: Optional[bool] = None # Là đảng viên?
    partyJoinDate: Optional[datetime] = None # Ngày vào Đảng
    partyOfficialDate: Optional[datetime] = None # Ngày chính thức
    unionJoinDate: Optional[datetime] = None # Ngày tham gia Công đoàn
    
    # Giấy tờ tùy thân
    idNumber: Optional[str] = None # Số CMND
    cccdNumber: Optional[str] = None # Số CCCD
    idIssueDate: Optional[datetime] = None # Ngày cấp
    idIssuePlace: Optional[str] = None # Nơi cấp
    
    # Khác
    familyBackground: Optional[str] = None # Hoàn cảnh gia đình
    userId: Optional[str] = None # Link to User account if exists

class UnionMemberCreate(UnionMemberBase):
    pass

class UnionMemberUpdate(BaseModel):
    employeeId: Optional[str] = None
    fullName: Optional[str] = None
    gender: Optional[str] = None
    birthDate: Optional[datetime] = None
    workUnit: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    hometown: Optional[str] = None
    permanentAddress: Optional[str] = None
    email: Optional[str] = None
    phoneNumber: Optional[str] = None
    educationLevel: Optional[str] = None
    qualification: Optional[str] = None
    professionalQualification: Optional[str] = None
    major: Optional[str] = None
    isPartyMember: Optional[bool] = None
    partyJoinDate: Optional[datetime] = None
    partyOfficialDate: Optional[datetime] = None
    unionJoinDate: Optional[datetime] = None
    idNumber: Optional[str] = None
    cccdNumber: Optional[str] = None
    idIssueDate: Optional[datetime] = None
    idIssuePlace: Optional[str] = None
    familyBackground: Optional[str] = None
    userId: Optional[str] = None

class UnionMemberResponse(UnionMemberBase):
    id: str
    userId: Optional[str] = None

    @field_validator(
        'idNumber', 'cccdNumber', 'phoneNumber', 'employeeId',
        mode='before'
    )
    @classmethod
    def coerce_numeric_to_str(cls, v):
        """Ép kiểu số (float/int) sang string — xử lý dữ liệu cũ lưu sai kiểu từ Excel."""
        if v is None:
            return v
        if isinstance(v, float):
            # Bỏ phần thập phân nếu là số nguyên (vd: 186009530.0 → '186009530')
            return str(int(v)) if v == int(v) else str(v)
        if isinstance(v, int):
            return str(v)
        return v
