import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import {
  User, ShieldCheck, MapPin, Phone, Calendar,
  Briefcase, Building2, GraduationCap, Heart, Flag,
  CreditCard, Mail
} from 'lucide-react-native';
import { Platform, TouchableOpacity } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';

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

export default function ProfileScreen() {
  const { user } = useAuth();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

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
                  <View style={styles.avatar}>
                    <User color="#ffffff" size={36} />
                  </View>
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
              <View style={styles.sectionIconBg}>
                <User color="#ffffff" size={18} />
              </View>
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
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
});