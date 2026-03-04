import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Modal,
    Platform,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';
import {
    Plus,
    Trash2,
    Eye,
    CheckCircle2,
    XCircle,
    Trophy,
    X,
    Lock,
    Unlock,
    Users,
    User,
    Clock,
    BarChart2,
} from 'lucide-react-native';

interface Campaign {
    id: string;
    title: string;
    description?: string;
    type: string;
    startDate?: string;
    endDate?: string;
    status: string;
    nominationCount: number;
    approvedCount: number;
    creatorName?: string;
}

interface Nomination {
    id: string;
    nomineeName: string;
    nomineeDepartment: string;
    reason: string;
    achievements?: string;
    status: string;
    nominatorName?: string;
    nominatorDepartment?: string;
    createdAt?: string;
    reviewNote?: string;
}

const DEPT_LABELS: Record<string, string> = {
    VAN_PHONG_CANG: 'VP Cảng',
    CUA_LO: 'Cửa Lò',
    BEN_THUY: 'Bến Thủy',
};

export default function HonorManagement() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');

    // Create modal
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [campaignType, setCampaignType] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);

    // Detail modal
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [nominations, setNominations] = useState<Nomination[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const fetchCampaigns = async () => {
        try {
            const statusParam = filterStatus ? `?status=${filterStatus}` : '';
            const res = await api.get(`/api/honors${statusParam}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCampaigns(res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchCampaigns(); }, [filterStatus]);

    const handleCreate = async () => {
        if (!title.trim()) {
            showToast({ message: 'Vui lòng nhập tiêu đề', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            await api.post('/api/honors', {
                title: title.trim(),
                description: description.trim() || null,
                type: campaignType,
                startDate: startDate || null,
                endDate: endDate || null,
                targetDepartments: [],
            }, { headers: { Authorization: `Bearer ${token}` } });
            showToast({ message: 'Tạo chiến dịch thành công', type: 'success' });
            setCreateModalVisible(false);
            setTitle(''); setDescription(''); setStartDate(''); setEndDate('');
            fetchCampaigns();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (campaign: Campaign) => {
        showConfirm({
            title: 'Xóa chiến dịch',
            message: `Xóa "${campaign.title}"? Tất cả đề cử sẽ bị xóa.`,
            type: 'danger',
            confirmText: 'Xóa',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/honors/${campaign.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    showToast({ message: 'Đã xóa', type: 'success' });
                    fetchCampaigns();
                } catch (error) {
                    showToast({ message: 'Không thể xóa', type: 'error' });
                }
            },
        });
    };

    const handleToggleStatus = async (campaign: Campaign) => {
        const newStatus = campaign.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
        try {
            await api.put(`/api/honors/${campaign.id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: newStatus === 'ACTIVE' ? 'Đã mở lại' : 'Đã đóng', type: 'success' });
            fetchCampaigns();
        } catch (error) {
            showToast({ message: 'Lỗi', type: 'error' });
        }
    };

    const openDetail = async (campaign: Campaign) => {
        setLoadingDetail(true);
        setDetailModalVisible(true);
        setSelectedCampaign(campaign);
        try {
            const res = await api.get(`/api/honors/${campaign.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setNominations(res.data.nominations || []);
        } catch (error) {
            showToast({ message: 'Lỗi tải chi tiết', type: 'error' });
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleReviewNomination = async (nominationId: string, action: 'APPROVED' | 'REJECTED') => {
        try {
            await api.put(`/api/honors/nominations/${nominationId}/review?action=${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: action === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối', type: 'success' });
            if (selectedCampaign) openDetail(selectedCampaign);
            fetchCampaigns();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi', type: 'error' });
        }
    };

    const handleDeleteNomination = async (nominationId: string) => {
        try {
            await api.delete(`/api/honors/nominations/${nominationId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: 'Đã xóa đề cử', type: 'success' });
            if (selectedCampaign) openDetail(selectedCampaign);
            fetchCampaigns();
        } catch (error) {
            showToast({ message: 'Lỗi', type: 'error' });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', text: 'Chờ duyệt' };
            case 'APPROVED': return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', text: 'Đã duyệt' };
            case 'REJECTED': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', text: 'Từ chối' };
            default: return { bg: '#f1f5f9', color: '#64748b', text: status };
        }
    };

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerBar}>
                <View style={styles.filterRow}>
                    {['', 'ACTIVE', 'CLOSED'].map(s => (
                        <TouchableOpacity
                            key={s || 'all'}
                            style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
                            onPress={() => setFilterStatus(s)}
                        >
                            <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>
                                {s === '' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModalVisible(true)}>
                    <Plus color="#fff" size={20} />
                    <Text style={styles.createBtnText}>Tạo chiến dịch</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={campaigns}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCampaigns(); }} />}
                ListEmptyComponent={
                    <View style={styles.empty}><Trophy color="#cbd5e1" size={48} /><Text style={styles.emptyText}>Chưa có chiến dịch</Text></View>
                }
                renderItem={({ item }) => (
                    <View style={styles.campaignItem}>
                        <View style={styles.campaignItemInfo}>
                            <View style={styles.campaignItemHeader}>
                                {item.type === 'TEAM' ? <Users color="#7c3aed" size={18} /> : <User color="#7c3aed" size={18} />}
                                <Text style={styles.campaignItemTitle} numberOfLines={1}>{item.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: item.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                                    <Text style={[styles.statusText, { color: item.status === 'ACTIVE' ? '#10b981' : '#ef4444' }]}>
                                        {item.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.campaignItemMeta}>
                                {item.nominationCount} đề cử • {item.approvedCount} duyệt
                            </Text>
                        </View>
                        <View style={styles.campaignItemActions}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(124,58,237,0.1)' }]} onPress={() => openDetail(item)}>
                                <Eye color="#7c3aed" size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: item.status === 'ACTIVE' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }]}
                                onPress={() => handleToggleStatus(item)}
                            >
                                {item.status === 'ACTIVE' ? <Lock color="#ef4444" size={18} /> : <Unlock color="#10b981" size={18} />}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => handleDelete(item)}>
                                <Trash2 color="#ef4444" size={18} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />

            {/* Create Modal */}
            <Modal visible={createModalVisible} animationType="fade" transparent onRequestClose={() => setCreateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tạo chiến dịch thi đua</Text>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Tiêu đề *</Text>
                            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="VD: Thi đua Quý 1/2026" placeholderTextColor="#94a3b8" />
                            <Text style={styles.label}>Mô tả</Text>
                            <TextInput style={[styles.input, { minHeight: 80 }]} value={description} onChangeText={setDescription} placeholder="Mô tả..." placeholderTextColor="#94a3b8" multiline textAlignVertical="top" />
                            <Text style={styles.label}>Loại</Text>
                            <View style={styles.typeRow}>
                                <TouchableOpacity style={[styles.typeChip, campaignType === 'INDIVIDUAL' && styles.typeChipActive]} onPress={() => setCampaignType('INDIVIDUAL')}>
                                    <User color={campaignType === 'INDIVIDUAL' ? '#7c3aed' : '#94a3b8'} size={16} />
                                    <Text style={[styles.typeChipText, campaignType === 'INDIVIDUAL' && styles.typeChipTextActive]}>Cá nhân</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.typeChip, campaignType === 'TEAM' && styles.typeChipActive]} onPress={() => setCampaignType('TEAM')}>
                                    <Users color={campaignType === 'TEAM' ? '#7c3aed' : '#94a3b8'} size={16} />
                                    <Text style={[styles.typeChipText, campaignType === 'TEAM' && styles.typeChipTextActive]}>Tập thể</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.label}>Ngày bắt đầu</Text>
                            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="VD: 2026-03-01" placeholderTextColor="#94a3b8" />
                            <Text style={styles.label}>Ngày kết thúc</Text>
                            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="VD: 2026-06-30" placeholderTextColor="#94a3b8" />
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                                <Text style={styles.saveBtnText}>{saving ? 'Đang tạo...' : 'Tạo chiến dịch'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Detail / Review Modal */}
            <Modal visible={detailModalVisible} animationType="fade" transparent onRequestClose={() => setDetailModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle} numberOfLines={1}>📋 {selectedCampaign?.title}</Text>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        {loadingDetail ? (
                            <View style={[styles.center, { padding: 40 }]}>
                                <ActivityIndicator size="large" color="#7c3aed" />
                            </View>
                        ) : (
                            <ScrollView style={styles.modalBody}>
                                {nominations.length === 0 ? (
                                    <View style={styles.empty}><Text style={styles.emptyText}>Chưa có đề cử nào</Text></View>
                                ) : (
                                    nominations.map(nom => {
                                        const badge = getStatusBadge(nom.status);
                                        return (
                                            <View key={nom.id} style={styles.nominationCard}>
                                                <View style={styles.nominationHeader}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.nomineeName}>{nom.nomineeName}</Text>
                                                        <Text style={styles.nomineeDept}>{DEPT_LABELS[nom.nomineeDepartment] || nom.nomineeDepartment}</Text>
                                                    </View>
                                                    <View style={[styles.nomStatusBadge, { backgroundColor: badge.bg }]}>
                                                        <Text style={[styles.nomStatusText, { color: badge.color }]}>{badge.text}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.nominationReason}>{nom.reason}</Text>
                                                {nom.achievements && <Text style={styles.nominationAchieve}>🎯 {nom.achievements}</Text>}
                                                <Text style={styles.nominatorInfo}>Đề cử bởi: {nom.nominatorName}</Text>

                                                {nom.status === 'PENDING' && (
                                                    <View style={styles.reviewActions}>
                                                        <TouchableOpacity
                                                            style={[styles.reviewBtn, { backgroundColor: 'rgba(16,185,129,0.1)' }]}
                                                            onPress={() => handleReviewNomination(nom.id, 'APPROVED')}
                                                        >
                                                            <CheckCircle2 color="#10b981" size={16} />
                                                            <Text style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}>Duyệt</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.reviewBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                                                            onPress={() => handleReviewNomination(nom.id, 'REJECTED')}
                                                        >
                                                            <XCircle color="#ef4444" size={16} />
                                                            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Từ chối</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.reviewBtn, { backgroundColor: 'rgba(239,68,68,0.05)' }]}
                                                            onPress={() => handleDeleteNomination(nom.id)}
                                                        >
                                                            <Trash2 color="#ef4444" size={14} />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap', gap: 12,
    },
    filterRow: { flexDirection: 'row', gap: 8 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    },
    filterChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    filterChipTextActive: { color: '#fff' },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    },
    createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    listContent: { padding: 16, gap: 10 },
    campaignItem: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    campaignItemInfo: { flex: 1 },
    campaignItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    campaignItemTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600' },
    campaignItemMeta: { fontSize: 13, color: '#94a3b8', marginLeft: 26 },
    campaignItemActions: { flexDirection: 'row', gap: 6 },
    actionBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 16, color: '#94a3b8', fontWeight: '500' },
    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%', maxWidth: 650,
        maxHeight: Platform.OS === 'web' ? '92%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1, overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flex: 1 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    modalBody: { flex: 1, padding: 20 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: '#0f172a', marginBottom: 8,
    },
    typeRow: { flexDirection: 'row', gap: 10 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    typeChipActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.06)' },
    typeChipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
    typeChipTextActive: { color: '#7c3aed' },
    saveBtn: { backgroundColor: '#7c3aed', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
    saveBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    // Nomination cards
    nominationCard: {
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        padding: 16, marginBottom: 12, backgroundColor: '#fafafa',
    },
    nominationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    nomineeName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    nomineeDept: { fontSize: 13, color: '#7c3aed', fontWeight: '500', marginTop: 2 },
    nomStatusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    nomStatusText: { fontSize: 12, fontWeight: '600' },
    nominationReason: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 6 },
    nominationAchieve: { fontSize: 13, color: '#10b981', fontWeight: '500', marginBottom: 6 },
    nominatorInfo: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
    reviewActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
});
