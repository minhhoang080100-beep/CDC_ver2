from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import db
from app.core.permissions import build_content_filter, can_manage_content, resolve_target_departments
from app.core.security import get_current_user, validate_object_id
from app.models.mini_game import MiniGameAnswerCreate, MiniGameCreate, MiniGameSettingsUpdate, MiniGameUpdate
from app.routers.websocket import manager


router = APIRouter()


ADMIN_ONLY = "Chi co quan tri vien/BCH moi co quyen thuc hien thao tac nay"
SETTINGS_KEY = "mini_game"
MAX_QUESTION_SCORE = 1000
MAX_SPEED_BONUS = 500
DEFAULT_TOTAL_TIME_SECONDS = 300


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


def _elapsed_seconds_since(started_at: Optional[datetime]) -> float:
    if not started_at:
        return 0
    return max(0, (_now() - _as_utc(started_at)).total_seconds())


def _total_time_seconds(game: dict) -> int:
    return int(game.get("totalTimeSeconds") or DEFAULT_TOTAL_TIME_SECONDS)


def _speed_bonus(game: dict, elapsed_seconds: int) -> int:
    total_seconds = max(1, _total_time_seconds(game))
    remaining_ratio = max(0, min(1, (total_seconds - elapsed_seconds) / total_seconds))
    return int(round(MAX_SPEED_BONUS * remaining_ratio))


def _is_admin(user: dict) -> bool:
    return can_manage_content(user)


def _is_super_admin(user: dict) -> bool:
    return user.get("role") == "SUPER_ADMIN"


async def _broadcast_mini_game_event(event: str, game: Optional[dict] = None, title: Optional[str] = None) -> None:
    payload = {
        "type": "mini_game_event",
        "data": {
            "event": event,
        },
    }
    if title:
        payload["title"] = title
    if game:
        payload["data"].update({
            "gameId": str(game["_id"]),
            "status": game.get("status"),
            "activeQuestionIndex": game.get("activeQuestionIndex", -1),
        })
    await manager.broadcast(payload)


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


async def _auto_advance_if_expired(game: dict) -> dict:
    return game


def _game_filter_for_user(game_id: Optional[str], current_user: dict) -> dict:
    query = {"isDeleted": {"$ne": True}}
    if game_id:
        query["_id"] = validate_object_id(game_id, "Mini game ID")

    if not _is_admin(current_user):
        query["status"] = "LIVE"
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
        "startedAt": _serialize_datetime(game.get("questionStartedAt")),
        "endedAt": _serialize_datetime(game.get("endedAt")),
        "totalTimeSeconds": _total_time_seconds(game),
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


def _ensure_can_view_dashboard(current_user: dict) -> None:
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail=ADMIN_ONLY)


async def _build_leaderboard(game_id: str, limit: int = 10) -> list:
    answers = await db.mini_game_answers.find({"gameId": game_id}).to_list(100000)
    submissions = await db.mini_game_submissions.find({"gameId": game_id}).to_list(100000)
    submissions_by_user = {submission.get("userId"): submission for submission in submissions}
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
                "baseScore": 0,
                "speedBonus": 0,
                "correctCount": 0,
                "answeredCount": 0,
                "questionCount": 0,
                "lastAnsweredAt": answer.get("answeredAt"),
                "submittedAt": None,
                "elapsedSeconds": None,
            },
        )
        row["score"] += int(answer.get("score", 0))
        row["correctCount"] += 1 if answer.get("isCorrect") else 0
        row["answeredCount"] += 1
        if answer.get("answeredAt") and (
            not row.get("lastAnsweredAt") or answer["answeredAt"] > row["lastAnsweredAt"]
        ):
            row["lastAnsweredAt"] = answer["answeredAt"]

    for user_id, submission in submissions_by_user.items():
        row = grouped.setdefault(
            user_id,
            {
                "userId": user_id,
                "userName": submission.get("userName"),
                "department": submission.get("department"),
                "score": int(submission.get("score", 0)),
                "baseScore": int(submission.get("baseScore", 0)),
                "speedBonus": int(submission.get("speedBonus", 0)),
                "correctCount": int(submission.get("correctCount", 0)),
                "answeredCount": int(submission.get("answeredCount", 0)),
                "questionCount": int(submission.get("questionCount", 0)),
                "lastAnsweredAt": None,
                "submittedAt": submission.get("submittedAt"),
                "elapsedSeconds": submission.get("elapsedSeconds"),
            },
        )
        row["score"] = int(submission.get("score", row["score"]))
        row["baseScore"] = int(submission.get("baseScore", row.get("baseScore", 0)))
        row["speedBonus"] = int(submission.get("speedBonus", row.get("speedBonus", 0)))
        row["correctCount"] = int(submission.get("correctCount", row["correctCount"]))
        row["answeredCount"] = int(submission.get("answeredCount", row["answeredCount"]))
        row["questionCount"] = int(submission.get("questionCount", row.get("questionCount", 0)))
        row["submittedAt"] = submission.get("submittedAt")
        row["elapsedSeconds"] = submission.get("elapsedSeconds")

    leaderboard = [row for row in grouped.values() if row.get("submittedAt")]
    leaderboard.sort(key=lambda row: (-row["correctCount"], -row["score"], _sort_timestamp(row.get("submittedAt") or row.get("lastAnsweredAt"))))

    for rank, row in enumerate(leaderboard, start=1):
        row["rank"] = rank

    return leaderboard[:limit]


