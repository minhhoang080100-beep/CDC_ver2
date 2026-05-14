import React, { useEffect, useMemo, useState } from 'react';
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
  Medal,
  Play,
  Plus,
  RotateCcw,
  RefreshCcw,
  SkipForward,
  Square,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';

type MiniGameStatus = 'DRAFT' | 'WAITING' | 'LIVE' | 'FINISHED';

type MiniGameSummary = {
  id: string;
  title: string;
  description?: string;
  status: MiniGameStatus;
  questionCount: number;
  participantCount: number;
  activeQuestionIndex: number;
  questionStartedAt?: string | null;
  questions?: MiniGameQuestion[];
};

type MiniGameQuestion = {
  id?: string;
  prompt: string;
  options: string[];
  correctOptionIndex?: number;
  timeLimitSeconds: number;
  points: number;
};

type MiniGameStats = {
  gameId: string;
  participantCount: number;
  questionCount: number;
  totalAnswers: number;
  correctAnswers: number;
  accuracyRate: number;
  averageScore: number;
  maxScore: number;
  questionStats: Array<{
    questionIndex: number;
    prompt: string;
    answeredCount: number;
    correctCount: number;
    accuracyRate: number;
    optionCounts: number[];
  }>;
};

type MiniGameState = {
  game: MiniGameSummary;
  activeQuestion?: MiniGameQuestion | null;
  remainingSeconds: number;
  myAnswer?: { optionIndex: number; isCorrect: boolean; score: number } | null;
  leaderboard: Array<{
    rank: number;
    userId: string;
    userName: string;
    score: number;
    correctCount: number;
    answeredCount: number;
  }>;
  stats?: MiniGameStats | null;
};

const statusLabels: Record<MiniGameStatus, string> = {
  DRAFT: 'Nháp',
  WAITING: 'Đang chờ',
  LIVE: 'Đang chơi',
  FINISHED: 'Đã kết thúc',
};

const statusColors: Record<MiniGameStatus, string> = {
  DRAFT: '#64748b',
  WAITING: '#f59e0b',
  LIVE: '#10b981',
  FINISHED: '#6366f1',
};

const emptyQuestion = () => ({
  prompt: '',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  timeLimitSeconds: '20',
  points: '1000',
});

