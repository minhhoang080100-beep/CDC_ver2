"""
Tests for centralized permission helpers (app.core.permissions).
"""

import pytest
from fastapi import HTTPException
from app.core.permissions import (
    ADMIN_ROLES,
    VALID_ROLES,
    VALID_DEPARTMENTS,
    MANAGER_ROLE_TO_DEPT,
    is_admin,
    require_admin,
    build_content_filter,
    resolve_target_departments,
    can_manage_content,
)


# ═══════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════

class TestConstants:
    def test_admin_roles_contains_all_admins(self):
        assert "SUPER_ADMIN" in ADMIN_ROLES
        assert "BCH_VANPHONG" in ADMIN_ROLES
        assert "BCH_CUALO" in ADMIN_ROLES
        assert "BCH_BENTHUY" in ADMIN_ROLES
        assert "MEMBER" not in ADMIN_ROLES

    def test_valid_roles_includes_member(self):
        assert "MEMBER" in VALID_ROLES
        for role in ADMIN_ROLES:
            assert role in VALID_ROLES

    def test_valid_departments(self):
        assert len(VALID_DEPARTMENTS) == 3
        assert "VAN_PHONG_CANG" in VALID_DEPARTMENTS
        assert "CUA_LO" in VALID_DEPARTMENTS
        assert "BEN_THUY" in VALID_DEPARTMENTS

    def test_manager_role_to_dept_mapping(self):
        assert MANAGER_ROLE_TO_DEPT["BCH_VANPHONG"] == "VAN_PHONG_CANG"
        assert MANAGER_ROLE_TO_DEPT["BCH_CUALO"] == "CUA_LO"
        assert MANAGER_ROLE_TO_DEPT["BCH_BENTHUY"] == "BEN_THUY"


# ═══════════════════════════════════════════════════════════════
#  is_admin / require_admin
# ═══════════════════════════════════════════════════════════════

class TestIsAdmin:
    def test_super_admin_is_admin(self):
        assert is_admin({"role": "SUPER_ADMIN"}) is True

    def test_bch_roles_are_admin(self):
        assert is_admin({"role": "BCH_VANPHONG"}) is True
        assert is_admin({"role": "BCH_CUALO"}) is True
        assert is_admin({"role": "BCH_BENTHUY"}) is True

    def test_member_is_not_admin(self):
        assert is_admin({"role": "MEMBER"}) is False

    def test_unknown_role_is_not_admin(self):
        assert is_admin({"role": "UNKNOWN"}) is False


class TestRequireAdmin:
    def test_admin_passes(self):
        # Should not raise
        require_admin({"role": "SUPER_ADMIN"})

    def test_bch_passes(self):
        require_admin({"role": "BCH_VANPHONG"})

    def test_member_raises_403(self):
        with pytest.raises(HTTPException) as exc_info:
            require_admin({"role": "MEMBER"})
        assert exc_info.value.status_code == 403

    def test_custom_detail_message(self):
        with pytest.raises(HTTPException) as exc_info:
            require_admin({"role": "MEMBER"}, detail="Custom message")
        assert exc_info.value.detail == "Custom message"


# ═══════════════════════════════════════════════════════════════
#  build_content_filter
# ═══════════════════════════════════════════════════════════════

class TestBuildContentFilter:
    def test_super_admin_sees_all(self):
        user = {"role": "SUPER_ADMIN", "department": "VAN_PHONG_CANG"}
        assert build_content_filter(user) == {}

    def test_bch_vanphong_sees_all(self):
        user = {"role": "BCH_VANPHONG", "department": "VAN_PHONG_CANG"}
        assert build_content_filter(user) == {}

    def test_bch_cualo_sees_own_dept(self):
        user = {"role": "BCH_CUALO", "department": "CUA_LO"}
        f = build_content_filter(user)
        assert "$or" in f
        assert f["$or"][0]["targetDepartments"] == "CUA_LO"
        assert f["$or"][1]["targetDepartments"] == "ALL"

    def test_member_sees_own_dept(self):
        user = {"role": "MEMBER", "department": "BEN_THUY"}
        f = build_content_filter(user)
        assert "$or" in f
        assert f["$or"][0]["targetDepartments"] == "BEN_THUY"


# ═══════════════════════════════════════════════════════════════
#  resolve_target_departments
# ═══════════════════════════════════════════════════════════════

class TestResolveTargetDepartments:
    def test_bch_cualo_always_returns_fixed(self):
        user = {"role": "BCH_CUALO"}
        result = resolve_target_departments(user, ["VAN_PHONG_CANG"])
        assert result == ["CUA_LO", "VAN_PHONG_CANG"]

    def test_bch_benthuy_always_returns_fixed(self):
        user = {"role": "BCH_BENTHUY"}
        result = resolve_target_departments(user, [])
        assert result == ["BEN_THUY", "VAN_PHONG_CANG"]

    def test_super_admin_empty_defaults_to_all(self):
        user = {"role": "SUPER_ADMIN"}
        result = resolve_target_departments(user, [])
        assert result == ["ALL"]

    def test_super_admin_respects_requested(self):
        user = {"role": "SUPER_ADMIN"}
        result = resolve_target_departments(user, ["CUA_LO"])
        assert result == ["CUA_LO"]


# ═══════════════════════════════════════════════════════════════
#  can_manage_content
# ═══════════════════════════════════════════════════════════════

class TestCanManageContent:
    def test_super_admin_can_manage(self):
        assert can_manage_content({"role": "SUPER_ADMIN"}) is True

    def test_bch_can_manage(self):
        assert can_manage_content({"role": "BCH_VANPHONG"}) is True
        assert can_manage_content({"role": "BCH_CUALO"}) is True
        assert can_manage_content({"role": "BCH_BENTHUY"}) is True

    def test_member_cannot_manage(self):
        assert can_manage_content({"role": "MEMBER"}) is False