async def _build_game_stats(game: dict) -> dict:
    game_id = str(game["_id"])
    questions = game.get("questions", [])
    answers = await db.mini_game_answers.find({"gameId": game_id}).to_list(100000)
    submissions = await db.mini_game_submissions.find({"gameId": game_id}).to_list(100000)
    participants = {answer.get("userId") for answer in answers if answer.get("userId")}
    participants.update(submission.get("userId") for submission in submissions if submission.get("userId"))
    total_answers = len(answers)
    correct_answers = sum(1 for answer in answers if answer.get("isCorrect"))
    scores_by_user: dict[str, int] = {
        submission.get("userId"): int(submission.get("score", 0))
        for submission in submissions
        if submission.get("userId")
    }

    question_stats = []
    for index, question in enumerate(questions):
        option_count = len(question.get("options", []))
        question_answers = [answer for answer in answers if int(answer.get("questionIndex", -1)) == index]
        question_correct = sum(1 for answer in question_answers if answer.get("isCorrect"))
        option_counts = [0] * option_count

        for answer in question_answers:
            option_index = int(answer.get("optionIndex", -1))
            if 0 <= option_index < option_count:
                option_counts[option_index] += 1

        answered_count = len(question_answers)
        question_stats.append({
            "questionIndex": index,
            "prompt": question.get("prompt"),
            "answeredCount": answered_count,
            "correctCount": question_correct,
            "accuracyRate": round((question_correct / answered_count) * 100, 1) if answered_count else 0,
            "optionCounts": option_counts,
        })

    if not scores_by_user:
        for answer in answers:
            user_id = answer.get("userId")
            if not user_id:
                continue
            scores_by_user[user_id] = scores_by_user.get(user_id, 0) + int(answer.get("score", 0))

    total_score = sum(scores_by_user.values())
    participant_count = len(participants)

    return {
        "gameId": game_id,
        "participantCount": participant_count,
        "questionCount": len(questions),
        "totalAnswers": total_answers,
        "correctAnswers": correct_answers,
        "accuracyRate": round((correct_answers / total_answers) * 100, 1) if total_answers else 0,
        "averageScore": round(total_score / participant_count, 1) if participant_count else 0,
        "maxScore": max(scores_by_user.values()) if scores_by_user else 0,
        "questionStats": question_stats,
    }


async def _build_submission(game: dict, current_user: dict, submitted_at: Optional[datetime] = None) -> dict:
    game_id = str(game["_id"])
    submitted_at = submitted_at or _now()
    answers = await db.mini_game_answers.find({
        "gameId": game_id,
        "userId": current_user["_id"],
    }).to_list(10000)
    correct_count = sum(1 for answer in answers if answer.get("isCorrect"))
    started_at = game.get("questionStartedAt")
    elapsed_seconds = int(min(_elapsed_seconds_since(started_at), _total_time_seconds(game))) if started_at else 0
    base_score = correct_count * MAX_QUESTION_SCORE
    speed_bonus = _speed_bonus(game, elapsed_seconds) if correct_count > 0 else 0
    score = base_score + speed_bonus
    return {
        "gameId": game_id,
        "userId": current_user["_id"],
        "userName": current_user.get("fullName"),
        "department": current_user.get("department"),
        "score": score,
        "baseScore": base_score,
        "speedBonus": speed_bonus,
        "correctCount": correct_count,
        "answeredCount": len(answers),
        "questionCount": len(game.get("questions", [])),
        "elapsedSeconds": elapsed_seconds,
        "submittedAt": submitted_at,
        "updatedAt": submitted_at,
    }