export default function MiniGameScreen() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { isDesktop } = useResponsive();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<MiniGameQuestion[]>([]);
  const [draftQuestion, setDraftQuestion] = useState(emptyQuestion);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const settingsQuery = useQuery({
    queryKey: ['mini-game-settings'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games/settings');
      return response.data as { enabled: boolean };
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const featureEnabled = settingsQuery.data?.enabled === true;

  const gamesQuery = useQuery({
    queryKey: ['mini-games'],
    queryFn: async () => {
      const response = await api.get('/api/mini-games?skip=0&limit=50');
      return response.data as { items: MiniGameSummary[]; total: number };
    },
    enabled: !!token && (featureEnabled || isSuperAdmin),
    refetchInterval: 3000,
  });

  const games = gamesQuery.data?.items || [];

  useEffect(() => {
    if (!selectedGameId && games.length > 0) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  const stateQuery = useQuery({
    queryKey: ['mini-game-state', selectedGameId],
    queryFn: async () => {
      const response = await api.get(`/api/mini-games/${selectedGameId}/state`);
      return response.data as MiniGameState;
    },
    enabled: !!selectedGameId && (featureEnabled || isSuperAdmin),
    refetchInterval: 1000,
  });

  const selectedGame = stateQuery.data?.game || games.find((game) => game.id === selectedGameId);
  const activeQuestion = stateQuery.data?.activeQuestion;
  const myAnswer = stateQuery.data?.myAnswer;
  const leaderboard = stateQuery.data?.leaderboard || [];
  const stats = stateQuery.data?.stats || null;

  const remainingSeconds = useMemo(() => {
    const serverRemaining = stateQuery.data?.remainingSeconds || 0;
    if (!activeQuestion || selectedGame?.status !== 'LIVE') {
      return serverRemaining;
    }
    const elapsedSinceFetch = Math.max(0, Math.floor((Date.now() - stateQuery.dataUpdatedAt) / 1000));
    return Math.max(0, serverRemaining - elapsedSinceFetch);
  }, [activeQuestion, selectedGame?.status, stateQuery.data?.remainingSeconds, stateQuery.dataUpdatedAt, tick]);

  const invalidateGame = () => {
    queryClient.invalidateQueries({ queryKey: ['mini-games'] });
    queryClient.invalidateQueries({ queryKey: ['mini-game-state', selectedGameId] });
    queryClient.invalidateQueries({ queryKey: ['mini-game-active'] });
  };

  const removeDeletedGameFromCache = (gameId: string) => {
    queryClient.removeQueries({ queryKey: ['mini-game-state', gameId], exact: true });
    queryClient.setQueryData(['mini-games'], (current: { items: MiniGameSummary[]; total: number; hasMore?: boolean } | undefined) => {
      if (!current?.items) return current;
      const nextItems = current.items.filter((game) => game.id !== gameId);
      return {
        ...current,
        items: nextItems,
        total: Math.max(0, current.total - (current.items.length - nextItems.length)),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['mini-games'] });
    queryClient.invalidateQueries({ queryKey: ['mini-game-active'] });
  };

  useEffect(() => {
    const status = (stateQuery.error as any)?.response?.status;
    if (stateQuery.isError && status === 404 && selectedGameId) {
      removeDeletedGameFromCache(selectedGameId);
      setSelectedGameId(null);
    }
  }, [stateQuery.isError, stateQuery.error, selectedGameId]);

  const showApiError = (error: any) => {
    showToast({
      message: error?.detail || error?.response?.data?.detail || error?.message || 'Không thể thực hiện thao tác',
      type: 'error',
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/mini-games', {
        title: title.trim(),
        description: description.trim() || undefined,
        questions,
        targetDepartments: [],
      });
      return response.data as MiniGameSummary;
    },
    onSuccess: (game) => {
      showToast({ message: 'Đã tạo mini game', type: 'success' });
      setSelectedGameId(game.id);
      setTitle('');
      setDescription('');
      setQuestions([]);
      setDraftQuestion(emptyQuestion());
      invalidateGame();
    },
    onError: showApiError,
  });

  const answerMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const response = await api.post(`/api/mini-games/${selectedGameId}/answers`, {
        optionIndex,
        questionIndex: selectedGame?.activeQuestionIndex,
      });
      return response.data;
    },
    onSuccess: (result) => {
      showToast({
        message: result.isCorrect ? `Chính xác +${result.score} điểm` : 'Đã ghi nhận câu trả lời',
        type: result.isCorrect ? 'success' : 'info',
      });
      invalidateGame();
    },
    onError: (error: any) => {
      const status = error?.response?.status || error?.status;
      if (status === 404 && selectedGameId) {
        removeDeletedGameFromCache(selectedGameId);
        setSelectedGameId(null);
      }
      showApiError(error);
    },
  });

  const controlMutation = useMutation({
    mutationFn: async (action: 'start' | 'next' | 'finish' | 'reset' | 'replay' | 'delete') => {
      if (action === 'delete') {
        const response = await api.delete(`/api/mini-games/${selectedGameId}`);
        return response.data;
      }
      const response = await api.post(`/api/mini-games/${selectedGameId}/${action}`, {});
      return response.data;
    },
    onSuccess: (_, action) => {
      showToast({ message: action === 'delete' ? 'Đã xóa mini game' : 'Đã cập nhật mini game', type: 'success' });
      if (action === 'delete' && selectedGameId) {
        removeDeletedGameFromCache(selectedGameId);
        setSelectedGameId(null);
        return;
      }
      invalidateGame();
    },
    onError: (error: any) => {
      const status = error?.response?.status || error?.status;
      if (status === 404 && selectedGameId) {
        removeDeletedGameFromCache(selectedGameId);
        setSelectedGameId(null);
      }
      showApiError(error);
    },
  });

  const updateOption = (index: number, value: string) => {
    setDraftQuestion((current) => {
      const nextOptions = [...current.options];
      nextOptions[index] = value;
      return { ...current, options: nextOptions };
    });
  };

  const addQuestion = () => {
    const prompt = draftQuestion.prompt.trim();
    const options = draftQuestion.options.map((option) => option.trim()).filter(Boolean);
    const timeLimitSeconds = Number(draftQuestion.timeLimitSeconds);
    const points = Number(draftQuestion.points);

    if (!prompt || options.length < 2) {
      showToast({ message: 'Câu hỏi cần có nội dung và ít nhất 2 đáp án', type: 'error' });
      return;
    }
    if (draftQuestion.correctOptionIndex >= options.length) {
      showToast({ message: 'Đáp án đúng không hợp lệ', type: 'error' });
      return;
    }
    if (!Number.isFinite(timeLimitSeconds) || timeLimitSeconds < 5) {
      showToast({ message: 'Thời gian mỗi câu tối thiểu 5 giây', type: 'error' });
      return;
    }

    setQuestions((items) => [
      ...items,
      {
        prompt,
        options,
        correctOptionIndex: draftQuestion.correctOptionIndex,
        timeLimitSeconds,
        points: Number.isFinite(points) && points >= 100 ? points : 1000,
      },
    ]);
    setDraftQuestion(emptyQuestion());
  };

  const createGame = () => {
    if (!title.trim()) {
      showToast({ message: 'Vui lòng nhập tên mini game', type: 'error' });
      return;
    }
    if (questions.length === 0) {
      showToast({ message: 'Mini game cần ít nhất 1 câu hỏi', type: 'error' });
      return;
    }
    createMutation.mutate();
  };

  const renderGames = () => {
    if (games.length === 0) return null;

    return (
      <View style={styles.gameList}>
        {games.map((game) => {
          const active = game.id === selectedGameId;
          return (
            <TouchableOpacity
              key={game.id}
              style={[styles.gameCard, isDesktop && styles.gameCardDesktop, active && styles.gameCardActive]}
              onPress={() => setSelectedGameId(game.id)}
              activeOpacity={0.8}
            >
              <View style={styles.gameCardHeader}>
                <Text style={styles.gameTitle} numberOfLines={2}>{game.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColors[game.status]}22` }]}>
                  <Text style={[styles.statusText, { color: statusColors[game.status] }]}>{statusLabels[game.status]}</Text>
                </View>
              </View>
              {!!game.description && <Text style={styles.gameDesc} numberOfLines={2}>{game.description}</Text>}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Trophy color="#64748b" size={15} />
                  <Text style={styles.metaText}>{game.questionCount} câu</Text>
                </View>
                <View style={styles.metaItem}>
                  <Users color="#64748b" size={15} />
                  <Text style={styles.metaText}>{game.participantCount} người</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderLeaderboard = () => (
    <View style={styles.panel}>
      <View style={styles.panelTitleRow}>
        <Trophy color="#f59e0b" size={20} />
        <View style={styles.panelTitleTextWrap}>
          <Text style={styles.panelTitle}>Bảng xếp hạng</Text>
          {!!selectedGame?.title && <Text style={styles.panelSubtitle} numberOfLines={1}>{selectedGame.title}</Text>}
        </View>
      </View>
      {leaderboard.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có người chơi</Text>
      ) : (
        leaderboard.map((row) => (
          <View key={row.userId} style={styles.leaderboardRow}>
            <View style={[styles.rankBadge, row.rank <= 3 && styles.rankBadgeTop]}>
              <Text style={[styles.rankText, row.rank <= 3 && styles.rankTextTop]}>{row.rank}</Text>
            </View>
            <View style={styles.leaderboardUser}>
              <Text style={styles.leaderboardName} numberOfLines={1}>{row.userName}</Text>
              <Text style={styles.leaderboardMeta}>{row.correctCount}/{row.answeredCount} đúng</Text>
            </View>
            <Text style={styles.scoreText}>{row.score}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderStats = () => {
    if (!isAdmin || !stats) return null;

    const statItems = [
      { label: 'Người chơi', value: stats.participantCount },
      { label: 'Lượt trả lời', value: stats.totalAnswers },
      { label: 'Câu đúng', value: stats.correctAnswers },
      { label: 'Tỷ lệ đúng', value: `${stats.accuracyRate}%` },
      { label: 'Điểm TB', value: stats.averageScore },
      { label: 'Điểm cao nhất', value: stats.maxScore },
    ];

    return (
      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <CheckCircle2 color="#10b981" size={20} />
          <View style={styles.panelTitleTextWrap}>
            <Text style={styles.panelTitle}>Thống kê mini game</Text>
            {!!selectedGame?.title && <Text style={styles.panelSubtitle} numberOfLines={1}>{selectedGame.title}</Text>}
          </View>
        </View>
        <View style={styles.statsGrid}>
          {statItems.map((item) => (
            <View key={item.label} style={styles.statBox}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {stats.questionStats.length > 0 && (
          <View style={styles.questionStatsList}>
            {stats.questionStats.map((question) => (
              <View key={question.questionIndex} style={styles.questionStatsRow}>
                <View style={styles.questionStatsTextWrap}>
                  <Text style={styles.questionStatsTitle} numberOfLines={2}>
                    Câu {question.questionIndex + 1}: {question.prompt}
                  </Text>
                  <Text style={styles.questionStatsMeta}>
                    {question.correctCount}/{question.answeredCount} đúng · {question.accuracyRate}% chính xác
                  </Text>
                </View>
                <Text style={styles.questionStatsCount}>{question.answeredCount}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPlayer = () => {
    if (settingsQuery.isLoading || gamesQuery.isLoading || stateQuery.isLoading) {
      return <View style={styles.panel}><ActivityIndicator color={Colors.primary} /></View>;
    }

    if (!featureEnabled && !isSuperAdmin) {
      return (
        <View style={styles.heroPanel}>
          <Trophy color="#94a3b8" size={42} />
          <Text style={[styles.heroTitle, !isDesktop && styles.heroTitleMobile]}>Chưa có sự kiện Mini Game</Text>
          <Text style={styles.heroDesc}>Tính năng sẽ xuất hiện khi ban tổ chức mở sự kiện.</Text>
        </View>
      );
    }

    if (!selectedGame) {
      return (
        <View style={styles.panel}>
          <Text style={styles.emptyTitle}>Chưa có mini game</Text>
          <Text style={styles.emptyText}>Mini game sẽ hiển thị khi ban tổ chức tạo sự kiện.</Text>
        </View>
      );
    }

    if (selectedGame.status === 'WAITING') {
      return (
        <View style={styles.heroPanel}>
          <Clock color="#f59e0b" size={42} />
          <Text style={[styles.heroTitle, !isDesktop && styles.heroTitleMobile]}>{selectedGame.title}</Text>
          {!!selectedGame.description && <Text style={styles.heroDesc}>{selectedGame.description}</Text>}
          <Text style={styles.waitingText}>Đang chờ bắt đầu</Text>
        </View>
      );
    }

    if (selectedGame.status === 'FINISHED') {
      return (
        <View style={styles.heroPanel}>
          <Medal color="#6366f1" size={42} />
          <Text style={[styles.heroTitle, !isDesktop && styles.heroTitleMobile]}>Mini game đã kết thúc</Text>
          <Text style={styles.heroDesc}>{selectedGame.title}</Text>
        </View>
      );
    }

    if (!activeQuestion) {
      return <View style={styles.panel}><Text style={styles.emptyTitle}>Chưa có câu hỏi đang chạy</Text></View>;
    }

    const isTimeUp = remainingSeconds <= 0;

    return (
      <View style={[styles.questionPanel, !isDesktop && styles.questionPanelMobile]}>
        <View style={styles.questionTopRow}>
          <Text style={styles.questionIndex}>Câu {(selectedGame.activeQuestionIndex || 0) + 1}/{selectedGame.questionCount}</Text>
          <View style={[styles.timerBadge, remainingSeconds <= 5 && styles.timerBadgeDanger]}>
            <Clock color={remainingSeconds <= 5 ? '#ef4444' : Colors.primary} size={16} />
            <Text style={[styles.timerText, remainingSeconds <= 5 && styles.timerTextDanger]}>{remainingSeconds}s</Text>
          </View>
        </View>
        <Text style={[styles.questionPrompt, !isDesktop && styles.questionPromptMobile]}>{activeQuestion.prompt}</Text>
        <View style={styles.optionList}>
          {activeQuestion.options.map((option, index) => {
            const selected = myAnswer?.optionIndex === index;
            const disabled = !!myAnswer || isTimeUp || answerMutation.isPending;
            return (
              <TouchableOpacity
                key={`${activeQuestion.id || activeQuestion.prompt}-${index}`}
                style={[styles.optionButton, selected && styles.optionButtonSelected, disabled && styles.optionButtonDisabled]}
                onPress={() => answerMutation.mutate(index)}
                disabled={disabled}
                activeOpacity={0.8}
              >
                <View style={[styles.optionLetter, selected && styles.optionLetterSelected]}>
                  <Text style={[styles.optionLetterText, selected && styles.optionLetterTextSelected]}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {isTimeUp && !myAnswer && (
          <View style={styles.timeUpBox}>
            <Clock color="#b91c1c" size={18} />
            <Text style={styles.timeUpText}>Đã hết thời gian trả lời. Vui lòng chờ câu tiếp theo hoặc ban tổ chức phát lại câu này.</Text>
          </View>
        )}
        {myAnswer && (
          <View style={[styles.answerResult, myAnswer.isCorrect ? styles.answerResultCorrect : styles.answerResultWrong]}>
            <CheckCircle2 color={myAnswer.isCorrect ? '#047857' : '#991b1b'} size={18} />
            <Text style={[styles.answerResultText, { color: myAnswer.isCorrect ? '#047857' : '#991b1b' }]}>
              {myAnswer.isCorrect ? `Chính xác +${myAnswer.score} điểm` : 'Đã ghi nhận đáp án'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderAdmin = () => {
    if (!isAdmin) return null;

    const busy = createMutation.isPending || controlMutation.isPending;
    const canStart = !!selectedGameId && selectedGame?.status !== 'LIVE';
    const canNext = !!selectedGameId && selectedGame?.status === 'LIVE';
    const canReplay = !!selectedGameId && selectedGame?.status === 'LIVE';
    const canFinish = !!selectedGameId && selectedGame?.status !== 'FINISHED';

    return (
      <View style={[styles.adminPanel, isDesktop && styles.adminPanelDesktop, !isDesktop && styles.adminPanelMobile]}>
        <Text style={styles.sectionTitle}>Điều khiển</Text>
        <View style={styles.controlGrid}>
          <ControlButton label="Bắt đầu" Icon={Play} disabled={!canStart || busy} onPress={() => controlMutation.mutate('start')} color="#10b981" />
          <ControlButton label="Câu tiếp" Icon={SkipForward} disabled={!canNext || busy} onPress={() => controlMutation.mutate('next')} color={Colors.primary} />
          <ControlButton label="Phát lại câu" Icon={RefreshCcw} disabled={!canReplay || busy} onPress={() => controlMutation.mutate('replay')} color="#8b5cf6" />
          <ControlButton label="Kết thúc" Icon={Square} disabled={!canFinish || busy} onPress={() => controlMutation.mutate('finish')} color="#475569" />
          <ControlButton label="Reset" Icon={RotateCcw} disabled={!selectedGameId || busy} onPress={() => controlMutation.mutate('reset')} color="#f59e0b" />
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, (!selectedGameId || busy) && styles.disabled]}
          disabled={!selectedGameId || busy}
          onPress={() => controlMutation.mutate('delete')}
        >
          <Trash2 color="#ef4444" size={17} />
          <Text style={styles.deleteButtonText}>Xóa mini game đang chọn</Text>
        </TouchableOpacity>

        <View style={styles.createBox}>
          <Text style={styles.sectionTitle}>Tạo mini game</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Tên mini game" placeholderTextColor="#94a3b8" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả ngắn"
            placeholderTextColor="#94a3b8"
            multiline
          />
          <Text style={styles.builderTitle}>Câu hỏi mới</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={draftQuestion.prompt}
            onChangeText={(value) => setDraftQuestion((current) => ({ ...current, prompt: value }))}
            placeholder="Nội dung câu hỏi"
            placeholderTextColor="#94a3b8"
            multiline
          />
          {draftQuestion.options.map((option, index) => (
            <View key={index} style={styles.optionInputRow}>
              <TouchableOpacity
                style={[styles.correctDot, draftQuestion.correctOptionIndex === index && styles.correctDotActive]}
                onPress={() => setDraftQuestion((current) => ({ ...current, correctOptionIndex: index }))}
              >
                <Text style={[styles.correctDotText, draftQuestion.correctOptionIndex === index && styles.correctDotTextActive]}>
                  {String.fromCharCode(65 + index)}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.optionInput]}
                value={option}
                onChangeText={(value) => updateOption(index, value)}
                placeholder={`Đáp án ${String.fromCharCode(65 + index)}`}
                placeholderTextColor="#94a3b8"
              />
            </View>
          ))}
          <View style={styles.compactRow}>
            <TextInput
              style={[styles.input, styles.compactInput]}
              value={draftQuestion.timeLimitSeconds}
              onChangeText={(value) => setDraftQuestion((current) => ({ ...current, timeLimitSeconds: value.replace(/[^0-9]/g, '') }))}
              placeholder="Thời gian (giây)"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={[styles.input, styles.compactInput]}
              value={draftQuestion.points}
              onChangeText={(value) => setDraftQuestion((current) => ({ ...current, points: value.replace(/[^0-9]/g, '') }))}
              placeholder="Điểm câu hỏi"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={[styles.addButton, !isDesktop && styles.addButtonMobile]} onPress={addQuestion}>
              <Plus color="#ffffff" size={17} />
              <Text style={styles.addButtonText}>Thêm câu</Text>
            </TouchableOpacity>
          </View>
          {questions.map((question, index) => (
            <View key={`${question.prompt}-${index}`} style={styles.draftQuestionRow}>
              <View style={styles.draftQuestionTextWrap}>
                <Text style={styles.draftQuestionTitle} numberOfLines={2}>{index + 1}. {question.prompt}</Text>
                <Text style={styles.draftQuestionMeta}>
                  Đúng: {String.fromCharCode(65 + (question.correctOptionIndex || 0))} · {question.timeLimitSeconds}s · {question.points} điểm
                </Text>
              </View>
              <TouchableOpacity style={styles.removeQuestionBtn} onPress={() => setQuestions((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2 color="#ef4444" size={16} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.createButton, busy && styles.disabled]} onPress={createGame} disabled={busy}>
            {createMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.createButtonText}>Tạo mini game</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, !isDesktop && styles.contentMobile]}>
        <View style={[styles.header, !isDesktop && styles.headerMobile]}>
          <View style={[styles.headerIcon, !isDesktop && styles.headerIconMobile]}><Trophy color="#ffffff" size={isDesktop ? 26 : 22} /></View>
          <View style={styles.headerText}>
            <Text style={[styles.title, !isDesktop && styles.titleMobile]}>Mini Game Công đoàn</Text>
            <Text style={styles.subtitle}>Trả lời nhanh, xếp hạng trực tiếp</Text>
          </View>
        </View>
        {renderGames()}
        <View style={[styles.mainGrid, isAdmin && isDesktop && styles.mainGridAdmin]}>
          <View style={styles.playColumn}>
            {renderPlayer()}
            {renderLeaderboard()}
            {renderStats()}
          </View>
          {renderAdmin()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ControlButton({ label, Icon, disabled, onPress, color }: {
  label: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
  disabled: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity style={[styles.controlButton, { backgroundColor: color }, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Icon color="#ffffff" size={16} />
      <Text style={styles.controlButtonText}>{label}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  headerMobile: { marginBottom: 12 },
  headerIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerIconMobile: { width: 48, height: 48, borderRadius: 14 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  titleMobile: { fontSize: 21, lineHeight: 26 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
  gameList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  gameCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  gameCardDesktop: { width: 270 },
  gameCardActive: { borderColor: Colors.primary, backgroundColor: '#f8fbff' },
  gameCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gameTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  gameDesc: { color: '#64748b', fontSize: 13, marginTop: 8, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  mainGrid: { gap: 14 },
  mainGridAdmin: { flexDirection: 'row', alignItems: 'flex-start' },
  playColumn: { flex: 1, minWidth: 0, gap: 14 },
  panel: { backgroundColor: '#ffffff', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  heroPanel: { backgroundColor: '#ffffff', borderRadius: 12, padding: 28, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 10 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  heroTitleMobile: { fontSize: 21, lineHeight: 27 },
  heroDesc: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  waitingText: { marginTop: 8, fontSize: 15, fontWeight: '700', color: '#f59e0b' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  questionPanel: { backgroundColor: '#ffffff', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  questionPanelMobile: { padding: 16 },
  questionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  questionIndex: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: 999 },
  timerBadgeDanger: { backgroundColor: '#fef2f2' },
  timerText: { color: Colors.primary, fontWeight: '800' },
  timerTextDanger: { color: '#ef4444' },
  questionPrompt: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#0f172a', marginBottom: 18, ...(Platform.OS === 'web' ? { overflowWrap: 'break-word' } as any : {}) },
  questionPromptMobile: { fontSize: 20, lineHeight: 27, marginBottom: 14 },
  optionList: { gap: 10 },
  optionButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  optionButtonSelected: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  optionButtonDisabled: { opacity: 0.82 },
  optionLetter: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  optionLetterSelected: { backgroundColor: Colors.primary },
  optionLetterText: { color: '#334155', fontWeight: '800' },
  optionLetterTextSelected: { color: '#ffffff' },
  optionText: { flex: 1, minWidth: 0, fontSize: 16, color: '#0f172a', fontWeight: '600', ...(Platform.OS === 'web' ? { overflowWrap: 'break-word' } as any : {}) },
  optionTextSelected: { color: Colors.primary },
  answerResult: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 10 },
  answerResultCorrect: { backgroundColor: '#ecfdf5' },
  answerResultWrong: { backgroundColor: '#fef2f2' },
  answerResultText: { fontWeight: '700' },
  timeUpBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#fef2f2' },
  timeUpText: { flex: 1, minWidth: 0, color: '#b91c1c', fontWeight: '700', lineHeight: 20 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  panelTitleTextWrap: { flex: 1, minWidth: 0 },
  panelTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  panelSubtitle: { color: '#64748b', fontSize: 13, marginTop: 2, fontWeight: '600' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rankBadgeTop: { backgroundColor: '#fef3c7' },
  rankText: { fontWeight: '800', color: '#64748b' },
  rankTextTop: { color: '#b45309' },
  leaderboardUser: { flex: 1, minWidth: 0 },
  leaderboardName: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  leaderboardMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  scoreText: { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flex: 1, minWidth: 120, padding: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  statValue: { color: '#0f172a', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', marginTop: 3 },
  questionStatsList: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  questionStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  questionStatsTextWrap: { flex: 1, minWidth: 0 },
  questionStatsTitle: { color: '#0f172a', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  questionStatsMeta: { color: '#64748b', fontSize: 12, marginTop: 3, fontWeight: '600' },
  questionStatsCount: { minWidth: 34, textAlign: 'center', color: Colors.primary, fontSize: 16, fontWeight: '900' },
  adminPanel: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 14 },
  adminPanelDesktop: { width: 390 },
  adminPanelMobile: { width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  controlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  controlButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 12, minWidth: 112 },
  controlButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.45 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff7f7', borderRadius: 9, padding: 11 },
  deleteButtonText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
  createBox: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f8fafc', color: '#0f172a', fontSize: 14 },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  builderTitle: { color: '#334155', fontWeight: '800', fontSize: 14 },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  correctDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  correctDotActive: { backgroundColor: '#10b981' },
  correctDotText: { color: '#475569', fontWeight: '800' },
  correctDotTextActive: { color: '#ffffff' },
  optionInput: { flex: 1 },
  compactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compactInput: { flex: 1, minWidth: 82 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 9, paddingHorizontal: 12, minHeight: 44 },
  addButtonMobile: { width: '100%' },
  addButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  draftQuestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 9, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  draftQuestionTextWrap: { flex: 1, minWidth: 0 },
  draftQuestionTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  draftQuestionMeta: { fontSize: 12, color: '#64748b', marginTop: 3 },
  removeQuestionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  createButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#10b981' },
  createButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
