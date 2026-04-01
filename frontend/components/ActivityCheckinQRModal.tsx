import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, ActivityIndicator, Image } from 'react-native';
import { X, Users, RefreshCw, Wifi } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// QRCode SVG: only on native
let QRCode: any = null;
if (Platform.OS !== 'web') {
    QRCode = require('react-native-qrcode-svg').default;
}

interface ActivityCheckinQRModalProps {
    visible: boolean;
    activityId: string | null;
    onClose: () => void;
}

export default function ActivityCheckinQRModal({ visible, activityId, onClose }: ActivityCheckinQRModalProps) {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [qrData, setQrData] = useState<string>('');
    const [expiresIn, setExpiresIn] = useState(30);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [activityName, setActivityName] = useState('');
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(30);
    const intervalRef = useRef<any>(null);
    const countdownRef = useRef<any>(null);

    const fetchToken = useCallback(async () => {
        if (!activityId || !token) return;
        try {
            const response = await api.get(`/api/activities/${activityId}/checkin-token`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQrData(response.data.qrData);
            setExpiresIn(response.data.expiresIn);
            setCountdown(response.data.expiresIn);
            setAttendanceCount(response.data.attendanceCount);
            setActivityName(response.data.activityName);
            setLoading(false);
        } catch (error: any) {
            console.error('Error fetching checkin token:', error);
            showToast({ message: error.detail || 'Không thể tải mã QR', type: 'error' });
            setLoading(false);
        }
    }, [activityId, token]);

    useEffect(() => {
        if (visible && activityId) {
            setLoading(true);
            fetchToken();

            // Refresh QR every 25 seconds
            intervalRef.current = setInterval(() => {
                fetchToken();
            }, 25000);

            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        } else {
            setQrData('');
            setLoading(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
    }, [visible, activityId, fetchToken]);

    // Countdown timer
    useEffect(() => {
        if (visible && !loading) {
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) return 30; // Reset
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (countdownRef.current) clearInterval(countdownRef.current);
            };
        }
    }, [visible, loading]);

    // Build QR image URL for web
    const getWebQRUrl = (data: string) => {
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Wifi color="#10b981" size={20} />
                            <Text style={styles.liveText}>ĐANG HOẠT ĐỘNG</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color="#64748b" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Activity Name */}
                    <Text style={styles.activityName}>{activityName}</Text>
                    <Text style={styles.instruction}>
                        Đoàn viên dùng app quét mã QR bên dưới để điểm danh
                    </Text>

                    {/* QR Code */}
                    <View style={styles.qrWrapper}>
                        {loading ? (
                            <View style={styles.qrPlaceholder}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                                <Text style={styles.loadingText}>Đang tạo mã QR...</Text>
                            </View>
                        ) : Platform.OS !== 'web' && QRCode && qrData ? (
                            <View style={styles.qrBox}>
                                <QRCode
                                    value={qrData}
                                    size={220}
                                    backgroundColor="#ffffff"
                                />
                            </View>
                        ) : qrData ? (
                            <View style={styles.qrBox}>
                                <Image
                                    source={{ uri: getWebQRUrl(qrData) }}
                                    style={styles.webQrImage}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : null}
                    </View>

                    {/* Countdown */}
                    <View style={styles.countdownRow}>
                        <RefreshCw color={countdown <= 5 ? '#ef4444' : '#64748b'} size={16} />
                        <Text style={[styles.countdownText, countdown <= 5 && { color: '#ef4444' }]}>
                            Mã QR tự cập nhật sau {countdown}s
                        </Text>
                    </View>

                    {/* Attendance Count */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Users color={Colors.primary} size={24} />
                            <Text style={styles.statNumber}>{attendanceCount}</Text>
                            <Text style={styles.statLabel}>Đã điểm danh</Text>
                        </View>
                    </View>

                    {/* Refresh button */}
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchToken}>
                        <RefreshCw color="#fff" size={18} />
                        <Text style={styles.refreshBtnText}>Làm mới QR & Thống kê</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 28,
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    liveText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#10b981',
        letterSpacing: 1,
    },
    closeBtn: {
        padding: 4,
    },
    activityName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    instruction: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    qrWrapper: {
        marginBottom: 20,
    },
    qrPlaceholder: {
        width: 252,
        height: 252,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    qrBox: {
        padding: 16,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: Colors.primary + '30',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    webQrImage: {
        width: 260,
        height: 260,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
    },
    countdownText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    statsRow: {
        width: '100%',
        marginBottom: 20,
    },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: Colors.primary + '10',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    statLabel: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        width: '100%',
        justifyContent: 'center',
    },
    refreshBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