async def _submit_game_for_user(game: dict, current_user: dict) -> dict:
    game_id = str(game["_id"])
    existing = await db.mini_game_submissions.find_one({
        "gameId": game_id,
        "userId": current_user["_id"],
    })
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing

    submission = await _build_submission(game, current_user)
    await db.mini_game_submissions.update_one(
        {"gameId": game_id, "userId": current_user["_id"]},
        {"$set": submission},
        upsert=True,
    )
    return submission


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
    if not game and _is_admin(current_user):
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
    await _broadcast_mini_game_event("settings_updated")
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
        "totalTimeSeconds": payload.totalTimeSeconds,
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
    await _broadcast_mini_game_event("created", data)
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
    if payload.totalTimeSeconds is not None:
        update_data["totalTimeSeconds"] = payload.totalTimeSeconds

    if not update_data:
        raise HTTPException(status_code=400, detail="Khong co du lieu cap nhat")

    update_data["updatedAt"] = _now()
    await db.mini_games.update_one({"_id": game["_id"]}, {"$set": update_data})
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    await _broadcast_mini_game_event("updated", updated or game)
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/start")
async def start_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)

    if not game.get("questions"):
        raise HTTPException(status_code=400, detail="Mini game can co it nhat 1 cau hoi")

    now = _now()
    await db.mini_game_answers.delete_many({"gameId": game_id})
    await db.mini_game_submissions.delete_many({"gameId": game_id})
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {
            "status": "LIVE",
            "activeQuestionIndex": -1,
            "questionStartedAt": now,
            "endedAt": None,
            "updatedAt": now,
        }},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    await _broadcast_mini_game_event("started", updated or game, title="Mini Game da bat dau")
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/next")
async def next_question(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    raise HTTPException(status_code=400, detail="Che do thoi gian chung khong can chuyen cau tu ban to chuc")


@router.post("/{game_id}/replay")
async def replay_question(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    raise HTTPException(status_code=400, detail="Che do thoi gian chung khong can phat lai tung cau")


@router.post("/{game_id}/finish")
async def finish_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    now = _now()
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"status": "FINISHED", "endedAt": now, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    await _broadcast_mini_game_event("finished", updated or game)
    return await _serialize_game(updated, current_user)


@router.post("/{game_id}/reset")
async def reset_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    now = _now()
    await db.mini_game_answers.delete_many({"gameId": game_id})
    await db.mini_game_submissions.delete_many({"gameId": game_id})
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {"status": "WAITING", "activeQuestionIndex": -1, "questionStartedAt": None, "endedAt": None, "updatedAt": now}},
    )
    updated = await db.mini_games.find_one({"_id": game["_id"]})
    await _broadcast_mini_game_event("reset", updated or game)
    return await _serialize_game(updated, current_user)


@router.delete("/{game_id}")
async def delete_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_manage_game(game, current_user)
    now = _now()
    answers_result = await db.mini_game_answers.delete_many({"gameId": game_id})
    await db.mini_game_submissions.delete_many({"gameId": game_id})
    await db.mini_games.update_one(
        {"_id": game["_id"]},
        {"$set": {
            "isDeleted": True,
            "status": "FINISHED",
            "questionStartedAt": None,
            "deletedAt": now,
            "updatedAt": now,
        }},
    )
    await _broadcast_mini_game_event("deleted", game)
    return {
        "status": "success",
        "message": "Mini game da duoc xoa",
        "deletedAnswers": answers_result.deleted_count,
    }


