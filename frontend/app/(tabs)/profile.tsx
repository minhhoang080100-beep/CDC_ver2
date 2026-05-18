import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import {
  User, ShieldCheck, MapPin, Phone, Calendar,
  Briefcase, Building2, GraduationCap, Heart, Flag,
  CreditCard, Mail, Edit2, Save, X, Camera, Trash2
} from 'lucide-react-native';
import { Platform, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useResponsive } from '../../hooks/useResponsive';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

const CLOUD_NAME = 'dljjearo2';
const UPLOAD_PRESET = 'CDCnghetinh';

// QRCode only works on native (uses Node.js modules incompatible with web)
let QRCode: any = null;
if (Platform.OS !== 'web') {
  QRCode = require('react-native-qrcode-svg').default;
}

interface MemberProfile {
  fullName: string | null;
  workUnit: string | null;
  department: string | null;
  position: string | null;
  birthDate: string | null;
  phoneNumber: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  email: string | null;
  gender: string | null;
  educationLevel: string | null;
  qualification: string | null;
  professionalQualification: string | null;
  major: string | null;
  isPartyMember: boolean | null;
  partyJoinDate: string | null;
  unionJoinDate: string | null;
  cccdNumber: string | null;
  idNumber: string | null;
  familyBackground: string | null;
  employeeId: string | null;
}

