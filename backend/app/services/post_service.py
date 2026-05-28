"""
Post service — business logic extracted from posts router.
"""

from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import db
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.core.push import send_bulk_push_notifications_async
from app.core.cloudinary_utils import delete_cloudinary_asset


def _normalize_images(post: dict) -> list:
    """Backward compat: convert old single `image` field to `images` list."""
    images = post.get("images")
    if images:
        return images
    old_image = post.get("image")
    if old_image:
        return [old_image]
    return []


def _cloudinary_url(value: Optional[str]) -> Optional[str]:
    if value and "cloudinary.com" in value:
        return value
    return None


def _to_object_id(value):
    value_str = str(value or "")
    if not ObjectId.is_valid(value_str):
        return None
    return ObjectId(value_str)


def _collect_post_user_ids(posts: list) -> set:
    user_ids = set()
    for post in posts:
        author_id = post.get("authorId")
        if author_id:
            user_ids.add(str(author_id))

        for comment in post.get("comments", []) or []:
            user_id = comment.get("userId")
            if user_id:
                user_ids.add(str(user_id))

    return user_ids


async def _build_user_lookup(user_ids: set) -> dict:
    object_ids = []
    seen = set()
    for user_id in user_ids:
        oid = _to_object_id(user_id)
        if oid and oid not in seen:
            object_ids.append(oid)
            seen.add(oid)

    if not object_ids:
        return {}

    users = await db.users.find(
        {"_id": {"$in": object_ids}},
        {"fullName": 1, "department": 1, "avatar": 1}
    ).to_list(len(object_ids))

    return {str(user["_id"]): user for user in users}


def _serialize_comment(comment: dict, users_by_id: dict) -> dict:
    user_id = str(comment.get("userId", ""))
    user = users_by_id.get(user_id, {})

    return {
        **comment,
        "id": str(comment.get("id") or comment.get("_id") or ""),
        "userId": user_id,
        "userName": user.get("fullName") or comment.get("userName", ""),
        "userDepartment": user.get("department") or comment.get("userDepartment", ""),
        "userAvatar": user.get("avatar") or comment.get("userAvatar", ""),
    }


def _serialize_post(post: dict, users_by_id: dict) -> dict:
    author_id = str(post.get("authorId", ""))
    author = users_by_id.get(author_id, {})

    return {
        "id": str(post["_id"]),
        "title": post.get("title", ""),
        "content": post.get("content", ""),
        "summary": post.get("summary", ""),
        "category": post.get("category", "Thông báo"),
        "images": _normalize_images(post),
        "videoUrl": post.get("videoUrl"),
        "authorId": author_id,
        "authorName": author.get("fullName") or post.get("authorName", "Ẩn danh"),
        "authorDepartment": author.get("department") or post.get("authorDepartment", ""),
        "authorAvatar": author.get("avatar") or post.get("authorAvatar", ""),
        "targetDepartments": post.get("targetDepartments", ["ALL"]),
        "likes": post.get("likes", []),
        "comments": [_serialize_comment(comment, users_by_id) for comment in post.get("comments", []) or []],
        "createdAt": post.get("createdAt", datetime.now(timezone.utc)),
        "updatedAt": post.get("updatedAt", datetime.now(timezone.utc))
    }


async def get_posts(skip: int, limit: int, cursor, current_user: dict):
    content_filter = build_content_filter(current_user)
    content_filter["isDeleted"] = {"$ne": True}

    if cursor:
        content_filter["createdAt"] = {"$lt": cursor}

    total = await db.posts.count_documents(content_filter)
    posts = await db.posts.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    items = [{
        "id": str(post["_id"]),
        "title": post.get("title", ""),
        "content": post.get("content", ""),
        "summary": post.get("summary", ""),
        "category": post.get("category", "Thông báo"),
        "images": _normalize_images(post),
        "videoUrl": post.get("videoUrl"),
        "authorId": post.get("authorId", ""),
        "authorName": post.get("authorName", "Ẩn danh"),
        "authorDepartment": post.get("authorDepartment", ""),
        "targetDepartments": post.get("targetDepartments", ["ALL"]),
        "likes": post.get("likes", []),
        "comments": post.get("comments", []),
        "createdAt": post.get("createdAt", datetime.now(timezone.utc)),
        "updatedAt": post.get("updatedAt", datetime.now(timezone.utc))
    } for post in posts]

    users_by_id = await _build_user_lookup(_collect_post_user_ids(posts))
    items = [_serialize_post(post, users_by_id) for post in posts]

    return {"items": items, "total": total, "hasMore": skip + limit < total}