@router.get("/{game_id}/state")
async def get_mini_game_state(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    game = await _auto_advance_if_expired(game)
    game_id_str = str(game["_id"])
    remaining_seconds = 0
    if game.get("status") == "LIVE" and game.get("questionStartedAt"):
        remaining_seconds = max(0, int(_total_time_seconds(game) - _elapsed_seconds_since(game.get("questionStartedAt"))))

    my_answers = await db.mini_game_answers.find({
        "gameId": game_id_str,
        "userId": current_user["_id"],
    }).to_list(10000)
    my_submission = await db.mini_game_submissions.find_one({
        "gameId": game_id_str,
        "userId": current_user["_id"],
    })

    can_view_dashboard = _is_admin(current_user)
    leaderboard = await _build_leaderboard(game_id_str, limit=50) if can_view_dashboard else []
    stats = await _build_game_stats(game) if can_view_dashboard else None
    show_results = can_view_dashboard or game.get("status") == "FINISHED" or bool(my_submission)
    return {
        "game": await _serialize_game(game, current_user, include_questions=can_view_dashboard or game.get("status") == "LIVE"),
        "serverTime": _serialize_datetime(_now()),
        "activeQuestion": None,
        "remainingSeconds": remaining_seconds,
        "myAnswer": None,
        "myAnswers": [
            {
                "questionIndex": answer.get("questionIndex"),
                "optionIndex": answer.get("optionIndex"),
                "isCorrect": answer.get("isCorrect") if show_results else None,
                "score": answer.get("score") if show_results else None,
                "answeredAt": answer.get("answeredAt"),
            }
            for answer in my_answers
        ],
        "mySubmission": {
            "score": my_submission.get("score"),
            "baseScore": my_submission.get("baseScore"),
            "speedBonus": my_submission.get("speedBonus"),
            "correctCount": my_submission.get("correctCount"),
            "answeredCount": my_submission.get("answeredCount"),
            "questionCount": my_submission.get("questionCount"),
            "elapsedSeconds": my_submission.get("elapsedSeconds"),
            "submittedAt": my_submission.get("submittedAt"),
        } if my_submission else None,
        "leaderboard": leaderboard,
        "stats": stats,
    }


@router.post("/{game_id}/answers")
async def answer_question(game_id: str, payload: MiniGameAnswerCreate, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    game = await _auto_advance_if_expired(game)
    if game.get("status") != "LIVE":
        raise HTTPException(status_code=400, detail="Mini game chua bat dau hoac da ket thuc")

    if payload.questionIndex is None:
        raise HTTPException(status_code=400, detail="Can chon cau hoi de tra loi")

    if await db.mini_game_submissions.find_one({"gameId": str(game["_id"]), "userId": current_user["_id"]}):
        raise HTTPException(status_code=400, detail="Ban da nop bai, khong the thay doi dap an")

    started_at = game.get("questionStartedAt")
    if not started_at:
        raise HTTPException(status_code=400, detail="Bai thi chua duoc bat dau")
    elapsed_seconds = max(0, (_now() - _as_utc(started_at)).total_seconds())
    if elapsed_seconds > _total_time_seconds(game) + 2:
        raise HTTPException(status_code=400, detail="Da het thoi gian lam bai")

    questions = game.get("questions", [])
    question_index = int(payload.questionIndex)
    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Cau hoi khong hop le")

    question = questions[question_index]
    if payload.optionIndex >= len(question.get("options", [])):
        raise HTTPException(status_code=400, detail="Dap an khong hop le")

    answered_at = _now()
    correct_index = int(question.get("correctOptionIndex"))
    is_correct = payload.optionIndex == correct_index
    score = min(int(question.get("points", MAX_QUESTION_SCORE)), MAX_QUESTION_SCORE) if is_correct else 0

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

    await db.mini_game_answers.update_one(
        {"gameId": str(game["_id"]), "questionIndex": question_index, "userId": current_user["_id"]},
        {"$set": answer_doc},
        upsert=True,
    )

    return {
        "status": "success",
        "questionIndex": question_index,
        "optionIndex": payload.optionIndex,
    }


@router.post("/{game_id}/submit")
async def submit_mini_game(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    if game.get("status") != "LIVE":
        existing = await db.mini_game_submissions.find_one({
            "gameId": str(game["_id"]),
            "userId": current_user["_id"],
        })
        if existing:
            return {
                "status": "already_submitted",
                "score": existing.get("score"),
                "baseScore": existing.get("baseScore"),
                "speedBonus": existing.get("speedBonus"),
                "correctCount": existing.get("correctCount"),
                "answeredCount": existing.get("answeredCount"),
                "questionCount": existing.get("questionCount"),
                "elapsedSeconds": existing.get("elapsedSeconds"),
            }
        raise HTTPException(status_code=400, detail="Mini game chua bat dau hoac da ket thuc")

    submission = await _submit_game_for_user(game, current_user)
    await _broadcast_mini_game_event("submitted", game)
    return {
        "status": "success",
        "score": submission.get("score"),
        "baseScore": submission.get("baseScore"),
        "speedBonus": submission.get("speedBonus"),
        "correctCount": submission.get("correctCount"),
        "answeredCount": submission.get("answeredCount"),
        "questionCount": submission.get("questionCount"),
        "elapsedSeconds": submission.get("elapsedSeconds"),
    }


@router.get("/{game_id}/leaderboard")
async def get_leaderboard(
    game_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_view_dashboard(current_user)
    return {
        "gameId": str(game["_id"]),
        "leaderboard": await _build_leaderboard(str(game["_id"]), limit=limit),
    }


@router.get("/{game_id}/stats")
async def get_mini_game_stats(game_id: str, current_user: dict = Depends(get_current_user)):
    await _ensure_feature_available(current_user)
    game = await _get_game_or_404(game_id, current_user)
    _ensure_can_view_dashboard(current_user)
    return await _build_game_stats(game)
