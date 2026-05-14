from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from app.core.database import db
from app.core.permissions import build_content_filter, can_manage_content, resolve_target_departments
from app.core.security import get_current_user, validate_object_id
from app.models.mini_game import MiniGameAnswerCreate, MiniGameCreate, MiniGameSettingsUpdate, MiniGameUpdate


router = APIRouter()


ADMIN_ONLY = "Chi co quan tri vien/BCH moi co quyen thuc hien thao tac nay"
SETTINGS_KEY = "mini_game"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _serialize_datetime(value: Optional[datetime]) -> Optional[str]:
    value = _as_utc(value)
    return value.isoformat() if value else None


def _sort_timestamp(value: Optional[datetime]) -> float:
    value = _as_utc(value)
    return value.timestamp() if value else float("inf")


def _is_admin(user: dict) -> bool:
    return can_manage_content(user)


def _is_super_admin(user: dict) -> bool:
    return user.get("role") == "SUPER_ADMIN"


async def _get_settings() -> dict:
    settings = await db.app_settings.find_one({"key": SETTINGS_KEY})
    if not settings:
        return {
            "key": SETTINGS_KEY,
            "enabled": False,
            "updatedAt": None,
            "updatedBy": None,
        }
    return settings


async def _feature_enabled() -> bool:
    settings = await _get_settings()
    return bool(settings.get("enabled", False))


async def _ensure_feature_available(current_user: dict) -> None:
    if _is_super_admin(current_user):
        return
    if not await _feature_enabled():
        raise HTTPException(status_code=403, detail="Mini game dang tam tat")


def _validate_questions(questions: list) -> None:
    for index, question in enumerate(questions):
        options = question.get("options", [])
        correct_index = question.get("correctOptionIndex")
        if correct_index is None or correct_index >= len(options):
            raise HTTPException(
                status_code=400,
                detail=f"Dap an dung cua cau {index + 1} khong hop le",
            )


def _question_dict(question, index: int) -> dict:
    data = question.model_dump()
    data["id"] = str(ObjectId())
    data["order"] = index
    return data


def _next_question_update(game: dict, now: datetime) -> dict:
    questions = game.get("questions", [])
    current_index = int(game.get("activeQuestionIndex", -1))
    next_index = current_index + 1

    if next_index >= len(questions):
        return {"status": "FINISHED", "questionStartedAt": None, "updatedAt": now}
    return {
        "status": "LIVE",
        "activeQuestionIndex": next_index,
        "questionStartedAt": now,
        "updatedAt": now,
    }


async def _auto_advance_if_expired(game: dict) -> dict:
    if game.get("status") != "LIVE":
        return game

    questions = game.get("questions", [])
    active_index = int(game.get("activeQuestionIndex", -1))
    if active_index < 0 or active_index >= len(questions):
        return game

    started_at = game.get("questionStartedAt")
    if not started_at:
        return game

    now = _now()
    elapsed = max(0, (now - _as_utc(started_at)).total_seconds())
    time_limit = int(questions[active_index].get("timeLimitSeconds", 20))
    if elapsed < time_limit:
        return game

    update = _next_question_update(game, now)
    result = await db.mini_games.update_one(
        {
            "_id": game["_id"],
            "status": "LIVE",
            "activeQuestionIndex": active_index,
            "questionStartedAt": started_at,
        },
        {"$set": update},
    )
    if result.modified_count:
        updated = await db.mini_games.find_one({"_id": game["_id"]})
        return updated or game

    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return updated or game


def _game_filter_for_user(game_id: Optional[str], current_user: dict) -> dict:
    query = {"isDeleted": {"$ne": True}}
    if game_id:
        query["_id"] = validate_object_id(game_id, "Mini game ID")

    if not _is_admin(current_user):
        query["status"] = {"$in": ["WAITING", "LIVE", "FINISHED"]}
        visibility = build_content_filter(current_user)
        if visibility:
            query = {"$and": [query, visibility]}

    return query


def _serialize_question(question: dict, include_correct: bool) -> dict:
    data = {
        "id": question.get("id"),
        "prompt": question.get("prompt"),
        "options": question.get("options", []),
        "timeLimitSeconds": question.get("timeLimitSeconds", 20),
        "points": question.get("points", 1000),
        "order": question.get("order"),
    }
    if include_correct:
        data["correctOptionIndex"] = question.get("correctOptionIndex")
    return data


