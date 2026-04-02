import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import {
  Bell, CheckCheck, Newspaper, Calendar,
  ClipboardList, Trophy, GraduationCap, MessageSquare,
  Megaphone, Inbox, MoreHorizontal,
} from 'lucide-react-native';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

// Icon + color mapping per notification type
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'new_post': return { Icon: Newspaper, color: '#ffffff', bg: '#3b82f6' };
    case 'new_activity': return { Icon: Calendar, color: '#ffffff', bg: '#10b981' };
    case 'new_survey': return { Icon: ClipboardList, color: '#ffffff', bg: '#f59e0b' };
    case 'new_honor': return { Icon: Trophy, color: '#ffffff', bg: '#eab308' };
    case 'new_course': return { Icon: GraduationCap, color: '#ffffff', bg: '#8b5cf6' };
    case 'new_feedback': return { Icon: MessageSquare, color: '#ffffff', bg: '#06b6d4' };
    default: return { Icon: Megaphone, color: '#ffffff', bg: Colors.primary };
  }
};

const getRoute = (type: string): string | null => {
  switch (type) {
    case 'new_post': return '/(tabs)';
    case 'new_activity': return '/(tabs)/activities';
    case 'new_survey': return '/(tabs)/surveys';
    case 'new_honor': return '/(tabs)/honors';
    case 'new_course': return '/(tabs)/elearning';
    case 'new_feedback': return '/(tabs)/feedback';
    default: return null;
  }
};

// Relative time like Facebook
const relativeTime = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 7) return `${diffDays} ngày`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần`;
    return `${Math.floor(diffDays / 30)} tháng`;
  } catch {
    return '';
  }
};

const getSectionKey = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'today';
    if (isYesterday(date)) return 'yesterday';
    if (isThisWeek(date)) return 'week';
    return 'older';
  } catch {
    return 'older';
  }
};

const SECTION_LABELS: Record<string, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  week: 'Tuần này',
  older: 'Trước đó',
};

export default function NotificationsScreen() {
  const { token } = useAuth();
  const { isDesktop } = useResponsive();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/api/notifications?skip=${(pageParam as number) * 20}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    enabled: !!token,
  });

  const allNotifications: Notification[] = data?.pages.flatMap((p: any) => p.items) || [];
  const unreadCount = data?.pages[0]?.unread || 0;

  const notifications = filter === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all', {}, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
    },
  });

  const handlePress = (notif: Notification) => {
    if (!notif.read) markReadMutation.mutate(notif.id);
    const route = getRoute(notif.type);
    if (route) router.push(route as any);
  };

  // Build flat list with section headers
  const flatData = React.useMemo(() => {
    const items: Array<
      | { type: 'header'; sectionKey: string }
      | { type: 'item'; notification: Notification }
    > = [];
    let currentSection = '';

    notifications.forEach((notif) => {
      const key = getSectionKey(notif.createdAt);
      if (key !== currentSection) {
        currentSection = key;
        items.push({ type: 'header', sectionKey: key });
      }
      items.push({ type: 'item', notification: notif });
    });

    return items;
  }, [notifications]);

  const renderItem = ({ item }: { item: typeof flatData[number] }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{SECTION_LABELS[item.sectionKey]}</Text>
          {item.sectionKey === 'today' && unreadCount > 0 && (
            <TouchableOpacity onPress={() => markAllReadMutation.mutate()}>
              <Text style={styles.seeAllBtn}>Xem tất cả</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const notif = item.notification;
    const { Icon, color, bg } = getTypeIcon(notif.type);
    const time = relativeTime(notif.createdAt);

    return (
      <TouchableOpacity
        style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
        onPress={() => handlePress(notif)}
        activeOpacity={0.65}
      >
        {/* Avatar with type icon overlay */}
        <View style={styles.avatarCol}>
          <View style={styles.avatar}>
            <Bell color="#94a3b8" size={22} />
          </View>
          <View style={[styles.typeIconBadge, { backgroundColor: bg }]}>
            <Icon color={color} size={12} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentCol}>
          <Text style={[styles.notifText, !notif.read && styles.notifTextBold]} numberOfLines={3}>
            {notif.title}
            {notif.body ? ` ${notif.body}` : ''}
          </Text>
          <Text style={[styles.timeText, !notif.read && { color: Colors.primary }]}>
            {time}
          </Text>
        </View>

        {/* Unread dot */}
        {!notif.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.panel, isDesktop && styles.panelDesktop]}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck color={Colors.primary} size={18} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Filter Tabs ─── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, filter === 'all' && styles.tabActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filter === 'unread' && styles.tabActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.tabText, filter === 'unread' && styles.tabTextActive]}>
              Chưa đọc
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── List ─── */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={flatData}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              item.type === 'header' ? `h-${item.sectionKey}` : `n-${item.notification.id}`
            }
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} colors={[Colors.primary]} />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              <>
                {isFetchingNextPage && (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                )}
                {hasNextPage && !isFetchingNextPage && notifications.length > 0 && (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchNextPage()}>
                    <Text style={styles.loadMoreText}>Xem thông báo trước đó</Text>
                  </TouchableOpacity>
                )}
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Inbox color="#94a3b8" size={52} />
                <Text style={styles.emptyTitle}>
                  {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
                </Text>
                <Text style={styles.emptySubtext}>
                  Bạn sẽ nhận được thông báo khi có tin mới từ Công Đoàn
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },

  // Panel — centered on desktop like Facebook
  panel: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  panelDesktop: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%' as any,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e4e6eb',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#050505',
  },
  markAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filter tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e4e6eb',
  },
  tabActive: {
    backgroundColor: '#e7f3ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#050505',
  },
  seeAllBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Notification item — Facebook style
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  notifItemUnread: {
    backgroundColor: '#e7f3ff',
  },

  // Avatar with badge
  avatarCol: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  // Content 
  contentCol: {
    flex: 1,
    gap: 2,
  },
  notifText: {
    fontSize: 14,
    color: '#050505',
    lineHeight: 20,
  },
  notifTextBold: {
    fontWeight: '600',
  },
  timeText: {
    fontSize: 13,
    color: '#65676b',
    fontWeight: '500',
  },

  // Unread dot
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },

  // List
  listContent: {
    paddingBottom: 100,
  },

  // Load more
  loadMoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e4e6eb',
    marginHorizontal: 16,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#050505',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#65676b',
    textAlign: 'center',
    lineHeight: 22,
  },
});
