import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';

import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { NotificationsPanel } from '../app/(tabs)/notifications';
import {
    Home,
    Bell,
    Calendar,
    BookOpen,
    IdCard,
    Settings,
    MessageSquare,
    LogOut,
    Shield,
    Users,
    ClipboardList,
    Trophy,
    GraduationCap,
    Gift,
} from 'lucide-react-native';

interface MenuItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ color: string; size: number }>;
    label: string;
}

const MENU_ITEMS: MenuItem[] = [
    { name: 'index', path: '/(tabs)', icon: Home, label: 'Bảng tin' },
    { name: 'activities', path: '/(tabs)/activities', icon: Calendar, label: 'Kế hoạch hoạt động' },
    { name: 'library', path: '/(tabs)/library', icon: BookOpen, label: 'Thư viện' },
    { name: 'profile', path: '/(tabs)/profile', icon: IdCard, label: 'Thẻ Đoàn viên' },
    { name: 'feedback', path: '/(tabs)/feedback', icon: MessageSquare, label: 'Lắng nghe & Phản hồi' },
    { name: 'surveys', path: '/(tabs)/surveys', icon: ClipboardList, label: 'Khảo sát' },
    { name: 'honors', path: '/(tabs)/honors', icon: Trophy, label: 'Vinh danh' },
    { name: 'elearning', path: '/(tabs)/elearning', icon: GraduationCap, label: 'Đào tạo' },
    { name: 'donations', path: '/(tabs)/donations', icon: Gift, label: 'Kho 0 đồng' },
    { name: 'settings', path: '/(tabs)/settings', icon: Settings, label: 'Cài đặt' },
];

const ADMIN_MENU_ITEM: MenuItem = { name: 'admin', path: '/(tabs)/admin', icon: Users, label: 'Quản trị' };

interface Props {
    width: number;
}

function DesktopSidebar({ width }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, token, logout } = useAuth();

    // Fetch unread count for notification badge
    const { data: notifData } = useQuery({
        queryKey: ['notifications-badge'],
        queryFn: async () => {
            const res = await api.get('/api/notifications?skip=0&limit=1', {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.data;
        },
        enabled: !!token,
        refetchInterval: 30000, // Poll every 30 seconds
    });
    const unreadCount = notifData?.unread || 0;

    const isActive = (item: MenuItem) => {
        if (item.name === 'index') {
            return pathname === '/' || pathname === '/(tabs)' || pathname === '';
        }
        return pathname.includes(item.name);
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

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    const [showNotifPopup, setShowNotifPopup] = useState(false);
    const isNotifActive = pathname.includes('notifications');

    return (
        <View style={[styles.sidebar, { width }]}>
            {/* Logo / Brand + Bell icon */}
            <View style={styles.brand}>
                <View style={[styles.logoContainer, { backgroundColor: 'transparent' }]}>
                    <Image
                        source={require('../assets/images/icon.png')}
                        style={{ width: 40, height: 40, resizeMode: 'contain' }}
                    />
                </View>
                <View style={styles.brandText}>
                    <Text style={styles.brandTitle}>Công Đoàn</Text>
                    <Text style={styles.brandSubtitle}>Cảng Nghệ Tĩnh</Text>
                </View>
                {/* Bell icon — top right */}
                <TouchableOpacity
                    style={[styles.bellButton, (isNotifActive || showNotifPopup) && styles.bellButtonActive]}
                    onPress={() => setShowNotifPopup(!showNotifPopup)}
                    activeOpacity={0.7}
                >
                    <Bell color={isNotifActive ? Colors.primary : '#65676b'} size={20} />
                    {unreadCount > 0 && (
                        <View style={styles.bellBadge}>
                            <Text style={styles.bellBadgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Notifications Popup */}
            {showNotifPopup && (
                <View style={[styles.notifPopupWrapper, { left: width - 40 }]}>
                    <NotificationsPanel isPopup onClose={() => setShowNotifPopup(false)} />
                </View>
            )}

            {/* Navigation Items */}
            <View style={styles.nav}>
                {[...MENU_ITEMS, ...(user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_') ? [ADMIN_MENU_ITEM] : [])].map((item) => {
                    const active = isActive(item);
                    const IconComponent = item.icon;
                    return (
                        <TouchableOpacity
                            key={item.name}
                            style={[styles.navItem, active && styles.navItemActive]}
                            onPress={() => router.push(item.path as any)}
                            activeOpacity={0.7}
                        >
                            <View style={{ position: 'relative' }}>
                                <IconComponent
                                    color={active ? Colors.primary : '#65676b'}
                                    size={22}
                                />
                            </View>
                            <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* User Info */}
            <View style={styles.userSection}>
                <View style={styles.divider} />
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        {user?.avatar ? (
                            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>
                                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.userDetails}>
                        <Text style={styles.userName} numberOfLines={1}>{user?.fullName}</Text>
                        <Text style={styles.userRole}>{getRoleBadge(user?.role)}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut color={Colors.status.error} size={18} />
                    <Text style={styles.logoutText}>Đăng xuất</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default memo(DesktopSidebar);

const styles = StyleSheet.create({
    sidebar: {
        backgroundColor: 'transparent',
        borderRightWidth: 0,
        paddingVertical: 0,
        justifyContent: 'space-between',
        ...(Platform.OS === 'web' ? { height: '100vh' as any, position: 'fixed' as any, left: 0, top: 0, zIndex: 100 } : {}),
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
        backgroundColor: 'transparent',
        gap: 12,
    },
    logoContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandText: {
        flex: 1,
    },
    brandTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#050505',
    },
    brandSubtitle: {
        fontSize: 13,
        color: '#65676b',
        marginTop: 2,
    },
    nav: {
        flex: 1,
        paddingTop: 16,
        paddingHorizontal: 12,
        gap: 4,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 12,
    },
    navItemActive: {
        backgroundColor: '#e4e6eb',
    },
    navLabel: {
        fontSize: 15,
        color: '#050505',
        fontWeight: '500',
    },
    navLabelActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    bellButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e4e6eb',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    bellButtonActive: {
        backgroundColor: '#e7f3ff',
    },
    bellBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    bellBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    notifPopupWrapper: {
        position: 'absolute',
        top: 76,
        zIndex: 9999,
        backgroundColor: '#fff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    userSection: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginBottom: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    userRole: {
        fontSize: 12,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    logoutText: {
        fontSize: 14,
        color: Colors.status.error,
        fontWeight: '500',
    },
});
