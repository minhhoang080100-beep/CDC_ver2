import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Lock,
  Bell,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  MessageSquare,
  Moon,
  Globe,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();  // Keep this for handleFeedback navigation
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogout = async () => {
    try {
      console.log('🔵 Settings: Logout button pressed');
      
      // Clear storage first
      console.log('🔵 Settings: Clearing AsyncStorage...');
      await AsyncStorage.clear();
      
      console.log('🔵 Settings: Clearing auth state...');
      await logout();
      
      console.log('🔵 Settings: Redirecting to login...');
      
      // Force reload page for web
      if (Platform.OS === 'web') {
        console.log('🔵 Settings: Using window.location.href');
        // Clear all possible storage
        if (typeof window !== 'undefined') {
          window.localStorage.clear();
          window.sessionStorage.clear();
          // Force navigation
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('🔴 Settings: Logout error:', error);
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Vui lòng nhập đầy đủ thông tin');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Mật khẩu mới không khớp');
      }
      return;
    }

    if (newPassword.length < 6) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Mật khẩu mới phải có ít nhất 6 ký tự');
      }
      return;
    }

    // TODO: Implement change password API
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert('Tính năng đổi mật khẩu đang được phát triển');
    }
    setChangePasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleFeedback = () => {
    router.push('/(tabs)/feedback');
  };

  const handleAbout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert('Ứng dụng Công đoàn Cảng Nghệ Tĩnh\nPhiên bản: 1.0.0\n\n© 2025 Công đoàn Cảng Nghệ Tĩnh');
    }
  };

  const handleHelp = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert('Để được hỗ trợ, vui lòng liên hệ:\n\nEmail: congdoan@ngheting.vn\nĐiện thoại: 0123-456-789\n\nHoặc gửi phản hồi qua mục "Gửi phản hồi" trong ứng dụng.');
    }
  };

  const getDepartmentName = (dept: string) => {
    switch (dept) {
      case 'VAN_PHONG_CANG':
        return 'Văn phòng Cảng';
      case 'CUA_LO':
        return 'Cửa Lò';
      case 'BEN_THUY':
        return 'Bến Thủy';
      default:
        return dept;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Quản trị viên';
      case 'BCH_VAN_PHONG':
        return 'BCH Văn phòng Cảng';
      case 'BCH_CUA_LO':
        return 'BCH Cửa Lò';
      case 'BCH_BEN_THUY':
        return 'BCH Bến Thủy';
      case 'THANH_VIEN_VAN_PHONG':
        return 'Thành viên Văn phòng';
      case 'THANH_VIEN_CUA_LO':
        return 'Thành viên Cửa Lò';
      case 'THANH_VIEN_BEN_THUY':
        return 'Thành viên Bến Thủy';
      default:
        return role;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CÀI ĐẶT</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài khoản</Text>
          <View style={styles.userInfoCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User color="#ffffff" size={40} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.fullName}</Text>
                <Text style={styles.userRole}>{getRoleName(user.role)}</Text>
                <Text style={styles.userDepartment}>{getDepartmentName(user.department)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cài đặt tài khoản</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setChangePasswordModalVisible(true)}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#fef3c7' }]}>
                <Lock color="#f59e0b" size={20} />
              </View>
              <Text style={styles.settingItemText}>Đổi mật khẩu</Text>
            </View>
            <ChevronRight color="#94a3b8" size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleFeedback}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#dbeafe' }]}>
                <MessageSquare color="#3b82f6" size={20} />
              </View>
              <Text style={styles.settingItemText}>Gửi phản hồi</Text>
            </View>
            <ChevronRight color="#94a3b8" size={20} />
          </TouchableOpacity>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ứng dụng</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#dcfce7' }]}>
                <Bell color="#10b981" size={20} />
              </View>
              <Text style={styles.settingItemText}>Thông báo</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#cbd5e1', true: '#0891b2' }}
              thumbColor={notificationsEnabled ? '#ffffff' : '#f4f4f5'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#e0e7ff' }]}>
                <Moon color="#6366f1" size={20} />
              </View>
              <Text style={styles.settingItemText}>Chế độ tối</Text>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#cbd5e1', true: '#0891b2' }}
              thumbColor={darkModeEnabled ? '#ffffff' : '#f4f4f5'}
              disabled
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#fce7f3' }]}>
                <Globe color="#ec4899" size={20} />
              </View>
              <Text style={styles.settingItemText}>Ngôn ngữ</Text>
            </View>
            <Text style={styles.settingValue}>Tiếng Việt</Text>
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hỗ trợ</Text>

          <TouchableOpacity style={styles.settingItem} onPress={handleHelp}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#fef3c7' }]}>
                <HelpCircle color="#f59e0b" size={20} />
              </View>
              <Text style={styles.settingItemText}>Trợ giúp</Text>
            </View>
            <ChevronRight color="#94a3b8" size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleAbout}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#dbeafe' }]}>
                <Info color="#3b82f6" size={20} />
              </View>
              <Text style={styles.settingItemText}>Thông tin ứng dụng</Text>
            </View>
            <ChevronRight color="#94a3b8" size={20} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color="#ef4444" size={24} />
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Phiên bản 1.0.0</Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
              <TouchableOpacity onPress={() => setChangePasswordModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  userInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  userDepartment: {
    fontSize: 13,
    color: '#94a3b8',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingItemText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fee2e2',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginLeft: 12,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeButton: {
    fontSize: 24,
    color: '#64748b',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  saveButton: {
    backgroundColor: '#0891b2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