async def _serialize_game(game: dict, current_user: dict, include_questions: bool = True) -> dict:
    include_correct = _is_admin(current_user)
    questions = game.get("questions", [])
    participant_count = len(await db.mini_game_answers.distinct("userId", {"gameId": str(game["_id"])}))

    item = {
        "id": str(game["_id"]),
        "title": game.get("title"),
        "description": game.get("description"),
        "status": game.get("status", "DRAFT"),
        "targetDepartments": game.get("targetDepartments", ["ALL"]),
        "createdBy": game.get("createdBy"),
        "creatorName": game.get("creatorName"),
        "activeQuestionIndex": game.get("activeQuestionIndex", -1),
        "questionStartedAt": _serialize_datetime(game.get("questionStartedAt")),
        "questionCount": len(questions),
        "participantCount": participant_count,
        "createdAt": _serialize_datetime(game.get("createdAt")),
        "updatedAt": _serialize_datetime(game.get("updatedAt")),
    }
    if include_questions:
        item["questions"] = [_serialize_question(q, include_correct) for q in questions]
    return item


async def _get_game_or_404(game_id: str, current_user: dict) -> dict:
    game = await db.mini_games.find_one(_game_filter_for_user(game_id, current_user))
    if not game:
        raise HTTPException(status_code=404, detail="Khong tim thay mini game")
    return game


def _ensure_can_manage_game(game: dict, current_user: dict) -> None:
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail=ADMIN_ONLY)
    if current_user["role"] != "SUPER_ADMIN" and game.get("createdBy") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Ban khong co quyen dieu khien mini game nay")


async def _build_leaderboard(game_id: str, limit: int = 10) -> list:
    answers = await db.mini_game_answers.find({"gameId": game_id}).to_list(100000)
    grouped: dict[str, dict] = {}

    for answer in answers:
        user_id = answer.get("userId")
        if not user_id:
            continue
        row = grouped.setdefault(
            user_id,
            {
                "userId": user_id,
                "userName": answer.get("userName"),
                "department": answer.get("department"),
                "score": 0,
                "correctCount": 0,
                "answeredCount": 0,
                "lastAnsweredAt": answer.get("answeredAt"),
            },
        )
        row["score"] += int(answer.get("score", 0))
        row["correctCount"] += 1 if answer.get("isCorrect") else 0
        row["answeredCount"] += 1
        if answer.get("answeredAt") and (
            not row.get("lastAnsweredAt") or answer["answeredAt"] < row["lastAnsweredAt"]
        ):
            row["lastAnsweredAt"] = answer["answeredAt"]

    leaderboard = list(grouped.values())
    leaderboard.sort(key=lambda row: (-row["score"], -row["correctCount"], _sort_timestamp(row.get("lastAnsweredAt"))))

    for rank, row in enumerate(leaderboard, start=1):
        row["rank"] = rank

    return leaderboard[:limit]