interface ProfileForm {
  fullName: string;
  cccdNumber: string;
  phoneNumber: string;
  email: string;
  hometown: string;
  permanentAddress: string;
  familyBackground: string;
}

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconContainer}>
          {icon}
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    fullName: '',
    cccdNumber: '',
    phoneNumber: '',
    email: '',
    hometown: '',
    permanentAddress: '',
    familyBackground: '',
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await api.get('/api/auth/my-profile');
      if (res.data?.found) {
        setProfile(res.data.profile);
      } else {
        setProfileError(res.data?.message || 'Không tìm thấy hồ sơ đoàn viên');
      }
    } catch (err: any) {
      setProfileError('Lỗi khi tải thông tin cá nhân');
    } finally {
      setProfileLoading(false);
    }
  };

  const uploadAvatarToCloudinary = async (base64Img: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', base64Img);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'cong-doan-avatars');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;
  };

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast({ message: 'Ứng dụng cần quyền truy cập thư viện ảnh để đổi ảnh đại diện', type: 'error' });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        showToast({ message: 'Không thể đọc dữ liệu ảnh đã chọn', type: 'error' });
        return;
      }

      setAvatarUploading(true);
      const mimeType = asset.mimeType || 'image/jpeg';
      const avatarUrl = await uploadAvatarToCloudinary(`data:${mimeType};base64,${asset.base64}`);
      await api.put('/api/auth/me', { avatar: avatarUrl });
      await refreshUser();
      showToast({ message: 'Đã cập nhật ảnh đại diện', type: 'success' });
    } catch (error: any) {
      showToast({
        message: error?.response?.data?.detail || error?.detail || error?.message || 'Không thể cập nhật ảnh đại diện',
        type: 'error',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar || avatarUploading) return;

    setAvatarUploading(true);
    try {
      await api.put('/api/auth/me', { avatar: '' });
      await refreshUser();
      showToast({ message: 'Đã gỡ ảnh đại diện', type: 'success' });
    } catch (error: any) {
      showToast({
        message: error?.response?.data?.detail || error?.detail || 'Không thể gỡ ảnh đại diện',
        type: 'error',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const openEditProfile = () => {
    if (!user) return;
    setProfileForm({
      fullName: profile?.fullName || user.fullName || '',
      cccdNumber: profile?.cccdNumber || user.cccdNumber || '',
      phoneNumber: profile?.phoneNumber || '',
      email: profile?.email || '',
      hometown: profile?.hometown || '',
      permanentAddress: profile?.permanentAddress || '',
      familyBackground: profile?.familyBackground || '',
    });
    setEditVisible(true);
  };

  const updateProfileForm = (field: keyof ProfileForm, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.fullName.trim()) {
      showToast({ message: 'Họ tên không được để trống', type: 'error' });
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        fullName: profileForm.fullName.trim(),
        cccdNumber: profileForm.cccdNumber.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        email: profileForm.email.trim(),
        hometown: profileForm.hometown.trim(),
        permanentAddress: profileForm.permanentAddress.trim(),
        familyBackground: profileForm.familyBackground.trim(),
      };

      const response = await api.put('/api/auth/me', payload);
      if (response.data?.profile) {
        setProfile(response.data.profile);
        setProfileError(null);
      }
      await refreshUser();
      await fetchProfile();
      setEditVisible(false);
      if (response.data?.profileFound === false) {
        showToast({
          message: 'Đã cập nhật tài khoản. Hồ sơ đoàn viên chưa liên kết nên thông tin liên hệ chưa được ghi.',
          type: 'info',
          duration: 5000,
        });
      } else {
        showToast({ message: 'Đã cập nhật thông tin cá nhân', type: 'success' });
      }
    } catch (error: any) {
      showToast({
        message: error.response?.data?.detail || error.detail || 'Không thể cập nhật thông tin cá nhân',
        type: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const renderEditInput = (
    label: string,
    field: keyof ProfileForm,
    placeholder: string,
    options?: { multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' }
  ) => (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, options?.multiline && styles.formTextArea]}
        value={profileForm[field]}
        onChangeText={(value) => updateProfileForm(field, value)}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={options?.multiline}
        keyboardType={options?.keyboardType || 'default'}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
      />
    </View>
  );

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
      case 'BCH_VANPHONG':
        return 'BCH Văn phòng Cảng';
      case 'BCH_CUALO':
        return 'BCH Cửa Lò';
      case 'BCH_BENTHUY':
        return 'BCH Bến Thủy';
      case 'MEMBER':
        return 'Thành viên';
      default:
        return role;
    }
  };

  if (!user) {
    return null;
  }

  // Use profile data if available, otherwise fall back to user data
  const displayName = profile?.fullName || user.fullName;
  const displayDepartment = profile?.department || profile?.workUnit || getDepartmentName(user.department);
  const displayPosition = profile?.position || getRoleName(user.role);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, isDesktop && { alignItems: 'center' as any }]}>
        <View style={isDesktop ? { width: '100%', maxWidth: 680 } as any : undefined}>
          {/* ═══ THẺ ĐOÀN VIÊN (Compact) ═══ */}
          <View style={styles.cardContainer}>
            <LinearGradient colors={['#ffffff', '#f8fafc']} style={styles.card}>
              {/* Header gradient bar */}
              <LinearGradient
                colors={Colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardHeader}
              >
                <Text style={styles.cardOrgName}>CÔNG ĐOÀN CẢNG NGHỆ TĨNH</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Đang hoạt động</Text>
                </View>
              </LinearGradient>

              {/* Main content: Avatar + Info + QR */}
              <View style={styles.cardBody}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <TouchableOpacity
                    style={styles.avatarButton}
                    onPress={handlePickAvatar}
                    disabled={avatarUploading}
                    activeOpacity={0.82}
                  >
                    <View style={styles.avatar}>
                      {user.avatar ? (
                        <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                      ) : (
                        <User color="#ffffff" size={36} />
                      )}
                      {avatarUploading && (
                        <View style={styles.avatarLoadingOverlay}>
                          <ActivityIndicator size="small" color="#ffffff" />
                        </View>
                      )}
                    </View>
                    <View style={styles.avatarEditBadge}>
                      <Camera color="#ffffff" size={14} />
                    </View>
                  </TouchableOpacity>
                  {user.avatar && (
                    <TouchableOpacity
                      style={styles.removeAvatarButton}
                      onPress={handleRemoveAvatar}
                      disabled={avatarUploading}
                      activeOpacity={0.8}
                    >
                      <Trash2 color="#ef4444" size={13} />
                      <Text style={styles.removeAvatarText}>Gỡ ảnh</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Center info */}
                <View style={styles.cardCenterInfo}>
                  <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                  {profile?.employeeId && (
                    <Text style={styles.employeeId}>MNV: {profile.employeeId}</Text>
                  )}
                  <View style={styles.cardMetaRow}>
                    <Building2 color="#94a3b8" size={13} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>{displayDepartment}</Text>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <Briefcase color="#94a3b8" size={13} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>{displayPosition}</Text>
                  </View>
                </View>

                {/* QR Code (compact) */}
                <View style={styles.qrContainer}>
                  {Platform.OS !== 'web' && QRCode ? (
                    <QRCode
                      value={JSON.stringify({
                        id: user.id,
                        unionId: user.unionId,
                        name: user.fullName,
                      })}
                      size={72}
                    />
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Text style={styles.qrPlaceholderText}>QR</Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ═══ THÔNG TIN CÁ NHÂN ═══ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIconBg}>
                  <User color="#ffffff" size={18} />
                </View>
                <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
              </View>
              <TouchableOpacity style={styles.editProfileButton} onPress={openEditProfile}>
                <Edit2 color={Colors.primary} size={16} />
                <Text style={styles.editProfileText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            </View>

            {profileLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Đang tải thông tin...</Text>
              </View>
            ) : profileError ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>{profileError}</Text>
                <Text style={styles.emptySubtext}>
                  Vui lòng liên hệ Ban Chấp hành để cập nhật số CCCD vào hệ thống
                </Text>
              </View>
            ) : profile ? (
              <View style={styles.infoGrid}>
                <InfoRow
                  icon={<User color="#3b82f6" size={16} />}
                  label="Họ và tên"
                  value={profile.fullName}
                />
                <InfoRow
                  icon={<Building2 color="#8b5cf6" size={16} />}
                  label="Bộ phận"
                  value={profile.department || profile.workUnit}
                />
                <InfoRow
                  icon={<Briefcase color="#f59e0b" size={16} />}
                  label="Chức vụ"
                  value={profile.position}
                />
                <InfoRow
                  icon={<Calendar color="#ef4444" size={16} />}
                  label="Ngày sinh"
                  value={profile.birthDate}
                />
                <InfoRow
                  icon={<Phone color="#10b981" size={16} />}
                  label="Số điện thoại"
                  value={profile.phoneNumber}
                />
                <InfoRow
                  icon={<MapPin color="#06b6d4" size={16} />}
                  label="Quê quán"
                  value={profile.hometown}
                />
                <InfoRow
                  icon={<MapPin color="#ec4899" size={16} />}
                  label="Địa chỉ thường trú"
                  value={profile.permanentAddress}
                />
              </View>
            ) : null}
          </View>

          {/* ═══ THÔNG TIN TÀI KHOẢN ═══ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#64748b' }]}>
                <ShieldCheck color="#ffffff" size={18} />
              </View>
              <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
            </View>
            <View style={styles.infoGrid}>
              <InfoRow
                icon={<User color="#64748b" size={16} />}
                label="Tên đăng nhập"
                value={user.username}
              />
              <InfoRow
                icon={<CreditCard color="#0ea5e9" size={16} />}
                label="CCCD/CMND"
                value={user.cccdNumber || profile?.cccdNumber}
              />
              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <View style={styles.infoIconContainer}>
                    <ShieldCheck color="#10b981" size={16} />
                  </View>
                  <Text style={styles.infoLabel}>Trạng thái</Text>
                </View>
                <View style={[styles.statusChip, user.status === 'ACTIVE' ? styles.statusChipActive : styles.statusChipInactive]}>
                  <Text style={[styles.statusChipText, user.status === 'ACTIVE' ? styles.statusChipTextActive : styles.statusChipTextInactive]}>
                    {user.status === 'ACTIVE' ? 'Hoạt động' : 'Ngưng'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ═══ NÚT QUẢN TRỊ ═══ */}
          {(!isDesktop && (user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_'))) && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => router.push('/(tabs)/admin')}
              activeOpacity={0.8}
            >
              <ShieldCheck color="#ffffff" size={24} />
              <Text style={styles.adminButtonText}>Quản trị hệ thống</Text>
            </TouchableOpacity>
          )}

          {/* Bottom spacing for tab bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <Modal
        visible={editVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, isDesktop && styles.editModalDesktop]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cập nhật thông tin cá nhân</Text>
                <Text style={styles.modalSubtitle}>Một số thông tin nghiệp vụ vẫn do BCH quản lý</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setEditVisible(false)} disabled={savingProfile}>
                <X color="#64748b" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {renderEditInput('Họ và tên', 'fullName', 'Nhập họ và tên')}
              {renderEditInput('CCCD/CMND', 'cccdNumber', 'Nhập số CCCD hoặc CMND', { keyboardType: 'number-pad' })}
              {renderEditInput('Số điện thoại', 'phoneNumber', 'Nhập số điện thoại', { keyboardType: 'phone-pad' })}
              {renderEditInput('Email', 'email', 'Nhập email', { keyboardType: 'email-address' })}
              {renderEditInput('Quê quán', 'hometown', 'Nhập quê quán')}
              {renderEditInput('Địa chỉ thường trú', 'permanentAddress', 'Nhập địa chỉ thường trú', { multiline: true })}
              {renderEditInput('Hoàn cảnh gia đình', 'familyBackground', 'Nhập thông tin nếu cần', { multiline: true })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditVisible(false)}
                disabled={savingProfile}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingProfile && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Save color="#ffffff" size={18} />
                )}
                <Text style={styles.saveButtonText}>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    padding: 16,
  },

  // ═══ THẺ ĐOÀN VIÊN ═══
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Colors.shadows.lg,
  },
  cardHeader: {
    marginHorizontal: -24,
    marginTop: -24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardOrgName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Card body — horizontal layout
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 8,
  },
  avatarButton: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e0e7ff',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  removeAvatarButton: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeAvatarText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  cardCenterInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  employeeId: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },

  // QR (compact)
  qrContainer: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrPlaceholder: {
    width: 72,
    height: 72,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  qrPlaceholderText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // ═══ SECTIONS ═══
  sectionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...Colors.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  editProfileText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // Info rows
  infoGrid: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  infoIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },

  // Status chip
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusChipActive: {
    backgroundColor: '#dcfce7',
  },
  statusChipInactive: {
    backgroundColor: '#fee2e2',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: '#10b981',
  },
  statusChipTextInactive: {
    color: '#ef4444',
  },

  // Loading & empty states
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Family background
  familyBgBox: {
    padding: 20,
  },
  familyBgText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },

  // Admin button
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    gap: 12,
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Edit profile modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModal: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editModalDesktop: {
    maxWidth: 620,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: 520,
  },
  modalBodyContent: {
    padding: 20,
    gap: 14,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  formInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  formTextArea: {
    minHeight: 92,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
