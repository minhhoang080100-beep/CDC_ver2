from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from pydantic import BaseModel

router = APIRouter()


class CommentCreate(BaseModel):
    content: str


@router.get("/{post_id}")
async def get_comments(
    post_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    post_oid = validate_object_id(post_id)
    post = await db.posts.find_one({"_id": post_oid, "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    total = await db.comments.count_documents({"postId": post_id})
    comments = await db.comments.find({"postId": post_id}).sort(
        "createdAt", -1
    ).skip(skip).limit(limit).to_list(limit)

    items = [{
        "id": str(c["_id"]),
        "postId": c["postId"],
        "userId": c["userId"],
        "userName": c["userName"],
        "userDepartment": c["userDepartment"],
        "content": c["content"],
        "createdAt": c["createdAt"]
    } for c in comments]

    return {"items": items, "total": total, "hasMore": skip + limit < total}


@router.post("/{post_id}")
async def create_comment(
    post_id: str,
    comment: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    post_oid = validate_object_id(post_id)
    post = await db.posts.find_one({"_id": post_oid, "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    comment_data = {
        "postId": post_id,
        "userId": str(current_user["_id"]),
        "userName": current_user["fullName"],
        "userDepartment": current_user["department"],
        "content": comment.content,
        "createdAt": datetime.now(timezone.utc)
    }

    result = await db.comments.insert_one(comment_data)

    # Also keep a copy in post.comments for backward compatibility
    embedded_comment = {
        "id": str(result.inserted_id),
        "userId": comment_data["userId"],
        "userName": comment_data["userName"],
        "userDepartment": comment_data["userDepartment"],
        "content": comment_data["content"],
        "createdAt": comment_data["createdAt"]
    }
    await db.posts.update_one(
        {"_id": post_oid},
        {"$push": {"comments": embedded_comment}}
    )

    return {
        "id": str(result.inserted_id),
        **{k: v for k, v in comment_data.items() if k != "_id"}
    }


@router.delete("/{post_id}/{comment_id}")
async def delete_comment(
    post_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    post_oid = validate_object_id(post_id)
    comment_oid = validate_object_id(comment_id)

    comment = await db.comments.find_one({"_id": comment_oid, "postId": post_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Bình luận không tồn tại")

    if comment["userId"] != str(current_user["_id"]) and current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bình luận này")

    await db.comments.delete_one({"_id": comment_oid})

    # Also remove from embedded comments
    await db.posts.update_one(
        {"_id": post_oid},
        {"$pull": {"comments": {"id": comment_id}}}
    )

    return {"status": "success", "message": "Đã xóa bình luận"}
