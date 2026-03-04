import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    Alert,
    TextInput,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { Users, Plus, Edit2, Trash2, Shield, Search, Lock, Download, Upload, MessageSquare, Filter, Unplug, BarChart2, BookOpen, ClipboardList, Trophy, GraduationCap } from 'lucide-react-native';
import WebHoverCard from '../../components/WebHoverCard';
import UserModal from '../../components/UserModal';
import FeedbackManagement from '../../components/admin/FeedbackManagement';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard';
import UnionMembersManagement from '../../components/admin/UnionMembersManagement';
import SurveyManagement from '../../components/admin/SurveyManagement';
import HonorManagement from '../../components/admin/HonorManagement';
import ElearningManagement from '../../components/admin/ElearningManagement';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface User {
    id: string;
    username: string;
    fullName: string;
    unionId: string;
    role: string;
    department: string;
    status: string;
}

export default function AdminScreen() {
    const { user, token } = useAuth();
    const { isDesktop } = useResponsive();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const [users, setUsers] = useState<User[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'union_members' | 'feedbacks' | 'analytics' | 'surveys' | 'honors' | 'elearning'>('users');

    // Search & Filter Stats
    const [searchText, setSearchText] = useState('');
    const [totalUsers, setTotalUsers] = useState(0);

    // Derived stats from current fetched users
    const activeUsers = users.filter(u => u.status === 'active' || u.status === 'ACTIVE').length;
    const lockedUsers = users.filter(u => u.status !== 'active' && u.status !== 'ACTIVE' && u.status !== 'PENDING').length;
    const pendingUsers = users.filter(u => u.status === 'PENDING').length;

    useEffect(() => {
        if (user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) {
            fetchUsers();
        }
    }, [user]);

    const fetchUsers = async () => {
        try {
            const response = await api.get(`/api/users?search=${encodeURIComponent(searchText)}&limit=100`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Handle both new API format {items, total} and old array format just in case
            if (response.data && response.data.items) {
                setUsers(response.data.items);
                setTotalUsers(response.data.total);
            } else {
                setUsers(response.data);
                setTotalUsers(response.data.length);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) {
                fetchUsers();
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchText]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const handleDelete = async (id: string) => {
        showConfirm({
            title: 'Xóa người dùng',
            message: 'Bạn có chắc chắn muốn xóa người dùng này khỏi hệ thống? Dữ liệu của họ sẽ bị xóa vĩnh viễn và không thể khôi phục.',
            type: 'danger',
            confirmText: 'Xóa người dùng',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/users/${id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    showToast({ message: 'Đã xóa người dùng thành công', type: 'success' });
                    fetchUsers();
                } catch (error) {
                    console.error('Error deleting user:', error);
                    showToast({ message: 'Không thể xóa người dùng. Vui lòng thử lại sau.', type: 'error' });
                }
            }
        });
    };

    const handleResetPassword = async (id: string, username: string) => {
        const defaultPassword = '123456';
        const confirmMessage = `Bạn có chắc muốn cấp lại mật khẩu mặc định (${defaultPassword}) cho người dùng @${username}?`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (window.confirm(confirmMessage)) {
                try {
                    await api.post(`/api/users/${id}/reset-password`, { newPassword: defaultPassword }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showToast({ message: 'Cấp lại mật khẩu thành công! Mật khẩu mới là: ' + defaultPassword, type: 'success' });
                } catch (error: any) {
                    console.error('Error resetting password:', error);
                    showToast({ message: error.response?.data?.detail || 'Không thể cấp lại mật khẩu', type: 'error' });
                }
            }
        } else {
            Alert.alert('Xác nhận', confirmMessage, [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Cấp lại',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(`/api/users/${id}/reset-password`, { newPassword: defaultPassword }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            showToast({ message: 'Mật khẩu đã được cấp lại về mặc định: ' + defaultPassword, type: 'success' });
                        } catch (error: any) {
                            console.error('Error resetting password:', error);
                            showToast({ message: error.response?.data?.detail || 'Không thể cấp lại mật khẩu', type: 'error' });
                        }
                    }
                }
            ]);
        }
    };

    const handleApprove = async (id: string, fullName: string) => {
        showConfirm({
            title: 'Phê duyệt tài khoản',
            message: `Bạn đang phê duyệt tài khoản cho "${fullName}". Người này sẽ có thể đăng nhập và truy cập vào các chức năng nội bộ của hệ thống. Bạn có chắc chắn không?`,
            type: 'success',
            confirmText: 'Phê duyệt',
            onConfirm: async () => {
                try {
                    await api.put(`/api/users/${id}/approve`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showToast({ message: 'Đã phê duyệt tài khoản thành công', type: 'success' });
                    fetchUsers();
                } catch (error: any) {
                    showToast({ message: error.response?.data?.detail || 'Không thể phê duyệt tài khoản', type: 'error' });
                }
            }
        });
    };

    const handleExportCSV = () => {
        if (users.length === 0) {
            showToast({ message: 'Không có dữ liệu để xuất', type: 'info' });
            return;
        }

        const headers = ['Họ Tên', 'Tài Khoản', 'Mã Đoàn Viên', 'Vai Trò', 'Phòng Ban', 'Trạng Thái'];
        const csvRows = [headers.join(',')];

        users.forEach(u => {
            const values = [
                `"${u.fullName}"`,
                `"${u.username}"`,
                `"${u.unionId}"`,
                `"${getRoleName(u.role)}"`,
                `"${getDeptName(u.department)}"`,
                `"${u.status === 'active' ? 'Hoạt động' : 'Khóa'}"`
            ];
            csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            // BOM for UTF-8 Excel compatibility
            const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `danh_sach_tai_khoan_${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            showToast({ message: 'Chức năng xuất File hiện chỉ tối ưu cho máy tính (Web).', type: 'info' });
        }
    };

    const handleImportCSV = () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.onchange = async (e: any) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                        try {
                            const rows = text.split('\n').map(row => row.split(','));
                            // Basic parsing: Assuming order Username, Password, FullName, UnionId, Role, Department
                            // Real app needs solid parsing/mapping logic or generic backend handler
                            const validUsersToImport = []; // Populate payload

                            // Placeholder logic... Wait, let's just alert for now since parsing logic would be complex.
                            showToast({ message: "Chức năng Import đang trong quá trình thử nghiệm. Vui lòng quay lại sau.", type: 'info' });

                        } catch (err: any) {
                            showToast({ message: 'Lỗi import: ' + err.message, type: 'error' });
                        }
                    }
                };
                reader.readAsText(file);
            };
            fileInput.click();
        } else {
            showToast({ message: 'Chức năng Import hiện chỉ hỗ trợ trên máy tính (Web).', type: 'info' });
        }
    }

    if (user?.role !== 'SUPER_ADMIN' && !user?.role?.startsWith('BCH_')) {
        return (
            <View style={styles.centerContainer}>
                <Shield color={Colors.status.error} size={48} />
                <Text style={styles.errorText}>Bạn không có quyền truy cập trang này</Text>
            </View>
        );
    }

    const getRoleName = (role: string) => {
        switch (role) {
            case 'SUPER_ADMIN': return 'Quản trị viên';
            case 'BCH_VANPHONG': return 'BCH Văn phòng';
            case 'BCH_CUALO': return 'BCH Cửa Lò';
            case 'BCH_BENTHUY': return 'BCH Bến Thủy';
            default: return 'Đoàn viên';
        }
    };

    const getDeptName = (dept: string) => {
        switch (dept) {
            case 'VAN_PHONG_CANG': return 'Văn phòng Cảng';
            case 'CUA_LO': return 'Cảng Cửa Lò';
            case 'BEN_THUY': return 'Cảng Bến Thủy';
            default: return dept;
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        return (
            <WebHoverCard style={styles.userCard}>
                <View style={styles.userInfo}>
                    <View style={styles.userMainInfo}>
                        <Text style={styles.userName}>{item.fullName}</Text>
                        <Text style={styles.userSubtitle}>@{item.username} • {item.unionId}</Text>
                    </View>
                    <View style={styles.badgesWrapper}>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>{getRoleName(item.role)}</Text>
                        </View>
                        <View style={styles.deptBadge}>
                            <Text style={styles.deptText}>{getDeptName(item.department)}</Text>
                        </View>
                        <View style={[styles.statusBadge, item.status !== 'active' && item.status !== 'ACTIVE' && item.status !== 'PENDING' && styles.statusInactive, item.status === 'PENDING' && { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                            <Text style={[styles.statusText, item.status === 'PENDING' && { color: '#f59e0b' }]}>
                                {item.status === 'active' || item.status === 'ACTIVE' ? 'Hoạt động' : item.status === 'PENDING' ? 'Chờ duyệt' : 'Khóa'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtons}>
                    {item.status === 'PENDING' && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                            onPress={() => handleApprove(item.id, item.fullName)}
                        >
                            <Shield color={Colors.status.success} size={18} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() => {
                            setEditingUser(item);
                            setModalVisible(true);
                        }}
                    >
                        <Edit2 color={Colors.primary} size={18} />
                    </TouchableOpacity>
                    {item.id !== user?.id && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
                            onPress={() => handleResetPassword(item.id, item.username)}
                        >
                            <Lock color="#f59e0b" size={18} />
                        </TouchableOpacity>
                    )}
                    {item.id !== user?.id && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn]}
                            onPress={() => handleDelete(item.id)}
                        >
                            <Trash2 color={Colors.status.error} size={18} />
                        </TouchableOpacity>
                    )}
                </View>
            </WebHoverCard>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={[styles.header, isDesktop && styles.headerDesktop]}>
                <View style={styles.headerLeft}>
                    <Users color={Colors.primary} size={28} />
                    <View>
                        <Text style={styles.headerTitle}>Quản trị hệ thống</Text>
                        <Text style={styles.headerSubtitle}>Quản lý người dùng và dữ liệu</Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    {activeTab === 'users' && (
                        <>
                            {user?.role === 'SUPER_ADMIN' && (
                                <>
                                    <TouchableOpacity
                                        style={[styles.addButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.divider }]}
                                        onPress={handleExportCSV}
                                    >
                                        <Download color={Colors.text.primary} size={20} />
                                        {isDesktop && <Text style={[styles.addButtonText, { color: Colors.text.primary }]}>Xuất Excel</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.addButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.divider }]}
                                        onPress={handleImportCSV}
                                    >
                                        <Upload color={Colors.text.primary} size={20} />
                                        {isDesktop && <Text style={[styles.addButtonText, { color: Colors.text.primary }]}>Nhập Excel</Text>}
                                    </TouchableOpacity>
                                </>
                            )}
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => {
                                    setEditingUser(null);
                                    setModalVisible(true);
                                }}
                            >
                                <Plus color="#ffffff" size={20} />
                                {isDesktop && <Text style={styles.addButtonText}>Thêm</Text>}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabScrollWrapper, isDesktop && styles.tabContainerDesktop]}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'users' && styles.tabItemActive]}
                        onPress={() => setActiveTab('users')}
                    >
                        <Users color={activeTab === 'users' ? Colors.primary : Colors.text.secondary} size={20} />
                        <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Tài khoản</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'union_members' && styles.tabItemActive]}
                        onPress={() => setActiveTab('union_members')}
                    >
                        <BookOpen color={activeTab === 'union_members' ? Colors.primary : Colors.text.secondary} size={20} />
                        <Text style={[styles.tabText, activeTab === 'union_members' && styles.tabTextActive]}>Đoàn viên</Text>
                    </TouchableOpacity>
                    {user?.role === 'SUPER_ADMIN' && (
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'feedbacks' && styles.tabItemActive]}
                            onPress={() => setActiveTab('feedbacks')}
                        >
                            <MessageSquare color={activeTab === 'feedbacks' ? Colors.primary : Colors.text.secondary} size={20} />
                            <Text style={[styles.tabText, activeTab === 'feedbacks' && styles.tabTextActive]}>Lắng nghe & Phản hồi</Text>
                        </TouchableOpacity>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) && (
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'analytics' && styles.tabItemActive]}
                            onPress={() => setActiveTab('analytics')}
                        >
                            <BarChart2 color={activeTab === 'analytics' ? Colors.primary : Colors.text.secondary} size={20} />
                            <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Thống kê</Text>
                        </TouchableOpacity>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) && (
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'surveys' && styles.tabItemActive]}
                            onPress={() => setActiveTab('surveys')}
                        >
                            <ClipboardList color={activeTab === 'surveys' ? Colors.primary : Colors.text.secondary} size={20} />
                            <Text style={[styles.tabText, activeTab === 'surveys' && styles.tabTextActive]}>Khảo sát</Text>
                        </TouchableOpacity>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) && (
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'honors' && styles.tabItemActive]}
                            onPress={() => setActiveTab('honors')}
                        >
                            <Trophy color={activeTab === 'honors' ? Colors.primary : Colors.text.secondary} size={20} />
                            <Text style={[styles.tabText, activeTab === 'honors' && styles.tabTextActive]}>Vinh danh</Text>
                        </TouchableOpacity>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_')) && (
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'elearning' && styles.tabItemActive]}
                            onPress={() => setActiveTab('elearning')}
                        >
                            <GraduationCap color={activeTab === 'elearning' ? Colors.primary : Colors.text.secondary} size={20} />
                            <Text style={[styles.tabText, activeTab === 'elearning' && styles.tabTextActive]}>Đào tạo</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {activeTab === 'users' ? (
                <View style={[styles.content, isDesktop && styles.contentDesktop]}>

                    {/* Dashboard Stats */}
                    <View style={[styles.statsContainer, !isDesktop && styles.statsContainerMobile]}>
                        <View style={styles.statCard}>
                            <Users color={Colors.primary} size={24} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statValue}>{totalUsers}</Text>
                                <Text style={styles.statLabel}>Tổng số</Text>
                            </View>
                        </View>
                        <View style={styles.statCard}>
                            <Shield color={Colors.status.success} size={24} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statValue}>{activeUsers}</Text>
                                <Text style={styles.statLabel}>Hoạt động</Text>
                            </View>
                        </View>
                        <View style={styles.statCard}>
                            <Users color="#f59e0b" size={24} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statValue}>{pendingUsers}</Text>
                                <Text style={styles.statLabel}>Chờ duyệt</Text>
                            </View>
                        </View>
                        <View style={styles.statCard}>
                            <Unplug color={Colors.status.error} size={24} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statValue}>{lockedUsers}</Text>
                                <Text style={styles.statLabel}>Bị khóa</Text>
                            </View>
                        </View>
                    </View>

                    {/* Search & Filter Bar */}
                    <View style={styles.filterBar}>
                        <View style={styles.searchContainer}>
                            <Search color={Colors.text.placeholder} size={20} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Tìm kiếm tài khoản (Tên, Mã ĐV, Username)..."
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                        </View>
                    </View>

                    {isDesktop ? (
                        <View style={styles.tableContainer}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Nhân sự</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Vai trò</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Phòng ban</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Trạng thái</Text>
                                <Text style={[styles.tableHeaderText, { width: 120, textAlign: 'center' }]}>Thao tác</Text>
                            </View>

                            {/* Table Body */}
                            <FlatList
                                data={users}
                                renderItem={({ item }) => (
                                    <View style={styles.tableRow}>
                                        <View style={[styles.tableCell, { flex: 2, alignItems: 'flex-start' }]}>
                                            <Text style={styles.userName}>{item.fullName}</Text>
                                            <Text style={styles.userSubtitle}>@{item.username} • {item.unionId}</Text>
                                        </View>
                                        <View style={[styles.tableCell, { flex: 1.5, alignItems: 'flex-start' }]}>
                                            <View style={styles.roleBadge}>
                                                <Text style={styles.roleText}>{getRoleName(item.role)}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tableCell, { flex: 1.5, alignItems: 'flex-start' }]}>
                                            <View style={styles.deptBadge}>
                                                <Text style={styles.deptText}>{getDeptName(item.department)}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                                            <View style={[styles.statusBadge, item.status !== 'active' && item.status !== 'ACTIVE' && item.status !== 'PENDING' && styles.statusInactive, item.status === 'PENDING' && { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                                <Text style={[styles.statusText, item.status === 'PENDING' && { color: '#f59e0b' }]}>
                                                    {item.status === 'active' || item.status === 'ACTIVE' ? 'Hoạt động' : item.status === 'PENDING' ? 'Chờ duyệt' : 'Khóa'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tableCell, { width: 120, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                                            {item.status === 'PENDING' && (
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 6 }]}
                                                    onPress={() => handleApprove(item.id, item.fullName)}
                                                >
                                                    <Shield color={Colors.status.success} size={16} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.editBtn, { padding: 6 }]}
                                                onPress={() => {
                                                    setEditingUser(item);
                                                    setModalVisible(true);
                                                }}
                                            >
                                                <Edit2 color={Colors.primary} size={16} />
                                            </TouchableOpacity>
                                            {item.id !== user?.id && (
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 6 }]}
                                                    onPress={() => handleResetPassword(item.id, item.username)}
                                                >
                                                    <Lock color="#f59e0b" size={16} />
                                                </TouchableOpacity>
                                            )}
                                            {item.id !== user?.id && user?.role === 'SUPER_ADMIN' && (
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.deleteBtn, { padding: 6 }]}
                                                    onPress={() => handleDelete(item.id)}
                                                >
                                                    <Trash2 color={Colors.status.error} size={16} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                )}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                refreshControl={
                                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                                }
                                ListEmptyComponent={
                                    !loading ? (
                                        <View style={styles.emptyContainer}>
                                            <Text style={styles.emptyText}>Chưa có người dùng nào</Text>
                                        </View>
                                    ) : null
                                }
                            />
                        </View>
                    ) : (
                        <FlatList
                            data={users}
                            renderItem={renderUser}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            }
                            ListEmptyComponent={
                                !loading ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>Chưa có người dùng nào</Text>
                                    </View>
                                ) : null
                            }
                        />
                    )}
                </View>
            ) : activeTab === 'union_members' ? (
                <UnionMembersManagement />
            ) : activeTab === 'feedbacks' ? (
                <FeedbackManagement />
            ) : activeTab === 'surveys' ? (
                <SurveyManagement />
            ) : activeTab === 'honors' ? (
                <HonorManagement />
            ) : activeTab === 'elearning' ? (
                <ElearningManagement />
            ) : (
                <AnalyticsDashboard />
            )}

            <UserModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSuccess={() => {
                    setModalVisible(false);
                    fetchUsers();
                }}
                editUser={editingUser}
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
        backgroundColor: Colors.background,
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    headerDesktop: {
        paddingVertical: 10,
        marginHorizontal: 'auto',
        width: '100%',
        maxWidth: 800,
        borderBottomWidth: 0,
        backgroundColor: 'transparent',
        paddingTop: 24,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    tabScrollWrapper: {
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        flexGrow: 0,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
    },
    tabContainerDesktop: {
        marginHorizontal: 'auto',
        width: '100%',
        maxWidth: 800,
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        gap: 8,
    },
    tabItemActive: {
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    tabTextActive: {
        color: Colors.primary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    contentDesktop: {
        maxWidth: 1000,
        width: '100%',
        alignSelf: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 12,
    },
    statsContainerMobile: {
        flexDirection: 'column',
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 12,
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: Colors.divider,
    },
    statInfo: {
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    statLabel: {
        fontSize: 13,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 12,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.divider,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.text.primary,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.divider,
        paddingHorizontal: 16,
        gap: 8,
    },
    filterText: {
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    // Table Styles
    tableContainer: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        margin: 16,
        borderWidth: 1,
        borderColor: Colors.divider,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    tableHeaderText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text.secondary,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        alignItems: 'center',
    },
    tableCell: {
        justifyContent: 'center',
    },
    userCard: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.divider,
    },
    userInfo: {
        flex: 1,
    },
    userMainInfo: {
        marginBottom: 8,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    userSubtitle: {
        fontSize: 14,
        color: Colors.text.secondary,
        marginBottom: 8,
    },
    badgesWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    roleBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    roleText: {
        color: '#3b82f6',
        fontSize: 12,
        fontWeight: '600',
    },
    deptBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    deptText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusInactive: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    statusText: {
        color: '#6366f1',
        fontSize: 12,
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 16,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: Colors.background,
    },
    editBtn: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    deleteBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.text.secondary,
        fontSize: 16,
    },
});
