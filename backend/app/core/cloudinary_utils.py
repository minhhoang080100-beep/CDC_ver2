import cloudinary
import cloudinary.uploader
import re
import os
import logging
import asyncio

logger = logging.getLogger(__name__)

def delete_cloudinary_asset_sync(file_url: str):
    """
    Synchronously extracts the public_id from a Cloudinary URL and deletes the asset.
    """
    if not file_url or "cloudinary.com" not in file_url:
        return

    try:
        # Extract everything after `/upload/` (ignoring version like `v1234567890/`)
        match = re.search(r'/upload/(?:v\d+/)?(.*?)$', file_url)
        if match:
            full_path = match.group(1) # e.g. folder/filename.pdf
            
            # Check if it's a document/raw file based on typical extensions
            is_document = bool(re.search(r'\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$', full_path, re.IGNORECASE))
            
            public_id = full_path
            resource_type = "raw" if is_document else "image"
            
            # For images, Cloudinary usually expects the public_id WITHOUT the extension
            if resource_type == "image":
                public_id = os.path.splitext(full_path)[0]

            logger.info(f"Attempting to delete Cloudinary asset: {public_id}, resource_type: {resource_type}")
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            logger.info(f"Cloudinary deletion result: {result}")
            return result
    except Exception as e:
        logger.error(f"Error deleting Cloudinary asset from URL {file_url}: {e}")

async def delete_cloudinary_asset(file_url: str):
    """
    Asynchronously wrappers for deleting a Cloudinary asset to avoid blocking the event loop.
    """
    if not file_url:
        return
        
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, delete_cloudinary_asset_sync, file_url)

