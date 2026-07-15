import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Power,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';

type MiniGameSettingsResponse = {
  enabled: boolean;
  updatedAt?: string | null;
};

type LuckyNumberState = {
  event: {
    id: string;
    title: string;
    status: string;
    ticketCount?: number | null;
    winningDisplayNumber?: string | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  OPEN: 'Đang phát số',
  CLOSED: 'Đã đóng phát số',
  DRAWN: 'Đã quay số',
};

export default function MiniGameSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isDesktop } = useResponsive();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const settingsQuery = useQuery({
    queryKey: ['mini-game-settings'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/settings');
      return response.data as MiniGameSettingsResponse;
    },
  });

  const luckyStateQuery = useQuery({
    queryKey: ['lucky-number-state'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/lucky/state');
      return response.data as LuckyNumberState;
    },
    enabled: settingsQuery.data?.enabled === true || isSuperAdmin,
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
      queryClient.invalidateQueries({ queryKey: ['lucky-number-state'] });
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
  const luckyEvent = luckyStateQuery.data?.event;
  const eventStatus = luckyEvent ? statusLabels[luckyEvent.status] || luckyEvent.status : 'Chưa tạo';
  const ticketCount = luckyEvent?.ticketCount || 0;
  const winningNumber = luckyEvent?.winningDisplayNumber || 'Chưa quay';

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={[styles.header, !isDesktop && styles.headerMobile]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Trophy color="#ffffff" size={24} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Trung tâm Mini Game</Text>
              <Text style={styles.subtitle}>Quản lý quiz và quay số sự kiện</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              enabled ? styles.toggleButtonOn : styles.toggleButtonOff,
              (!isSuperAdmin || toggleMutation.isPending) && styles.disabled,
            ]}
            disabled={!isSuperAdmin || toggleMutation.isPending}
            onPress={() => toggleMutation.mutate(!enabled)}
          >
            {toggleMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Power color="#ffffff" size={17} />
                <Text style={styles.toggleButtonText}>{enabled ? 'Tắt nút' : 'Bật nút'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.statusBand}>
          <View style={styles.statusItem}>
            <Text style={styles.kicker}>Nút sự kiện</Text>
            <Text style={[styles.statusValue, enabled ? styles.statusOn : styles.statusOff]}>
              {enabled ? 'Đang bật' : 'Đang tắt'}
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.kicker}>Sự kiện may mắn</Text>
            <Text style={styles.statusValue} numberOfLines={1}>
              {eventStatus}
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.kicker}>Số đã phát</Text>
            <Text style={styles.statusValue}>{ticketCount}</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.kicker}>Số trúng</Text>
            <Text style={styles.statusValue} numberOfLines={1}>{winningNumber}</Text>
          </View>
        </View>

        <View style={[styles.modeGrid, !isDesktop && styles.modeGridMobile]}>
          <ModeButton
            title="Mini Game câu hỏi"
            meta="Quiz trực tiếp"
            Icon={ClipboardList}
            accent="#0ea5e9"
            onPress={() => router.push('/(tabs)/mini-game' as any)}
          />
          <ModeButton
            title="Số May Mắn"
            meta={luckyEvent?.title || 'Chưa có sự kiện'}
            Icon={Ticket}
            accent="#7c3aed"
            onPress={() => router.push('/(tabs)/lucky-number' as any)}
          />
        </View>
      </View>
    </View>
  );
}

function ModeButton({ title, meta, Icon, accent, onPress }: {
  title: string;
  meta: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.modeButton} activeOpacity={0.82} onPress={onPress}>
      <View style={[styles.modeIcon, { backgroundColor: `${accent}14` }]}>
        <Icon color={accent} size={22} />
      </View>
      <View style={styles.modeText}>
        <Text style={styles.modeTitle}>{title}</Text>
        <View style={styles.modeMetaRow}>
          <Users color="#94a3b8" size={14} />
          <Text style={styles.modeMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
      <View style={[styles.modeArrow, { borderColor: `${accent}33` }]}>
        <ExternalLink color={accent} size={16} />
      </View>
      <ChevronRight color="#cbd5e1" size={18} />
    </TouchableOpacity>
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
  panel: {
    width: '100%',
    maxWidth: 980,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    overflow: 'hidden',
  },
  header: {
    minHeight: 88,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  headerMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    minHeight: 42,
    minWidth: 118,
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleButtonOn: {
    backgroundColor: '#ef4444',
  },
  toggleButtonOff: {
    backgroundColor: '#10b981',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  statusBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  statusItem: {
    flex: 1,
    minWidth: 150,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  kicker: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  statusValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  statusOn: {
    color: '#059669',
  },
  statusOff: {
    color: '#ef4444',
  },
  modeGrid: {
    padding: 18,
    flexDirection: 'row',
    gap: 12,
  },
  modeGridMobile: {
    flexDirection: 'column',
  },
  modeButton: {
    flex: 1,
    minHeight: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    minWidth: 0,
  },
  modeTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  modeMetaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modeMeta: {
    flex: 1,
    minWidth: 0,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  modeArrow: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
