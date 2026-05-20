from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import pandas as pd
import io

from app.core.database import db
from app.models.union_member import UnionMemberCreate, UnionMemberUpdate, UnionMemberResponse
from app.core.security import get_current_user
from app.core.permissions import require_admin

router = APIRouter()

# Helper to format response
def format_member(member: dict) -> dict:
    member["id"] = str(member["_id"])
    return member

def get_allowed_work_unit(role: str) -> Optional[str]:
    mapping = {
        "BCH_VANPHONG": "Văn phòng Cảng",
        "BCH_CUALO": "XNXD Cửa Lò",
        "BCH_BENTHUY": "XNXD Bến Thủy",
    }
    return mapping.get(role)

@router.post("/", response_model=UnionMemberResponse)
async def create_union_member(
    member: UnionMemberCreate,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user, "Not authorized")

    member_dict = member.dict()
    allowed_wu = get_allowed_work_unit(current_user["role"])
    
    # Enforce workUnit limits if not SUPER_ADMIN
    if allowed_wu:
        if member_dict.get("workUnit") and member_dict.get("workUnit") != allowed_wu:
            raise HTTPException(status_code=403, detail=f"BCH chỉ được thêm thành viên vào đơn vị {allowed_wu}")
        member_dict["workUnit"] = allowed_wu

    # Add timestamps if needed, here just basic insert
    new_member = await db.union_members.insert_one(member_dict)
    
    created_member = await db.union_members.find_one({"_id": new_member.inserted_id})
    return format_member(created_member)

@router.post("/import")
async def import_union_members(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user, "Not authorized")

    if not file.filename.endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        
        imported_count = 0
        errors = []
        current_work_unit = None
        current_department = None
        
        for index, row in df.iterrows():
            try:
                # Các cột chứa số định danh cần ép kiểu về string
                STR_COLS = {'Số điện thoại', 'Số CMND', 'Số CCCD', 'Mã nhân viên'}

                def get_val(col_name):
                    val = row.get(col_name)
                    if pd.isna(val):
                        return None
                    if isinstance(val, pd.Timestamp):
                        return val.to_pydatetime()
                    if isinstance(val, str):
                        return val.strip()
                    # Ép kiểu float/int → str cho các cột số định danh
                    if col_name in STR_COLS:
                        if isinstance(val, float):
                            return str(int(val)) if val == int(val) else str(val)
                        if isinstance(val, int):
                            return str(val)
                    return val

                full_name = get_val('Tên nhân viên')
                employee_id = get_val('Mã nhân viên')
                
                if not full_name and not employee_id:
                    continue

                # Nhận diện dòng Header Lớp 1 (Đơn vị) & Lớp 2 (Bộ phận)
                if not employee_id and full_name:
                    if '(Tổng' in full_name or '(Tổng:' in full_name:
                        current_department = full_name.split('(Tổng')[0].strip()
                    else:
                        current_work_unit = full_name.strip()
                        current_department = None
                    continue
                
                if not employee_id:
                    continue

                party_join = get_val('Ngày vào Đảng')
                is_party = bool(party_join)

                member_data = {
                    "employeeId": str(employee_id).strip(),
                    "fullName": full_name,
                    "gender": get_val('Giới tính'),
                    "birthDate": get_val('Ngày sinh'),
                    "workUnit": get_val('Đơn vị Công tác') or current_work_unit,
                    "department": get_val('Bộ phận') or current_department,
                    "position": get_val('Chức vụ'),
                    "hometown": get_val('Quê quán'),
                    "permanentAddress": get_val('Đại chỉ thường trú'),
                    "email": get_val('Email'),
                    "phoneNumber": get_val('SĐT'),
                    "educationLevel": get_val('Trình độ văn hóa'),
                    "qualification": get_val('Trình độ'),
                    "professionalQualification": get_val('Trình độ chuyên môn'),
                    "major": get_val('Chuyên ngành'),
                    "isPartyMember": is_party,
                    "partyJoinDate": party_join,
                    "partyOfficialDate": get_val('Ngày chính thức'),
                    "unionJoinDate": get_val('Ngày tham gia Công đoàn'),
                    "idNumber": get_val('Số CMND'),
                    "cccdNumber": get_val('Số CCCD'),
                    "idIssueDate": get_val('Ngày cấp'),
                    "idIssuePlace": get_val('Nơi cấp'),
                    "familyBackground": get_val('Hoàn cảnh gia đình')
                }

                # Ghi đè/Kiểm tra quyền khi lưu vào DB:
                allowed_wu = get_allowed_work_unit(current_user["role"])
                if allowed_wu:
                    member_data["workUnit"] = allowed_wu

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

