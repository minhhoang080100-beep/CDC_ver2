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
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
    Calendar,
    Info,
    FileText,
    CheckCircle2,
    Clock,
    XCircle,
    Eye,
    ImagePlus,
    Heart,
    ThumbsUp,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

interface Reaction {
    userId: string;
    type: string;
}

interface ApprovedNomination {
    id: string;
    nomineeName: string;
    nomineeDepartment: string;
    reason: string;
    achievements?: string;
    images?: string[];
    nominatorName?: string;
    reactions?: Reaction[];
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
    startDate?: string;
    endDate?: string;
    nominationCount: number;
    approvedCount: number;
}

interface CampaignDetail {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    startDate?: string;
    endDate?: string;
    targetDepartments: string[];
    creatorName?: string;
    createdAt: string;
    nominations: {
        id: string;
        nomineeName: string;
        nomineeDepartment: string;
        reason: string;
        achievements?: string;
        images?: string[];
        status: string;
        nominatorName?: string;
        nominatorDepartment?: string;
        createdAt: string;
        reviewedAt?: string;
        reviewNote?: string;
        reactions?: Reaction[];
    }[];
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
    const [images, setImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Cloudinary Details
    const CLOUD_NAME = 'dljjearo2';
    const UPLOAD_PRESET = 'CDCnghetinh';

    // Detail modal
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

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
        setImages([]);
        setNominateModalVisible(true);
    };

