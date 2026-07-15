import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Gift,
  Play,
  Plus,
  Shuffle,
  Square,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';

type LuckyStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'DRAWN';

type LuckyTicket = {
  id: string;
  eventId: string;
  userId: string;
  luckyNumber: number;
  displayNumber: string;
  issuedAt?: string | null;
  userSnapshot?: {
    fullName?: string | null;
    department?: string | null;
    workUnit?: string | null;
  };
};

type LuckyEvent = {
  id: string;
  title: string;
  status: LuckyStatus;
  rawStatus?: LuckyStatus;
  numberMin: number;
  numberMax: number;
  numberDigits: number;
  issueStartAt?: string | null;
  issueEndAt?: string | null;
  ticketCount?: number | null;
  drawCount?: number | null;
  remainingDrawCount?: number | null;
  winningTicketId?: string | null;
  winningNumber?: number | null;
  winningDisplayNumber?: string | null;
  winningUserId?: string | null;
  winningUserName?: string | null;
  winningUserDepartment?: string | null;
  drawnAt?: string | null;
};

type LuckyDraw = {
  id: string;
  eventId: string;
  drawOrder: number;
  ticketId: string;
  luckyNumber: number;
  displayNumber: string;
  userId: string;
  winnerName?: string | null;
  winnerDepartment?: string | null;
  drawnAt?: string | null;
};

type LuckyState = {
  event: LuckyEvent | null;
  myTicket: LuckyTicket | null;
  ticketCount: number;
  drawHistory: LuckyDraw[];
};

type TicketsResponse = {
  items: LuckyTicket[];
  total: number;
  hasMore: boolean;
};

const statusLabels: Record<LuckyStatus, string> = {
  DRAFT: 'Nháp',
  OPEN: 'Đang phát số',
  CLOSED: 'Đã đóng phát số',
  DRAWN: 'Đã quay số',
};

const statusColors: Record<LuckyStatus, string> = {
  DRAFT: '#64748b',
  OPEN: '#10b981',
  CLOSED: '#f59e0b',
  DRAWN: '#7c3aed',
};

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '');

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa đặt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const makeDisplayNumber = (number: number, digits: number) => String(number).padStart(Math.max(1, digits), '0');

