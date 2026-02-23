from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.models.document import DocumentCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_documents(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["SUPER_ADMIN", "BCH_VANPHONG"]:
        documents = await db.documents.find().sort("createdAt", -1).to_list(100)
    elif current_user["role"].startswith("BCH_"):
        documents = await db.documents.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    else:
        documents = await db.documents.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    
    return [{
        "id": str(doc["_id"]),
        "title": doc["title"],
        "category": doc["category"],
        "fileSize": doc["fileSize"],
        "uploadedBy": doc["uploadedBy"],
        "targetDepartments": doc.get("targetDepartments", ["ALL"]),
        "createdAt": doc["createdAt"]
    } for doc in documents]

@router.post("")
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to create documents")
    
    target_departments = document.targetDepartments
    
    if current_user["role"] == "BCH_CUALO":
        target_departments = ["CUA_LO", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_BENTHUY":
        target_departments = ["BEN_THUY", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_VANPHONG" and not target_departments:
        target_departments = ["ALL"]
    
    document_data = {
        "title": document.title,
        "category": document.category,
        "fileSize": document.fileSize,
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

@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    existing_document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not existing_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_document["uploadedBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this document")
    
    await db.documents.delete_one({"_id": ObjectId(document_id)})
    
    return {"status": "success", "message": "Document deleted"}
