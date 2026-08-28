import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    Modal, TextInput, ScrollView, Platform, ActivityIndicator, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Heart, Package, Check, X, Filter, Plus, Clock, CheckCircle2,
    XCircle, Info, ImagePlus, User, MapPin, Send, MessageCircle, Gift
} from 'lucide-react-native';

const CATEGORIES = [
    { value: '', label: 'Tất cả' },
    { value: 'CLOTHING', label: 'Quần áo' },
    { value: 'ELECTRONICS', label: 'Thiết bị điện tử' },
    { value: 'SCHOOL_SUPPLIES', label: 'Đồ dùng học tập' },
    { value: 'BABY', label: 'Mẹ và bé' },
    { value: 'HOUSEHOLD', label: 'Đồ gia dụng' },
    { value: 'OTHER', label: 'Khác' },
];

const CONDITIONS = [
    { value: '90%', label: 'Mới 90%' },
    { value: '70%', label: 'Còn 70%' },
    { value: 'GOOD', label: 'Còn dùng tốt' },
];

const PRIORITIES = [
    { value: 'FIRST_COME', label: 'Đăng ký trước nhận trước' },
    { value: 'MOST_NEEDED', label: 'Ưu tiên người cần nhất' },
];

const STATUS_LABELS: Record<string, { label: string, color: string, bgColor: string }> = {
    PENDING: { label: 'Chờ duyệt', color: '#D97706', bgColor: '#FEF3C7' },
    APPROVED: { label: 'Đã duyệt', color: '#047857', bgColor: '#D1FAE5' },
    MATCHED: { label: 'Đã kết nối', color: '#1D4ED8', bgColor: '#DBEAFE' },
    COMPLETED: { label: 'Hoàn tất', color: '#6D28D9', bgColor: '#EDE9FE' },
    REJECTED: { label: 'Từ chối', color: '#DC2626', bgColor: '#FEE2E2' },
};

const DEPT_LABELS: Record<string, string> = {
    VAN_PHONG_CANG: 'VP Cảng',
    CUA_LO: 'Cửa Lò',
    BEN_THUY: 'Bến Thủy',
};

// Cloudinary
const CLOUD_NAME = 'dljjearo2';
const UPLOAD_PRESET = 'CDCnghetinh';

