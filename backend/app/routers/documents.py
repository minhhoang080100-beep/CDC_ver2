from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.document import DocumentCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(None, description="Search by title or category"),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
    
    # Add search filter if provided
    if search:
        search_filter = {
            "$or": [
                {"title": {"$regex": search, "$options": "i"}},
                {"category": {"$regex": search, "$options": "i"}}
            ]
        }
        if content_filter:
            content_filter = {"$and": [content_filter, search_filter]}
        else:
            content_filter = search_filter
    
    documents = await db.documents.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    return [{
        "id": str(doc["_id"]),
        "title": doc["title"],
        "category": doc["category"],
        "fileSize": doc["fileSize"],
        "fileUrl": doc.get("fileUrl"),
        "uploadedBy": doc["uploadedBy"],
        "targetDepartments": doc.get("targetDepartments", ["ALL"]),
        "createdAt": doc["createdAt"]
    } for doc in documents]

@router.post("")
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create documents")
    
    target_departments = resolve_target_departments(current_user, document.targetDepartments)
    
    document_data = {
        "title": document.title,
        "category": document.category,
        "fileSize": document.fileSize,
        "fileUrl": document.fileUrl,
        "uploadedBy": current_user["_id"],
        "targetDepartments": target_departments,
        "createdAt": datetime.utcnow()
    }
    
    result = await db.documents.insert_one(document_data)
    document_data["_id"] = result.inserted_id
    
    return {
        "id": str(document_data["_id"]),
        **{k: v for k, v in document_data.items() if k != "_id"}
    }

@router.put("/{document_id}")
async def update_document(document_id: str, document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    existing_document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not existing_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_document["uploadedBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this document")
    
    target_departments = resolve_target_departments(current_user, document.targetDepartments)
    
    update_data = {
        "title": document.title,
        "category": document.category,
        "fileSize": document.fileSize,
        "fileUrl": document.fileUrl,
        "targetDepartments": target_departments,
        "updatedAt": datetime.utcnow()
    }
    
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": update_data}
    )
    
    return {
        "id": document_id,
        **update_data
    }

@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    existing_document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not existing_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_document["uploadedBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this document")
    
    await db.documents.delete_one({"_id": ObjectId(document_id)})
    
    return {"status": "success", "message": "Document deleted"}
