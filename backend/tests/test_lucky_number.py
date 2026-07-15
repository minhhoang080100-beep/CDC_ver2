from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import db
from app.core.security import hash_password
from app.main import app


ADMIN_USER = {
    "username": "lucky_admin_test",
    "password": "AdminPass123",
    "fullName": "Lucky Admin",
    "role": "SUPER_ADMIN",
    "department": "VAN_PHONG_CANG",
    "status": "ACTIVE",
}

MEMBER_ONE = {
    "username": "lucky_member_one_test",
    "password": "MemberPass123",
    "fullName": "Lucky Member One",
    "role": "MEMBER",
    "department": "CUA_LO",
    "status": "ACTIVE",
}

MEMBER_TWO = {
    "username": "lucky_member_two_test",
    "password": "MemberPass123",
    "fullName": "Lucky Member Two",
    "role": "MEMBER",
    "department": "BEN_THUY",
    "status": "ACTIVE",
}


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _create_user(user: dict) -> str:
    await db.users.delete_many({"username": user["username"]})
    data = {**user, "password": hash_password(user["password"])}
    result = await db.users.insert_one(data)
    return str(result.inserted_id)


async def _login(client: AsyncClient, user: dict) -> str:
    response = await client.post("/api/v1/auth/login", json={
        "username": user["username"],
        "password": user["password"],
    })
    assert response.status_code == 200, response.text
    return response.json()["token"]


@pytest_asyncio.fixture
async def lucky_context(client):
    previous_setting = await db.app_settings.find_one({"key": "mini_game"})
    usernames = [ADMIN_USER["username"], MEMBER_ONE["username"], MEMBER_TWO["username"]]
    await db.users.delete_many({"username": {"$in": usernames}})
    await db.refresh_tokens.delete_many({})
    await db.rate_limits.delete_many({})

    admin_id = await _create_user(ADMIN_USER)
    member_one_id = await _create_user(MEMBER_ONE)
    member_two_id = await _create_user(MEMBER_TWO)

    await db.app_settings.update_one(
        {"key": "mini_game"},
        {"$set": {"key": "mini_game", "enabled": True, "updatedAt": datetime.now(timezone.utc), "updatedBy": admin_id}},
        upsert=True,
    )

    now = datetime.now(timezone.utc)
    event = {
        "title": "Lucky Number Test Event",
        "status": "OPEN",
        "numberMin": 1,
        "numberMax": 2,
        "numberDigits": 4,
        "issueStartAt": now - timedelta(minutes=1),
        "issueEndAt": now + timedelta(minutes=10),
        "createdBy": admin_id,
        "creatorName": ADMIN_USER["fullName"],
        "isDeleted": False,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.lucky_number_events.insert_one(event)
    event_id = str(result.inserted_id)

    admin_token = await _login(client, ADMIN_USER)
    member_one_token = await _login(client, MEMBER_ONE)
    member_two_token = await _login(client, MEMBER_TWO)

    yield {
        "event_id": event_id,
        "admin_id": admin_id,
        "member_one_id": member_one_id,
        "member_two_id": member_two_id,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "member_one_headers": {"Authorization": f"Bearer {member_one_token}"},
        "member_two_headers": {"Authorization": f"Bearer {member_two_token}"},
    }

    await db.lucky_number_tickets.delete_many({"eventId": event_id})
    await db.lucky_number_draws.delete_many({"eventId": event_id})
    await db.lucky_number_events.delete_one({"_id": result.inserted_id})
    await db.users.delete_many({"username": {"$in": usernames}})
    await db.refresh_tokens.delete_many({})
    await db.rate_limits.delete_many({})
    if previous_setting:
        await db.app_settings.replace_one({"key": "mini_game"}, previous_setting, upsert=True)
    else:
        await db.app_settings.delete_one({"key": "mini_game"})


@pytest.mark.asyncio
async def test_claim_is_idempotent_and_numbers_are_unique(client, lucky_context):
    event_id = lucky_context["event_id"]

    first_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_one_headers"],
    )
    assert first_claim.status_code == 200, first_claim.text
    first_ticket = first_claim.json()["ticket"]

    repeat_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_one_headers"],
    )
    assert repeat_claim.status_code == 200, repeat_claim.text
    repeat_ticket = repeat_claim.json()["ticket"]

    second_user_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_two_headers"],
    )
    assert second_user_claim.status_code == 200, second_user_claim.text
    second_ticket = second_user_claim.json()["ticket"]

    assert repeat_ticket["id"] == first_ticket["id"]
    assert repeat_ticket["displayNumber"] == first_ticket["displayNumber"]
    assert first_ticket["userId"] == lucky_context["member_one_id"]
    assert second_ticket["userId"] == lucky_context["member_two_id"]
    assert first_ticket["luckyNumber"] != second_ticket["luckyNumber"]


@pytest.mark.asyncio
async def test_close_blocks_new_claim_and_draws_from_issued_tickets(client, lucky_context):
    event_id = lucky_context["event_id"]

    claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_one_headers"],
    )
    assert claim.status_code == 200, claim.text
    issued_ticket = claim.json()["ticket"]

    close = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/close",
        headers=lucky_context["admin_headers"],
    )
    assert close.status_code == 200, close.text
    assert close.json()["status"] == "CLOSED"

    blocked_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_two_headers"],
    )
    assert blocked_claim.status_code == 400

    draw = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/draw",
        headers=lucky_context["admin_headers"],
    )
    assert draw.status_code == 200, draw.text
    drawn_event = draw.json()

    assert drawn_event["status"] == "DRAWN"
    assert drawn_event["winningTicketId"] == issued_ticket["id"]
    assert drawn_event["winningDisplayNumber"] == issued_ticket["displayNumber"]
    assert drawn_event["winningUserId"] == lucky_context["member_one_id"]

    draw_again = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/draw",
        headers=lucky_context["admin_headers"],
    )
    assert draw_again.status_code == 400


@pytest.mark.asyncio
async def test_can_draw_multiple_unique_winners_until_tickets_are_exhausted(client, lucky_context):
    event_id = lucky_context["event_id"]

    first_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_one_headers"],
    )
    assert first_claim.status_code == 200, first_claim.text
    first_ticket = first_claim.json()["ticket"]

    second_claim = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/claim",
        headers=lucky_context["member_two_headers"],
    )
    assert second_claim.status_code == 200, second_claim.text
    second_ticket = second_claim.json()["ticket"]

    close = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/close",
        headers=lucky_context["admin_headers"],
    )
    assert close.status_code == 200, close.text

    first_draw = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/draw",
        headers=lucky_context["admin_headers"],
    )
    assert first_draw.status_code == 200, first_draw.text

    second_draw = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/draw",
        headers=lucky_context["admin_headers"],
    )
    assert second_draw.status_code == 200, second_draw.text

    drawn_ticket_ids = {
        first_draw.json()["winningTicketId"],
        second_draw.json()["winningTicketId"],
    }
    assert drawn_ticket_ids == {first_ticket["id"], second_ticket["id"]}

    state = await client.get(
        "/api/v1/mini-games/lucky/state",
        headers=lucky_context["admin_headers"],
    )
    assert state.status_code == 200, state.text
    state_data = state.json()
    assert state_data["event"]["drawCount"] == 2
    assert state_data["event"]["remainingDrawCount"] == 0
    assert [draw["drawOrder"] for draw in state_data["drawHistory"]] == [1, 2]

    exhausted_draw = await client.post(
        f"/api/v1/mini-games/lucky/events/{event_id}/draw",
        headers=lucky_context["admin_headers"],
    )
    assert exhausted_draw.status_code == 400
