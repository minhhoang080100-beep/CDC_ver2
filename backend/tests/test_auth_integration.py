"""
Integration tests for the auth flow (login → refresh → logout → revocation).
Uses httpx.AsyncClient to test FastAPI endpoints directly.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.core.security import hash_password


# ═══════════════════════════════════════════════════════════════
#  FIXTURES
# ═══════════════════════════════════════════════════════════════

TEST_USER = {
    "username": "integration_test_user",
    "password": "TestPass123",
    "fullName": "Integration Test",
    "unionId": "TEST_INTEGRATION_001",
    "role": "MEMBER",
    "department": "VAN_PHONG_CANG",
    "status": "ACTIVE",
}


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(autouse=True)
async def setup_test_user():
    """Create test user before each test, clean up after."""
    await db.users.delete_many({"username": TEST_USER["username"]})
    await db.rate_limits.delete_many({})
    await db.refresh_tokens.delete_many({})

    user_data = {**TEST_USER, "password": hash_password(TEST_USER["password"])}
    result = await db.users.insert_one(user_data)
    user_id = str(result.inserted_id)

    yield user_id

    await db.users.delete_many({"username": TEST_USER["username"]})
    await db.rate_limits.delete_many({})
    await db.refresh_tokens.delete_many({})


# ═══════════════════════════════════════════════════════════════
#  AUTH FLOW
# ═══════════════════════════════════════════════════════════════

class TestLoginFlow:
    @pytest.mark.asyncio
    async def test_login_returns_tokens(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "username": TEST_USER["username"],
            "password": TEST_USER["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refreshToken" in data
        assert data["user"]["username"] == TEST_USER["username"]

    @pytest.mark.asyncio
    async def test_wrong_password_401(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "username": TEST_USER["username"],
            "password": "WrongPassword123",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_nonexistent_user_401(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "username": "no_such_user_xyz",
            "password": "SomePass123",
        })
        assert resp.status_code == 401


class TestTokenRefresh:
    @pytest.mark.asyncio
    async def test_refresh_returns_new_access_token(self, client):
        # Login first
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": TEST_USER["username"],
            "password": TEST_USER["password"],
        })
        refresh_token = login_resp.json()["refreshToken"]

        # Refresh
        resp = await client.post("/api/v1/auth/refresh", json={
            "refreshToken": refresh_token,
        })
        assert resp.status_code == 200
        assert "token" in resp.json()

    @pytest.mark.asyncio
    async def test_invalid_refresh_token_401(self, client):
        resp = await client.post("/api/v1/auth/refresh", json={
            "refreshToken": "invalid.token.here",
        })
        assert resp.status_code == 401


class TestLogoutRevocation:
    @pytest.mark.asyncio
    async def test_logout_revokes_tokens(self, client):
        # Login
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": TEST_USER["username"],
            "password": TEST_USER["password"],
        })
        data = login_resp.json()
        access_token = data["token"]
        refresh_token = data["refreshToken"]

        # Logout
        resp = await client.post("/api/v1/auth/logout", headers={
            "Authorization": f"Bearer {access_token}",
        })
        assert resp.status_code == 200
        assert resp.json()["revokedTokens"] >= 1

        # Refresh should now fail (token revoked)
        resp = await client.post("/api/v1/auth/refresh", json={
            "refreshToken": refresh_token,
        })
        assert resp.status_code == 401


class TestProtectedEndpoints:
    @pytest.mark.asyncio
    async def test_me_with_valid_token(self, client):
        # Login
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": TEST_USER["username"],
            "password": TEST_USER["password"],
        })
        token = login_resp.json()["token"]

        # Access /me
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == TEST_USER["username"]

    @pytest.mark.asyncio
    async def test_me_without_token_403(self, client):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_me_with_invalid_token_401(self, client):
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": "Bearer invalid.token.xyz",
        })
        assert resp.status_code == 401


class TestRateLimiting:
    @pytest.mark.asyncio
    async def test_rate_limit_blocks_after_max(self, client):
        # Send MAX+1 wrong login attempts
        for i in range(6):
            resp = await client.post("/api/v1/auth/login", json={
                "username": "rate_limit_test_user",
                "password": "WrongPass123",
            })

        # The 6th attempt should be rate limited (429)
        assert resp.status_code == 429
