import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../contexts/ToastContext';
import { Calendar, MapPin, Users, Plus, Edit2, Trash2, QrCode } from 'lucide-react-native';
import CreateActivityModal from '../../components/CreateActivityModal';
import QRScannerModal from '../../components/QRScannerModal';
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
}

export default function ActivitiesScreen() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { gridColumns, isDesktop } = useResponsive();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerActivityId, setScannerActivityId] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await api.get('/api/activities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const handleCreateSuccess = () => {
    fetchActivities();
  };

  const handleRegister = async (activityId: string) => {
    try {
      await api.post(
        `/api/activities/${activityId}/register`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchActivities();
    } catch (error) {
      console.error('Error registering:', error);
    }
  };

  const canCreateActivity = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

  const canEditDelete = (activity: Activity) => {
    return user?.role === 'SUPER_ADMIN' || activity.createdBy === user?.id;
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bạn có chắc muốn xóa hoạt động này?')) {
        try {
          await api.delete(`/api/activities/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          showToast({ message: 'Đã xóa hoạt động', type: 'success' });
          fetchActivities();
        } catch (error) {
          console.error('Error deleting activity:', error);
          showToast({ message: 'Không thể xóa hoạt động', type: 'error' });
        }
      }
    }
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
      <View style={{ flex: 1 }}>
        <WebHoverCard style={styles.activityCard}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getTypeColor(item.type) },
            ]}
          >
            <Text style={styles.typeText}>{getTypeName(item.type)}</Text>
          </View>
          <Text style={styles.activityName}>{item.name}</Text>
          <Text style={styles.activityDescription}>{item.description}</Text>

          <View style={styles.infoRow}>
            <Calendar color="#64748b" size={18} />
            <Text style={styles.infoText}>{item.time}</Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin color="#64748b" size={18} />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Users color="#64748b" size={18} />
            <Text style={styles.infoText}>
              {item.registrations.length} đăng ký • {item.attendances?.length || 0} có mặt
            </Text>
          </View>

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
                {registered ? 'Đã đăng ký' : 'Đăng ký ngay'}
              </Text>
            </TouchableOpacity>

            {(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) && (
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => {
                  setScannerActivityId(item.id);
                  setScannerVisible(true);
                }}
              >
                <QrCode color="#ffffff" size={20} />
              </TouchableOpacity>
            )}
          </View>

          {canEditDelete(item) && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEdit(item)}
              >
                <Edit2 color="#3b82f6" size={20} />
                <Text style={styles.actionTextEdit}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 color="#ef4444" size={20} />
                <Text style={styles.actionTextDelete}>Xóa</Text>
              </TouchableOpacity>
            </View>
          )}
        </WebHoverCard>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HOẠT ĐỘNG CÔNG ĐOÀN</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <Text style={styles.headerTitle}>HOẠT ĐỘNG CÔNG ĐOÀN</Text>
        {canCreateActivity && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus color="#ffffff" size={24} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        key={gridColumns}
        numColumns={gridColumns}
        columnWrapperStyle={gridColumns > 1 ? { gap: 16 } : undefined}
        contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 1000, alignSelf: 'center' as any, width: '100%' as any }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0891b2']}
          />
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
          fetchActivities();
        }}
      />
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
    backgroundColor: Colors.header.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.header.text,
    letterSpacing: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 24,
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
    padding: 16,
  },
  activityCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
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
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  registeredButton: {
    backgroundColor: Colors.status.success,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.light,
  },
  registeredButtonText: {
    color: Colors.text.light,
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
    paddingVertical: 6,
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
    backgroundColor: Colors.primary,
    width: 44,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
});