    const openCampaignDetail = async (campaignId: string) => {
        setDetailModalVisible(true);
        setDetailLoading(true);
        try {
            const response = await api.get(`/api/honors/${campaignId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCampaignDetail(response.data);
        } catch (error) {
            showToast({ message: 'Không thể tải chi tiết chiến dịch', type: 'error' });
            setDetailModalVisible(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
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
                images: images,
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

    const pickImage = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    showToast({ message: 'Ứng dụng cần quyền truy cập thư viện ảnh để tải ảnh lên', type: 'error' });
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5 - images.length,
                quality: 0.6,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setUploadingImage(true);
                try {
                    const validUrls: string[] = [];
                    for (const asset of result.assets) {
                        const base64Img = `data:image/jpeg;base64,${asset.base64}`;
                        const url = await uploadSingleToCloudinary(base64Img);
                        if (url) validUrls.push(url);
                    }
                    if (validUrls.length > 0) {
                        setImages((prev) => [...prev, ...validUrls]);
                    }
                } catch (error) {
                    console.error("Lỗi upload nhiều ảnh:", error);
                } finally {
                    setUploadingImage(false);
                }
            }
        } catch (error) {
            console.error('Error picking image:', error);
            showToast({ message: 'Không thể chọn ảnh', type: 'error' });
        }
    };

    const uploadSingleToCloudinary = async (base64Img: string): Promise<string | null> => {
        try {
            const formData = new FormData();
            formData.append('file', base64Img);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'cong-doan-app');

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (response.ok && data.secure_url) return data.secure_url;
            throw new Error(data.error?.message || 'Upload failed');
        } catch (error: any) {
            console.error('Error uploading:', error);
            showToast({ message: 'Upload ảnh thất bại.', type: 'error' });
            return null;
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

    const handleToggleReaction = async (nominationId: string, type: 'HEART' | 'LIKE') => {
        try {
            await api.post(`/api/honors/nominations/${nominationId}/react`, { type }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
            if (detailModalVisible && campaignDetail) {
                // Background refresh to not block UI completely
                api.get(`/api/honors/${campaignDetail.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setCampaignDetail(res.data));
            }
        } catch (error) {
            console.error('Error toggling:', error);
            showToast({ message: 'Lỗi khi tương tác', type: 'error' });
        }
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
                            <TouchableOpacity key={c.id} style={styles.campaignCard} onPress={() => openCampaignDetail(c.id)} activeOpacity={0.7}>
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
                                <View style={styles.campaignActions}>
                                    <TouchableOpacity
                                        style={styles.detailBtn}
                                        onPress={(e) => { e.stopPropagation(); openCampaignDetail(c.id); }}
                                    >
                                        <Eye color={Colors.primary} size={16} />
                                        <Text style={styles.detailBtnText}>Chi tiết</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.nominateButton}
                                        onPress={(e) => { e.stopPropagation(); openNominate(c.id); }}
                                    >
                                        <Send color="#ffffff" size={16} />
                                        <Text style={styles.nominateText}>Đề cử</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
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
                                                    {nom.images && nom.images.length > 0 && (
                                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                                            {nom.images.map((url, idx) => (
                                                                <Image key={idx} source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: '#f1f5f9' }} />
                                                            ))}
                                                        </ScrollView>
                                                    )}
                                                    <View style={styles.reactionContainer}>
                                                        <TouchableOpacity 
                                                            style={[styles.reactionBtn, nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') && styles.reactionBtnActive]}
                                                            onPress={(e) => { e.stopPropagation(); handleToggleReaction(nom.id, 'HEART'); }}
                                                        >
                                                            <Heart size={16} color={nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') ? '#ef4444' : '#64748b'} fill={nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') ? '#ef4444' : 'none'} />
                                                            <Text style={[styles.reactionText, nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') && { color: '#ef4444' }]}>{nom.reactions?.filter(r => r.type === 'HEART').length || 0}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity 
                                                            style={[styles.reactionBtn, nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') && styles.reactionBtnActive]}
                                                            onPress={(e) => { e.stopPropagation(); handleToggleReaction(nom.id, 'LIKE'); }}
                                                        >
                                                            <ThumbsUp size={16} color={nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') ? Colors.primary : '#64748b'} fill={nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') ? Colors.primary : 'none'} />
                                                            <Text style={[styles.reactionText, nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') && { color: Colors.primary }]}>{nom.reactions?.filter(r => r.type === 'LIKE').length || 0}</Text>
                                                        </TouchableOpacity>
                                                    </View>
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

            {/* Campaign Detail Modal */}
            <Modal visible={detailModalVisible} animationType="fade" transparent onRequestClose={() => { setDetailModalVisible(false); setCampaignDetail(null); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 650 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📋 Chi tiết chiến dịch</Text>
                            <TouchableOpacity onPress={() => { setDetailModalVisible(false); setCampaignDetail(null); }} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>

                        {detailLoading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        ) : campaignDetail ? (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                {/* Title */}
                                <Text style={styles.detailTitle}>{campaignDetail.title}</Text>

                                {/* Meta info row */}
                                <View style={styles.detailMetaRow}>
                                    <View style={styles.detailMetaChip}>
                                        {campaignDetail.type === 'TEAM' ? (
                                            <Users color={Colors.primary} size={14} />
                                        ) : (
                                            <User color={Colors.primary} size={14} />
                                        )}
                                        <Text style={styles.detailMetaChipText}>
                                            {campaignDetail.type === 'TEAM' ? 'Tập thể' : 'Cá nhân'}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.detailMetaChip,
                                        { backgroundColor: campaignDetail.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2' }
                                    ]}>
                                        <View style={{
                                            width: 8, height: 8, borderRadius: 4,
                                            backgroundColor: campaignDetail.status === 'ACTIVE' ? '#10B981' : '#EF4444',
                                        }} />
                                        <Text style={[
                                            styles.detailMetaChipText,
                                            { color: campaignDetail.status === 'ACTIVE' ? '#047857' : '#DC2626' }
                                        ]}>
                                            {campaignDetail.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}
                                        </Text>
                                    </View>
                                    {campaignDetail.creatorName && (
                                        <View style={styles.detailMetaChip}>
                                            <User color="#64748b" size={14} />
                                            <Text style={[styles.detailMetaChipText, { color: '#64748b' }]}>
                                                {campaignDetail.creatorName}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Date info */}
                                {(campaignDetail.startDate || campaignDetail.endDate) && (
                                    <View style={styles.detailDateRow}>
                                        <Calendar color="#64748b" size={16} />
                                        <Text style={styles.detailDateText}>
                                            {campaignDetail.startDate && campaignDetail.endDate
                                                ? `${formatDate(campaignDetail.startDate)} — ${formatDate(campaignDetail.endDate)}`
                                                : campaignDetail.startDate
                                                    ? `Bắt đầu: ${formatDate(campaignDetail.startDate)}`
                                                    : `Kết thúc: ${formatDate(campaignDetail.endDate)}`
                                            }
                                        </Text>
                                    </View>
                                )}

                                {/* Full description */}
                                {campaignDetail.description && (
                                    <View style={styles.detailDescSection}>
                                        <View style={styles.detailDescHeader}>
                                            <FileText color="#0f172a" size={18} />
                                            <Text style={styles.detailDescLabel}>Nội dung chiến dịch</Text>
                                        </View>
                                        <Text style={styles.detailDescText}>{campaignDetail.description}</Text>
                                    </View>
                                )}

                                {/* Nominations list */}
                                {campaignDetail.nominations && campaignDetail.nominations.length > 0 && (
                                    <View style={styles.detailNominationsSection}>
                                        <Text style={styles.detailSectionLabel}>
                                            📝 Danh sách đề cử ({campaignDetail.nominations.length})
                                        </Text>
                                        {campaignDetail.nominations.map((nom) => (
                                            <View key={nom.id} style={styles.detailNomCard}>
                                                <View style={styles.detailNomHeader}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.detailNomName}>{nom.nomineeName}</Text>
                                                        <Text style={styles.detailNomDept}>
                                                            {DEPT_LABELS[nom.nomineeDepartment] || nom.nomineeDepartment}
                                                        </Text>
                                                    </View>
                                                    <View style={[
                                                        styles.detailNomStatusBadge,
                                                        nom.status === 'APPROVED' && { backgroundColor: '#D1FAE5' },
                                                        nom.status === 'REJECTED' && { backgroundColor: '#FEE2E2' },
                                                        nom.status === 'PENDING' && { backgroundColor: '#FEF3C7' },
                                                    ]}>
                                                        {nom.status === 'APPROVED' && <CheckCircle2 color="#047857" size={12} />}
                                                        {nom.status === 'REJECTED' && <XCircle color="#DC2626" size={12} />}
                                                        {nom.status === 'PENDING' && <Clock color="#D97706" size={12} />}
                                                        <Text style={[
                                                            styles.detailNomStatusText,
                                                            nom.status === 'APPROVED' && { color: '#047857' },
                                                            nom.status === 'REJECTED' && { color: '#DC2626' },
                                                            nom.status === 'PENDING' && { color: '#D97706' },
                                                        ]}>
                                                            {nom.status === 'APPROVED' ? 'Đã duyệt' : nom.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.detailNomReason}>{nom.reason}</Text>
                                                {nom.achievements && (
                                                    <Text style={styles.detailNomAchieve}>🎯 {nom.achievements}</Text>
                                                )}
                                                {nom.images && nom.images.length > 0 && (
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                                                        {nom.images.map((url, idx) => (
                                                            <Image key={idx} source={{ uri: url }} style={{ width: 100, height: 100, borderRadius: 8, marginRight: 8, backgroundColor: '#f1f5f9' }} />
                                                        ))}
                                                    </ScrollView>
                                                )}
                                                <View style={styles.detailNomFooter}>
                                                    {nom.nominatorName && (
                                                        <Text style={styles.detailNomBy}>Đề cử bởi: {nom.nominatorName}</Text>
                                                    )}
                                                    <Text style={styles.detailNomDate}>{formatDateTime(nom.createdAt)}</Text>
                                                </View>
                                                {nom.reviewNote && (
                                                    <View style={styles.detailReviewNote}>
                                                        <Text style={styles.detailReviewNoteText}>💬 {nom.reviewNote}</Text>
                                                    </View>
                                                )}
                                                <View style={styles.reactionContainer}>
                                                    <TouchableOpacity 
                                                        style={[styles.reactionBtn, nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') && styles.reactionBtnActive]}
                                                        onPress={(e) => { e.stopPropagation(); handleToggleReaction(nom.id, 'HEART'); }}
                                                    >
                                                        <Heart size={16} color={nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') ? '#ef4444' : '#64748b'} fill={nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') ? '#ef4444' : 'none'} />
                                                        <Text style={[styles.reactionText, nom.reactions?.some(r => r.userId === user?.id && r.type === 'HEART') && { color: '#ef4444' }]}>{nom.reactions?.filter(r => r.type === 'HEART').length || 0}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.reactionBtn, nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') && styles.reactionBtnActive]}
                                                        onPress={(e) => { e.stopPropagation(); handleToggleReaction(nom.id, 'LIKE'); }}
                                                    >
                                                        <ThumbsUp size={16} color={nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') ? Colors.primary : '#64748b'} fill={nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') ? Colors.primary : 'none'} />
                                                        <Text style={[styles.reactionText, nom.reactions?.some(r => r.userId === user?.id && r.type === 'LIKE') && { color: Colors.primary }]}>{nom.reactions?.filter(r => r.type === 'LIKE').length || 0}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {campaignDetail.nominations && campaignDetail.nominations.length === 0 && (
                                    <View style={styles.detailEmptyNom}>
                                        <Info color="#94a3b8" size={32} />
                                        <Text style={styles.detailEmptyNomText}>Chưa có ai đề cử</Text>
                                    </View>
                                )}
                            </ScrollView>
                        ) : null}

                        {/* Footer with Nominate button */}
                        {campaignDetail && campaignDetail.status === 'ACTIVE' && (
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.submitBtn}
                                    onPress={() => {
                                        setDetailModalVisible(false);
                                        setCampaignDetail(null);
                                        openNominate(campaignDetail.id);
                                    }}
                                >
                                    <Send color="#ffffff" size={18} />
                                    <Text style={styles.submitText}>Đề cử ngay</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

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

                            <Text style={styles.label}>Ảnh đính kèm (Tối đa 5 ảnh)</Text>
                            {images.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalImageScroll}>
                                    {images.map((url, idx) => (
                                        <View key={idx} style={styles.multiImagePreviewContainer}>
                                            <Image source={{ uri: url }} style={styles.imagePreview} />
                                            <TouchableOpacity
                                                style={styles.removeImageButton}
                                                onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                                disabled={submitting || uploadingImage}
                                            >
                                                <X color="#fff" size={20} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    {images.length < 5 && (
                                        <TouchableOpacity style={[styles.imageUploadButton, { width: 100, height: 100, padding: 0 }]} onPress={pickImage} disabled={submitting || uploadingImage}>
                                            {uploadingImage ? <ActivityIndicator color={Colors.primary} /> : <ImagePlus color={Colors.primary} size={28} />}
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                            ) : (
                                <TouchableOpacity style={styles.imageUploadButton} onPress={pickImage} disabled={submitting || uploadingImage}>
                                    {uploadingImage ? (
                                        <>
                                            <ActivityIndicator color={Colors.primary} style={{ marginBottom: 8 }} />
                                            <Text style={styles.imageUploadText}>Đang tải ảnh lên...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <ImagePlus color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
                                            <Text style={styles.imageUploadText}>Thêm ảnh minh chứng (tối đa 5)</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitBtn, (submitting || uploadingImage) && { opacity: 0.6 }]}
                                onPress={handleSubmitNomination}
                                disabled={submitting || uploadingImage}
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
    campaignActions: {
        flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    },
    detailBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#E7F3FF', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 8, minHeight: 44,
    },
    detailBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
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
    // Campaign Detail Modal styles
    detailTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 14, lineHeight: 30 },
    detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    detailMetaChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#E7F3FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    detailMetaChipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
    detailDateRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 16,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    detailDateText: { fontSize: 14, color: '#334155', fontWeight: '500' },
    detailDescSection: {
        backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    detailDescHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
    },
    detailDescLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    detailDescText: { fontSize: 15, color: '#334155', lineHeight: 24 },
    detailNominationsSection: { marginBottom: 20, gap: 10 },
    detailSectionLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    detailNomCard: {
        backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: '#e2e8f0',
        borderLeftWidth: 3, borderLeftColor: '#f59e0b',
    },
    detailNomHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
    },
    detailNomName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    detailNomDept: { fontSize: 13, color: Colors.primary, fontWeight: '500', marginTop: 2 },
    detailNomStatusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    detailNomStatusText: { fontSize: 12, fontWeight: '600' },
    detailNomReason: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 6 },
    detailNomAchieve: { fontSize: 13, color: '#10b981', fontWeight: '500', marginBottom: 6 },
    detailNomFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
    },
    detailNomBy: { fontSize: 12, color: '#94a3b8' },
    detailNomDate: { fontSize: 12, color: '#94a3b8' },
    detailReviewNote: {
        marginTop: 8, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8,
    },
    detailReviewNoteText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    detailEmptyNom: {
        alignItems: 'center', paddingVertical: 40, gap: 8,
    },
    detailEmptyNomText: { fontSize: 15, color: '#94a3b8' },
    // Image Upload styles
    imageUploadButton: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    imageUploadText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    horizontalImageScroll: {
        marginBottom: 20,
        flexDirection: 'row',
    },
    multiImagePreviewContainer: {
        width: 100,
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#e2e8f0',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    },
    reactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    reactionBtnActive: {
        backgroundColor: '#faf5ff',
        borderColor: '#e9d5ff',
    },
    reactionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
});
