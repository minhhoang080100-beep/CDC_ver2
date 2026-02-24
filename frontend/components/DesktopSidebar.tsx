import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import {
    Home,
    Calendar,
    BookOpen,
    IdCard,
    Settings,
    MessageSquare,
    LogOut,
    Shield,
} from 'lucide-react-native';

interface MenuItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ color: string; size: number }>;
    label: string;
}

const MENU_ITEMS: MenuItem[] = [
    { name: 'index', path: '/(tabs)', icon: Home, label: 'Bảng tin' },
    { name: 'activities', path: '/(tabs)/activities', icon: Calendar, label: 'Hoạt động' },
    { name: 'library', path: '/(tabs)/library', icon: BookOpen, label: 'Thư viện' },
    { name: 'profile', path: '/(tabs)/profile', icon: IdCard, label: 'Thẻ Đoàn viên' },
    { name: 'feedback', path: '/(tabs)/feedback', icon: MessageSquare, label: 'Phản hồi' },
    { name: 'settings', path: '/(tabs)/settings', icon: Settings, label: 'Cài đặt' },
];

interface Props {
    width: number;
}

function DesktopSidebar({ width }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();

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

    return (
        <View style={[styles.sidebar, { width }]}>
            {/* Logo / Brand */}
            <View style={styles.brand}>
                <View style={[styles.logoContainer, { backgroundColor: 'transparent' }]}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={{ width: 40, height: 40, resizeMode: 'contain' }}
                    />
                </View>
                <View style={styles.brandText}>
                    <Text style={styles.brandTitle}>Công Đoàn</Text>
                    <Text style={styles.brandSubtitle}>Cảng Nghệ Tĩnh</Text>
                </View>
            </View>

            {/* Navigation Items */}
            <View style={styles.nav}>
                {MENU_ITEMS.map((item) => {
                    const active = isActive(item);
                    const IconComponent = item.icon;
                    return (
                        <TouchableOpacity
                            key={item.name}
                            style={[styles.navItem, active && styles.navItemActive]}
                            onPress={() => router.push(item.path as any)}
                            activeOpacity={0.7}
                        >
                            <IconComponent
                                color={active ? Colors.primary : Colors.text.secondary}
                                size={20}
                            />
                            <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                                {item.label}
                            </Text>
                            {active && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* User Info */}
            <View style={styles.userSection}>
                <View style={styles.divider} />
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
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
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: Colors.divider,
        paddingVertical: 0,
        justifyContent: 'space-between',
        ...(Platform.OS === 'web' ? { height: '100vh' as any, position: 'fixed' as any, left: 0, top: 0, zIndex: 100 } : {}),
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
        backgroundColor: Colors.header.background,
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
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    brandSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 14,
        position: 'relative',
    },
    navItemActive: {
        backgroundColor: '#f0f9ff',
    },
    navLabel: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    navLabelActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        left: 0,
        top: 8,
        bottom: 8,
        width: 3,
        borderRadius: 2,
        backgroundColor: Colors.primary,
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