export default function DonationsScreen() {
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const { isDesktop } = useResponsive();
    const queryClient = useQueryClient();

    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

    const [activeTab, setActiveTab] = useState<'LIST' | 'MY_ITEMS' | 'ADMIN'>('LIST');
    const [myItemsTab, setMyItemsTab] = useState<'DONATED' | 'RECEIVED'>('DONATED');
    const [adminTab, setAdminTab] = useState<'PENDING' | 'APPROVED' | 'MATCHED' | 'COMPLETED'>('PENDING');
    const [listTab, setListTab] = useState<'AVAILABLE' | 'COMPLETED'>('AVAILABLE');

    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Modals state
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [requestModalVisible, setRequestModalVisible] = useState(false);
    const [completeModalVisible, setCompleteModalVisible] = useState(false);
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('CLOTHING');
    const [condition, setCondition] = useState('90%');
    const [priority, setPriority] = useState('FIRST_COME');
    const [images, setImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    const [rejectReason, setRejectReason] = useState('');
    const [requestReason, setRequestReason] = useState('');
    const [thankYouMessage, setThankYouMessage] = useState('');
    const [commentText, setCommentText] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [conditionFilter, setConditionFilter] = useState('');

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Queries
    const { data: stats } = useQuery({
        queryKey: ['donations-stats'],
        queryFn: () => api.get('/api/donations/stats').then(res => res.data),
    });

    const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
        queryKey: ['donations', categoryFilter, conditionFilter, searchQuery],
        queryFn: () => api.get(`/api/donations?status=APPROVED&category=${categoryFilter}&condition=${conditionFilter}&search=${searchQuery}`).then(res => res.data),
    });

    const { data: myDonations, isLoading: myDonationsLoading, refetch: refetchMyDonations } = useQuery({
        queryKey: ['my-donations'],
        queryFn: () => api.get('/api/donations/my-donations').then(res => res.data),
        enabled: activeTab === 'MY_ITEMS' && myItemsTab === 'DONATED',
    });

    const { data: myReceived, isLoading: myReceivedLoading, refetch: refetchMyReceived } = useQuery({
        queryKey: ['my-received'],
        queryFn: () => api.get('/api/donations/my-received').then(res => res.data),
        enabled: activeTab === 'MY_ITEMS' && myItemsTab === 'RECEIVED',
    });

    const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
        queryKey: ['donations-pending'],
        queryFn: () => api.get('/api/donations?status=PENDING').then(res => res.data),
        enabled: activeTab === 'ADMIN' && adminTab === 'PENDING',
    });

    const { data: approvedData, isLoading: approvedLoading, refetch: refetchApproved } = useQuery({
        queryKey: ['donations-approved-admin'],
        queryFn: () => api.get('/api/donations?status=APPROVED').then(res => res.data),
        enabled: activeTab === 'ADMIN' && adminTab === 'APPROVED',
    });

    const { data: matchedData, isLoading: matchedLoading, refetch: refetchMatched } = useQuery({
        queryKey: ['donations-matched'],
        queryFn: () => api.get('/api/donations?status=MATCHED').then(res => res.data),
        enabled: activeTab === 'ADMIN' && adminTab === 'MATCHED',
    });

    const { data: completedListData, isLoading: completedListLoading, refetch: refetchCompletedList } = useQuery({
        queryKey: ['donations-completed-list', categoryFilter, conditionFilter, searchQuery],
        queryFn: () => api.get(`/api/donations?status=COMPLETED&category=${categoryFilter}&condition=${conditionFilter}&search=${searchQuery}`).then(res => res.data),
        enabled: activeTab === 'LIST' && listTab === 'COMPLETED',
    });

    const { data: adminCompletedData, isLoading: adminCompletedLoading, refetch: refetchAdminCompleted } = useQuery({
        queryKey: ['donations-completed-admin'],
        queryFn: () => api.get('/api/donations?status=COMPLETED').then(res => res.data),
        enabled: activeTab === 'ADMIN' && adminTab === 'COMPLETED',
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['donations'] });
        queryClient.invalidateQueries({ queryKey: ['my-donations'] });
        queryClient.invalidateQueries({ queryKey: ['my-received'] });
        queryClient.invalidateQueries({ queryKey: ['donations-pending'] });
        queryClient.invalidateQueries({ queryKey: ['donations-approved-admin'] });
        queryClient.invalidateQueries({ queryKey: ['donations-matched'] });
        queryClient.invalidateQueries({ queryKey: ['donations-completed-list'] });
        queryClient.invalidateQueries({ queryKey: ['donations-completed-admin'] });
        queryClient.invalidateQueries({ queryKey: ['donations-stats'] });
    };

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/api/donations', data),
        onSuccess: () => {
            showToast({ message: 'Đăng tặng thành công, đang chờ duyệt', type: 'success' });
            setCreateModalVisible(false);
            invalidateAll();
            setActiveTab('MY_ITEMS');
            setMyItemsTab('DONATED');
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => api.put(`/api/donations/${id}/approve`),
        onSuccess: () => {
            showToast({ message: 'Đã duyệt bài', type: 'success' });
            invalidateAll();
            setDetailModalVisible(false);
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string, reason: string }) => api.put(`/api/donations/${id}/reject`, { reason }),
        onSuccess: () => {
            showToast({ message: 'Đã từ chối bài', type: 'success' });
            setRejectModalVisible(false);
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const requestMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string, reason: string }) => api.post(`/api/donations/${id}/request`, { reason }),
        onSuccess: () => {
            showToast({ message: 'Đã gửi yêu cầu nhận', type: 'success' });
            setRequestModalVisible(false);
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/api/donations/${id}`),
        onSuccess: () => {
            showToast({ message: 'Đã xóa bài', type: 'success' });
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const confirmReceiverMutation = useMutation({
        mutationFn: ({ id, userId }: { id: string, userId: string }) => api.put(`/api/donations/${id}/confirm/${userId}`),
        onSuccess: () => {
            showToast({ message: 'Đã xác nhận người nhận', type: 'success' });
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const cancelRequestMutation = useMutation({
        mutationFn: (id: string) => api.put(`/api/donations/${id}/cancel-request`),
        onSuccess: () => {
            showToast({ message: 'Đã hủy đăng ký nhận', type: 'success' });
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const cancelMatchMutation = useMutation({
        mutationFn: (id: string) => api.put(`/api/donations/${id}/cancel-match`),
        onSuccess: () => {
            showToast({ message: 'Đã hủy giao dịch thành công', type: 'success' });
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const commentMutation = useMutation({
        mutationFn: ({ id, content }: { id: string, content: string }) => api.post(`/api/donations/${id}/comments`, { content }),
        onSuccess: (data) => {
            setCommentText('');
            // Update selected item in place to show comment immediately
            setSelectedItem(data.data);
            queryClient.invalidateQueries({ queryKey: ['donations'] });
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const archiveMutation = useMutation({
        mutationFn: (id: string) => api.put(`/api/donations/${id}/archive`),
        onSuccess: () => {
            showToast({ message: 'Đã lưu trữ bài đăng', type: 'success' });
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    const completeMutation = useMutation({
        mutationFn: ({ id, message }: { id: string, message: string }) => api.put(`/api/donations/${id}/complete`, { thankYouMessage: message }),
        onSuccess: () => {
            showToast({ message: 'Đã xác nhận hoàn tất', type: 'success' });
            setCompleteModalVisible(false);
            setDetailModalVisible(false);
            invalidateAll();
        },
        onError: (err: any) => showToast({ message: err.message, type: 'error' })
    });

    // Upload Image
    const pickImage = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    showToast({ message: 'Cần quyền truy cập thư viện ảnh', type: 'error' });
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
                        const formData = new FormData();
                        formData.append('file', base64Img);
                        formData.append('upload_preset', UPLOAD_PRESET);
                        formData.append('folder', 'cong-doan-app');

                        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                            method: 'POST',
                            body: formData,
                        });
                        const data = await response.json();
                        if (response.ok && data.secure_url) {
                            validUrls.push(data.secure_url);
                        }
                    }
                    if (validUrls.length > 0) {
                        setImages((prev) => [...prev, ...validUrls]);
                    }
                } catch (error) {
                    showToast({ message: 'Upload ảnh thất bại', type: 'error' });
                } finally {
                    setUploadingImage(false);
                }
            }
        } catch (error) {
            showToast({ message: 'Không thể chọn ảnh', type: 'error' });
        }
    };

    const openCreateModal = () => {
        setTitle('');
        setDescription('');
        setCategory('CLOTHING');
        setCondition('90%');
        setPriority('FIRST_COME');
        setImages([]);
        setCreateModalVisible(true);
    };

    const handleSubmitCreate = () => {
        if (!title.trim() || !description.trim()) {
            showToast({ message: 'Vui lòng điền tiêu đề và mô tả', type: 'error' });
            return;
        }
        if (images.length === 0) {
            showToast({ message: 'Vui lòng thêm ít nhất 1 ảnh', type: 'error' });
            return;
        }
        createMutation.mutate({ title, description, category, condition, priority, images });
    };

    const openDetail = async (item: any) => {
        setSelectedItem(item);
        setDetailModalVisible(true);
        // Fetch fresh data to ensure requesters list and latest status are up-to-date
        try {
            const res = await api.get(`/api/donations/${item.id}`);
            setSelectedItem(res.data);
        } catch (error) {
            // Silently use cached data if fetch fails
        }
    };

    const handleDelete = (id: string) => {
        showConfirm({
            title: 'Xóa bài đăng',
            message: 'Bạn có chắc chắn muốn xóa bài đăng này không?',
            confirmText: 'Xóa',
            type: 'danger',
            onConfirm: () => deleteMutation.mutate(id),
        });
    };

    const renderItem = ({ item }: { item: any }) => {
        const cat = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
        const cond = CONDITIONS.find(c => c.value === item.condition)?.label || item.condition;
        const status = STATUS_LABELS[item.status] || STATUS_LABELS.PENDING;

        return (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.7}>
                <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }} style={styles.cardImage} />
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.cardDept}>{DEPT_LABELS[item.donorDepartment] || item.donorDepartment}</Text>
                    
                    <View style={styles.cardBadges}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{cat}</Text>
                        </View>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{cond}</Text>
                        </View>
                    </View>

                    {item.status !== 'APPROVED' && (
                        <View style={[styles.statusBadge, { backgroundColor: status.bgColor, marginTop: 8 }]}>
                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                    )}
                    {(item.status === 'COMPLETED' || item.status === 'MATCHED') && item.receiverName && (
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }} numberOfLines={1}>
                            → {item.receiverName}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.mainWrapper, isDesktop && { maxWidth: 1000 }]}>
                <View style={styles.header}>
                <Text style={styles.headerTitle}>KHO 0 ĐỒNG</Text>
                <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
                    <Plus color="#fff" size={20} />
                    <Text style={styles.createBtnText}>Tặng đồ</Text>
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Package color={Colors.primary} size={24} />
                    <Text style={styles.statNum}>{stats?.totalAvailable || 0}</Text>
                    <Text style={styles.statLabel}>Đang tặng</Text>
                </View>
                <View style={styles.statBox}>
                    <CheckCircle2 color="#10B981" size={24} />
                    <Text style={styles.statNum}>{stats?.totalCompleted || 0}</Text>
                    <Text style={styles.statLabel}>Đã trao</Text>
                </View>
                <View style={styles.statBox}>
                    <Heart color="#F43F5E" size={24} />
                    <Text style={styles.statNum}>{stats?.totalDonations || 0}</Text>
                    <Text style={styles.statLabel}>Tổng đóng góp</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tab, activeTab === 'LIST' && styles.tabActive]} onPress={() => setActiveTab('LIST')}>
                    <Text style={[styles.tabText, activeTab === 'LIST' && styles.tabTextActive]}>Danh sách</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'MY_ITEMS' && styles.tabActive]} onPress={() => setActiveTab('MY_ITEMS')}>
                    <Text style={[styles.tabText, activeTab === 'MY_ITEMS' && styles.tabTextActive]}>Đồ của tôi</Text>
                </TouchableOpacity>
                {isAdmin && (
                    <TouchableOpacity style={[styles.tab, activeTab === 'ADMIN' && styles.tabActive]} onPress={() => setActiveTab('ADMIN')}>
                        <Text style={[styles.tabText, activeTab === 'ADMIN' && styles.tabTextActive]}>Quản trị</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.content}>
                {activeTab === 'LIST' && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.subTabBar}>
                            <TouchableOpacity style={[styles.subTab, listTab === 'AVAILABLE' && styles.subTabActive]} onPress={() => setListTab('AVAILABLE')}>
                                <Text style={[styles.subTabText, listTab === 'AVAILABLE' && styles.subTabTextActive]}>Đang tặng</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subTab, listTab === 'COMPLETED' && styles.subTabActive]} onPress={() => setListTab('COMPLETED')}>
                                <Text style={[styles.subTabText, listTab === 'COMPLETED' && styles.subTabTextActive]}>Đã nhận</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                style={[styles.input, { flex: 1, height: 40, marginBottom: 0 }]}
                                placeholder="Tìm kiếm tên, mô tả..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <View style={styles.filters}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                {CATEGORIES.map(c => (
                                    <TouchableOpacity 
                                        key={c.value} 
                                        style={[styles.filterChip, categoryFilter === c.value && styles.filterChipActive]}
                                        onPress={() => setCategoryFilter(c.value)}
                                    >
                                        <Text style={[styles.filterChipText, categoryFilter === c.value && styles.filterChipTextActive]}>
                                            {c.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <TouchableOpacity 
                                    style={[styles.filterChip, conditionFilter === '' && styles.filterChipActive]}
                                    onPress={() => setConditionFilter('')}
                                >
                                    <Text style={[styles.filterChipText, conditionFilter === '' && styles.filterChipTextActive]}>Mọi tình trạng</Text>
                                </TouchableOpacity>
                                {CONDITIONS.map(c => (
                                    <TouchableOpacity 
                                        key={c.value} 
                                        style={[styles.filterChip, conditionFilter === c.value && styles.filterChipActive]}
                                        onPress={() => setConditionFilter(c.value)}
                                    >
                                        <Text style={[styles.filterChipText, conditionFilter === c.value && styles.filterChipTextActive]}>
                                            {c.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        {listTab === 'AVAILABLE' ? (
                            listLoading ? (
                                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                            ) : listData?.items?.length > 0 ? (
                                <FlatList
                                    data={listData.items}
                                    keyExtractor={item => item.id}
                                    renderItem={renderItem}
                                    numColumns={isDesktop ? 3 : 2}
                                    key={isDesktop ? 'desktop' : 'mobile'}
                                    contentContainerStyle={styles.listContent}
                                    columnWrapperStyle={styles.columnWrapper}
                                    refreshControl={<RefreshControl refreshing={listLoading} onRefresh={refetchList} />}
                                />
                            ) : (
                                <View style={styles.emptyState}>
                                    <Package color="#cbd5e1" size={48} />
                                    <Text style={styles.emptyStateText}>Chưa có đồ dùng nào trong danh mục này</Text>
                                </View>
                            )
                        ) : (
                            completedListLoading ? (
                                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                            ) : completedListData?.items?.length > 0 ? (
                                <FlatList
                                    data={completedListData.items}
                                    keyExtractor={item => item.id}
                                    renderItem={renderItem}
                                    numColumns={isDesktop ? 3 : 2}
                                    key={isDesktop ? 'desktop' : 'mobile'}
                                    contentContainerStyle={styles.listContent}
                                    columnWrapperStyle={styles.columnWrapper}
                                    refreshControl={<RefreshControl refreshing={false} onRefresh={refetchCompletedList} />}
                                />
                            ) : (
                                <View style={styles.emptyState}>
                                    <CheckCircle2 color="#cbd5e1" size={48} />
                                    <Text style={styles.emptyStateText}>Chưa có đồ dùng nào đã được nhận</Text>
                                </View>
                            )
                        )}
                    </View>
                )}

                {activeTab === 'MY_ITEMS' && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.subTabBar}>
                            <TouchableOpacity style={[styles.subTab, myItemsTab === 'DONATED' && styles.subTabActive]} onPress={() => setMyItemsTab('DONATED')}>
                                <Text style={[styles.subTabText, myItemsTab === 'DONATED' && styles.subTabTextActive]}>Đã tặng</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subTab, myItemsTab === 'RECEIVED' && styles.subTabActive]} onPress={() => setMyItemsTab('RECEIVED')}>
                                <Text style={[styles.subTabText, myItemsTab === 'RECEIVED' && styles.subTabTextActive]}>Đã nhận</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {(myItemsTab === 'DONATED' ? myDonationsLoading : myReceivedLoading) ? (
                            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                        ) : (myItemsTab === 'DONATED' ? myDonations : myReceived)?.length > 0 ? (
                            <FlatList
                                data={myItemsTab === 'DONATED' ? myDonations : myReceived}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                numColumns={isDesktop ? 3 : 2}
                                key={isDesktop ? 'desktop' : 'mobile'}
                                contentContainerStyle={styles.listContent}
                                columnWrapperStyle={styles.columnWrapper}
                                refreshControl={<RefreshControl refreshing={false} onRefresh={myItemsTab === 'DONATED' ? refetchMyDonations : refetchMyReceived} />}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <Package color="#cbd5e1" size={48} />
                                <Text style={styles.emptyStateText}>Bạn chưa {myItemsTab === 'DONATED' ? 'tặng' : 'nhận'} đồ dùng nào</Text>
                            </View>
                        )}
                    </View>
                )}

                {activeTab === 'ADMIN' && isAdmin && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.subTabBar}>
                            <TouchableOpacity style={[styles.subTab, adminTab === 'PENDING' && styles.subTabActive]} onPress={() => setAdminTab('PENDING')}>
                                <Text style={[styles.subTabText, adminTab === 'PENDING' && styles.subTabTextActive]}>Chờ duyệt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subTab, adminTab === 'APPROVED' && styles.subTabActive]} onPress={() => setAdminTab('APPROVED')}>
                                <Text style={[styles.subTabText, adminTab === 'APPROVED' && styles.subTabTextActive]}>Đã duyệt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subTab, adminTab === 'MATCHED' && styles.subTabActive]} onPress={() => setAdminTab('MATCHED')}>
                                <Text style={[styles.subTabText, adminTab === 'MATCHED' && styles.subTabTextActive]}>Đang giao dịch</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subTab, adminTab === 'COMPLETED' && styles.subTabActive]} onPress={() => setAdminTab('COMPLETED')}>
                                <Text style={[styles.subTabText, adminTab === 'COMPLETED' && styles.subTabTextActive]}>Hoàn thành</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {(adminTab === 'PENDING' ? pendingLoading : adminTab === 'APPROVED' ? approvedLoading : adminTab === 'MATCHED' ? matchedLoading : adminCompletedLoading) ? (
                            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                        ) : (adminTab === 'PENDING' ? pendingData?.items : adminTab === 'APPROVED' ? approvedData?.items : adminTab === 'MATCHED' ? matchedData?.items : adminCompletedData?.items)?.length > 0 ? (
                            <FlatList
                                data={adminTab === 'PENDING' ? pendingData.items : adminTab === 'APPROVED' ? approvedData.items : adminTab === 'MATCHED' ? matchedData.items : adminCompletedData.items}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                numColumns={isDesktop ? 3 : 2}
                                key={isDesktop ? 'desktop' : 'mobile'}
                                contentContainerStyle={styles.listContent}
                                columnWrapperStyle={styles.columnWrapper}
                                refreshControl={<RefreshControl refreshing={false} onRefresh={adminTab === 'PENDING' ? refetchPending : adminTab === 'APPROVED' ? refetchApproved : adminTab === 'MATCHED' ? refetchMatched : refetchAdminCompleted} />}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <CheckCircle2 color="#cbd5e1" size={48} />
                                <Text style={styles.emptyStateText}>Không có bài nào trong mục này</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
            </View>

            {/* Create Modal */}
            <Modal visible={createModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tặng đồ 0 Đồng</Text>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Tên đồ dùng *</Text>
                            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="VD: Áo sơ mi nam size L" />

                            <Text style={styles.label}>Mô tả *</Text>
                            <TextInput style={[styles.input, { height: 80 }]} value={description} onChangeText={setDescription} placeholder="Mô tả tình trạng, size, lưu ý..." multiline />

                            <Text style={styles.label}>Danh mục</Text>
                            <View style={styles.chipGroup}>
                                {CATEGORIES.filter(c => c.value !== '').map(c => (
                                    <TouchableOpacity key={c.value} style={[styles.chip, category === c.value && styles.chipActive]} onPress={() => setCategory(c.value)}>
                                        <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Tình trạng</Text>
                            <View style={styles.chipGroup}>
                                {CONDITIONS.map(c => (
                                    <TouchableOpacity key={c.value} style={[styles.chip, condition === c.value && styles.chipActive]} onPress={() => setCondition(c.value)}>
                                        <Text style={[styles.chipText, condition === c.value && styles.chipTextActive]}>{c.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Tiêu chí tặng</Text>
                            <View style={styles.chipGroup}>
                                {PRIORITIES.map(c => (
                                    <TouchableOpacity key={c.value} style={[styles.chip, priority === c.value && styles.chipActive]} onPress={() => setPriority(c.value)}>
                                        <Text style={[styles.chipText, priority === c.value && styles.chipTextActive]}>{c.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Hình ảnh (Tối đa 5 ảnh) *</Text>
                            <ScrollView horizontal style={styles.imageScroll}>
                                {images.map((img, i) => (
                                    <View key={i} style={styles.imagePreviewContainer}>
                                        <Image source={{ uri: img }} style={styles.imagePreview} />
                                        <TouchableOpacity style={styles.removeImgBtn} onPress={() => setImages(images.filter((_, idx) => idx !== i))}>
                                            <X color="#fff" size={16} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {images.length < 5 && (
                                    <TouchableOpacity style={styles.addImgBtn} onPress={pickImage} disabled={uploadingImage}>
                                        {uploadingImage ? <ActivityIndicator color={Colors.primary} /> : <ImagePlus color={Colors.primary} size={24} />}
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCreate} disabled={createMutation.isPending || uploadingImage}>
                                <Text style={styles.submitBtnText}>{createMutation.isPending ? 'Đang gửi...' : 'Đăng tặng'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Detail Modal */}
            <Modal visible={detailModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedItem && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Chi tiết đồ dùng</Text>
                                    <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                                        <X color="#64748b" size={24} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={styles.modalBody}>
                                    <ScrollView horizontal pagingEnabled style={{ height: 250, marginBottom: 16 }}>
                                        {selectedItem.images?.map((img: string, i: number) => (
                                            <TouchableOpacity key={i} onPress={() => setViewerImage(img)} activeOpacity={0.8}>
                                                <Image source={{ uri: img }} style={{ width: isDesktop ? 450 : 350, height: 250, resizeMode: 'cover', borderRadius: 8, marginRight: 8 }} />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    
                                    <Text style={styles.detailTitle}>{selectedItem.title}</Text>
                                    
                                    <View style={styles.detailBadges}>
                                        <View style={styles.badge}><Text style={styles.badgeText}>{CATEGORIES.find(c => c.value === selectedItem.category)?.label}</Text></View>
                                        <View style={styles.badge}><Text style={styles.badgeText}>{CONDITIONS.find(c => c.value === selectedItem.condition)?.label}</Text></View>
                                        <View style={[styles.statusBadge, { backgroundColor: STATUS_LABELS[selectedItem.status]?.bgColor }]}>
                                            <Text style={[styles.statusText, { color: STATUS_LABELS[selectedItem.status]?.color }]}>{STATUS_LABELS[selectedItem.status]?.label}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.infoRow}>
                                        <User color="#64748b" size={16} />
                                        <Text style={styles.infoText}>Người tặng: {selectedItem.donorName}</Text>
                                    </View>
                                    {(selectedItem.status === 'MATCHED' || selectedItem.status === 'COMPLETED') && selectedItem.receiverName && (
                                        <View style={styles.infoRow}>
                                            <Gift color="#64748b" size={16} />
                                            <Text style={styles.infoText}>Người nhận: {selectedItem.receiverName}</Text>
                                        </View>
                                    )}
                                    <View style={styles.infoRow}>
                                        <MapPin color="#64748b" size={16} />
                                        <Text style={styles.infoText}>Đơn vị: {DEPT_LABELS[selectedItem.donorDepartment] || selectedItem.donorDepartment}</Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Clock color="#64748b" size={16} />
                                        <Text style={styles.infoText}>Ngày đăng: {new Date(selectedItem.createdAt).toLocaleDateString('vi-VN')}</Text>
                                    </View>

                                    <Text style={styles.detailDescTitle}>Mô tả chi tiết</Text>
                                    <Text style={styles.detailDesc}>{selectedItem.description}</Text>

                                    {selectedItem.rejectReason && (
                                        <View style={styles.rejectBox}>
                                            <Text style={styles.rejectTitle}>Lý do từ chối:</Text>
                                            <Text style={styles.rejectText}>{selectedItem.rejectReason}</Text>
                                        </View>
                                    )}

                                    {selectedItem.thankYouMessage && (
                                        <View style={styles.thankYouBox}>
                                            <Text style={styles.thankYouTitle}>Lời cảm ơn từ người nhận:</Text>
                                            <Text style={styles.thankYouText}>"{selectedItem.thankYouMessage}"</Text>
                                        </View>
                                    )}

                                    {/* Requesters List */}
                                    {(isAdmin || selectedItem.donorId === user?.id) && selectedItem.status === 'APPROVED' && selectedItem.requesters && selectedItem.requesters.length > 0 && (
                                        <View style={{ marginTop: 24 }}>
                                            <Text style={styles.detailDescTitle}>Danh sách đăng ký nhận ({selectedItem.requesters.length})</Text>
                                            {selectedItem.requesters.map((req: any, index: number) => (
                                                <View key={index} style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{req.userName}</Text>
                                                        <Text style={{ fontSize: 12, color: '#64748b' }}>{DEPT_LABELS[req.userDepartment] || req.userDepartment}</Text>
                                                        {req.reason && <Text style={{ fontSize: 13, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>"{req.reason}"</Text>}
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.btn, styles.btnApprove, { paddingHorizontal: 12, paddingVertical: 6 }]} 
                                                        onPress={() => {
                                                            showConfirm({
                                                                title: 'Xác nhận trao đồ',
                                                                message: `Bạn có chắc muốn trao món đồ này cho ${req.userName}?`,
                                                                confirmText: 'Xác nhận',
                                                                onConfirm: () => {
                                                                    confirmReceiverMutation.mutate({ id: selectedItem.id, userId: req.userId });
                                                                }
                                                            });
                                                        }}
                                                        disabled={confirmReceiverMutation.isPending}
                                                    >
                                                        <Text style={[styles.btnApproveText, { fontSize: 13 }]}>Chọn</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Comments Section */}
                                    <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16 }}>
                                        <Text style={styles.detailDescTitle}>Bình luận & Hỏi đáp</Text>
                                        {selectedItem.comments && selectedItem.comments.length > 0 ? (
                                            selectedItem.comments.map((cmt: any, idx: number) => (
                                                <View key={idx} style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>{cmt.userName}</Text>
                                                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(cmt.createdAt).toLocaleDateString('vi-VN')}</Text>
                                                    </View>
                                                    <Text style={{ color: '#334155', fontSize: 14 }}>{cmt.content}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', marginBottom: 8 }}>Chưa có bình luận nào.</Text>
                                        )}
                                        
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                            <TextInput 
                                                style={[styles.input, { flex: 1, marginBottom: 0, height: 40, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                                placeholder="Nhập bình luận..."
                                                value={commentText}
                                                onChangeText={setCommentText}
                                            />
                                            <TouchableOpacity 
                                                style={{ backgroundColor: Colors.primary, height: 40, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
                                                onPress={() => {
                                                    if (commentText.trim()) {
                                                        commentMutation.mutate({ id: selectedItem.id, content: commentText.trim() });
                                                    }
                                                }}
                                                disabled={commentMutation.isPending || !commentText.trim()}
                                            >
                                                <Send color="#fff" size={16} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </ScrollView>
                                <View style={styles.modalFooter}>
                                    {/* Admin Actions */}
                                    {isAdmin && selectedItem.status === 'PENDING' && (
                                        <View style={styles.actionRow}>
                                            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => { setRejectReason(''); setRejectModalVisible(true); }}>
                                                <Text style={styles.btnRejectText}>Từ chối</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.btn, styles.btnApprove, approveMutation.isPending && { opacity: 0.7 }]} onPress={() => approveMutation.mutate(selectedItem.id)} disabled={approveMutation.isPending}>
                                                <Text style={styles.btnApproveText}>{approveMutation.isPending ? 'Đang xử lý...' : 'Duyệt bài'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {isAdmin && selectedItem.status === 'APPROVED' && (
                                        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => archiveMutation.mutate(selectedItem.id)} disabled={archiveMutation.isPending}>
                                            <Text style={styles.submitBtnText}>Lưu trữ bài này</Text>
                                        </TouchableOpacity>
                                    )}
                                    {/* User Actions */}
                                    {selectedItem.status === 'APPROVED' && selectedItem.donorId !== user?.id && !selectedItem.hasRequested && (
                                        <TouchableOpacity style={styles.submitBtn} onPress={() => { setRequestReason(''); setRequestModalVisible(true); }}>
                                            <Text style={styles.submitBtnText}>Xin nhận món đồ này</Text>
                                        </TouchableOpacity>
                                    )}
                                    {selectedItem.status === 'APPROVED' && selectedItem.donorId !== user?.id && selectedItem.hasRequested && (
                                        <TouchableOpacity 
                                            style={[styles.submitBtn, { backgroundColor: '#cbd5e1' }]}
                                            onPress={() => cancelRequestMutation.mutate(selectedItem.id)}
                                            disabled={cancelRequestMutation.isPending}
                                        >
                                            <Text style={styles.submitBtnText}>{cancelRequestMutation.isPending ? 'Đang hủy...' : 'Hủy yêu cầu nhận'}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {/* Cancel Match Action (Owner or Admin) */}
                                    {(isAdmin || selectedItem.donorId === user?.id) && selectedItem.status === 'MATCHED' && (
                                        <TouchableOpacity 
                                            style={[styles.submitBtn, { backgroundColor: Colors.status.warning, marginTop: 8 }]}
                                            onPress={() => {
                                                showConfirm({
                                                    title: 'Hủy giao dịch',
                                                    message: 'Bạn có chắc chắn muốn hủy giao dịch này không? Món đồ sẽ chuyển lại trạng thái Đã duyệt.',
                                                    confirmText: 'Xác nhận hủy',
                                                    type: 'warning',
                                                    onConfirm: () => cancelMatchMutation.mutate(selectedItem.id)
                                                });
                                            }}
                                            disabled={cancelMatchMutation.isPending}
                                        >
                                            <Text style={styles.submitBtnText}>{cancelMatchMutation.isPending ? 'Đang xử lý...' : 'Hủy giao dịch (Bùng kèo)'}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {/* Delete Action (Owner or Admin) */}
                                    {(isAdmin || (selectedItem.donorId === user?.id && (selectedItem.status === 'PENDING' || selectedItem.status === 'REJECTED'))) && (
                                        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: Colors.status.error, marginTop: 8 }]} onPress={() => handleDelete(selectedItem.id)}>
                                            <Text style={styles.submitBtnText}>Xóa bài</Text>
                                        </TouchableOpacity>
                                    )}
                                    {/* Receiver actions */}
                                    {selectedItem.status === 'MATCHED' && selectedItem.receiverId === user?.id && (
                                        <TouchableOpacity style={styles.submitBtn} onPress={() => { setThankYouMessage(''); setCompleteModalVisible(true); }}>
                                            <Text style={styles.submitBtnText}>Đã nhận được đồ</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Request Modal */}
            <Modal visible={requestModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { padding: 24, height: 'auto' }]}>
                        <Text style={styles.modalTitle}>Xin nhận đồ</Text>
                        <Text style={styles.label}>Lời nhắn cho người tặng (Tùy chọn)</Text>
                        <TextInput 
                            style={[styles.input, { height: 80 }]} 
                            value={requestReason} 
                            onChangeText={setRequestReason} 
                            placeholder="Nhập lời nhắn..." 
                            multiline 
                        />
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: '#f1f5f9' }]} onPress={() => setRequestModalVisible(false)}>
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.btnApprove, requestMutation.isPending && { opacity: 0.7 }]} onPress={() => requestMutation.mutate({ id: selectedItem?.id, reason: requestReason })} disabled={requestMutation.isPending}>
                                <Text style={styles.btnApproveText}>{requestMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Complete Modal */}
            <Modal visible={completeModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { padding: 24, height: 'auto' }]}>
                        <Text style={styles.modalTitle}>Xác nhận đã nhận đồ</Text>
                        <Text style={styles.label}>Gửi lời cảm ơn (Tùy chọn)</Text>
                        <TextInput 
                            style={[styles.input, { height: 80 }]} 
                            value={thankYouMessage} 
                            onChangeText={setThankYouMessage} 
                            placeholder="Cảm ơn bạn đã tặng đồ..." 
                            multiline 
                        />
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: '#f1f5f9' }]} onPress={() => setCompleteModalVisible(false)}>
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.btnApprove, completeMutation.isPending && { opacity: 0.7 }]} onPress={() => completeMutation.mutate({ id: selectedItem?.id, message: thankYouMessage })} disabled={completeMutation.isPending}>
                                <Text style={styles.btnApproveText}>{completeMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Reject Modal */}
            <Modal visible={rejectModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { padding: 24, height: 'auto' }]}>
                        <Text style={styles.modalTitle}>Từ chối bài đăng</Text>
                        <Text style={styles.label}>Lý do từ chối *</Text>
                        <TextInput 
                            style={[styles.input, { height: 80 }]} 
                            value={rejectReason} 
                            onChangeText={setRejectReason} 
                            placeholder="Nhập lý do..." 
                            multiline 
                        />
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: '#f1f5f9' }]} onPress={() => setRejectModalVisible(false)}>
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.btnReject, rejectMutation.isPending && { opacity: 0.7 }]} onPress={() => rejectMutation.mutate({ id: selectedItem?.id, reason: rejectReason })} disabled={rejectMutation.isPending}>
                                <Text style={styles.btnRejectText}>{rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Image Viewer Modal */}
            <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity 
                        style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8 }}
                        onPress={() => setViewerImage(null)}
                    >
                        <X color="#fff" size={32} />
                    </TouchableOpacity>
                    {viewerImage && (
                        <Image 
                            source={{ uri: viewerImage }} 
                            style={{ width: '100%', height: '80%', resizeMode: 'contain' }} 
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    mainWrapper: { flex: 1, width: '100%', alignSelf: 'center' },
    
    // Header
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        backgroundColor: '#fff', padding: 16, borderRadius: 14, margin: 16, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 
    },
    headerTitle: { color: Colors.primary, fontSize: 20, fontWeight: 'bold' },
    createBtn: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, 
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 
    },
    createBtnText: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 15 },
    
    // Stats
    statsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    statBox: { 
        flex: 1, alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 
    },
    statNum: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginVertical: 6 },
    statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    
    // Tabs
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, padding: 4, borderRadius: 12, marginBottom: 12 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: '#eff6ff' },
    tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
    tabTextActive: { color: Colors.primary, fontWeight: 'bold' },
    
    // Sub Tabs
    subTabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
    subTabActive: { backgroundColor: Colors.primary },
    subTabText: { color: '#475569', fontWeight: '600', fontSize: 13 },
    subTabTextActive: { color: '#fff' },
    
    content: { flex: 1 },
    filters: { paddingHorizontal: 16, paddingBottom: 12 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterChipText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
    filterChipTextActive: { color: '#fff', fontWeight: 'bold' },
    
    listContent: { padding: 8, paddingBottom: 32 },
    columnWrapper: { justifyContent: 'space-between' },
    
    // Item Card
    card: { 
        flex: 1, backgroundColor: '#fff', borderRadius: 14, margin: 8, overflow: 'hidden', 
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 
    },
    cardImage: { width: '100%', height: 140, resizeMode: 'cover' },
    cardContent: { padding: 14 },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
    cardDept: { fontSize: 13, color: '#64748b', marginBottom: 10 },
    cardBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' },
    badgeText: { fontSize: 11, color: '#475569', fontWeight: '500' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyStateText: { marginTop: 16, color: '#94a3b8', fontSize: 15, textAlign: 'center' },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxWidth: 600, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtn: { padding: 4 },
    modalBody: { padding: 16 },
    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 16 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
    chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#eff6ff', borderColor: Colors.primary },
    chipText: { fontSize: 13, color: '#64748b' },
    chipTextActive: { color: Colors.primary, fontWeight: '600' },
    imageScroll: { flexDirection: 'row', marginVertical: 8 },
    imagePreviewContainer: { marginRight: 8, position: 'relative' },
    imagePreview: { width: 80, height: 80, borderRadius: 8 },
    removeImgBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 2 },
    addImgBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    submitBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
    detailBadges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    infoText: { fontSize: 14, color: '#475569' },
    detailDescTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginTop: 16, marginBottom: 8 },
    detailDesc: { fontSize: 14, color: '#334155', lineHeight: 22 },
    rejectBox: { marginTop: 16, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8 },
    rejectTitle: { fontWeight: 'bold', color: '#DC2626', marginBottom: 4 },
    rejectText: { color: '#991B1B' },
    thankYouBox: { marginTop: 16, padding: 12, backgroundColor: '#EDE9FE', borderRadius: 8 },
    thankYouTitle: { fontWeight: 'bold', color: '#6D28D9', marginBottom: 4 },
    thankYouText: { color: '#4C1D95', fontStyle: 'italic' },
    actionRow: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EF4444' },
    btnApproveText: { color: '#fff', fontWeight: 'bold' },
    btnRejectText: { color: '#EF4444', fontWeight: 'bold' },
});
