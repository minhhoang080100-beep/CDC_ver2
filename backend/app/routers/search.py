from fastapi import APIRouter, Depends, Query
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter

router = APIRouter()


@router.get("")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: str = Query("all", description="Search type: all, posts, documents"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    results = []
    content_filter = build_content_filter(current_user)

    if type in ("all", "posts"):
        post_filter = {
            "$text": {"$search": q},
            "isDeleted": {"$ne": True}
        }
        if content_filter:
            post_filter = {"$and": [post_filter, content_filter]}

        posts = await db.posts.find(
            post_filter,
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).skip(skip).limit(limit).to_list(limit)

        for p in posts:
            results.append({
                "id": str(p["_id"]),
                "type": "post",
                "title": p["title"],
                "summary": p.get("summary", ""),
                "category": p.get("category", ""),
                "createdAt": p.get("createdAt")
            })

    if type in ("all", "documents"):
        doc_filter = {"$text": {"$search": q}}
        if content_filter:
            doc_filter = {"$and": [doc_filter, content_filter]}

        docs = await db.documents.find(
            doc_filter,
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).skip(skip).limit(limit).to_list(limit)

        for d in docs:
            results.append({
                "id": str(d["_id"]),
                "type": "document",
                "title": d["title"],
                "category": d.get("category", ""),
                "createdAt": d.get("createdAt")
            })

    return {"items": results, "query": q}
