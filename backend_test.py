#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Nghe Tinh Port Union App
Tests all authentication, posts, activities, feedback, and documents endpoints
with proper permission verification for all user roles.
"""

import requests
import json
import sys
from typing import Dict, List, Optional, Any

# Backend URL from frontend .env
BACKEND_URL = "https://unionhub-1.preview.emergentagent.com/api"

# Test user accounts
TEST_USERS = [
    {"username": "superadmin", "password": "Admin@123", "role": "SUPER_ADMIN", "department": "VAN_PHONG_CANG"},
    {"username": "bch_vanphong", "password": "VanPhong@123", "role": "BCH_VAN_PHONG", "department": "VAN_PHONG_CANG"},
    {"username": "bch_cualo", "password": "CuaLo@123", "role": "BCH_CUA_LO", "department": "CUA_LO"},
    {"username": "bch_benthuy", "password": "BenThuy@123", "role": "BCH_BEN_THUY", "department": "BEN_THUY"},
    {"username": "tv_vanphong", "password": "Member@123", "role": "THANH_VIEN_VAN_PHONG", "department": "VAN_PHONG_CANG"},
    {"username": "tv_cualo", "password": "Member@123", "role": "THANH_VIEN_CUA_LO", "department": "CUA_LO"},
    {"username": "tv_benthuy", "password": "Member@123", "role": "THANH_VIEN_BEN_THUY", "department": "BEN_THUY"}
]

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.warnings = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"✅ PASS: {test_name}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ FAIL: {test_name} - {error}")
    
    def add_warning(self, test_name: str, warning: str):
        self.warnings.append(f"{test_name}: {warning}")
        print(f"⚠️  WARNING: {test_name} - {warning}")
    
    def summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY")
        print(f"{'='*60}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"⚠️  Warnings: {len(self.warnings)}")
        
        if self.errors:
            print(f"\n🔴 CRITICAL FAILURES:")
            for error in self.errors:
                print(f"  - {error}")
        
        if self.warnings:
            print(f"\n🟡 WARNINGS:")
            for warning in self.warnings:
                print(f"  - {warning}")
        
        return self.failed == 0

class UnionAppTester:
    def __init__(self):
        self.result = TestResult()
        self.user_tokens = {}
        self.user_data = {}
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    token: Optional[str] = None, expected_status: int = 200) -> Optional[Dict]:
        """Make HTTP request with proper error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Always include status code in response
            result = {"status_code": response.status_code}
            
            if response.status_code != expected_status:
                result.update({
                    "error": f"Expected status {expected_status}, got {response.status_code}",
                    "response": response.text
                })
                return result
            
            # Status code matches expected, parse response
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    json_data = response.json()
                    if isinstance(json_data, dict):
                        result.update(json_data)
                    else:
                        result["data"] = json_data
                except:
                    result["raw_response"] = response.text
            else:
                result["raw_response"] = response.text
                
            return result
                
        except requests.exceptions.RequestException as e:
            return {"error": f"Request failed: {str(e)}"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode error: {str(e)}", "raw_response": response.text}
    
    def initialize_database(self):
        """Initialize database with demo data"""
        print(f"\n🔄 Initializing database...")
        
        result = self.make_request("POST", "/init-db")
        if result and "error" not in result:
            self.result.add_pass("Database initialization")
            print(f"✅ Database initialized successfully")
        else:
            self.result.add_fail("Database initialization", str(result.get("error", "Unknown error")))
            return False
        return True
    
    def test_authentication(self):
        """Test authentication for all users"""
        print(f"\n🔐 Testing Authentication...")
        
        for user in TEST_USERS:
            username = user["username"]
            
            # Test login
            login_data = {"username": username, "password": user["password"]}
            result = self.make_request("POST", "/auth/login", login_data)
            
            if result and "error" not in result and "token" in result:
                token = result["token"]
                user_info = result["user"]
                
                self.user_tokens[username] = token
                self.user_data[username] = user_info
                
                # Verify user data
                if (user_info["role"] == user["role"] and 
                    user_info["department"] == user["department"]):
                    self.result.add_pass(f"Login {username}")
                else:
                    self.result.add_fail(f"Login {username}", 
                                       f"Role/Department mismatch: expected {user['role']}/{user['department']}, got {user_info['role']}/{user_info['department']}")
                
                # Test /auth/me endpoint
                me_result = self.make_request("GET", "/auth/me", token=token)
                if me_result and "error" not in me_result and "id" in me_result:
                    self.result.add_pass(f"Auth/me {username}")
                else:
                    self.result.add_fail(f"Auth/me {username}", str(me_result.get("error", "Invalid response")))
                    
            else:
                self.result.add_fail(f"Login {username}", str(result.get("error", "Login failed")))
    
    def test_posts_permissions(self):
        """Test posts endpoints with complex permission logic"""
        print(f"\n📝 Testing Posts Permissions...")
        
        # Test GET /posts for each user
        for username in self.user_tokens:
            token = self.user_tokens[username]
            result = self.make_request("GET", "/posts", token=token)
            
            if result and "error" not in result and ("data" in result or result.get("status_code") == 200):
                self.result.add_pass(f"GET posts {username}")
            else:
                self.result.add_fail(f"GET posts {username}", str(result.get("error", "Failed to get posts")))
        
        # Test POST /posts permissions
        test_post = {
            "title": "Test Post Quyền Hạn",
            "content": "Đây là bài viết test quyền hạn tạo bài",
            "summary": "Test post permissions",
            "category": "Test",
            "targetDepartments": []
        }
        
        # BCH users should be able to create posts
        bch_users = ["superadmin", "bch_vanphong", "bch_cualo", "bch_benthuy"]
        for username in bch_users:
            if username in self.user_tokens:
                token = self.user_tokens[username]
                result = self.make_request("POST", "/posts", test_post, token=token)
                
                if result and "error" not in result and "id" in result:
                    self.result.add_pass(f"CREATE post {username}")
                    
                    # Verify target departments logic
                    if username == "bch_cualo":
                        expected_targets = ["CUA_LO", "VAN_PHONG_CANG"]
                        if set(result.get("targetDepartments", [])) == set(expected_targets):
                            self.result.add_pass(f"Target departments {username}")
                        else:
                            self.result.add_fail(f"Target departments {username}", 
                                               f"Expected {expected_targets}, got {result.get('targetDepartments')}")
                    elif username == "bch_benthuy":
                        expected_targets = ["BEN_THUY", "VAN_PHONG_CANG"]
                        if set(result.get("targetDepartments", [])) == set(expected_targets):
                            self.result.add_pass(f"Target departments {username}")
                        else:
                            self.result.add_fail(f"Target departments {username}", 
                                               f"Expected {expected_targets}, got {result.get('targetDepartments')}")
                else:
                    self.result.add_fail(f"CREATE post {username}", str(result.get("error", "Failed to create post")))
        
        # Members should NOT be able to create posts (403)
        member_users = ["tv_vanphong", "tv_cualo", "tv_benthuy"]
        for username in member_users:
            if username in self.user_tokens:
                token = self.user_tokens[username]
                result = self.make_request("POST", "/posts", test_post, token=token, expected_status=403)
                
                if result and result.get("status_code") == 403:
                    self.result.add_pass(f"CREATE post forbidden {username}")
                else:
                    # Debug the actual response
                    print(f"DEBUG {username}: {result}")
                    self.result.add_fail(f"CREATE post forbidden {username}", 
                                       f"Expected 403, got {result.get('status_code', 'unknown')}: {result.get('response', '')}")
    
    def test_activities(self):
        """Test activities endpoints"""
        print(f"\n🎯 Testing Activities...")
        
        # Test GET /activities for all users
        for username in self.user_tokens:
            token = self.user_tokens[username]
            result = self.make_request("GET", "/activities", token=token)
            
            if result and "error" not in result and result.get("status_code") == 200:
                self.result.add_pass(f"GET activities {username}")
                
                # Store activity ID for registration test
                activities_data = result.get("data", [])
                if activities_data and len(activities_data) > 0:
                    activity_id = activities_data[0]["id"]
                    
                    # Test activity registration
                    reg_result = self.make_request("POST", f"/activities/{activity_id}/register", token=token)
                    if reg_result and "error" not in reg_result and "action" in reg_result:
                        self.result.add_pass(f"Register activity {username}")
                        
                        # Test unregister (call again)
                        unreg_result = self.make_request("POST", f"/activities/{activity_id}/register", token=token)
                        if unreg_result and "error" not in unreg_result and unreg_result.get("action") == "unregistered":
                            self.result.add_pass(f"Unregister activity {username}")
                        else:
                            self.result.add_fail(f"Unregister activity {username}", 
                                               str(unreg_result.get("error", "Failed to unregister")))
                    else:
                        self.result.add_fail(f"Register activity {username}", 
                                           str(reg_result.get("error", "Failed to register")))
            else:
                self.result.add_fail(f"GET activities {username}", str(result.get("error", "Failed to get activities")))
    
    def test_feedback_complex_logic(self):
        """Test feedback with complex recipient logic"""
        print(f"\n💬 Testing Feedback Complex Logic...")
        
        # Test feedback creation with different senders
        feedback_tests = [
            {
                "sender": "tv_vanphong",
                "expected_recipients": ["BCH_VAN_PHONG"],  # Only BCH Văn phòng
                "subject": "Góp ý từ thành viên văn phòng",
                "content": "Đây là góp ý từ thành viên văn phòng cảng"
            },
            {
                "sender": "tv_cualo", 
                "expected_recipients": ["BCH_CUA_LO", "BCH_VAN_PHONG"],  # BCH Cửa Lò + BCH Văn phòng
                "subject": "Góp ý từ thành viên Cửa Lò",
                "content": "Đây là góp ý từ thành viên Cửa Lò"
            },
            {
                "sender": "tv_benthuy",
                "expected_recipients": ["BCH_BEN_THUY", "BCH_VAN_PHONG"],  # BCH Bến Thủy + BCH Văn phòng
                "subject": "Góp ý từ thành viên Bến Thủy", 
                "content": "Đây là góp ý từ thành viên Bến Thủy"
            }
        ]
        
        created_feedback_ids = []
        
        for test in feedback_tests:
            sender = test["sender"]
            if sender in self.user_tokens:
                token = self.user_tokens[sender]
                
                # Create feedback
                feedback_data = {
                    "subject": test["subject"],
                    "content": test["content"],
                    "isAnonymous": False
                }
                
                result = self.make_request("POST", "/feedback", feedback_data, token=token)
                if result and "error" not in result and "id" in result:
                    self.result.add_pass(f"CREATE feedback {sender}")
                    created_feedback_ids.append(result["id"])
                else:
                    self.result.add_fail(f"CREATE feedback {sender}", str(result.get("error", "Failed to create feedback")))
        
        # Test anonymous feedback
        if "tv_vanphong" in self.user_tokens:
            token = self.user_tokens["tv_vanphong"]
            anon_feedback = {
                "subject": "Góp ý ẩn danh",
                "content": "Đây là góp ý ẩn danh từ thành viên",
                "isAnonymous": True
            }
            
            result = self.make_request("POST", "/feedback", anon_feedback, token=token)
            if result and "error" not in result:
                self.result.add_pass("CREATE anonymous feedback")
            else:
                self.result.add_fail("CREATE anonymous feedback", str(result.get("error", "Failed")))
        
        # Test GET /feedback for different roles
        for username in self.user_tokens:
            token = self.user_tokens[username]
            result = self.make_request("GET", "/feedback", token=token)
            
            if result and "error" not in result and result.get("status_code") == 200:
                self.result.add_pass(f"GET feedback {username}")
            else:
                self.result.add_fail(f"GET feedback {username}", str(result.get("error", "Failed to get feedback")))
        
        # Test feedback replies (BCH users only)
        if created_feedback_ids:
            feedback_id = created_feedback_ids[0]
            bch_users = ["superadmin", "bch_vanphong", "bch_cualo", "bch_benthuy"]
            
            for username in bch_users:
                if username in self.user_tokens:
                    token = self.user_tokens[username]
                    reply_data = {"content": f"Phản hồi từ {username}"}
                    
                    result = self.make_request("POST", f"/feedback/{feedback_id}/reply", reply_data, token=token)
                    if result and "error" not in result and result.get("status") == "success":
                        self.result.add_pass(f"REPLY feedback {username}")
                        break  # Only test one reply to avoid conflicts
                    else:
                        self.result.add_fail(f"REPLY feedback {username}", str(result.get("error", "Failed to reply")))
            
            # Test that members cannot reply (403)
            member_users = ["tv_vanphong", "tv_cualo", "tv_benthuy"]
            for username in member_users:
                if username in self.user_tokens:
                    token = self.user_tokens[username]
                    reply_data = {"content": "Thành viên không được phép reply"}
                    
                    result = self.make_request("POST", f"/feedback/{feedback_id}/reply", reply_data, 
                                             token=token, expected_status=403)
                    if result and result.get("status_code") == 403:
                        self.result.add_pass(f"REPLY feedback forbidden {username}")
                    else:
                        # Debug the actual response
                        print(f"DEBUG REPLY {username}: {result}")
                        self.result.add_fail(f"REPLY feedback forbidden {username}", 
                                           f"Expected 403, got {result.get('status_code', 'unknown')}: {result.get('response', '')}")
    
    def test_documents(self):
        """Test documents endpoint"""
        print(f"\n📄 Testing Documents...")
        
        for username in self.user_tokens:
            token = self.user_tokens[username]
            result = self.make_request("GET", "/documents", token=token)
            
            if result and "error" not in result and result.get("status_code") == 200:
                self.result.add_pass(f"GET documents {username}")
            else:
                self.result.add_fail(f"GET documents {username}", str(result.get("error", "Failed to get documents")))
    
    def run_all_tests(self):
        """Run all test suites"""
        print(f"🚀 Starting Comprehensive Backend API Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Testing {len(TEST_USERS)} user accounts")
        
        # Initialize database first
        if not self.initialize_database():
            print("❌ Database initialization failed. Stopping tests.")
            return False
        
        # Run all test suites
        self.test_authentication()
        self.test_posts_permissions()
        self.test_activities()
        self.test_feedback_complex_logic()
        self.test_documents()
        
        # Print summary
        success = self.result.summary()
        
        if success:
            print(f"\n🎉 ALL TESTS PASSED! Backend APIs are working correctly.")
        else:
            print(f"\n💥 SOME TESTS FAILED! Check the errors above.")
        
        return success

def main():
    """Main test runner"""
    tester = UnionAppTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()