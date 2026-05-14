import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Power, Trophy } from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

type MiniGameSettingsResponse = {
  enabled: boolean;
  updatedAt?: string | null;
};

type ActiveMiniGame = {
  id: string;
  title: string;
  status: string;
} | null;

export default function MiniGameSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const settingsQuery = useQuery({
    queryKey: ['mini-game-settings'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/settings');
      return response.data as MiniGameSettingsResponse;
    },
  });

  const activeGameQuery = useQuery({
    queryKey: ['mini-game-active'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/active');
      return response.data as ActiveMiniGame;
    },
    enabled: settingsQuery.data?.enabled === true,
    refetchInterval: 5000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await api.put('/api/mini-games/settings', { enabled });
      return response.data as MiniGameSettingsResponse;
    },
    onSuccess: (data) => {
      showToast({
        message: data.enabled ? 'Đã bật Mini Game' : 'Đã tắt Mini Game',
        type: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['mini-game-settings'] });
      queryClient.invalidateQueries({ queryKey: ['mini-game-active'] });
      queryClient.invalidateQueries({ queryKey: ['mini-games'] });
    },
    onError: (error: any) => {
      showToast({
        message: error?.detail || error?.response?.data?.detail || 'Không thể cập nhật Mini Game',
        type: 'error',
      });
    },
  });

  if (settingsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const enabled = settingsQuery.data?.enabled === true;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Trophy color="#ffffff" size={24} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mini Game sự kiện</Text>
            <Text style={styles.subtitle}>Trạng thái hiển thị nút sự kiện cho đoàn viên</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Trạng thái</Text>
            <Text style={[styles.statusValue, enabled ? styles.statusOn : styles.statusOff]}>
              {enabled ? 'Đang bật' : 'Đang tắt'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleButton, enabled ? styles.toggleOffButton : styles.toggleOnButton, (!isSuperAdmin || toggleMutation.isPending) && styles.disabled]}
            disabled={!isSuperAdmin || toggleMutation.isPending}
            onPress={() => toggleMutation.mutate(!enabled)}
          >
            <Power color="#ffffff" size={18} />
            <Text style={styles.toggleButtonText}>{enabled ? 'Tắt' : 'Bật'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.eventBox}>
          <Text style={styles.statusLabel}>Sự kiện đang mở</Text>
          <Text style={styles.eventTitle}>
            {activeGameQuery.data?.title || 'Chưa có mini game đang chờ/đang chạy'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.openButton}
          onPress={() => router.push('/(tabs)/mini-game' as any)}
        >
          <ExternalLink color="#ffffff" size={18} />
          <Text style={styles.openButtonText}>Mở trang Mini Game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 720,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusOn: {
    color: '#10b981',
  },
  statusOff: {
    color: '#ef4444',
  },
  toggleButton: {
    minWidth: 104,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  toggleOnButton: {
    backgroundColor: '#10b981',
  },
  toggleOffButton: {
    backgroundColor: '#ef4444',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  eventBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  openButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
