import asyncio
import logging
from datetime import datetime, timezone
from app.core.database import db

logger = logging.getLogger(__name__)

async def check_birthdays():
    """
    Tìm những đoàn viên có sinh nhật vào hôm nay và gửi thông báo chúc mừng.
    """
    now = datetime.now(timezone.utc)
    today = datetime.now()
    current_year = today.year
    current_month = today.month
    current_day = today.day

    users_cursor = db.users.find({"status": "ACTIVE", "isDeleted": {"$ne": 1}})
    
    count = 0
    async for user in users_cursor:
        if user.get("lastBirthdayGreetingYear") == current_year:
            continue

        cccd = user.get("cccdNumber")
        if not cccd:
            continue

        member = await db.union_members.find_one({
            "cccdNumber": cccd, 
            "isDeleted": {"$ne": 1}
        })
        
        if not member or not member.get("birthDate"):
            continue

        birth_date = member["birthDate"]
        if birth_date.month == current_month and birth_date.day == current_day:
            user_id = str(user["_id"])
            full_name = user.get("fullName", "Đồng chí")
            
            await db.notifications.insert_one({
                "userId": user_id,
                "type": "SYSTEM",
                "title": "🎉 Chúc mừng sinh nhật!",
                "body": f"Chúc mừng sinh nhật {full_name}! Ban Chấp Hành Công Đoàn Cảng Nghệ Tĩnh chúc đồng chí tuổi mới nhiều sức khỏe, hạnh phúc và thành công!",
                "read": False,
                "createdAt": now
            })
            
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"lastBirthdayGreetingYear": current_year}}
            )
            count += 1
            
    if count > 0:
        logger.info(f"Đã tự động gửi {count} lời chúc mừng sinh nhật hôm nay ({current_day}/{current_month}).")

async def birthday_cron_loop():
    """
    Vòng lặp chạy ngầm.
    """
    logger.info("Khởi động Birthday Cron Job (sẽ gửi lúc 08:00 sáng hàng ngày).")
    while True:
        try:
            now = datetime.now()
            # Chạy vào 8h sáng
            if now.hour == 8:
                await check_birthdays()
        except Exception as e:
            logger.error(f"Lỗi khi chạy cron sinh nhật: {e}")
        
        # Kiểm tra mỗi giờ
        await asyncio.sleep(3600)
