import os
import cloudinary
import cloudinary.uploader
import re
import asyncio

# Setup cloudinary config
cloudinary.config(
    cloud_name="dljjearo2",
    api_key="457657369946697",
    api_secret="R9pxfK5tIxjG3N3g1LDvXClJkrc"
)

def test_extract(file_url):
    print(f"\nTesting URL: {file_url}")
    if not file_url or "cloudinary.com" not in file_url:
        print("Not a cloudinary URL")
        return

    match = re.search(r'/upload/(?:v\d+/)?(.*?)$', file_url)
    if match:
        full_path = match.group(1) 
        print(f"Full path extracted: {full_path}")
        
        is_document = bool(re.search(r'\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$', full_path, re.IGNORECASE))
        print(f"Is Document: {is_document}")
        
        public_id = full_path
        resource_type = "raw" if is_document else "image"
        
        if resource_type == "image":
            # For images, we need to strip extension
            public_id = os.path.splitext(full_path)[0]

        print(f"Final public_id to destroy: {public_id}")
        print(f"Resource type to destroy: {resource_type}")
        
        try:
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            print(f"Destroy Result: {result}")
        except Exception as e:
            print(f"Exception: {e}")
    else:
        print("Regex did not match")

urls = [
    # Image example
    "https://res.cloudinary.com/dljjearo2/image/upload/v1714013442/cong-doan-docs/test_image.jpg",
    # Auto upload document example (PDF)
    "https://res.cloudinary.com/dljjearo2/auto/upload/v1714013455/cong-doan-docs/test_document.pdf"
]

for url in urls:
    test_extract(url)

