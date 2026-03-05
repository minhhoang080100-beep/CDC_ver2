import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    validate_password,
    validate_object_id,
)
from fastapi import HTTPException


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "TestPassword123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password(self):
        hashed = hash_password("TestPassword123")
        assert verify_password("WrongPassword123", hashed) is False


class TestTokens:
    def test_access_token_creation(self):
        token = create_access_token(data={"sub": "test_user_id"})
        assert token is not None
        assert isinstance(token, str)

    def test_refresh_token_creation(self):
        token = create_refresh_token(data={"sub": "test_user_id"})
        assert token is not None
        assert isinstance(token, str)

    def test_access_token_decode(self):
        token = create_access_token(data={"sub": "test_user_id"})
        payload = decode_token(token)
        assert payload["sub"] == "test_user_id"
        assert payload["type"] == "access"

    def test_refresh_token_decode(self):
        token = create_refresh_token(data={"sub": "test_user_id"})
        payload = decode_token(token)
        assert payload["sub"] == "test_user_id"
        assert payload["type"] == "refresh"

    def test_invalid_token(self):
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid.token.here")
        assert exc_info.value.status_code == 401


class TestPasswordValidation:
    def test_valid_password(self):
        # Should not raise
        validate_password("StrongPass1")

    def test_short_password(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password("Sh1")
        assert exc_info.value.status_code == 400

    def test_no_uppercase(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password("lowercase1")
        assert exc_info.value.status_code == 400

    def test_no_lowercase(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password("UPPERCASE1")
        assert exc_info.value.status_code == 400

    def test_no_number(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password("NoNumberHere")
        assert exc_info.value.status_code == 400


class TestObjectIdValidation:
    def test_valid_object_id(self):
        # Should not raise
        validate_object_id("507f1f77bcf86cd799439011")

    def test_invalid_object_id(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_object_id("invalid")
        assert exc_info.value.status_code == 400

    def test_short_object_id(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_object_id("507f1f77")
        assert exc_info.value.status_code == 400


class TestPermissions:
    def test_super_admin_can_manage(self):
        from app.core.permissions import can_manage_content
        user = {"role": "SUPER_ADMIN", "department": "VAN_PHONG_CANG"}
        assert can_manage_content(user) is True

    def test_bch_can_manage(self):
        from app.core.permissions import can_manage_content
        user = {"role": "BCH_VANPHONG", "department": "VAN_PHONG_CANG"}
        assert can_manage_content(user) is True

    def test_member_cannot_manage(self):
        from app.core.permissions import can_manage_content
        user = {"role": "MEMBER", "department": "VAN_PHONG_CANG"}
        assert can_manage_content(user) is False
