# Hướng dẫn chạy dự án Công Đoàn

Dự án bao gồm 2 phần: Backend (FastAPI) và Frontend (React Native/Expo).

## 1. Yêu cầu hệ thống

-   **Node.js** (v18 trở lên) & **npm** / **yarn**
-   **Python** (v3.9 trở lên)
-   **MongoDB** (đang chạy local hoặc có URL kết nối)

## 2. Cài đặt & Chạy Backend

Backend xử lý logic, kết nối CSDL và cung cấp API.

### Cài đặt MongoDB

Bạn cần có MongoDB đang chạy để ứng dụng hoạt động.

**Cách 1: Sử dụng Docker (Khuyên dùng)**
Nếu bạn đã cài Docker, chỉ cần chạy:
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Cách 2: Cài đặt trực tiếp**
-   MacOS: `brew tap mongodb/brew && brew install mongodb-community`
-   Windows: Tải bộ cài từ trang chủ MongoDB.

### Cài đặt môi trường (Lần đầu tiên)

Mở terminal tại thư mục gốc của dự án:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # MacOS/Linux
# .\venv\Scripts\activate # Windows
pip install -r requirements.txt
```

### Khởi tạo dữ liệu (Tài khoản mẫu)

Sau khi MongoDB đã chạy, hãy chạy lệnh sau để tạo các tài khoản mẫu:

```bash
# Từ thư mục gốc (đã activate venv)
python3 backend/seed.py
```

**Danh sách tài khoản mẫu:**

| Username | Password | Role | Mô tả |
|----------|----------|------|-------|
| `superadmin` | `Admin@123` | SUPER_ADMIN | Quản trị viên cao cấp |
| `bch_vanphong` | `VanPhong@123` | BCH_VP | BCH Văn phòng Cảng |
| `bch_cualo` | `CuaLo@123` | BCH_CL | BCH Cửa Lò |
| `bch_benthuy` | `BenThuy@123` | BCH_BT | BCH Bến Thủy |
| `tv_vanphong` | `Member@123` | MEMBER | Thành viên VP |
| `tv_cualo` | `Member@123` | MEMBER | Thành viên Cửa Lò |
| `tv_benthuy` | `Member@123` | MEMBER | Thành viên Bến Thủy |

### Cấu hình biến môi trường

Đảm bảo file `.env` ở thư mục gốc có nội dung tương tự:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=cong_doan_db
JWT_SECRET_KEY=your_secret_key
# Thêm các biến khác nếu cần
```

### Chạy Backend

```bash
# Từ thư mục gốc
source backend/venv/bin/activate
uvicorn backend.app.main:app --reload
```

-   Backend sẽ chạy tại: `http://localhost:8000`
-   Tài liệu API (Swagger UI): `http://localhost:8000/docs`

---

## 3. Cài đặt & Chạy Frontend

Frontend là ứng dụng di động/web cho người dùng.

### Cài đặt dependencies (Lần đầu tiên)

Mở một terminal **mới** (giữ terminal backend chạy):

```bash
cd frontend
npm install
```

### Chạy Frontend

```bash
cd frontend
npx expo start
```

Sau khi chạy lệnh trên, bạn có thể nhấn các phím sau trong terminal:
-   `w`: Để mở phiên bản Web trên trình duyệt.
-   `i`: Để chạy trên iOS Simulator (cần cài Xcode).
-   `a`: Để chạy trên Android Emulator (cần cài Android Studio).
-   Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại thực để chạy thử.

## 4. Lưu ý khi phát triển

-   Backend cần chạy trước để Frontend có thể gọi API.
-   Nếu chạy trên thiết bị thật (điện thoại), hãy đảm bảo điện thoại và máy tính cùng kết nối một mạng Wifi.
-   Cập nhật IP backend trong file `.env` hoặc cấu hình frontend nếu cần thiết (đặc biệt khi test trên điện thoại).
