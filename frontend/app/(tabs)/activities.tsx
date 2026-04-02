import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Calendar, MapPin, Users, Plus, Edit2, Trash2, QrCode, Search, User, ScanLine, Monitor, ToggleLeft, ToggleRight } from 'lucide-react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import CreateActivityModal from '../../components/CreateActivityModal';
import QRScannerModal from '../../components/QRScannerModal';
import ActivityCheckinQRModal from '../../components/ActivityCheckinQRModal';
import MemberCheckinModal from '../../components/MemberCheckinModal';
import ActivityParticipantsModal from '../../components/ActivityParticipantsModal';
import WebHoverCard from '../../components/WebHoverCard';
import { api } from '../../utils/api';

interface Activity {
  id: string;
  name: string;
  description: string;
  time: string;
  location: string;
  type: string;
  createdBy: string;
  targetDepartments: string[];
  registrations: Array<{ userId: string; userName: string }>;
  attendances?: Array<{ userId: string; userName: string; checkedInAt: string }>;
  checkinEnabled?: boolean;
}

export default function ActivitiesScreen() {
  const { user, token } = useAuth();
  const { showConfirm } = useConfirm();
  const { showToast } = useToast();
  const { gridColumns, isDesktop } = useResponsive();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerActivityId, setScannerActivityId] = useState<string | null>(null);
  const [checkinQRVisible, setCheckinQRVisible] = useState(false);
  const [checkinQRActivityId, setCheckinQRActivityId] = useState<string | null>(null);
  const [memberCheckinVisible, setMemberCheckinVisible] = useState(false);
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [participantsActivity, setParticipantsActivity] = useState<Activity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['activities'],
    queryFn: async ({ pageParam }) => {
      const response = await api.get(`/api/activities?skip=${(pageParam as number) * 20}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!token,
  });

  const activities = data?.pages.flatMap((page: any) => page.items) || [];

  const onRefresh = () => {
    refetch();
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  };

  const handleRegister = async (activityId: string) => {
    try {
      await api.post(
        `/api/activities/${activityId}/register`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (error) {
      console.error('Error registering:', error);
    }
  };

  const canCreateActivity = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');
  const isBCH = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

  const handleToggleCheckin = async (activityId: string) => {
    try {
      const response = await api.post(
        `/api/activities/${activityId}/toggle-checkin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast({ message: response.data.message, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (error: any) {
      showToast({ message: error.detail || 'Không thể thay đổi trạng thái điểm danh', type: 'error' });
    }
  };

  const canEditDelete = (activity: Activity) => {
    return user?.role === 'SUPER_ADMIN' || activity.createdBy === user?.id;
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    showConfirm({
      title: 'Xóa hoạt động',
      message: 'Bạn có chắc chắn muốn xóa hoạt động này? Mọi thông tin, bao gồm cả danh sách người đăng ký sẽ bị xóa hoàn toàn.',
      type: 'danger',
      confirmText: 'Xóa hoạt động',
      onConfirm: async () => {
        try {
          await api.delete(`/api/activities/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          showToast({ message: 'Đã xóa hoạt động thành công', type: 'success' });
          queryClient.invalidateQueries({ queryKey: ['activities'] }); // Refresh list after deletion
        } catch (error) {
          console.error('Error deleting activity:', error);
          showToast({ message: 'Không thể xóa hoạt động. Thử lại sau.', type: 'error' });
        }
      }
    });
  };

  const isRegistered = (activity: Activity) => {
    return activity.registrations.some((reg) => reg.userId === user?.id);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SPORTS':
        return '#10b981';
      case 'TRAINING':
        return '#3b82f6';
      case 'VACATION':
        return '#f59e0b';
      default:
        return '#6366f1';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SPORTS':
        return 'Thể thao';
      case 'TRAINING':
        return 'Tập huấn';
      case 'VACATION':
        return 'Nghỉ mát';
      default:
        return type;
    }
  };

  const renderActivity = ({ item }: { item: Activity }) => {
    const registered = isRegistered(item);
    return (
      <View style={{ flex: 1, marginBottom: 8, maxWidth: 680, alignSelf: 'center', width: '100%' }}>
        <WebHoverCard style={styles.activityCard}>
          <View style={styles.activityHeaderRow}>
            <View>
              <Text style={styles.activityName}>{item.name}</Text>
              <Text style={styles.activityDateMeta}>
                {getTypeName(item.type)} • {item.time}
              </Text>
            </View>
          </View>
          
          <Text style={styles.activityDescription}>{item.description}</Text>

          <View style={styles.infoRow}>
            <MapPin color="#64748b" size={16} />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.infoRow, { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6, alignSelf: 'flex-start' }]}
            onPress={() => {
              setParticipantsActivity(item);
              setParticipantsVisible(true);
            }}
          >
            <Users color="#0891b2" size={16} />
            <Text style={[styles.infoText, { color: '#0f172a', fontWeight: '500' }]}>
              {item.registrations.length} đăng ký • {item.attendances?.length || 0} có mặt
            </Text>
          </TouchableOpacity>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.registerButton,
                registered && styles.registeredButton,
                { flex: 1 }
              ]}
              onPress={() => handleRegister(item.id)}
            >
              <Text
                style={[
                  styles.registerButtonText,
                  registered && styles.registeredButtonText,
                ]}
              >
                {registered ? 'Đã đăng ký tham gia' : 'Tham gia'}
              </Text>
            </TouchableOpacity>

            {/* Member: Điểm danh via self-checkin */}
            {item.checkinEnabled && (
              <TouchableOpacity
                style={styles.checkinButton}
                onPress={() => setMemberCheckinVisible(true)}
              >
                <ScanLine color="#fff" size={18} />
                <Text style={styles.checkinButtonText}>Điểm danh</Text>
              </TouchableOpacity>
            )}

            {/* BCH: Quét QR đoàn viên (cũ) */}
            {isBCH && (
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => {
                  setScannerActivityId(item.id);
                  setScannerVisible(true);
                }}
              >
                <QrCode color="#050505" size={20} />
              </TouchableOpacity>
            )}
          </View>

          {/* BCH: Toggle checkin + Hiển thị QR */}
          {isBCH && (
            <View style={styles.bchCheckinRow}>
              <TouchableOpacity
                style={[styles.toggleCheckinBtn, item.checkinEnabled && styles.toggleCheckinBtnActive]}
                onPress={() => handleToggleCheckin(item.id)}
              >
                {item.checkinEnabled ? (
                  <ToggleRight color="#10b981" size={20} />
                ) : (
                  <ToggleLeft color="#94a3b8" size={20} />
                )}
                <Text style={[styles.toggleCheckinText, item.checkinEnabled && { color: '#10b981' }]}>
                  {item.checkinEnabled ? 'Điểm danh: Bật' : 'Điểm danh: Tắt'}
                </Text>
              </TouchableOpacity>

              {item.checkinEnabled && (
                <TouchableOpacity
                  style={styles.showQRBtn}
                  onPress={() => {
                    setCheckinQRActivityId(item.id);
                    setCheckinQRVisible(true);
                  }}
                >
                  <Monitor color="#fff" size={16} />
                  <Text style={styles.showQRBtnText}>Hiển thị QR</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {canEditDelete(item) && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEdit(item)}
              >
                <Edit2 color={Colors.text.secondary} size={18} />
                <Text style={styles.actionTextEdit}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 color={Colors.text.secondary} size={18} />
                <Text style={styles.actionTextDelete}>Xóa</Text>
              </TouchableOpacity>
            </View>
          )}
        </WebHoverCard>
      </View>
    );
  };

  const filteredActivities = activities.filter(activity =>
    activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>


      <FlatList
        data={filteredActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any },
          !isDesktop && { paddingBottom: 110 } // Tăng padding bottom cho mobile để tránh bị tab bar đè lên
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={['#0891b2']}
          />
        }
        ListHeaderComponent={
          <>
            {/* Search Bar */}
            <View style={[styles.searchContainer, isDesktop && { marginTop: 8 }]}>
              <View style={styles.searchInputWrapper}>
                <Search color={Colors.text.placeholder} size={20} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm hoạt động..."
                  placeholderTextColor={Colors.text.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {canCreateActivity && (
              <View style={[isDesktop && { paddingTop: 8 }, !isDesktop && { paddingTop: 8, paddingHorizontal: 0 }]}>
                <TouchableOpacity 
                  style={[styles.createPostBox, isDesktop && { borderWidth: 1, borderColor: Colors.border + '40', borderRadius: 8 }]}
                  onPress={() => setModalVisible(true)}
                >
                  <View style={styles.createPostHeader}>
                    <View style={styles.avatarMini}>
                      <User size={24} color="#bac2c9" />
                    </View>
                    <View style={styles.createPostInput}>
                      <Text style={styles.createPostPlaceholder}>Tạo hoạt động mới...</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có hoạt động nào</Text>
          </View>
        }
      />

      <CreateActivityModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingActivity(null);
        }}
        onSuccess={handleCreateSuccess}
        editActivity={editingActivity}
      />

      <QRScannerModal
        visible={scannerVisible}
        activityId={scannerActivityId}
        onClose={() => setScannerVisible(false)}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }}
      />

      <ActivityCheckinQRModal
        visible={checkinQRVisible}
        activityId={checkinQRActivityId}
        onClose={() => setCheckinQRVisible(false)}
      />

      <MemberCheckinModal
        visible={memberCheckinVisible}
        onClose={() => setMemberCheckinVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }}
      />

      <ActivityParticipantsModal
        visible={participantsVisible}
        onClose={() => setParticipantsVisible(false)}
        activity={participantsActivity}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  createPostBox: { backgroundColor: '#ffffff', padding: 16, marginBottom: 8 },
  createPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e4e6eb', justifyContent: 'center', alignItems: 'center' },
  avatarMiniText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  createPostInput: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  createPostPlaceholder: { color: '#65676B', fontSize: 16 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border + '40',
    ...Colors.shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  listContent: {
    padding: Platform.select({ ios: 12, android: 12, default: 16 }), // Small padding on mobile
  },
  activityCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Platform.select({ ios: 14, android: 14, default: 16 }),
    marginBottom: 8,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityDateMeta: {
    fontSize: 13,
    color: '#65676b',
    marginTop: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text.light,
  },
  activityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  activityDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  registerButton: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  registeredButton: {
    backgroundColor: '#e4e6eb',
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  registeredButtonText: {
    color: '#050505',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.placeholder,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10, // Tăng touch target
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionTextEdit: {
    fontSize: 14,
    color: Colors.status.info,
    fontWeight: '600',
  },
  actionTextDelete: {
    fontSize: 14,
    color: Colors.status.error,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#e4e6eb',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleFB: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  iconButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonCircleActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Self Check-in styles ──
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    height: 40,
  },
  checkinButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  bchCheckinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  toggleCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  toggleCheckinBtnActive: {
    backgroundColor: '#dcfce7',
  },
  toggleCheckinText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  showQRBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  showQRBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});