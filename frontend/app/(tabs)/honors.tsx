import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';
import {
    Trophy,
    Star,
    Award,
    Users,
    User,
    Send,
    X,
    ChevronDown,
    ChevronUp,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

interface ApprovedNomination {
    id: string;
    nomineeName: string;
    nomineeDepartment: string;
    reason: string;
    achievements?: string;
    nominatorName?: string;
}

interface HonorCampaign {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    approvedNominations: ApprovedNomination[];
}

interface ActiveCampaign {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    nominationCount: number;
    approvedCount: number;
}

const DEPT_LABELS: Record<string, string> = {
    VAN_PHONG_CANG: 'VP Cảng',
    CUA_LO: 'Cửa Lò',
    BEN_THUY: 'Bến Thủy',
};

export default function HonorsScreen() {
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const { isDesktop } = useResponsive();
    const [honorBoard, setHonorBoard] = useState<HonorCampaign[]>([]);
    const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

    // Nominate modal
    const [nominateModalVisible, setNominateModalVisible] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [nomineeName, setNomineeName] = useState('');
    const [nomineeDept, setNomineeDept] = useState('VAN_PHONG_CANG');
    const [reason, setReason] = useState('');
    const [achievements, setAchievements] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const [boardRes, campaignsRes] = await Promise.all([
                api.get('/api/honors/board', { headers: { Authorization: `Bearer ${token}` } }),
                api.get('/api/honors?status=ACTIVE', { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            setHonorBoard(boardRes.data || []);
            setActiveCampaigns(campaignsRes.data?.items || campaignsRes.data || []);
        } catch (error) {
            console.error('Error fetching honors:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const openNominate = (campaignId: string) => {
        setSelectedCampaignId(campaignId);
        setNomineeName('');
        setNomineeDept('VAN_PHONG_CANG');
        setReason('');
        setAchievements('');
        setNominateModalVisible(true);
    };

    const handleSubmitNomination = async () => {
        if (!nomineeName.trim() || !reason.trim()) {
            showToast({ message: 'Vui lòng nhập tên và lý do đề cử', type: 'error' });
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/api/honors/nominate', {
                campaignId: selectedCampaignId,
                nomineeName: nomineeName.trim(),
                nomineeDepartment: nomineeDept,
                reason: reason.trim(),
                achievements: achievements.trim() || null,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: 'Đề cử thành công! Đang chờ duyệt.', type: 'success' });
            setNominateModalVisible(false);
            fetchData();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi đề cử', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const getMedalColor = (index: number) => {
        if (index === 0) return '#FFD700';
        if (index === 1) return '#C0C0C0';
        if (index === 2) return '#CD7F32';
        return Colors.primary;
    };

    const getMedalEmoji = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return '⭐';
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

    return (
        <SafeAreaView style={styles.container}>


            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                    styles.scrollContent,
                    isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any },
                    !isDesktop && { paddingBottom: 110 } // Tăng padding bottom
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Active Campaigns - Nominate */}
                {activeCampaigns.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📣 Chiến dịch đang mở</Text>
                        {activeCampaigns.map(c => (
                            <View key={c.id} style={styles.campaignCard}>
                                <View style={styles.campaignInfo}>
                                    <View style={styles.campaignTypeIcon}>
                                        {c.type === 'TEAM' ? (
                                            <Users color={Colors.primary} size={20} />
                                        ) : (
                                            <User color={Colors.primary} size={20} />
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.campaignTitle}>{c.title}</Text>
                                        {c.description && (
                                            <Text style={styles.campaignDesc} numberOfLines={2}>{c.description}</Text>
                                        )}
                                        <Text style={styles.campaignMeta}>
                                            {c.nominationCount} đề cử • {c.approvedCount} được duyệt
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.nominateButton}
                                    onPress={() => openNominate(c.id)}
                                >
                                    <Send color="#ffffff" size={16} />
                                    <Text style={styles.nominateText}>Đề cử</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Honor Board */}
                {honorBoard.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏆 Bảng Vinh Danh</Text>
                        {honorBoard.map(campaign => (
                            <View key={campaign.id} style={styles.honorSection}>
                                <TouchableOpacity
                                    style={styles.honorSectionHeader}
                                    onPress={() => setExpandedCampaign(
                                        expandedCampaign === campaign.id ? null : campaign.id
                                    )}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.honorSectionTitle}>{campaign.title}</Text>
                                        <Text style={styles.honorSectionSub}>
                                            {campaign.approvedNominations.length} cá nhân/tập thể được vinh danh
                                        </Text>
                                    </View>
                                    {expandedCampaign === campaign.id ? (
                                        <ChevronUp color="#64748b" size={22} />
                                    ) : (
                                        <ChevronDown color="#64748b" size={22} />
                                    )}
                                </TouchableOpacity>

                                {expandedCampaign === campaign.id && (
                                    <View style={styles.honorList}>
                                        {campaign.approvedNominations.map((nom, i) => (
                                            <View key={nom.id} style={styles.honorCard}>
                                                <View style={styles.honorRank}>
                                                    <Text style={styles.honorRankEmoji}>{getMedalEmoji(i)}</Text>
                                                </View>
                                                <View style={styles.honorInfo}>
                                                    <Text style={styles.honorName}>{nom.nomineeName}</Text>
                                                    <Text style={styles.honorDept}>
                                                        {DEPT_LABELS[nom.nomineeDepartment] || nom.nomineeDepartment}
                                                    </Text>
                                                    <Text style={styles.honorReason} numberOfLines={3}>
                                                        {nom.reason}
                                                    </Text>
                                                    {nom.achievements && (
                                                        <Text style={styles.honorAchieve} numberOfLines={2}>
                                                            🎯 {nom.achievements}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Award color={getMedalColor(i)} size={28} />
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                ) : activeCampaigns.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Trophy color="#cbd5e1" size={64} />
                        <Text style={styles.emptyTitle}>Chưa có vinh danh nào</Text>
                        <Text style={styles.emptySubtitle}>Các chiến dịch thi đua sẽ xuất hiện tại đây</Text>
                    </View>
                ) : null}
            </ScrollView>

            {/* Nominate Modal */}
            <Modal visible={nominateModalVisible} animationType="fade" transparent onRequestClose={() => setNominateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📨 Đề cử vinh danh</Text>
                            <TouchableOpacity onPress={() => setNominateModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Tên cá nhân/tập thể *</Text>
                            <TextInput
                                style={styles.input}
                                value={nomineeName}
                                onChangeText={setNomineeName}
                                placeholder="VD: Nguyễn Văn A hoặc Tổ bốc xếp 1"
                                placeholderTextColor="#94a3b8"
                            />

                            <Text style={styles.label}>Phòng ban</Text>
                            <View style={styles.deptRow}>
                                {Object.entries(DEPT_LABELS).map(([value, label]) => (
                                    <TouchableOpacity
                                        key={value}
                                        style={[styles.deptChip, nomineeDept === value && styles.deptChipActive]}
                                        onPress={() => setNomineeDept(value)}
                                    >
                                        <Text style={[styles.deptChipText, nomineeDept === value && styles.deptChipTextActive]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Lý do đề cử *</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 80 }]}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="Nêu lý do tại sao đề cử..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                textAlignVertical="top"
                            />

                            <Text style={styles.label}>Thành tích nổi bật</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 60 }]}
                                value={achievements}
                                onChangeText={setAchievements}
                                placeholder="Các thành tích, đóng góp cụ thể..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                textAlignVertical="top"
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleSubmitNomination}
                                disabled={submitting}
                            >
                                <Send color="#ffffff" size={18} />
                                <Text style={styles.submitText}>
                                    {submitting ? 'Đang gửi...' : 'Gửi đề cử'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 16, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: Colors.divider,
    },
    headerDesktop: {
        paddingVertical: 10, paddingHorizontal: 24,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitleFB: { fontSize: 22, fontWeight: 'bold', color: '#050505' },
    scrollContent: { padding: Platform.select({ ios: 12, android: 12, default: 16 }), gap: 20 },
    section: { gap: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
    // Campaign Card
    campaignCard: {
        backgroundColor: '#ffffff', borderRadius: 8, padding: 16,
        borderWidth: 1, borderColor: Colors.border + '40',
        borderLeftWidth: 4, borderLeftColor: Colors.primary,
        marginBottom: 12,
    },
    campaignInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    campaignTypeIcon: {
        width: 40, height: 40, borderRadius: 10,
        backgroundColor: 'rgba(8, 145, 178, 0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    campaignTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    campaignDesc: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 6 },
    campaignMeta: { fontSize: 13, color: '#94a3b8' },
    nominateButton: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: 8, alignSelf: 'flex-start', minHeight: 44,
    },
    nominateText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    // Honor Board
    honorSection: {
        backgroundColor: '#ffffff', borderRadius: 8, overflow: 'hidden',
        borderWidth: 1, borderColor: Colors.border + '40',
        marginBottom: 12,
    },
    honorSectionHeader: {
        flexDirection: 'row', alignItems: 'center', padding: Platform.select({ ios: 14, android: 14, default: 16 }),
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    honorSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    honorSectionSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
    honorList: { padding: 12, gap: 10 },
    honorCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        padding: 14, backgroundColor: '#fafafa', borderRadius: 12,
        borderLeftWidth: 3, borderLeftColor: '#f59e0b',
    },
    honorRank: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    honorRankEmoji: { fontSize: 24 },
    honorInfo: { flex: 1 },
    honorName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
    honorDept: { fontSize: 13, color: Colors.primary, fontWeight: '500', marginBottom: 6 },
    honorReason: { fontSize: 14, color: '#334155', lineHeight: 20 },
    honorAchieve: { fontSize: 13, color: '#10b981', marginTop: 6, fontWeight: '500' },
    // Empty
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94a3b8' },
    emptySubtitle: { fontSize: 14, color: '#cbd5e1' },
    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%', maxWidth: 550,
        maxHeight: Platform.OS === 'web' ? '90%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
    },
    modalBody: { flex: 1, padding: 20 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8, marginTop: 14 },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: '#0f172a',
    },
    deptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    deptChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    deptChipActive: { borderColor: Colors.primary, backgroundColor: '#e7f3ff' },
    deptChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    deptChipTextActive: { color: Colors.primary },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 10,
    },
    submitText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
});