async def get_post(post_id: str, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")

    content_filter = build_content_filter(current_user)
    content_filter["_id"] = oid
    content_filter["isDeleted"] = {"$ne": True}

    post = await db.posts.find_one(content_filter)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    users_by_id = await _build_user_lookup(_collect_post_user_ids([post]))
    return _serialize_post(post, users_by_id)


async def create_post(post_data: dict, current_user: dict):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create posts")

    target_departments = resolve_target_departments(current_user, post_data.get("targetDepartments", []))

    doc = {
        "title": post_data["title"],
        "content": post_data["content"],
        "summary": post_data["summary"],
        "category": post_data["category"],
        "images": post_data.get("images", []),
        "videoUrl": post_data.get("videoUrl"),
        "authorId": current_user["_id"],
        "authorName": current_user["fullName"],
        "authorDepartment": current_user["department"],
        "authorAvatar": current_user.get("avatar", ""),
        "targetDepartments": target_departments,
        "likes": [],
        "comments": [],
        "isDeleted": False,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }

    result = await db.posts.insert_one(doc)
    doc["_id"] = result.inserted_id

    return doc, target_departments


async def update_post(post_id: str, post_data: dict, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    existing_post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")

    if current_user["role"] != "SUPER_ADMIN" and existing_post.get("authorId") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this post")

    target_departments = resolve_target_departments(current_user, post_data.get("targetDepartments", []))

    # Detect removed media for Cloudinary cleanup
    old_images = set(_normalize_images(existing_post))
    new_images = set(post_data.get("images", []))
    assets_to_delete = list(old_images - new_images)

    old_video = existing_post.get("videoUrl")
    new_video = post_data.get("videoUrl")
    if old_video and old_video != new_video:
        old_cloudinary_video = _cloudinary_url(old_video)
        if old_cloudinary_video:
            assets_to_delete.append(old_cloudinary_video)

    update_data = {
        "title": post_data["title"],
        "content": post_data["content"],
        "summary": post_data["summary"],
        "category": post_data["category"],
        "images": post_data.get("images", []),
        "videoUrl": post_data.get("videoUrl"),
        "targetDepartments": target_departments,
        "updatedAt": datetime.now(timezone.utc)
    }

    await db.posts.update_one({"_id": oid}, {"$set": update_data})

    return {"status": "success", "message": "Post updated"}, assets_to_delete


async def delete_post(post_id: str, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    existing_post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")

    if current_user["role"] != "SUPER_ADMIN" and existing_post.get("authorId") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this post")

    assets_to_delete = _normalize_images(existing_post)
    video_to_delete = _cloudinary_url(existing_post.get("videoUrl"))
    if video_to_delete:
        assets_to_delete.append(video_to_delete)

    await db.posts.update_one({"_id": oid}, {"$set": {"isDeleted": True, "images": [], "videoUrl": None}})

    return assets_to_delete  # caller handles async cleanup


async def toggle_like(post_id: str, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_id_str = str(current_user["_id"])
    likes = post.get("likes", [])

    if user_id_str in likes:
        await db.posts.update_one({"_id": oid}, {"$pull": {"likes": user_id_str}})
        action = "unliked"
    else:
        await db.posts.update_one({"_id": oid}, {"$addToSet": {"likes": user_id_str}})
        action = "liked"

    updated = await db.posts.find_one({"_id": oid}, {"likes": 1})

    return {"status": "success", "action": action, "likes": updated.get("likes", [])}


async def notify_new_post(title: str, body: str, target_departments: list, post_id: str):
    query = {"status": "ACTIVE"}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}

    users = await db.users.find(query).to_list(1000)
    if not users:
        return

    # 1. Create internal notifications
    now = datetime.now(timezone.utc)
    notifications = []
    for u in users:
        notifications.append({
            "userId": str(u["_id"]),
            "type": "post",
            "title": title,
            "body": body,
            "data": {"postId": post_id},
            "read": False,
            "createdAt": now
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)

    # 2. Send push notifications
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]
    if tokens:
        await send_bulk_push_notifications_async(
            tokens=tokens,
            title=title,
            body=body,
            data={"postId": post_id}
        )
