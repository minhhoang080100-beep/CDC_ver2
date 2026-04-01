import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import {
    MessageSquare,
    ClipboardList,
    Trophy,
    GraduationCap,
    Settings,
    Users,
    LogOut,
    ChevronRight,
} from 'lucide-react-native';

interface MenuItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ color: string; size: number }>;
    label: string;
    description: string;
    color: string;
    bgColor: string;
}

const MENU_ITEMS: MenuItem[] = [
    {
        name: 'feedback',
        path: '/(tabs)/feedback',
        icon: MessageSquare,
        label: 'Góp ý & Giải đáp',
        description: 'Gửi và xem ý kiến đóng góp',
        color: '#3b82f6',
        bgColor: '#eff6ff',
    },
    {
        name: 'surveys',
        path: '/(tabs)/surveys',
        icon: ClipboardList,
        label: 'Khảo sát',
        description: 'Tham gia các khảo sát',
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
    },
    {
        name: 'honors',
        path: '/(tabs)/honors',
        icon: Trophy,
        label: 'Vinh danh',
        description: 'Bảng vinh danh & đề cử',
        color: '#f59e0b',
        bgColor: '#fffbeb',
    },
    {
        name: 'elearning',
        path: '/(tabs)/elearning',
        icon: GraduationCap,
        label: 'Đào tạo',
        description: 'Khóa học trực tuyến',
        color: '#10b981',
        bgColor: '#ecfdf5',
    },
];

const ADMIN_ITEM: MenuItem = {
    name: 'admin',
    path: '/(tabs)/admin',
    icon: Users,
    label: 'Quản trị hệ thống',
    description: 'Quản lý người dùng & dữ liệu',
    color: '#ef4444',
    bgColor: '#fef2f2',
};

const SETTINGS_ITEM: MenuItem = {
    name: 'settings',
    path: '/(tabs)/settings',
    icon: Settings,
    label: 'Cài đặt',
    description: 'Thông báo, bảo mật, giao diện',
    color: '#64748b',
    bgColor: '#f8fafc',
};

export default function MoreScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

    const allItems = [...MENU_ITEMS, ...(isAdmin ? [ADMIN_ITEM] : []), SETTINGS_ITEM];

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case 'SUPER_ADMIN': return 'Quản trị viên';
            case 'BCH_VANPHONG': return 'BCH Văn phòng';
            case 'BCH_CUALO': return 'BCH Cửa Lò';
            case 'BCH_BENTHUY': return 'BCH Bến Thủy';
            default: return 'Đoàn viên';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>TIỆN ÍCH</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* User Card */}
                <View style={styles.userCard}>
                    <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.fullName}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>{getRoleBadge(user?.role)}</Text>
                        </View>
                    </View>
                </View>

                {/* Menu Grid */}
                <View style={styles.menuGrid}>
                    {allItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <TouchableOpacity
                                key={item.name}
                                style={styles.menuItem}
                                onPress={() => router.push(item.path as any)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: item.bgColor }]}>
                                    <IconComponent color={item.color} size={24} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <Text style={styles.menuDesc} numberOfLines={1}>{item.description}</Text>
                                </View>
                                <ChevronRight color="#cbd5e1" size={18} />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut color={Colors.status.error} size={20} />
                    <Text style={styles.logoutText}>Đăng xuất</Text>
                </TouchableOpacity>

                {/* Version  */}
                <Text style={styles.version}>Phiên bản 2.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        backgroundColor: Colors.header.background,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'web' ? 16 : 14,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        letterSpacing: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    // User Card
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 }, // Tăng độ nổi
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        gap: 14,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userAvatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    roleBadge: {
        backgroundColor: 'rgba(8, 145, 178, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    roleText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    // Menu
    menuGrid: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        minHeight: 64,
    },
    menuIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    menuDesc: {
        fontSize: 13,
        color: '#64748b', // Tăng độ tương phản từ #94a3b8 lên #64748b
    },
    // Logout
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fecaca',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.status.error,
    },
    version: {
        textAlign: 'center',
        fontSize: 12,
        color: '#cbd5e1',
        marginTop: 20,
    },
});