@router.get("", response_model=List[UnionMemberResponse])
@router.get("/", response_model=List[UnionMemberResponse])
async def get_union_members(
    skip: int = 0,
    limit: int = 2000,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user, "Not authorized")

    query = {}
    
    # Optional filtering based on Role
    # For instance BCH_VP can only see their department? 
    # Current requirement: Admin needs to see all. Let's filter by query param.
    if department:
        query["department"] = department
        
    # Role-based filtering constraints
    if current_user["role"] != "SUPER_ADMIN":
        allowed_wu = get_allowed_work_unit(current_user["role"])
        if allowed_wu:
            query["workUnit"] = allowed_wu

    cursor = db.union_members.find(query).skip(skip).limit(limit)
    members = await cursor.to_list(length=limit)

    # Automatically map User ID based on exact match: cccdNumber == cccdNumber
    if members:
        def normalize_cccd(val):
            if val is None or str(val).lower() == 'nan': return None
            s = str(val)
            if isinstance(val, float):
                s, _, _ = s.partition('.')
            if len(s) == 11:
                return s.zfill(12)
            if len(s) == 8:
                return s.zfill(9)
            return s

        normalized_map = {}
        for m in members:
            cccd = m.get("cccdNumber")
            if cccd:
                norm = normalize_cccd(cccd)
                if norm:
                    m["cccdNumber"] = norm  # Correct the in-memory representation
                    # Group by normalized cccd to handle multiple records identically if needed
                    # But since we're just setting userId on m, we can just use a list, 
                    # but since multiple union members might theoretically have same CCCD (edge case),
                    # we should list append
                    if norm not in normalized_map:
                        normalized_map[norm] = []
                    normalized_map[norm].append(m)

        cccd_list = list(normalized_map.keys())
        
        if cccd_list:
            users = await db.users.find({"cccdNumber": {"$in": cccd_list}}, {"_id": 1, "cccdNumber": 1}).to_list(length=len(cccd_list))
            user_map = {u["cccdNumber"]: str(u["_id"]) for u in users if u.get("cccdNumber")}
            
            for norm_cccd, members_with_cccd in normalized_map.items():
                if norm_cccd in user_map:
                    user_id = user_map[norm_cccd]
                    for m in members_with_cccd:
                        m["userId"] = user_id

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
        
    if current_user["role"] != "SUPER_ADMIN":
        allowed_wu = get_allowed_work_unit(current_user["role"])
        if allowed_wu and member.get("workUnit") != allowed_wu:
            raise HTTPException(status_code=403, detail="Not authorized to access this member")
            
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

    # Row-level check
    existing_member = await db.union_members.find_one({"_id": ObjectId(member_id)})
    if not existing_member:
        raise HTTPException(status_code=404, detail="Member not found")

    allowed_wu = None
    if current_user["role"] != "SUPER_ADMIN":
        allowed_wu = get_allowed_work_unit(current_user["role"])
        if allowed_wu and existing_member.get("workUnit") != allowed_wu:
            raise HTTPException(status_code=403, detail="Not authorized to edit this member")

    # Use exclude_unset so omitted fields stay unchanged, while fields explicitly
    # sent as null can clear stale profile data.
    update_data = member_update.model_dump(exclude_unset=True)

    for required_field in ("employeeId", "fullName"):
        if required_field in update_data and not update_data.get(required_field):
            raise HTTPException(status_code=400, detail=f"{required_field} cannot be empty")
    
    if allowed_wu and "workUnit" in update_data:
        if update_data.get("workUnit") and update_data.get("workUnit") != allowed_wu:
            raise HTTPException(status_code=403, detail="Cannot change member to a different work unit")
        update_data["workUnit"] = allowed_wu
    
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

    # Row-level check
    existing_member = await db.union_members.find_one({"_id": ObjectId(member_id)})
    if not existing_member:
        raise HTTPException(status_code=404, detail="Member not found")

    if current_user["role"] != "SUPER_ADMIN":
        allowed_wu = get_allowed_work_unit(current_user["role"])
        if allowed_wu and existing_member.get("workUnit") != allowed_wu:
            raise HTTPException(status_code=403, detail="Not authorized to delete this member")

    result = await db.union_members.delete_one({"_id": ObjectId(member_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
        
    return {"message": "Member deleted successfully"}
