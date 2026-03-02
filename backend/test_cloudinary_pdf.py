import os
import cloudinary
import cloudinary.api

cloudinary.config(
    cloud_name="dljjearo2",
    api_key="457657369946697",
    api_secret="R9pxfK5tIxjG3N3g1LDvXClJkrc"
)

# Search for the asset we just saw in the logs
try:
    print("Searching for resource xixroy7jrvkl9af3bxeh (image type)...")
    res1 = cloudinary.api.resource("cong-doan-docs/xixroy7jrvkl9af3bxeh", resource_type="image")
    print("Found as image!")
    print(res1)
except Exception as e:
    print(f"Not found as image: {e}")

try:
    print("\nSearching for resource xixroy7jrvkl9af3bxeh.pdf (raw type)...")
    res2 = cloudinary.api.resource("cong-doan-docs/xixroy7jrvkl9af3bxeh.pdf", resource_type="raw")
    print("Found as raw!")
    print(res2)
except Exception as e:
    print(f"Not found as raw: {e}")
