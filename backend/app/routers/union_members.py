from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import pandas as pd
import io

from app.core.database import db
from app.models.union_member import UnionMemberCreate, UnionMemberUpdate, UnionMemberResponse
from app.core.security import get_current_user

router = APIRouter()

# Helper to format response
def format_member(member: dict) -> dict:
    member["id"] = str(member["_id"])
    return member

@router.post("/", response_model=UnionMemberResponse)
async def create_union_member(
    member: UnionMemberCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    member_dict = member.dict()
    # Add timestamps if needed, here just basic insert
    new_member = await db.union_members.insert_one(member_dict)
    
    created_member = await db.union_members.find_one({"_id": new_member.inserted_id})
    return format_member(created_member)

@router.post("/import")
async def import_union_members(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not file.filename.endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        
        imported_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                def get_val(col_name):
                    val = row.get(col_name)
                    if pd.isna(val):
                        return None
                    if isinstance(val, pd.Timestamp):
                        return val.to_pydatetime()
                    if isinstance(val, str):
                        return val.strip()
                    # Handle float parsed as int
                    if isinstance(val, float) and col_name == 'Số điện thoại':
                        return str(int(val))
                    if isinstance(val, int) and col_name == 'Số điện thoại':
                        return str(val)
                    return val

                full_name = get_val('Họ và Tên')
                if not full_name:
                    continue

                is_party = False
                party_val = get_val('Là Đảng Viên?')
                if party_val and str(party_val).strip().lower() in ['x', 'có', 'yes', 'true', '1']:
                    is_party = True

                member_data = {
                    "fullName": full_name,
                    "gender": get_val('Giới tính'),
                    "birthDate": get_val('Ngày sinh'),
                    "hometown": get_val('Quê quán'),
                    "permanentAddress": get_val('Địa chỉ thường trú'),
                    "phoneNumber": get_val('Số điện thoại'),
                    "ethnicity": get_val('Dân tộc'),
                    "religion": get_val('Tôn giáo'),
                    "isPartyMember": is_party,
                    "partyJoinDate": get_val('Ngày vào đảng'),
                    "partyOfficialDate": get_val('Ngày chính thức'),
                    "workUnit": get_val('Đơn vị công tác'),
                    "department": get_val('Bộ phận'),
                    "companyJoinDate": get_val('Ngày vào công ty'),
                    "unionJoinDate": get_val('Ngày vào công đoàn'),
                    "familyBackground": get_val('Hoàn cảnh Gia đình'),
                    "personalBackground": get_val('Hoàn cảnh bản thân')
                }

                await db.union_members.insert_one(member_data)
                imported_count += 1
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")

        return {
            "status": "success",
            "message": f"Đã nhập thành công {imported_count} đoàn viên.",
            "errors": errors
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@router.get("/", response_model=List[UnionMemberResponse])
async def get_union_members(
    skip: int = 0,
    limit: int = 50,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = {}
    
    # Optional filtering based on Role
    # For instance BCH_VP can only see their department? 
    # Current requirement: Admin needs to see all. Let's filter by query param.
    if department:
        query["department"] = department
        
    # Role-based filtering constraints
    if current_user["role"] != "SUPER_ADMIN":
        # BCH can only view their own department
        if current_user["role"] == "BCH_VANPHONG":
            query["department"] = "Văn phòng Cảng"
        elif current_user["role"] == "BCH_CUALO":
            query["department"] = "Xí nghiệp xếp dỡ Cửa Lò"
        elif current_user["role"] == "BCH_BENTHUY":
            query["department"] = "Xí nghiệp xếp dỡ Bến Thủy"

    cursor = db.union_members.find(query).skip(skip).limit(limit)
    members = await cursor.to_list(length=limit)
    return [format_member(m) for m in members]

@router.get("/{member_id}", response_model=UnionMemberResponse)
async def get_union_member(member_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not ObjectId.is_valid(member_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    member = await db.union_members.find_one({"_id": ObjectId(member_id)})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    return format_member(member)

@router.put("/{member_id}", response_model=UnionMemberResponse)
async def update_union_member(
    member_id: str, 
    member_update: UnionMemberUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not ObjectId.is_valid(member_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = {k: v for k, v in member_update.dict().items() if v is not None}
    
    if update_data:
        result = await db.union_members.update_one(
            {"_id": ObjectId(member_id)},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Member not found")
            
    updated_member = await db.union_members.find_one({"_id": ObjectId(member_id)})
    return format_member(updated_member)

@router.delete("/{member_id}")
async def delete_union_member(member_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not ObjectId.is_valid(member_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await db.union_members.delete_one({"_id": ObjectId(member_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
        
    return {"message": "Member deleted successfully"}