@router.get("")
async def list_mini_games(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    if not _is_super_admin(current_user) and not await _feature_enabled():
        return {"items": [], "total": 0, "hasMore": False}

    query = _game_filter_for_user(None, current_user)
    total = await db.mini_games.count_documents(query)
    games = await db.mini_games.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    items = [await _serialize_game(game, current_user, include_questions=False) for game in games]
    return {"items": items, "total": total, "hasMore": skip + limit < total}


@router.get("/active")
async def get_active_mini_game(current_user: dict = Depends(get_current_user)):
    if not _is_super_admin(current_user) and not await _feature_enabled():
        return None

    query = _game_filter_for_user(None, current_user)
    live_query = {**query, "status": "LIVE"}
    waiting_query = {**query, "status": "WAITING"}
    game = await db.mini_games.find_one(live_query, sort=[("createdAt", -1)])
    if not game:
        game = await db.mini_games.find_one(waiting_query, sort=[("createdAt", -1)])
    if not game:
        return None
    return await _serialize_game(game, current_user, include_questions=False)


@router.get("/settings")
async def get_mini_game_settings(current_user: dict = Depends(get_current_user)):
    settings = await _get_settings()
    return {
        "enabled": bool(settings.get("enabled", False)),
        "updatedAt": _serialize_datetime(settings.get("updatedAt")),
        "updatedBy": settings.get("updatedBy"),
    }


@router.put("/settings")
async def update_mini_game_settings(
    payload: MiniGameSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not _is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Chi SUPER_ADMIN moi co quyen bat/tat Mini Game")

    now = _now()
    await db.app_settings.update_one(
        {"key": SETTINGS_KEY},
        {"$set": {
            "enabled": payload.enabled,
            "updatedAt": now,
            "updatedBy": current_user["_id"],
        }},
        upsert=True,
    )
    return {
        "enabled": payload.enabled,
        "updatedAt": _serialize_datetime(now),
        "updatedBy": current_user["_id"],
    }


@router.post("")
async def create_mini_game(payload: MiniGameCreate, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail=ADMIN_ONLY)

    questions = [_question_dict(question, index) for index, question in enumerate(payload.questions)]
    _validate_questions(questions)
    target_departments = resolve_target_departments(current_user, payload.targetDepartments)

    data = {
        "title": payload.title,
        "description": payload.description,
        "questions": questions,
        "targetDepartments": target_departments,
        "status": "WAITING",
        "activeQuestionIndex": -1,
        "questionStartedAt": None,
        "createdBy": current_user["_id"],
        "creatorName": current_user.get("fullName"),
        "isDeleted": False,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    result = await db.mini_games.insert_one(data)
    data["_id"] = result.inserted_id
    return await _serialize_game(data, current_user)


@router.get("/{game_id}")
async def get_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    return await _serialize_game(game, current_user)


@router.put("/{game_id}")
async def update_mini_game(game_id: str, payload: MiniGameUpdate, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)

    update_data = {}
    if payload.title is not None:
        update_data["title"] = payload.title
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.questions is not None:
        questions = [_question_dict(question, index) for index, question in enumerate(payload.questions)]
        _validate_questions(questions)
        update_data["questions"] = questions
    if payload.targetDepartments is not None:
        update_data["targetDepartments"] = resolve_target_departments(current_user, payload.targetDepartments)
    if payload.status is not None:
        update_data["status"] = payload.status.value

    if not update_data:
        raise HTTPException(status_code=400, detail="Khong co du lieu cap nhat")

    update_data["updatedAt"] = _now()
    await db.mini_games.update_one({"_id": game["_id"]}, {"$set": update_data})
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/start")
async def start_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)

    if not game.get("questions"):
        raise HTTPException(status_code=400, detail="Mini game can co it nhat 1 cau hoi")

    now = _now()
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"status": "LIVE", "activeQuestionIndex": 0, "questionStartedAt": now, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/next")
async def next_question(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)

    questions = game.get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="Mini game chua co cau hoi")

    current_index = int(game.get("activeQuestionIndex", -1))
    now = _now()
    update = _next_question_update(game, now)

    await db.mini_games.update_one({"_id": game["_id"]}, {"$set": update})
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/replay")
async def replay_question(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)

    questions = game.get("questions", [])
    current_index = int(game.get("activeQuestionIndex", -1))
    if game.get("status") != "LIVE" or current_index < 0 or current_index >= len(questions):
        raise HTTPException(status_code=400, detail="Khong co cau hoi dang chay de phat lai")

    now = _now()
    await db.mini_game_answers.delete_many({
        "gameId": game_id,
        "questionIndex": current_index,
    })
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"questionStartedAt": now, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/finish")
async def finish_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    now = _now()
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"status": "FINISHED", "questionStartedAt": None, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/reset")
async def reset_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    now = _now()
    await db.mini_game_answers.delete_many({"gameId": game_id})
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"status": "WAITING", "activeQuestionIndex": -1, "questionStartedAt": None, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    return await _serialize_game(updated, current_user)


@router.delete("/{game_id}")
async def delete_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    await db.mini_games.update_one({"_id": game["_id"]}, {"$set": {"isDeleted": True, "deletedAt": _now()}})
    return {"status": "success", "message": "Mini game da duoc xoa"}


@router.get("/{game_id}/state")
async def get_mini_game_state(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    game = await _auto_advance_if_expired(game)
    game_id_str = str(game["_id"])
    active_index = int(game.get("activeQuestionIndex", -1))
    questions = game.get("questions", [])
    active_question = None
    my_answer = None
    remaining_seconds = 0

    if game.get("status") == "LIVE" and 0 <= active_index < len(questions):
        active_question = _serialize_question(questions[active_index], include_correct=False)
        started_at = game.get("questionStartedAt")
        if started_at:
            elapsed = max(0, (_now() - _as_utc(started_at)).total_seconds())
            remaining_seconds = max(0, int(active_question["timeLimitSeconds"] - elapsed))
        my_answer = await db.mini_game_answers.find_one({
            "gameId": game_id_str,
            "userId": current_user["_id"],
            "questionIndex": active_index,
        })

    leaderboard = await _build_leaderboard(game_id_str, limit=10)
    return {
        "game": await _serialize_game(game, current_user, include_questions=_is_admin(current_user)),
        "serverTime": _serialize_datetime(_now()),
        "activeQuestion": active_question,
        "remainingSeconds": remaining_seconds,
        "myAnswer": {
            "optionIndex": my_answer.get("optionIndex"),
            "isCorrect": my_answer.get("isCorrect"),
            "score": my_answer.get("score"),
            "answeredAt": my_answer.get("answeredAt"),
        } if my_answer else None,
        "leaderboard": leaderboard,
    }


@router.post("/{game_id}/answers")
async def answer_question(game_id: str, payload: MiniGameAnswerCreate, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    game = await _auto_advance_if_expired(game)
    if game.get("status") != "LIVE":
        raise HTTPException(status_code=400, detail="Mini game chua bat dau hoac da ket thuc")

    questions = game.get("questions", [])
    question_index = int(game.get("activeQuestionIndex", -1))
    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Chua co cau hoi dang dien ra")
    if payload.questionIndex is not None and payload.questionIndex != question_index:
        raise HTTPException(status_code=400, detail="Cau hoi da chuyen, vui long tra loi cau hien tai")

    question = questions[question_index]
    if payload.optionIndex >= len(question.get("options", [])):
        raise HTTPException(status_code=400, detail="Dap an khong hop le")

    started_at = game.get("questionStartedAt")
    if not started_at:
        raise HTTPException(status_code=400, detail="Cau hoi chua duoc bat dau")

    answered_at = _now()
    elapsed_seconds = max(0, (answered_at - _as_utc(started_at)).total_seconds())
    time_limit = int(question.get("timeLimitSeconds", 20))
    if elapsed_seconds > time_limit + 2:
        raise HTTPException(status_code=400, detail="Da het thoi gian tra loi cau hoi nay")

    correct_index = int(question.get("correctOptionIndex"))
    is_correct = payload.optionIndex == correct_index
    base_points = int(question.get("points", 1000))
    if is_correct:
        remaining_ratio = max(0, min(1, (time_limit - elapsed_seconds) / time_limit))
        score = base_points + int(base_points * 0.5 * remaining_ratio)
    else:
        score = 0

    answer_doc = {
        "gameId": str(game["_id"]),
        "questionIndex": question_index,
        "questionId": question.get("id"),
        "userId": current_user["_id"],
        "userName": current_user.get("fullName"),
        "department": current_user.get("department"),
        "optionIndex": payload.optionIndex,
        "isCorrect": is_correct,
        "score": score,
        "elapsedSeconds": elapsed_seconds,
        "answeredAt": answered_at,
    }

    try:
        await db.mini_game_answers.insert_one(answer_doc)
    except DuplicateKeyError:
        existing = await db.mini_game_answers.find_one({
            "gameId": str(game["_id"]),
            "questionIndex": question_index,
            "userId": current_user["_id"],
        })
        return {
            "status": "already_answered",
            "optionIndex": existing.get("optionIndex"),
            "isCorrect": existing.get("isCorrect"),
            "score": existing.get("score"),
        }

    return {
        "status": "success",
        "optionIndex": payload.optionIndex,
        "isCorrect": is_correct,
        "score": score,
    }


@router.get("/{game_id}/leaderboard")
async def get_leaderboard(
    game_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    return {
        "gameId": str(game["_id"]),
        "leaderboard": await _build_leaderboard(str(game["_id"]), limit=limit),
    }
