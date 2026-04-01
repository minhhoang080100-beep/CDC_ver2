import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { User, ShieldCheck } from 'lucide-react-native';
import { Platform, TouchableOpacity } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// QRCode only works on native (uses Node.js modules incompatible with web)
let QRCode: any = null;
if (Platform.OS !== 'web') {
  QRCode = require('react-native-qrcode-svg').default;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { isDesktop } = useResponsive();
  const router = useRouter();

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

  return (
    <SafeAreaView style={styles.container}>


      <ScrollView contentContainerStyle={[styles.content, isDesktop && { alignItems: 'center' as any }]}>
        <View style={isDesktop ? { width: '100%', maxWidth: 680 } as any : undefined}>
          <View style={styles.cardContainer}>
            <LinearGradient colors={['#ffffff', '#f8fafc']} style={styles.card}>
              <LinearGradient colors={Colors.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardHeader}>
                <Text style={styles.cardTitle}>CÔNG ĐOÀN CẢNG NGHỆ TĨNH</Text>
              </LinearGradient>

              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <User color="#ffffff" size={60} />
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.unionId}>Mã đoàn viên: {user.unionId}</Text>
              </View>

              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bộ phận:</Text>
                  <Text style={styles.detailValue}>
                    {getDepartmentName(user.department)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Chức vụ:</Text>
                  <Text style={styles.detailValue}>{getRoleName(user.role)}</Text>
                </View>
              </View>

              <View style={styles.qrSection}>
                <View style={styles.qrContainer}>
                  {Platform.OS !== 'web' && QRCode ? (
                    <QRCode
                      value={JSON.stringify({
                        id: user.id,
                        unionId: user.unionId,
                        name: user.fullName,
                      })}
                      size={120}
                    />
                  ) : (
                    <View style={{ width: 120, height: 120, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>QR Code{"\n"}(Xem trên app)</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.qrLabel}>Mã QR đoàn viên</Text>
              </View>

              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Đang hoạt động</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Thông tin tài khoản</Text>
            <View style={styles.infoBoxRow}>
              <Text style={styles.infoBoxLabel}>Tên đăng nhập:</Text>
              <Text style={styles.infoBoxValue}>{user.username}</Text>
            </View>
            <View style={styles.infoBoxRow}>
              <Text style={styles.infoBoxLabel}>Trạng thái:</Text>
              <Text style={[styles.infoBoxValue, styles.activeStatus]}>
                {user.status === 'ACTIVE' ? 'Hoạt động' : 'Ngưng hoạt động'}
              </Text>
            </View>
          </View>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  headerTitleFB: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#050505',
  },
  content: {
    padding: 16,
  },
  cardContainer: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border + '40',
  },
  cardHeader: {
    marginHorizontal: -24,
    marginTop: -24,
    padding: 16,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    ...Colors.shadows.md,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  unionId: {
    fontSize: 16,
    color: '#0891b2',
    fontWeight: '600',
  },
  detailsSection: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border + '40',
  },
  qrLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
  },
  infoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border + '40',
  },
  infoBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  infoBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoBoxLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoBoxValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  activeStatus: {
    color: '#10b981',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    gap: 12,
    marginBottom: 20,
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});