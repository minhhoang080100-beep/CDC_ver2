import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';
import {
    ClipboardList,
    CheckCircle2,
    Clock,
    ChevronRight,
    Users,
    Lock,
    Unlock,
    Eye,
    Plus,
    Trash2,
    BarChart2,
    Paperclip,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import SurveyFormModal from '../../components/SurveyFormModal';
import SurveyCreateModal from '../../components/SurveyCreateModal';
import SurveyResponsesModal from '../../components/SurveyResponsesModal';

interface Survey {
    id: string;
    title: string;
    description?: string;
    questionCount: number;
    isAnonymous: boolean;
    deadline?: string;
    status: string;
    creatorName?: string;
    createdAt: string;
    responseCount: number;
    hasResponded: boolean;
    attachments?: string[];
}

export default function SurveysScreen() {
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const { isDesktop } = useResponsive();
    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
    const [surveyModalVisible, setSurveyModalVisible] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [responsesModalVisible, setResponsesModalVisible] = useState(false);

    const handleCreateSurvey = async (data: any) => {
        try {
            await api.post('/api/surveys', data, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: 'Tạo khảo sát thành công!', type: 'success' });
            setCreateModalVisible(false);
            fetchSurveys();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi tạo khảo sát', type: 'error' });
        }
    };

    const fetchSurveys = async () => {
        try {
            const response = await api.get('/api/surveys?limit=50', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSurveys(response.data?.items || response.data || []);
        } catch (error) {
            console.error('Error fetching surveys:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSurveys();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchSurveys();
    };

    const handleOpenSurvey = async (survey: Survey) => {
        if (survey.hasResponded) {
            showToast({ message: 'Bạn đã tham gia khảo sát này rồi', type: 'info' });
            return;
        }
        try {
            const response = await api.get(`/api/surveys/${survey.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSelectedSurvey(response.data);
            setSurveyModalVisible(true);
        } catch (error) {
            showToast({ message: 'Không thể tải khảo sát', type: 'error' });
        }
    };

    const handleOpenResponses = (survey: Survey) => {
        setSelectedSurvey(survey);
        setResponsesModalVisible(true);
    };

    const handleSubmitSurvey = async (surveyId: string, answers: any[]) => {
        try {
            await api.post(`/api/surveys/${surveyId}/submit`, { answers }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: 'Cảm ơn bạn đã tham gia khảo sát!', type: 'success' });
            setSurveyModalVisible(false);
            setSelectedSurvey(null);
            fetchSurveys();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Không thể gửi khảo sát', type: 'error' });
        }
    };

    const handleDeleteSurvey = (survey: Survey) => {
        showConfirm({
            title: 'Xóa khảo sát',
            message: `Bạn có chắc muốn xóa "${survey.title}"?\nTất cả câu trả lời sẽ bị xóa vĩnh viễn.`,
            type: 'danger',
            confirmText: 'Xóa',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/surveys/${survey.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    showToast({ message: 'Đã xóa khảo sát', type: 'success' });
                    fetchSurveys();
                } catch (error) {
                    showToast({ message: 'Không thể xóa khảo sát', type: 'error' });
                }
            },
        });
    };

    const handleToggleStatus = async (survey: Survey) => {
        const newStatus = survey.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
        try {
            await api.put(`/api/surveys/${survey.id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({
                message: newStatus === 'ACTIVE' ? 'Đã mở lại khảo sát' : 'Đã đóng khảo sát',
                type: 'success',
            });
            fetchSurveys();
        } catch (error) {
            showToast({ message: 'Không thể thay đổi trạng thái', type: 'error' });
        }
    };


    const isExpired = (deadline?: string) => {
        if (!deadline) return false;
        try {
            return new Date(deadline) < new Date();
        } catch {
            return false;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const renderSurvey = ({ item }: { item: Survey }) => {
        const expired = isExpired(item.deadline);
        const responded = item.hasResponded;

        return (
            <TouchableOpacity
                style={[
                    styles.surveyCard,
                    responded && styles.surveyCardResponded,
                    expired && !responded && styles.surveyCardExpired,
                ]}
                onPress={() => handleOpenSurvey(item)}
                activeOpacity={0.7}
                disabled={expired && !responded}
            >
                <View style={styles.surveyCardHeader}>
                    <View style={styles.surveyIcon}>
                        {responded ? (
                            <CheckCircle2 color={Colors.status.success} size={24} />
                        ) : expired ? (
                            <Clock color="#94a3b8" size={24} />
                        ) : (
                            <ClipboardList color={Colors.primary} size={24} />
                        )}
                    </View>
                    <View style={styles.surveyInfo}>
                        <View style={styles.surveyTitleRow}>
                            <Text style={[styles.surveyTitle, (expired && !responded) && { color: '#94a3b8' }]} numberOfLines={2}>
                                {item.title}
                            </Text>
                            {!responded && !expired && (
                                <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>Mới</Text>
                                </View>
                            )}
                        </View>
                        {item.description && (
                            <Text style={styles.surveyDesc} numberOfLines={2}>{item.description}</Text>
                        )}
                        <View style={styles.surveyMeta}>
                            <View style={styles.metaItem}>
                                <ClipboardList color="#94a3b8" size={14} />
                                <Text style={styles.metaText}>{item.questionCount} câu hỏi</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Users color="#94a3b8" size={14} />
                                <Text style={styles.metaText}>{item.responseCount} lượt</Text>
                            </View>
                            {item.isAnonymous && (
                                <View style={styles.metaItem}>
                                    <Eye color="#94a3b8" size={14} />
                                    <Text style={styles.metaText}>Ẩn danh</Text>
                                </View>
                            )}
                            {item.attachments && item.attachments.length > 0 && (
                                <View style={styles.metaItem}>
                                    <Paperclip color="#f59e0b" size={14} />
                                    <Text style={[styles.metaText, { color: '#f59e0b' }]}>{item.attachments.length} tài liệu</Text>
                                </View>
                            )}
                            {item.deadline && (
                                <View style={styles.metaItem}>
                                    <Clock color={expired ? Colors.status.error : '#94a3b8'} size={14} />
                                    <Text style={[styles.metaText, expired && { color: Colors.status.error }]}>
                                        {expired ? 'Hết hạn' : `Đến ${formatDate(item.deadline)}`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Admin Actions */}
                        {isAdmin && (
                            <View style={styles.adminActions}>
                                <TouchableOpacity
                                    style={[styles.adminActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
                                    onPress={(e) => { e.stopPropagation(); handleOpenResponses(item); }}
                                >
                                    <BarChart2 color="#3b82f6" size={14} />
                                    <Text style={[styles.adminActionText, { color: '#3b82f6' }]}>Thống kê</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.adminActionBtn, { backgroundColor: item.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}
                                    onPress={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                                >
                                    {item.status === 'ACTIVE' ? (
                                        <Lock color="#ef4444" size={14} />
                                    ) : (
                                        <Unlock color="#10b981" size={14} />
                                    )}
                                    <Text style={[styles.adminActionText, { color: item.status === 'ACTIVE' ? '#ef4444' : '#10b981' }]}>
                                        {item.status === 'ACTIVE' ? 'Đóng' : 'Mở lại'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.adminActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                                    onPress={(e) => { e.stopPropagation(); handleDeleteSurvey(item); }}
                                >
                                    <Trash2 color="#ef4444" size={14} />
                                    <Text style={[styles.adminActionText, { color: '#ef4444' }]}>Xóa</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {!expired && !responded && !isAdmin && (
                        <ChevronRight color={Colors.primary} size={22} />
                    )}
                    {responded && (
                        <View style={styles.completedBadge}>
                            <Text style={styles.completedText}>Đã tham gia</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>

                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const activeSurveys = surveys.filter(s => !s.hasResponded && !isExpired(s.deadline));
    const completedSurveys = surveys.filter(s => s.hasResponded);
    const expiredSurveys = surveys.filter(s => !s.hasResponded && isExpired(s.deadline));

    return (
        <SafeAreaView style={styles.container}>


            <FlatList
                data={[...activeSurveys, ...completedSurveys, ...expiredSurveys]}
                renderItem={renderSurvey}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any },
                    !isDesktop && { paddingBottom: 110 } // Tăng padding bottom
                ]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponent={
                    <View>
                        {isAdmin && (
                            <View style={[isDesktop && { paddingTop: 16 }, !isDesktop && { paddingTop: 8, paddingHorizontal: 0 }]}>
                                <TouchableOpacity 
                                    style={[styles.createPostBox, isDesktop && { borderWidth: 1, borderColor: Colors.border + '40', borderRadius: 8 }]}
                                    onPress={() => setCreateModalVisible(true)}
                                >
                                    <View style={styles.createPostHeader}>
                                        <View style={styles.avatarMini}>
                                            {user?.avatar ? (
                                                <Image source={{ uri: user.avatar }} style={styles.avatarMiniImage} />
                                            ) : (
                                                <Text style={styles.avatarMiniText}>{user?.fullName?.charAt(0) || 'U'}</Text>
                                            )}
                                        </View>
                                        <View style={styles.createPostInput}>
                                            <Text style={styles.createPostPlaceholder}>Tạo bài khảo sát mới...</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}
                        {activeSurveys.length > 0 && (
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>📋 Khảo sát cần thực hiện ({activeSurveys.length})</Text>
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ClipboardList color="#cbd5e1" size={64} />
                        <Text style={styles.emptyTitle}>Chưa có khảo sát nào</Text>
                        <Text style={styles.emptySubtitle}>Các khảo sát mới sẽ xuất hiện tại đây</Text>
                    </View>
                }
            />

            <SurveyFormModal
                visible={surveyModalVisible}
                survey={selectedSurvey}
                onClose={() => {
                    setSurveyModalVisible(false);
                    setSelectedSurvey(null);
                }}
                onSubmit={handleSubmitSurvey}
            />

            <SurveyCreateModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSave={handleCreateSurvey}
            />

            <SurveyResponsesModal
                visible={responsesModalVisible}
                survey={selectedSurvey}
                onClose={() => {
                    setResponsesModalVisible(false);
                    setSelectedSurvey(null);
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
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createPostBox: { backgroundColor: '#ffffff', padding: 16, marginBottom: 8 },
    createPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarMiniImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarMiniText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
    createPostInput: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
    createPostPlaceholder: { color: '#65676B', fontSize: 16 },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    listContent: {
        padding: Platform.select({ ios: 12, android: 12, default: 16 }),
        gap: 12,
    },
    sectionHeader: {
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    surveyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border + '40',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        marginBottom: 12,
    },
    surveyCardResponded: {
        borderLeftColor: Colors.status.success,
        opacity: 0.85,
    },
    surveyCardExpired: {
        borderLeftColor: '#cbd5e1',
        opacity: 0.6,
    },
    surveyCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    surveyIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    surveyInfo: {
        flex: 1,
    },
    surveyTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    surveyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
        flex: 1,
    },
    newBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    newBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    surveyDesc: {
        fontSize: 14,
        color: '#64748b', // Tăng tương phản
        marginBottom: 10,
        lineHeight: 20,
    },
    surveyMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    adminActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    adminActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    adminActionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    completedBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    completedText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.status.success,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#cbd5e1',
    },
});
