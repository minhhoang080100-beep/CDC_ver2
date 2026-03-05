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
        # Extract resource_type and full_path directly from the URL
        # Example: https://res.cloudinary.com/cloudname/image/upload/v1234/folder/file.pdf
        match = re.search(r'/res\.cloudinary\.com/[^/]+/(image|raw|video|auto)/upload/(?:v\d+/)?(.*?)$', file_url)
        if match:
            url_resource_type = match.group(1)
            full_path = match.group(2) # e.g. folder/filename.pdf
            
            # Determine public_id and resource_type based on the URL's classification
            if url_resource_type in ["image", "video"]:
                # Images and videos exclude the extension in Cloudinary public_id
                public_id = os.path.splitext(full_path)[0]
                resource_type = url_resource_type
            else:
                # Raw files include the extension in public_id
                public_id = full_path
                resource_type = url_resource_type
                
                # If it was uploaded as "auto" and returned as "auto" (rare, but possible)
                if resource_type == "auto":
                    is_document = bool(re.search(r'\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$', full_path, re.IGNORECASE))
                    resource_type = "raw" if is_document else "image"
                    if resource_type == "image":
                        public_id = os.path.splitext(full_path)[0]

            logger.info(f"Attempting to delete Cloudinary asset: {public_id}, resource_type: {resource_type}")
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            logger.info(f"Cloudinary deletion result: {result}")
            
            # Smart fallback: Sometimes raw files are misclassified as image or vice versa by auto/upload
            if result.get("result") == "not found":
                logger.info("Asset not found with URL's resource type. Trying fallback...")
                fallback_type = "image" if resource_type == "raw" else "raw"
                fallback_id = os.path.splitext(full_path)[0] if fallback_type == "image" else full_path
                fallback_result = cloudinary.uploader.destroy(fallback_id, resource_type=fallback_type)
                logger.info(f"Fallback deletion result: {fallback_result}")
                return fallback_result
                
            return result
    except Exception as e:
        logger.error(f"Error deleting Cloudinary asset from URL {file_url}: {e}")

async def delete_cloudinary_asset(file_url: str):
    """
    Asynchronously delete a Cloudinary asset without blocking the event loop.
    Uses asyncio.to_thread (Python 3.9+) instead of deprecated run_in_executor.
    """
    if not file_url:
        return

    await asyncio.to_thread(delete_cloudinary_asset_sync, file_url)
