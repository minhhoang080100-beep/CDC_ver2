from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.document import DocumentCreate
import cloudinary
import cloudinary.uploader
import os
import re

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
    
    # Extract Cloudinary Public ID and attempt to delete the physical file
    file_url = existing_document.get("fileUrl")
    if file_url and "cloudinary.com" in file_url:
        try:
            # We need to extract the public ID. 
            # A typical cloudinary URL: https://res.cloudinary.com/dljjearo2/auto/upload/v12345/cong-doan-docs/filename.pdf
            # The Public ID here is: cong-doan-docs/filename (without auto/upload/v.. etc, and WITHOUT the extension for images, BUT for raw files often WITH the extension)
            # Actually, the safest way is to regex everything after `/upload/` (ignoring version `v123.../`).
            match = re.search(r'/upload/(?:v\d+/)?(.*?)$', file_url)
            if match:
                full_path = match.group(1) # e.g. cong-doan-docs/r8xz1a.pdf
                
                # If it's a raw file (like PDF), Cloudinary often needs the extension to destroy it, or resource_type="raw"
                is_document = bool(re.search(r'\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$', full_path, re.IGNORECASE))
                
                # Cloudinary's destroy method usually expects public_id WITHOUT extension for images,
                # BUT if we uploaded it as raw or auto, we should test it. Let's try raw first if it's a doc.
                public_id = full_path
                resource_type = "raw" if is_document else "image"
                
                # If it's an image, public ID has no extension. 
                # According to Cloudinary docs, destroy for 'raw' files NEEDS the extension included in the public_id.
                if resource_type == "image":
                    public_id = os.path.splitext(full_path)[0]

                cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        except Exception as e:
            print(f"Error deleting Cloudinary asset: {e}")
            # Non-fatal error, continue to delete the DB record

    await db.documents.delete_one({"_id": ObjectId(document_id)})
    
    return {"status": "success", "message": "Document deleted"}
