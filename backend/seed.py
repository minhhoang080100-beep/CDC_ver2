import sys
import os
from pathlib import Path

# Add project root to sys.path
file_path = Path(__file__).resolve()
root_path = file_path.parent.parent
sys.path.append(str(root_path))

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from backend.app.core.config import settings

# Security Context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed_data():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    users = [
        {
            "username": "superadmin",
            "password": "Admin@123",
            "fullName": "Super Admin",
            "role": "SUPER_ADMIN",
            "department": "Hội sở",
            "unionId": "SA001",
            "phoneNumber": "0900000001",
            "email": "superadmin@example.com",
            "avatar": "https://ui-avatars.com/api/?name=Super+Admin&background=0D8ABC&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "bch_vanphong",
            "password": "VanPhong@123",
            "fullName": "BCH Văn phòng Cảng",
            "role": "BCH_VANPHONG",
            "department": "Văn phòng",
            "unionId": "BCH001",
            "phoneNumber": "0900000002",
            "email": "bch_vp@example.com",
            "avatar": "https://ui-avatars.com/api/?name=BCH+VP&background=10b981&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "bch_cualo",
            "password": "CuaLo@123",
            "fullName": "BCH Cửa Lò",
            "role": "BCH_CUALO",
            "department": "Cảng Cửa Lò",
            "unionId": "BCH002",
            "phoneNumber": "0900000003",
            "email": "bch_cl@example.com",
            "avatar": "https://ui-avatars.com/api/?name=BCH+CL&background=3b82f6&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "bch_benthuy",
            "password": "BenThuy@123",
            "fullName": "BCH Bến Thủy",
            "role": "BCH_BENTHUY",
            "department": "Cảng Bến Thủy",
            "unionId": "BCH003",
            "phoneNumber": "0900000004",
            "email": "bch_bt@example.com",
            "avatar": "https://ui-avatars.com/api/?name=BCH+BT&background=f59e0b&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "tv_vanphong",
            "password": "Member@123",
            "fullName": "Thành viên VP",
            "role": "MEMBER",
            "department": "Văn phòng",
            "unionId": "TV001",
            "phoneNumber": "0900000005",
            "email": "tv_vp@example.com",
            "avatar": "https://ui-avatars.com/api/?name=Mem+VP&background=6366f1&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "tv_cualo",
            "password": "Member@123",
            "fullName": "Thành viên Cửa Lò",
            "role": "MEMBER",
            "department": "Cảng Cửa Lò",
            "unionId": "TV002",
            "phoneNumber": "0900000006",
            "email": "tv_cl@example.com",
            "avatar": "https://ui-avatars.com/api/?name=Mem+CL&background=8b5cf6&color=fff",
            "status": "ACTIVE"
        },
        {
            "username": "tv_benthuy",
            "password": "Member@123",
            "fullName": "Thành viên Bến Thủy",
            "role": "MEMBER",
            "department": "Cảng Bến Thủy",
            "unionId": "TV003",
            "phoneNumber": "0900000007",
            "email": "tv_bt@example.com",
            "avatar": "https://ui-avatars.com/api/?name=Mem+BT&background=ec4899&color=fff",
            "status": "ACTIVE"
        }
    ]

    for user in users:
        # Hash password before checking existence to ensure we have the hash
        hashed_password = hash_password(user["password"])
        user["password"] = hashed_password
        
        existing_user = await db.users.find_one({"username": user["username"]})
        if existing_user:
            await db.users.update_one({"_id": existing_user["_id"]}, {"$set": user})
            print(f"User {user['username']} updated successfully!")
        else:
            await db.users.insert_one(user)
            print(f"User {user['username']} created successfully!")

    # Get Super Admin for authorship
    admin = await db.users.find_one({"username": "superadmin"})
    if not admin:
        print("Super admin not found, skipping content seeding.")
        return

    admin_id = str(admin["_id"])
    admin_name = admin["fullName"]
    admin_dept = admin["department"]

    # Seed Posts
    posts = [
        {
            "title": "Thông báo nghỉ lễ 30/4 - 1/5 (Toàn công ty)",
            "content": "Công ty thông báo lịch nghỉ lễ 30/4 và 1/5 cho toàn thể cán bộ công nhân viên. Thời gian nghỉ từ ngày... Chúc mọi người kỳ nghỉ vui vẻ!",
            "summary": "Lịch nghỉ lễ chi tiết cho CBNV toàn công ty.",
            "category": "Thông báo",
            "image": "https://img.freepik.com/free-vector/vietnamese-reunification-day-background_23-2149336154.jpg",
            "targetDepartments": [], # Public
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-04-20T08:00:00Z",
            "updatedAt": "2024-04-20T08:00:00Z"
        },
        {
            "title": "Triển khai kế hoạch tháng 6 (VP & Cửa Lò)",
            "content": "Kế hoạch hoạt động chi tiết cho tháng 6 bao gồm các mục tiêu về sản lượng...",
            "summary": "Mục tiêu và kế hoạch hành động tháng 6.",
            "category": "Hoạt động",
            "image": "https://img.freepik.com/free-photo/business-people-meeting-office-writing-memo-sticky-notes_53876-13768.jpg",
            "targetDepartments": ["Văn phòng", "Cảng Cửa Lò"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-05-28T09:30:00Z",
            "updatedAt": "2024-05-28T09:30:00Z"
        },
        {
            "title": "Chính sách hỗ trợ đoàn viên khó khăn (Toàn công ty)",
            "content": "Công đoàn công ty ban hành chính sách mới về việc hỗ trợ các đoàn viên có hoàn cảnh khó khăn...",
            "summary": "Chính sách mới về phúc lợi đoàn viên.",
            "category": "Chính sách",
            "image": "https://img.freepik.com/free-vector/charity-logo-hands-supporting-heart-icon-flat-design-vector_53876-136267.jpg",
            "targetDepartments": [],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-06-01T14:00:00Z",
            "updatedAt": "2024-06-01T14:00:00Z"
        },
        {
            "title": "Họp giao ban Văn phòng tháng 7 (Riêng VP)",
            "content": "Mời toàn thể nhân viên khối Văn phòng tham dự cuộc họp giao ban tháng 7...",
            "summary": "Lịch họp giao ban khối Văn phòng.",
            "category": "Thông báo",
            "image": "https://img.freepik.com/free-photo/corporate-workers-brainstorming-together_23-2148804520.jpg",
            "targetDepartments": ["Văn phòng"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-06-25T08:00:00Z",
            "updatedAt": "2024-06-25T08:00:00Z"
        },
        {
            "title": "Bảo trì Cầu cảng số 3 (Riêng Cửa Lò)",
            "content": "Thông báo về việc tạm dừng hoạt động Cầu cảng số 3 để bảo trì định kỳ...",
            "summary": "Lịch bảo trì hạ tầng Cảng Cửa Lò.",
            "category": "Thông báo",
            "image": "https://img.freepik.com/free-photo/container-ship-loading-unloading-port_1150-10946.jpg",
            "targetDepartments": ["Cảng Cửa Lò"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-06-28T09:00:00Z",
            "updatedAt": "2024-06-28T09:00:00Z"
        },
        {
            "title": "Kế hoạch nạo vét luồng (Riêng Bến Thủy)",
            "content": "Kế hoạch chi tiết về việc nạo vét luồng lạch tại khu vực Cảng Bến Thủy...",
            "summary": "Đảm bảo độ sâu luồng cho tàu ra vào.",
            "category": "Hoạt động",
            "image": "https://img.freepik.com/free-photo/excavator-working-construction-site_1150-11204.jpg",
            "targetDepartments": ["Cảng Bến Thủy"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-06-29T10:00:00Z",
            "updatedAt": "2024-06-29T10:00:00Z"
        },
        # More test data for specific combinations
        {
            "title": "Đào tạo kỹ năng mềm (Văn phòng & Bến Thủy)",
            "content": "Chương trình đào tạo kỹ năng giao tiếp và làm việc nhóm...",
            "summary": "Khóa học kỹ năng cho VP và BT.",
            "category": "Đào tạo",
            "image": "https://img.freepik.com/free-vector/business-team-discussing-ideas-startup_74855-4380.jpg",
            "targetDepartments": ["Văn phòng", "Cảng Bến Thủy"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-07-01T08:00:00Z",
            "updatedAt": "2024-07-01T08:00:00Z"
        },
        {
            "title": "Lịch trực ban tháng 8 (Riêng Cửa Lò)",
            "content": "Phân công lịch trực ban lãnh đạo và các phòng ban...",
            "summary": "Lịch trực Cảng Cửa Lò tháng 8.",
            "category": "Thông báo",
            "image": "https://img.freepik.com/free-vector/schedule-calendar-flat-style_23-2147541998.jpg",
            "targetDepartments": ["Cảng Cửa Lò"],
            "authorId": admin_id,
            "authorName": admin_name,
            "authorDepartment": admin_dept,
            "createdAt": "2024-07-28T09:00:00Z",
            "updatedAt": "2024-07-28T09:00:00Z"
        }
    ]

    for post in posts:
        if await db.posts.count_documents({"title": post["title"]}) == 0:
            await db.posts.insert_one(post)
            print(f"Post '{post['title']}' created.")

    # Seed Activities
    activities = [
        {
            "name": "Giải bóng đá Công đoàn 2024 (Toàn công ty)",
            "description": "Giải bóng đá thường niên nhằm nâng cao sức khỏe và tinh thần đoàn kết.",
            "time": "08:00 - 15/06/2024",
            "location": "Sân vận động Cửa Lò",
            "type": "SPORTS",
            "image": "https://img.freepik.com/free-photo/soccer-ball-green-grass_1150-14561.jpg",
            "targetDepartments": [],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-05-20T10:00:00Z"
        },
        {
            "name": "Tập huấn An toàn lao động (Cửa Lò & Bến Thủy)",
            "description": "Khóa tập huấn bắt buộc về an toàn lao động cho khối kỹ thuật.",
            "time": "14:00 - 20/06/2024",
            "location": "Hội trường A",
            "type": "TRAINING",
            "image": "https://img.freepik.com/free-vector/construction-safety-equipment-concept_1284-18865.jpg",
            "targetDepartments": ["Cảng Cửa Lò", "Cảng Bến Thủy"],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-06-01T08:00:00Z"
        },
        {
            "name": "Du lịch hè 2024 - Đà Nẵng (Toàn công ty)",
            "description": "Chuyến du lịch nghỉ mát 3 ngày 2 đêm tại Đà Nẵng cho toàn thể CBNV.",
            "time": "05/07/2024 - 07/07/2024",
            "location": "Đà Nẵng",
            "type": "VACATION",
            "image": "https://img.freepik.com/free-photo/beautiful-tropical-beach-sea-ocean-with-coconut-palm-tree-sunrise-time_74190-7454.jpg",
            "targetDepartments": [],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-05-15T16:00:00Z"
        },
        {
            "name": "Tiệc trà chiều (Riêng Văn phòng)",
            "description": "Giao lưu nhẹ nhàng cuối tuần cho khối Văn phòng.",
            "time": "16:00 - 28/06/2024",
            "location": "Pantry Văn phòng",
            "type": "VACATION",
            "image": "https://img.freepik.com/free-photo/cup-coffee-with-heart-pattern_1150-4122.jpg",
            "targetDepartments": ["Văn phòng"],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-06-20T15:00:00Z"
        },
        {
            "name": "Giải bơi lội mở rộng (Riêng Cửa Lò)",
            "description": "Giải bơi lội dành cho CBNV đang làm việc tại Cảng Cửa Lò.",
            "time": "07:00 - 10/07/2024",
            "location": "Biển Cửa Lò",
            "type": "SPORTS",
            "image": "https://img.freepik.com/free-photo/swimmer-swimming-pool_1150-1786.jpg",
            "targetDepartments": ["Cảng Cửa Lò"],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-06-15T09:00:00Z"
        },
        {
            "name": "Hội diễn văn nghệ (VP & Bến Thủy)",
            "description": "Hội diễn văn nghệ chào mừng ngày thành lập công ty.",
            "time": "19:00 - 15/08/2024",
            "location": "Nhà văn hóa Tỉnh",
            "type": "ARTS",
            "image": "https://img.freepik.com/free-photo/singer-performing-stage-with-lights_23-2148943644.jpg",
            "targetDepartments": ["Văn phòng", "Cảng Bến Thủy"],
            "createdBy": admin_id,
            "registrations": [],
            "createdAt": "2024-07-20T10:00:00Z"
        }
    ]

    for activity in activities:
        if await db.activities.count_documents({"name": activity["name"]}) == 0:
            await db.activities.insert_one(activity)
            print(f"Activity '{activity['name']}' created.")

    # Seed Documents
    documents = [
        {
            "title": "Điều lệ Công đoàn Việt Nam (Public)",
            "category": "Quy chế",
            "fileSize": "2.5 MB",
            "uploadedBy": admin_id,
            "targetDepartments": [],
            "createdAt": "2023-12-01T09:00:00Z"
        },
        {
            "title": "Báo cáo tài chính Quý 1/2024 (Public)",
            "category": "Báo cáo",
            "fileSize": "1.2 MB",
            "uploadedBy": admin_id,
            "targetDepartments": [],
            "createdAt": "2024-04-10T15:30:00Z"
        },
        {
            "title": "Quy định chấm công khối VP (Riêng VP)",
            "category": "Quy chế",
            "fileSize": "300 KB",
            "uploadedBy": admin_id,
            "targetDepartments": ["Văn phòng"],
            "createdAt": "2024-05-01T08:00:00Z"
        },
        {
            "title": "Hướng dẫn vận hành cẩu (Riêng Bến Thủy)",
            "category": "Hướng dẫn",
            "fileSize": "5.0 MB",
            "uploadedBy": admin_id,
            "targetDepartments": ["Cảng Bến Thủy"],
            "createdAt": "2024-05-15T14:00:00Z"
        },
         {
            "title": "Sơ đồ bãi container (Riêng Cửa Lò)",
            "category": "Hướng dẫn",
            "fileSize": "4.2 MB",
            "uploadedBy": admin_id,
            "targetDepartments": ["Cảng Cửa Lò"],
            "createdAt": "2024-05-20T11:00:00Z"
        }
    ]
    
    for doc in documents:
         if await db.documents.count_documents({"title": doc["title"]}) == 0:
            await db.documents.insert_one(doc)
            print(f"Document '{doc['title']}' created.")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_data())