export default function MiniGameScreen() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { isDesktop } = useResponsive();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [title, setTitle] = useState('Quay số may mắn Công đoàn');
  const [numberMinInput, setNumberMinInput] = useState('1');
  const [numberMaxInput, setNumberMaxInput] = useState('9999');
  const [numberDigitsInput, setNumberDigitsInput] = useState('4');
  const [openMinutesInput, setOpenMinutesInput] = useState('30');
  const [rollingNumber, setRollingNumber] = useState<string | null>(null);
  const rollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['mini-game-settings'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/settings');
      return response.data as { enabled: boolean };
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const featureEnabled = settingsQuery.data?.enabled === true;

  const stateQuery = useQuery({
    queryKey: ['lucky-number-state'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/lucky/state');
      return response.data as LuckyState;
    },
    enabled: !!token && (featureEnabled || isSuperAdmin),
    refetchInterval: (query) => {
      const status = query.state.data?.event?.status;
      return status === 'OPEN' || status === 'CLOSED' ? 3000 : 10000;
    },
  });

  const event = stateQuery.data?.event || null;
  const myTicket = stateQuery.data?.myTicket || null;
  const ticketCount = stateQuery.data?.ticketCount ?? event?.ticketCount ?? 0;
  const drawHistory = stateQuery.data?.drawHistory || [];
  const drawCount = event?.drawCount ?? drawHistory.length;
  const remainingDrawCount = event?.remainingDrawCount ?? Math.max(ticketCount - drawHistory.length, 0);

  const ticketsQuery = useQuery({
    queryKey: ['lucky-number-tickets', event?.id],
    queryFn: async () => {
      if (!event?.id) throw new Error('Chưa có sự kiện');
      const response = await api.get(`/api/mini-games/lucky/events/${event.id}/tickets?skip=0&limit=100`);
      return response.data as TicketsResponse;
    },
    enabled: !!event?.id && !!token && isAdmin && (featureEnabled || isSuperAdmin),
    refetchInterval: event?.status === 'OPEN' ? 3000 : 10000,
  });

  const capacity = useMemo(() => {
    if (!event) return Number(numberMaxInput || 0) - Number(numberMinInput || 0) + 1;
    return event.numberMax - event.numberMin + 1;
  }, [event, numberMaxInput, numberMinInput]);

  useEffect(() => {
    return () => {
      if (rollingTimerRef.current) clearInterval(rollingTimerRef.current);
    };
  }, []);

  const invalidateLucky = () => {
    queryClient.invalidateQueries({ queryKey: ['lucky-number-state'] });
    queryClient.invalidateQueries({ queryKey: ['lucky-number-tickets'] });
    queryClient.invalidateQueries({ queryKey: ['mini-game-active'] });
    queryClient.invalidateQueries({ queryKey: ['mini-games'] });
  };

  const showApiError = (error: any) => {
    showToast({
      message: error?.detail || error?.response?.data?.detail || error?.message || 'Không thể thực hiện thao tác',
      type: 'error',
    });
  };

  const startRolling = (currentEvent: LuckyEvent) => {
    if (rollingTimerRef.current) clearInterval(rollingTimerRef.current);
    const min = currentEvent.numberMin;
    const max = currentEvent.numberMax;
    const range = Math.max(1, max - min + 1);
    rollingTimerRef.current = setInterval(() => {
      const next = min + Math.floor(Math.random() * range);
      setRollingNumber(makeDisplayNumber(next, currentEvent.numberDigits));
    }, 80);
  };

  const stopRolling = (finalNumber?: string | null) => {
    if (rollingTimerRef.current) {
      clearInterval(rollingTimerRef.current);
      rollingTimerRef.current = null;
    }
    if (finalNumber) {
      setRollingNumber(finalNumber);
      setTimeout(() => setRollingNumber(null), 1600);
    } else {
      setRollingNumber(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const numberMin = Number(numberMinInput || '0');
      const numberMax = Number(numberMaxInput || '0');
      const numberDigits = Number(numberDigitsInput || '0');
      const response = await api.post('/api/mini-games/lucky/events', {
        title: title.trim(),
        numberMin,
        numberMax,
        numberDigits,
      });
      return response.data as LuckyEvent;
    },
    onSuccess: () => {
      showToast({ message: 'Đã tạo sự kiện số may mắn', type: 'success' });
      invalidateLucky();
    },
    onError: showApiError,
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!event?.id) throw new Error('Chưa có sự kiện');
      const minutes = Math.max(1, Number(openMinutesInput || '0'));
      const now = new Date();
      const issueEndAt = new Date(now.getTime() + minutes * 60 * 1000);
      await api.put(`/api/mini-games/lucky/events/${event.id}`, {
        issueStartAt: now.toISOString(),
        issueEndAt: issueEndAt.toISOString(),
      });
      const response = await api.post(`/api/mini-games/lucky/events/${event.id}/open`, {});
      return response.data as LuckyEvent;
    },
    onSuccess: () => {
      showToast({ message: 'Đã mở phát số may mắn', type: 'success' });
      invalidateLucky();
    },
    onError: showApiError,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!event?.id) throw new Error('Chưa có sự kiện');
      const response = await api.post(`/api/mini-games/lucky/events/${event.id}/close`, {});
      return response.data as LuckyEvent;
    },
    onSuccess: () => {
      showToast({ message: 'Đã đóng phát số', type: 'success' });
      invalidateLucky();
    },
    onError: showApiError,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!event?.id) throw new Error('Chưa có sự kiện');
      const response = await api.post(`/api/mini-games/lucky/events/${event.id}/claim`, {});
      return response.data as { ticket: LuckyTicket; state: LuckyState };
    },
    onSuccess: (data) => {
      showToast({ message: `Số may mắn của bạn: ${data.ticket.displayNumber}`, type: 'success' });
      queryClient.setQueryData(['lucky-number-state'], data.state);
      invalidateLucky();
    },
    onError: showApiError,
  });

  const drawMutation = useMutation({
    mutationFn: async () => {
      if (!event?.id) throw new Error('Chưa có sự kiện');
      startRolling(event);
      const response = await api.post(`/api/mini-games/lucky/events/${event.id}/draw`, {});
      await new Promise((resolve) => setTimeout(resolve, 1400));
      return response.data as LuckyEvent;
    },
    onSuccess: (result) => {
      stopRolling(result.winningDisplayNumber);
      showToast({ message: `Số trúng giải: ${result.winningDisplayNumber}`, type: 'success' });
      invalidateLucky();
    },
    onError: (error) => {
      stopRolling();
      showApiError(error);
    },
  });

  const createEvent = () => {
    const numberMin = Number(numberMinInput || '0');
    const numberMax = Number(numberMaxInput || '0');
    const numberDigits = Number(numberDigitsInput || '0');
    if (!title.trim()) {
      showToast({ message: 'Vui lòng nhập tên sự kiện', type: 'error' });
      return;
    }
    if (!Number.isFinite(numberMin) || !Number.isFinite(numberMax) || numberMin > numberMax) {
      showToast({ message: 'Dải số không hợp lệ', type: 'error' });
      return;
    }
    if (numberMax - numberMin + 1 > 1000000) {
      showToast({ message: 'Dải số tối đa 1.000.000 số', type: 'error' });
      return;
    }
    if (!Number.isFinite(numberDigits) || numberDigits < 1) {
      showToast({ message: 'Số chữ số không hợp lệ', type: 'error' });
      return;
    }
    createMutation.mutate();
  };

  const openEvent = () => {
    const minutes = Number(openMinutesInput || '0');
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast({ message: 'Thời lượng phát số phải từ 1 phút', type: 'error' });
      return;
    }
    openMutation.mutate();
  };

  const renderNumberPanel = () => {
    if (!featureEnabled && !isSuperAdmin) {
      return (
        <View style={styles.panel}>
          <Text style={styles.emptyTitle}>Mini game đang tạm tắt</Text>
          <Text style={styles.emptyText}>Nút sự kiện sẽ hiển thị khi quản trị viên bật Mini Game.</Text>
        </View>
      );
    }

    if (stateQuery.isLoading) {
      return (
        <View style={styles.panelCenter}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      );
    }

    if (!event) {
      return (
        <View style={styles.panel}>
          <Text style={styles.emptyTitle}>Chưa có sự kiện số may mắn</Text>
          <Text style={styles.emptyText}>Khi ban tổ chức mở sự kiện, số may mắn sẽ xuất hiện tại đây.</Text>
        </View>
      );
    }

    const isWinner = !!myTicket && (
      event.winningTicketId === myTicket.id ||
      drawHistory.some((draw) => draw.ticketId === myTicket.id)
    );
    const canClaim = event.status === 'OPEN' && !myTicket;
    const mainNumber = rollingNumber || event.winningDisplayNumber || myTicket?.displayNumber || makeDisplayNumber(event.numberMin, event.numberDigits);

    return (
      <View style={[styles.heroPanel, event.status === 'DRAWN' && styles.heroPanelDrawn]}>
        <View style={styles.eventTitleRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColors[event.status]}1F` }]}>
            <Text style={[styles.statusText, { color: statusColors[event.status] }]}>{statusLabels[event.status]}</Text>
          </View>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        </View>

        <View style={styles.numberBox}>
          <Text style={styles.numberLabel}>
            {event.status === 'DRAWN' || rollingNumber ? 'Số trúng giải' : myTicket ? 'Số may mắn của bạn' : 'Số may mắn'}
          </Text>
          <Text style={[styles.bigNumber, !isDesktop && styles.bigNumberMobile]}>{mainNumber}</Text>
          {myTicket?.issuedAt && event.status !== 'DRAWN' && (
            <Text style={styles.numberMeta}>Đã nhận lúc {formatDateTime(myTicket.issuedAt)}</Text>
          )}
          {event.status === 'DRAWN' && (
            <View style={styles.winnerBox}>
              <Trophy color="#b45309" size={18} />
              <Text style={styles.winnerText}>
                {event.winningUserName || 'Người trúng giải'}
                {event.winningUserDepartment ? ` · ${event.winningUserDepartment}` : ''}
              </Text>
            </View>
          )}
          {isWinner && (
            <View style={styles.successBox}>
              <CheckCircle2 color="#047857" size={18} />
              <Text style={styles.successText}>Chúc mừng, bạn là người trúng giải!</Text>
            </View>
          )}
        </View>

        {canClaim && (
          <TouchableOpacity
            style={[styles.claimButton, claimMutation.isPending && styles.disabled]}
            disabled={claimMutation.isPending}
            onPress={() => claimMutation.mutate()}
          >
            {claimMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <Ticket color="#ffffff" size={20} />}
            <Text style={styles.claimButtonText}>Nhận số may mắn</Text>
          </TouchableOpacity>
        )}

        {!myTicket && event.status === 'CLOSED' && (
          <Text style={styles.closedText}>Đã hết thời gian nhận số</Text>
        )}
      </View>
    );
  };

  const renderStats = () => {
    if (!event) return null;
    return (
      <View style={styles.statsGrid}>
        <MetricBox label="Da quay" value={`${drawCount}/${ticketCount}`} Icon={Trophy} color="#7c3aed" />
        <MetricBox label="Đã phát" value={`${ticketCount}`} Icon={Users} color="#0866ff" />
        <MetricBox label="Dải số" value={`${event.numberMin}-${event.numberMax}`} Icon={Ticket} color="#10b981" />
        <MetricBox label="Đóng lúc" value={formatDateTime(event.issueEndAt)} Icon={Clock} color="#f59e0b" />
      </View>
    );
  };

  const renderDrawHistory = () => {
    if (!event || drawHistory.length === 0) return null;
    return (
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <Trophy color="#7c3aed" size={20} />
          <View style={styles.panelTitleText}>
            <Text style={styles.panelTitle}>Lich su quay so</Text>
            <Text style={styles.panelSubtitle}>{drawHistory.length} luot da quay</Text>
          </View>
        </View>
        <View style={styles.drawList}>
          {drawHistory.map((draw) => (
            <View key={draw.id} style={styles.drawRow}>
              <View style={styles.drawOrderBadge}>
                <Text style={styles.drawOrderText}>{draw.drawOrder}</Text>
              </View>
              <Text style={styles.drawNumber}>{draw.displayNumber}</Text>
              <View style={styles.drawWinner}>
                <Text style={styles.drawWinnerName} numberOfLines={1}>{draw.winnerName || 'Doan vien'}</Text>
                <Text style={styles.drawWinnerMeta} numberOfLines={1}>
                  {draw.winnerDepartment || 'Chua co don vi'} · {formatDateTime(draw.drawnAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderAdmin = () => {
    if (!isAdmin) return null;

    const busy = createMutation.isPending || openMutation.isPending || closeMutation.isPending || drawMutation.isPending;
    const canOpen = event?.status === 'DRAFT' || (event?.status === 'CLOSED' && ticketCount === 0);
    const canClose = event?.status === 'OPEN';
    const canDraw = !!event && ['CLOSED', 'DRAWN'].includes(event.status) && remainingDrawCount > 0;
    const canCreate = !event || event.status === 'DRAWN';

    return (
      <View style={[styles.adminPanel, isDesktop && styles.adminPanelDesktop]}>
        <View style={styles.panelTitleRow}>
          <Gift color={Colors.primary} size={20} />
          <Text style={styles.panelTitle}>Quản trị quay số</Text>
        </View>

        {event && (
          <View style={styles.controlGrid}>
            <ActionButton label="Mở phát số" Icon={Play} color="#10b981" disabled={!canOpen || busy} onPress={openEvent} />
            <ActionButton label="Đóng phát số" Icon={Square} color="#475569" disabled={!canClose || busy} onPress={() => closeMutation.mutate()} />
            <ActionButton label="Quay số" Icon={Shuffle} color="#7c3aed" disabled={!canDraw || busy} onPress={() => drawMutation.mutate()} />
          </View>
        )}

        <View style={styles.openConfigRow}>
          <Text style={styles.inputLabel}>Thời lượng phát số</Text>
          <View style={styles.minutesInputWrap}>
            <TextInput
              style={[styles.input, styles.minutesInput]}
              value={openMinutesInput}
              onChangeText={(value) => setOpenMinutesInput(onlyDigits(value))}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.minutesSuffix}>phút</Text>
          </View>
        </View>

        {canCreate && (
          <View style={styles.createBox}>
            <Text style={styles.sectionTitle}>Tạo sự kiện mới</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Tên sự kiện"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.inlineInputs}>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={numberMinInput}
                onChangeText={(value) => setNumberMinInput(onlyDigits(value))}
                keyboardType="numeric"
                placeholder="Từ số"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={numberMaxInput}
                onChangeText={(value) => setNumberMaxInput(onlyDigits(value))}
                keyboardType="numeric"
                placeholder="Đến số"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[styles.input, styles.digitsInput]}
                value={numberDigitsInput}
                onChangeText={(value) => setNumberDigitsInput(onlyDigits(value))}
                keyboardType="numeric"
                placeholder="Số chữ số"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <TouchableOpacity
              style={[styles.createButton, createMutation.isPending && styles.disabled]}
              disabled={createMutation.isPending}
              onPress={createEvent}
            >
              {createMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <Plus color="#ffffff" size={18} />}
              <Text style={styles.createButtonText}>Tạo sự kiện</Text>
            </TouchableOpacity>
          </View>
        )}

        {event && (
          <View style={styles.adminSummary}>
            <Text style={styles.summaryText}>Con co the quay: {remainingDrawCount} luot</Text>
            <Text style={styles.summaryText}>Sức chứa: {capacity.toLocaleString('vi-VN')} số</Text>
            <Text style={styles.summaryText}>Bắt đầu: {formatDateTime(event.issueStartAt)}</Text>
            <Text style={styles.summaryText}>Kết thúc: {formatDateTime(event.issueEndAt)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTickets = () => {
    if (!isAdmin || !event) return null;
    const tickets = ticketsQuery.data?.items || [];
    return (
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <Ticket color="#10b981" size={20} />
          <View style={styles.panelTitleText}>
            <Text style={styles.panelTitle}>Danh sách đã nhận số</Text>
            <Text style={styles.panelSubtitle}>{ticketsQuery.data?.total ?? ticketCount} người tham gia</Text>
          </View>
        </View>
        {tickets.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có người nhận số.</Text>
        ) : (
          <View style={styles.ticketList}>
            {tickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketRow}>
                <Text style={styles.ticketNumber}>{ticket.displayNumber}</Text>
                <View style={styles.ticketUser}>
                  <Text style={styles.ticketName} numberOfLines={1}>{ticket.userSnapshot?.fullName || 'Đoàn viên'}</Text>
                  <Text style={styles.ticketMeta} numberOfLines={1}>
                    {ticket.userSnapshot?.department || 'Chưa có đơn vị'} · {formatDateTime(ticket.issuedAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, !isDesktop && styles.contentMobile]}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Trophy color="#ffffff" size={isDesktop ? 28 : 24} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, !isDesktop && styles.titleMobile]}>Số May Mắn</Text>
            <Text style={styles.subtitle}>Công đoàn Cảng Nghệ Tĩnh</Text>
          </View>
        </View>

        <View style={[styles.mainGrid, isDesktop && isAdmin && styles.mainGridAdmin]}>
          <View style={styles.playColumn}>
            {renderNumberPanel()}
            {renderStats()}
            {renderDrawHistory()}
            {renderTickets()}
          </View>
          {renderAdmin()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricBox({ label, value, Icon, color }: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
}) {
  return (
    <View style={styles.metricBox}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Icon color={color} size={18} />
      </View>
      <View style={styles.metricText}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, Icon, color, disabled, onPress }: {
  label: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color }, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Icon color="#ffffff" size={17} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f7' },
  content: {
    padding: Platform.select({ ios: 12, android: 12, default: 16 }),
    paddingBottom: 120,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },
  contentMobile: {
    padding: 12,
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  titleMobile: { fontSize: 22, lineHeight: 28 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2, fontWeight: '600' },
  mainGrid: { gap: 14 },
  mainGridAdmin: { flexDirection: 'row', alignItems: 'flex-start' },
  playColumn: { flex: 1, minWidth: 0, gap: 14 },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  panelCenter: {
    minHeight: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  heroPanelDrawn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf5',
  },
  eventTitleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  eventTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  numberBox: {
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  numberLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bigNumber: {
    fontSize: 86,
    lineHeight: 96,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  bigNumberMobile: {
    fontSize: 64,
    lineHeight: 74,
  },
  numberMeta: {
    color: '#64748b',
    fontWeight: '700',
  },
  winnerBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
  },
  winnerText: {
    flexShrink: 1,
    color: '#92400e',
    fontWeight: '800',
    textAlign: 'center',
  },
  successBox: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  successText: {
    flexShrink: 1,
    color: '#047857',
    fontWeight: '800',
    textAlign: 'center',
  },
  claimButton: {
    marginTop: 18,
    minHeight: 50,
    minWidth: 220,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  claimButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  closedText: {
    marginTop: 14,
    color: '#b45309',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricText: { flex: 1, minWidth: 0 },
  metricLabel: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  metricValue: { color: '#0f172a', fontSize: 16, fontWeight: '900', marginTop: 2 },
  adminPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  adminPanelDesktop: { width: 390 },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitleText: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  controlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 42,
    minWidth: 118,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  openConfigRow: {
    gap: 7,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  minutesInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  minutesInput: {
    width: 96,
  },
  minutesSuffix: {
    color: '#64748b',
    fontWeight: '800',
  },
  createBox: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
  },
  digitsInput: {
    width: 100,
  },
  createButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  adminSummary: {
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  drawList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  drawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  drawOrderBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawOrderText: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '900',
  },
  drawNumber: {
    minWidth: 76,
    color: '#7c3aed',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  drawWinner: {
    flex: 1,
    minWidth: 0,
  },
  drawWinnerName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  drawWinnerMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  ticketList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  ticketNumber: {
    minWidth: 70,
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  ticketUser: {
    flex: 1,
    minWidth: 0,
  },
  ticketName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  ticketMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  disabled: {
    opacity: 0.48,
  },
});
