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
from app.core.config import settings

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
            "department": "VAN_PHONG_CANG",
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
            "department": "VAN_PHONG_CANG",
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
            "department": "CUA_LO",
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
            "department": "BEN_THUY",
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
            "department": "VAN_PHONG_CANG",
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
            "department": "CUA_LO",
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
            "department": "BEN_THUY",
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
            "targetDepartments": ["VAN_PHONG_CANG", "CUA_LO"],
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
            "targetDepartments": ["VAN_PHONG_CANG"],
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
            "targetDepartments": ["CUA_LO"],
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
            "targetDepartments": ["BEN_THUY"],
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
            "targetDepartments": ["VAN_PHONG_CANG", "BEN_THUY"],
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
            "targetDepartments": ["CUA_LO"],
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
            "targetDepartments": ["CUA_LO", "BEN_THUY"],
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
            "targetDepartments": ["VAN_PHONG_CANG"],
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
            "targetDepartments": ["CUA_LO"],
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
            "targetDepartments": ["VAN_PHONG_CANG", "BEN_THUY"],
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
            "targetDepartments": ["VAN_PHONG_CANG"],
            "createdAt": "2024-05-01T08:00:00Z"
        },
        {
            "title": "Hướng dẫn vận hành cẩu (Riêng Bến Thủy)",
            "category": "Hướng dẫn",
            "fileSize": "5.0 MB",
            "uploadedBy": admin_id,
            "targetDepartments": ["BEN_THUY"],
            "createdAt": "2024-05-15T14:00:00Z"
        },
         {
            "title": "Sơ đồ bãi container (Riêng Cửa Lò)",
            "category": "Hướng dẫn",
            "fileSize": "4.2 MB",
            "uploadedBy": admin_id,
            "targetDepartments": ["CUA_LO"],
            "createdAt": "2024-05-20T11:00:00Z"
        }
    ]
    
    for doc in documents:
         if await db.documents.count_documents({"title": doc["title"]}) == 0:
            await db.documents.insert_one(doc)
            print(f"Document '{doc['title']}' created.")

    # Seed Surveys
    surveys = [
        {
            "title": "Khảo sát mức độ hài lòng Q1/2026",
            "description": "Khảo sát mức độ hài lòng của đoàn viên về các hoạt động công đoàn trong Quý 1 năm 2026. Mọi ý kiến đóng góp đều được ghi nhận.",
            "questions": [
                {
                    "content": "Mức độ hài lòng của bạn về hoạt động Công đoàn trong quý vừa qua?",
                    "type": "STAR_RATING",
                    "options": [],
                    "isRequired": True
                },
                {
                    "content": "Bạn đánh giá thế nào về chất lượng các sự kiện/hoạt động được tổ chức?",
                    "type": "SINGLE_CHOICE",
                    "options": ["Rất tốt", "Tốt", "Bình thường", "Chưa tốt", "Kém"],
                    "isRequired": True
                },
                {
                    "content": "Hoạt động nào bạn muốn Công đoàn tổ chức thêm? (Chọn nhiều đáp án)",
                    "type": "MULTIPLE_CHOICE",
                    "options": ["Thể thao", "Văn nghệ", "Du lịch", "Đào tạo kỹ năng", "Khám sức khỏe", "Teambuilding"],
                    "isRequired": True
                },
                {
                    "content": "Bạn có góp ý gì thêm cho hoạt động Công đoàn?",
                    "type": "OPEN_TEXT",
                    "options": [],
                    "isRequired": False
                }
            ],
            "isAnonymous": False,
            "deadline": "2026-03-31",
            "targetDepartments": [],
            "status": "ACTIVE",
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-03-01T08:00:00Z"
        },
        {
            "title": "Khảo sát An toàn Lao động 2026",
            "description": "Đánh giá tình hình an toàn lao động tại các đơn vị. Khảo sát này là ẩn danh.",
            "questions": [
                {
                    "content": "Bạn đánh giá mức độ an toàn tại nơi làm việc như thế nào?",
                    "type": "STAR_RATING",
                    "options": [],
                    "isRequired": True
                },
                {
                    "content": "Bạn đã được tập huấn đầy đủ về an toàn lao động chưa?",
                    "type": "SINGLE_CHOICE",
                    "options": ["Đã tập huấn đầy đủ", "Đã tập huấn nhưng chưa đủ", "Chưa được tập huấn"],
                    "isRequired": True
                },
                {
                    "content": "Thiết bị bảo hộ cá nhân được cấp phát đầy đủ không?",
                    "type": "SINGLE_CHOICE",
                    "options": ["Đầy đủ", "Thiếu một số", "Thiếu nhiều", "Chưa được cấp"],
                    "isRequired": True
                },
                {
                    "content": "Bạn mong muốn cải thiện điều gì về an toàn lao động?",
                    "type": "OPEN_TEXT",
                    "options": [],
                    "isRequired": False
                }
            ],
            "isAnonymous": True,
            "deadline": "2026-04-15",
            "targetDepartments": ["CUA_LO", "BEN_THUY"],
            "status": "ACTIVE",
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-03-02T10:00:00Z"
        },
        {
            "title": "Đánh giá suất ăn trưa tháng 2/2026",
            "description": "Khảo sát nhanh để cải thiện thực đơn suất ăn trưa.",
            "questions": [
                {
                    "content": "Đánh giá chung về suất ăn trưa?",
                    "type": "STAR_RATING",
                    "options": [],
                    "isRequired": True
                },
                {
                    "content": "Bạn quan tâm nhất điều gì? (Chọn nhiều)",
                    "type": "MULTIPLE_CHOICE",
                    "options": ["Vệ sinh an toàn", "Khẩu phần", "Đa dạng thực đơn", "Rau xanh", "Giá cả"],
                    "isRequired": True
                }
            ],
            "isAnonymous": False,
            "deadline": "2026-02-28",
            "targetDepartments": ["VAN_PHONG_CANG"],
            "status": "CLOSED",
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-02-15T09:00:00Z"
        }
    ]

    for survey in surveys:
        if await db.surveys.count_documents({"title": survey["title"]}) == 0:
            result = await db.surveys.insert_one(survey)
            print(f"Survey '{survey['title']}' created.")

    # Seed Survey Responses (for the closed meal survey)
    meal_survey = await db.surveys.find_one({"title": "Đánh giá suất ăn trưa tháng 2/2026"})
    tv_vp = await db.users.find_one({"username": "tv_vanphong"})
    tv_cl = await db.users.find_one({"username": "tv_cualo"})
    tv_bt = await db.users.find_one({"username": "tv_benthuy"})
    bch_vp = await db.users.find_one({"username": "bch_vanphong"})

    if meal_survey and tv_vp and bch_vp:
        meal_sid = str(meal_survey["_id"])
        sample_responses = [
            {
                "surveyId": meal_sid,
                "userId": str(tv_vp["_id"]),
                "userName": tv_vp["fullName"],
                "department": tv_vp["department"],
                "answers": [
                    {"questionIndex": 0, "answer": 4},
                    {"questionIndex": 1, "answer": ["Đa dạng thực đơn", "Rau xanh"]}
                ],
                "submittedAt": "2026-02-16T12:00:00Z"
            },
            {
                "surveyId": meal_sid,
                "userId": str(bch_vp["_id"]),
                "userName": bch_vp["fullName"],
                "department": bch_vp["department"],
                "answers": [
                    {"questionIndex": 0, "answer": 3},
                    {"questionIndex": 1, "answer": ["Vệ sinh an toàn", "Khẩu phần", "Rau xanh"]}
                ],
                "submittedAt": "2026-02-17T11:30:00Z"
            }
        ]
        for resp in sample_responses:
            if await db.survey_responses.count_documents({"surveyId": meal_sid, "userId": resp["userId"]}) == 0:
                await db.survey_responses.insert_one(resp)
                print(f"Survey response by '{resp.get('userName', 'anon')}' created.")

    # Seed Honor Campaigns & Nominations
    campaigns_data = [
        {
            "title": "Thi đua lao động giỏi Quý 1/2026",
            "description": "Bình chọn cá nhân/tập thể có nhiều đóng góp xuất sắc trong Quý 1 năm 2026.",
            "type": "INDIVIDUAL",
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
            "targetDepartments": [],
            "status": "ACTIVE",
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-01-05T08:00:00Z",
        },
        {
            "title": "Tập thể xuất sắc 2025",
            "description": "Vinh danh các tổ/đội/phòng ban có thành tích xuất sắc năm 2025.",
            "type": "TEAM",
            "startDate": "2025-12-01",
            "endDate": "2025-12-31",
            "targetDepartments": [],
            "status": "CLOSED",
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2025-12-01T08:00:00Z",
        }
    ]

    for c in campaigns_data:
        if await db.campaigns.count_documents({"title": c["title"]}) == 0:
            await db.campaigns.insert_one(c)
            print(f"Campaign '{c['title']}' created.")

    # Seed Nominations
    active_campaign = await db.campaigns.find_one({"title": "Thi đua lao động giỏi Quý 1/2026"})
    closed_campaign = await db.campaigns.find_one({"title": "Tập thể xuất sắc 2025"})

    if active_campaign and tv_vp and tv_bt and bch_vp:
        active_cid = str(active_campaign["_id"])
        nominations_data = [
            {
                "campaignId": active_cid,
                "nomineeName": "Trần Văn Hùng",
                "nomineeDepartment": "CUA_LO",
                "reason": "Hoàn thành xuất sắc nhiệm vụ điều phối hàng hóa, giảm thời gian xoay vòng tàu 15%.",
                "achievements": "Xử lý 200+ lượt tàu không để xảy ra sự cố, được khen thưởng 3 tháng liên tiếp",
                "status": "APPROVED",
                "nominatorId": str(tv_vp["_id"]),
                "nominatorName": tv_vp["fullName"],
                "nominatorDepartment": tv_vp["department"],
                "reviewedAt": "2026-02-15T10:00:00Z",
                "createdAt": "2026-02-10T09:00:00Z",
            },
            {
                "campaignId": active_cid,
                "nomineeName": "Lê Thị Mai",
                "nomineeDepartment": "VAN_PHONG_CANG",
                "reason": "Sáng kiến cải tiến quy trình kế toán, tiết kiệm 30% thời gian xử lý chứng từ.",
                "achievements": "Xây dựng hệ thống quản lý chứng từ điện tử cho Văn phòng Cảng",
                "status": "APPROVED",
                "nominatorId": str(bch_vp["_id"]),
                "nominatorName": bch_vp["fullName"],
                "nominatorDepartment": bch_vp["department"],
                "reviewedAt": "2026-02-20T14:00:00Z",
                "createdAt": "2026-02-18T11:00:00Z",
            },
            {
                "campaignId": active_cid,
                "nomineeName": "Nguyễn Đức Toàn",
                "nomineeDepartment": "BEN_THUY",
                "reason": "Phát hiện kịp thời nguy cơ tai nạn lao động, tham gia cứu hộ thành công.",
                "achievements": "Tham gia 5 khóa huấn luyện ATLĐ, đạt chứng chỉ sơ cấp cứu",
                "status": "PENDING",
                "nominatorId": str(tv_bt["_id"]),
                "nominatorName": tv_bt["fullName"],
                "nominatorDepartment": tv_bt["department"],
                "createdAt": "2026-03-01T08:00:00Z",
            },
        ]
        for nom in nominations_data:
            if await db.nominations.count_documents({"campaignId": active_cid, "nomineeName": nom["nomineeName"]}) == 0:
                await db.nominations.insert_one(nom)
                print(f"Nomination '{nom['nomineeName']}' created.")

    if closed_campaign and tv_vp:
        closed_cid = str(closed_campaign["_id"])
        team_nominations = [
            {
                "campaignId": closed_cid,
                "nomineeName": "Tổ Bốc xếp số 2 - Cảng Cửa Lò",
                "nomineeDepartment": "CUA_LO",
                "reason": "Đạt sản lượng bốc xếp cao nhất năm, vượt chỉ tiêu 120%.",
                "achievements": "Bốc xếp 1.2 triệu tấn hàng, 0 sự cố an toàn lao động",
                "status": "APPROVED",
                "nominatorId": str(tv_vp["_id"]),
                "nominatorName": tv_vp["fullName"],
                "nominatorDepartment": tv_vp["department"],
                "reviewedAt": "2025-12-25T10:00:00Z",
                "createdAt": "2025-12-10T09:00:00Z",
            },
            {
                "campaignId": closed_cid,
                "nomineeName": "Phòng Kế hoạch - VP Cảng",
                "nomineeDepartment": "VAN_PHONG_CANG",
                "reason": "Hoàn thành xuất sắc kế hoạch năm 2025, xây dựng chiến lược phát triển.",
                "achievements": "Triển khai thành công 3 dự án trọng điểm",
                "status": "APPROVED",
                "nominatorId": str(tv_vp["_id"]),
                "nominatorName": tv_vp["fullName"],
                "nominatorDepartment": tv_vp["department"],
                "reviewedAt": "2025-12-26T10:00:00Z",
                "createdAt": "2025-12-12T09:00:00Z",
            },
        ]
        for nom in team_nominations:
            if await db.nominations.count_documents({"campaignId": closed_cid, "nomineeName": nom["nomineeName"]}) == 0:
                await db.nominations.insert_one(nom)
                print(f"Team nomination '{nom['nomineeName']}' created.")

    # Seed E-learning Courses, Quizzes & Enrollments
    elearning_courses = [
        {
            "title": "An toàn lao động tại Cảng biển",
            "description": "Khóa học bắt buộc về quy tắc an toàn lao động, nhận diện rủi ro và phòng chống tai nạn tại khu vực cảng.",
            "category": "An toàn lao động",
            "courseType": "MANDATORY",
            "targetDepartments": [],
            "status": "PUBLISHED",
            "lessons": [
                {"title": "Tổng quan về An toàn lao động cảng biển", "type": "TEXT",
                 "content": "An toàn lao động tại cảng biển là yếu tố quan trọng hàng đầu. Mỗi công nhân cần nắm vững:\n\n1. Quy tắc di chuyển trong khu vực cảng\n2. Trang bị bảo hộ lao động bắt buộc (mũ, giày, áo phản quang)\n3. Nhận diện các khu vực nguy hiểm\n4. Quy trình báo cáo sự cố\n5. Sơ cứu cơ bản khi xảy ra tai nạn",
                 "duration": 15},
                {"title": "Video: Quy trình an toàn khi bốc xếp hàng hóa", "type": "VIDEO",
                 "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "duration": 20},
                {"title": "Tài liệu: Hướng dẫn sử dụng thiết bị nâng hạ", "type": "PDF",
                 "url": "https://example.com/huong-dan-thiet-bi.pdf", "duration": 10},
            ],
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-01-15T08:00:00Z",
        },
        {
            "title": "Nghiệp vụ kế toán cảng biển",
            "description": "Khóa học về quy trình kế toán, quản lý chứng từ và báo cáo tài chính tại đơn vị cảng.",
            "category": "Nghiệp vụ",
            "courseType": "OPTIONAL",
            "targetDepartments": ["VAN_PHONG_CANG"],
            "status": "PUBLISHED",
            "lessons": [
                {"title": "Quy trình luân chuyển chứng từ", "type": "TEXT",
                 "content": "Chứng từ kế toán tại cảng gồm:\n- Phiếu thu/chi\n- Hóa đơn dịch vụ cảng\n- Biên bản bốc xếp\n- Hợp đồng vận chuyển\n\nQuy trình: Lập chứng từ → Kiểm tra → Ký duyệt → Lưu trữ → Báo cáo",
                 "duration": 20},
                {"title": "Phần mềm quản lý tài chính", "type": "VIDEO",
                 "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "duration": 30},
            ],
            "createdBy": admin_id,
            "creatorName": admin_name,
            "createdAt": "2026-02-01T08:00:00Z",
        }
    ]

    for course_data in elearning_courses:
        if await db.courses.count_documents({"title": course_data["title"]}) == 0:
            await db.courses.insert_one(course_data)
            print(f"Course '{course_data['title']}' created.")

    # Seed quiz for safety course
    safety_course = await db.courses.find_one({"title": "An toàn lao động tại Cảng biển"})
    if safety_course:
        safety_cid = str(safety_course["_id"])
        if await db.quizzes.count_documents({"courseId": safety_cid}) == 0:
            quiz_data = {
                "courseId": safety_cid,
                "title": "Kiểm tra An toàn lao động",
                "description": "Bài kiểm tra kiến thức về an toàn lao động tại cảng biển",
                "timeLimit": 10,
                "passingScore": 60,
                "questions": [
                    {
                        "content": "Khi di chuyển trong khu vực cảng, bạn BẮT BUỘC phải mang trang bị nào?",
                        "type": "MULTIPLE_CHOICE",
                        "options": ["Mũ bảo hộ, giày bảo hộ, áo phản quang", "Chỉ cần mũ bảo hộ", "Chỉ cần giày bảo hộ", "Không cần trang bị gì"],
                        "correctAnswer": 0
                    },
                    {
                        "content": "Khi phát hiện sự cố an toàn, bạn cần báo cáo ngay cho ai?",
                        "type": "MULTIPLE_CHOICE",
                        "options": ["Đồng nghiệp", "Quản lý trực tiếp hoặc bộ phận an toàn", "Tự xử lý", "Ghi nhận và báo cáo vào cuối ca"],
                        "correctAnswer": 1
                    },
                    {
                        "content": "Công nhân được phép vào khu vực cẩu hàng mà không có sự cho phép của người điều phối.",
                        "type": "TRUE_FALSE",
                        "options": ["Đúng", "Sai"],
                        "correctAnswer": 1
                    },
                    {
                        "content": "Tốc độ tối đa cho phương tiện di chuyển trong khu vực cảng là bao nhiêu?",
                        "type": "MULTIPLE_CHOICE",
                        "options": ["40 km/h", "30 km/h", "20 km/h", "10 km/h"],
                        "correctAnswer": 2
                    },
                    {
                        "content": "Mọi tai nạn lao động dù nhỏ đều cần được ghi nhận và báo cáo.",
                        "type": "TRUE_FALSE",
                        "options": ["Đúng", "Sai"],
                        "correctAnswer": 0
                    },
                ],
                "createdBy": admin_id,
                "createdAt": "2026-01-20T08:00:00Z",
            }
            await db.quizzes.insert_one(quiz_data)
            print("Quiz 'Kiểm tra An toàn lao động' created.")

        # Seed enrollments
        if tv_vp:
            if await db.enrollments.count_documents({"courseId": safety_cid, "userId": str(tv_vp["_id"])}) == 0:
                await db.enrollments.insert_one({
                    "courseId": safety_cid,
                    "userId": str(tv_vp["_id"]),
                    "userName": tv_vp["fullName"],
                    "department": tv_vp["department"],
                    "completedLessons": [0, 1],
                    "quizResult": {"quizId": "", "score": 80, "correct": 4, "total": 5, "passed": True, "submittedAt": "2026-02-10T10:00:00Z"},
                    "enrolledAt": "2026-02-01T08:00:00Z",
                })
                print(f"Enrollment for '{tv_vp['fullName']}' created.")

        if tv_bt:
            if await db.enrollments.count_documents({"courseId": safety_cid, "userId": str(tv_bt["_id"])}) == 0:
                await db.enrollments.insert_one({
                    "courseId": safety_cid,
                    "userId": str(tv_bt["_id"]),
                    "userName": tv_bt["fullName"],
                    "department": tv_bt["department"],
                    "completedLessons": [0],
                    "quizResult": None,
                    "enrolledAt": "2026-02-05T08:00:00Z",
                })
                print(f"Enrollment for '{tv_bt['fullName']}' created.")

    # Seed Feedback
    tv_cl = await db.users.find_one({"username": "tv_cualo"})
    bch_cl = await db.users.find_one({"username": "bch_cualo"})

    if tv_vp and tv_cl and bch_vp and bch_cl:
        feedbacks = [
            {
                "subject": "Đề xuất thêm tính năng theo dõi lịch tàu",
                "content": "Kính gửi Ban Lãnh đạo, tôi xin đề xuất thêm tính năng xem lịch tàu cập cảng trực tiếp trên app để anh em dễ dàng theo dõi kế hoạch làm hàng.",
                "senderId": str(tv_vp["_id"]),
                "senderName": tv_vp["fullName"],
                "senderDepartment": tv_vp["department"],
                "isAnonymous": False,
                "status": "PENDING",
                "targetRecipients": [str(bch_vp["_id"])],
                "replies": [],
                "createdAt": "2024-07-10T10:00:00Z"
            },
            {
                "subject": "Báo cáo hỏng hóc thiết bị bốc xếp tại Cửa Lò",
                "content": "Tại cần cẩu số 2 khu vực bãi Cửa Lò đang có dấu hiệu mòn tời thép, cần bộ phận kỹ thuật kiểm tra và thay thế sớm để đảm bảo an toàn.",
                "senderId": str(tv_cl["_id"]),
                "senderName": tv_cl["fullName"],
                "senderDepartment": tv_cl["department"],
                "isAnonymous": False,
                "status": "REPLIED",
                "targetRecipients": [str(bch_cl["_id"]), str(bch_vp["_id"])],
                "replies": [
                    {
                        "userId": str(bch_cl["_id"]),
                        "userName": bch_cl["fullName"],
                        "content": "Đã ghi nhận, bộ phận kỹ thuật sẽ điều người tới kiểm tra trong chiều nay.",
                        "repliedAt": "2024-07-11T14:30:00Z"
                    }
                ],
                "createdAt": "2024-07-11T09:00:00Z"
            },
            {
                "subject": "Góp ý về suất ăn trưa",
                "content": "Suất ăn trưa gần đây hơi ít rau xanh, mong ban đời sống có thể điều chỉnh lại thực đơn cho anh em công nhân ạ.",
                "senderId": str(tv_vp["_id"]),
                "senderName": tv_vp["fullName"],
                "senderDepartment": tv_vp["department"],
                "isAnonymous": True,
                "status": "PENDING",
                "targetRecipients": [str(bch_vp["_id"])],
                "replies": [],
                "createdAt": "2024-07-12T12:00:00Z"
            }
        ]
        
        for fb in feedbacks:
            if await db.feedback.count_documents({"subject": fb["subject"]}) == 0:
                await db.feedback.insert_one(fb)
                print(f"Feedback '{fb['subject']}' created.")

if __name__ == "__main__":
    asyncio.run(seed_data())
