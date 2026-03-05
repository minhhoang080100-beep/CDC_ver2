"""
Centralized permission helpers to avoid code duplication across routers.
"""

from fastapi import HTTPException


# ═══════════════════════════════════════════════════════════════
#  ROLE & DEPARTMENT CONSTANTS
# ═══════════════════════════════════════════════════════════════

ADMIN_ROLES = ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]
VALID_ROLES = ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY", "MEMBER"]
VALID_DEPARTMENTS = ["VAN_PHONG_CANG", "CUA_LO", "BEN_THUY"]

MANAGER_ROLE_TO_DEPT = {
    "BCH_VANPHONG": "VAN_PHONG_CANG",
    "BCH_CUALO": "CUA_LO",
    "BCH_BENTHUY": "BEN_THUY",
}


# ═══════════════════════════════════════════════════════════════
#  ROLE CHECK HELPERS
# ═══════════════════════════════════════════════════════════════

def is_admin(user: dict) -> bool:
    """Check if user has an admin/BCH role."""
    return user["role"] in ADMIN_ROLES


def require_admin(user: dict, detail: str = "Không có quyền thực hiện") -> None:
    """Raise 403 if user is not an admin/BCH."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail=detail)


# ═══════════════════════════════════════════════════════════════
#  CONTENT PERMISSION HELPERS
# ═══════════════════════════════════════════════════════════════

def build_content_filter(user: dict) -> dict:
    """
    Build MongoDB query filter based on user role/department.
    - SUPER_ADMIN & BCH_VANPHONG: see all content
    - BCH regional & MEMBER: see content targeting their department or ALL
    """
    if user["role"] in ["SUPER_ADMIN", "BCH_VANPHONG"]:
        return {}  # No filter, see everything
    
    return {
        "$or": [
            {"targetDepartments": user["department"]},
            {"targetDepartments": "ALL"}
        ]
    }


def resolve_target_departments(user: dict, requested_departments: list) -> list:
    """
    Resolve target departments based on user role.
    - BCH_CUALO: always targets CUA_LO + VAN_PHONG_CANG
    - BCH_BENTHUY: always targets BEN_THUY + VAN_PHONG_CANG
    - BCH_VANPHONG/SUPER_ADMIN: uses requested or defaults to ALL
    """
    if user["role"] == "BCH_CUALO":
        return ["CUA_LO", "VAN_PHONG_CANG"]
    elif user["role"] == "BCH_BENTHUY":
        return ["BEN_THUY", "VAN_PHONG_CANG"]
    elif user["role"] in ["BCH_VANPHONG", "SUPER_ADMIN"] and not requested_departments:
        return ["ALL"]
    
    return requested_departments


def can_manage_content(user: dict) -> bool:
    """Check if user can create/edit content (SUPER_ADMIN or BCH_*)."""
    return user["role"] == "SUPER_ADMIN" or user["role"].startswith("BCH_")
