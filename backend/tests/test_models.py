"""
Tests for Pydantic models validation.
"""

import pytest
from pydantic import ValidationError
from app.models.user import UserCreate, ChangePassword
from app.models.survey import SurveyCreate, SurveySubmission
from app.models.post import PostCreate


# ═══════════════════════════════════════════════════════════════
#  USER MODELS
# ═══════════════════════════════════════════════════════════════

class TestUserCreate:
    def test_valid_user(self):
        user = UserCreate(
            username="testuser",
            password="StrongPass1",
            fullName="Test User",
            unionId="DV001",
            role="MEMBER",
            department="VAN_PHONG_CANG",
        )
        assert user.username == "testuser"
        assert user.department == "VAN_PHONG_CANG"

    def test_username_too_short(self):
        with pytest.raises(ValidationError):
            UserCreate(
                username="ab",
                password="StrongPass1",
                fullName="Test User",
                unionId="DV001",
                role="MEMBER",
                department="VAN_PHONG_CANG",
            )

    def test_username_too_long(self):
        with pytest.raises(ValidationError):
            UserCreate(
                username="a" * 51,
                password="StrongPass1",
                fullName="Test User",
                unionId="DV001",
                role="MEMBER",
                department="VAN_PHONG_CANG",
            )

    def test_empty_fullname(self):
        with pytest.raises(ValidationError):
            UserCreate(
                username="testuser",
                password="StrongPass1",
                fullName="",
                unionId="DV001",
                role="MEMBER",
                department="VAN_PHONG_CANG",
            )


class TestChangePassword:
    def test_valid_change(self):
        data = ChangePassword(
            currentPassword="OldPass1",
            newPassword="NewPass1",
        )
        assert data.currentPassword == "OldPass1"

    def test_empty_new_password(self):
        with pytest.raises(ValidationError):
            ChangePassword(
                currentPassword="OldPass1",
                newPassword="",
            )


# ═══════════════════════════════════════════════════════════════
#  POST MODELS
# ═══════════════════════════════════════════════════════════════

class TestPostCreate:
    def test_valid_post(self):
        post = PostCreate(
            title="Test Post",
            content="This is a test post content that is long enough.",
            summary="A short summary",
            category="NEWS",
        )
        assert post.title == "Test Post"
        assert post.category == "NEWS"

    def test_empty_title(self):
        with pytest.raises(ValidationError):
            PostCreate(
                title="",
                content="This is long enough content for validation.",
                summary="Summary",
                category="NEWS",
            )


# ═══════════════════════════════════════════════════════════════
#  SURVEY MODELS
# ═══════════════════════════════════════════════════════════════

class TestSurveyCreate:
    def test_valid_survey(self):
        survey = SurveyCreate(
            title="Test Survey",
            description="A test survey",
            questions=[{
                "content": "How satisfied are you?",
                "type": "STAR_RATING",
            }],
        )
        assert survey.title == "Test Survey"
        assert len(survey.questions) == 1

    def test_questions_can_be_empty_list(self):
        """SurveyCreate allows empty questions list by default."""
        survey = SurveyCreate(
            title="Test Survey",
            description="A test survey",
            questions=[],
        )
        assert len(survey.questions) == 0

    def test_no_title(self):
        with pytest.raises(ValidationError):
            SurveyCreate(
                title="",
                description="A test survey",
                questions=[{"content": "Q1", "type": "OPEN_TEXT"}],
            )
