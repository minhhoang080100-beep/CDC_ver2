import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, CheckCircle, AlertCircle } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface MemberCheckinModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function MemberCheckinModal({ visible, onClose, onSuccess }: MemberCheckinModalProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const { token } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        if (visible && !permission?.granted && permission?.canAskAgain) {
            requestPermission();
        }
        if (visible) {
            setScanned(false);
            setIsProcessing(false);
            setResult(null);
        }
    }, [visible]);

    if (!visible) return null;

    if (!permission) return <View />;

    if (!permission.granted) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.permissionCard}>
                        <Text style={styles.permissionText}>
                            Cần cấp quyền Camera để quét mã QR điểm danh.
                        </Text>
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <Text style={styles.permissionButtonText}>Cấp quyền Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Đóng</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
        if (scanned || isProcessing) return;
        setScanned(true);
        setIsProcessing(true);

        try {
            const parsed = JSON.parse(data);

            // Check if this is an activity checkin QR
            if (parsed.type !== 'activity_checkin' || !parsed.activityId || !parsed.token) {
                setResult({ success: false, message: 'Mã QR không phải mã điểm danh sự kiện.' });
                setIsProcessing(false);
                return;
            }

            const response = await api.post(
                `/api/activities/${parsed.activityId}/self-checkin`,
                { qr_data: data },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const msg = response.data.message || 'Điểm danh thành công!';
            setResult({ success: true, message: msg });
            onSuccess();
        } catch (error: any) {
            console.error('Self-checkin error:', error);
            const msg = error.detail || error.response?.data?.detail || 'Không thể điểm danh. Vui lòng thử lại.';
            setResult({ success: false, message: msg });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetry = () => {
        setScanned(false);
        setResult(null);
        setIsProcessing(false);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.scannerContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Điểm danh sự kiện</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
                            <X color="#ffffff" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Instruction */}
                    <View style={styles.instructionBar}>
                        <Text style={styles.instructionText}>
                            Hướng camera vào mã QR được hiển thị tại sự kiện
                        </Text>
                    </View>

                    {/* Camera or Result */}
                    {result ? (
                        <View style={styles.resultContainer}>
                            <View style={[styles.resultCard, result.success ? styles.resultSuccess : styles.resultError]}>
                                {result.success ? (
                                    <CheckCircle color="#10b981" size={64} />
                                ) : (
                                    <AlertCircle color="#ef4444" size={64} />
                                )}
                                <Text style={[styles.resultMessage, result.success ? { color: '#10b981' } : { color: '#ef4444' }]}>
                                    {result.message}
                                </Text>
                                <View style={styles.resultActions}>
                                    {!result.success && (
                                        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                                            <Text style={styles.retryBtnText}>Quét lại</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.doneBtn, result.success && { flex: 1 }]}
                                        onPress={onClose}
                                    >
                                        <Text style={styles.doneBtnText}>Đóng</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <>
                            {Platform.OS === 'web' ? (
                                <View style={styles.webFallback}>
                                    <Text style={styles.webFallbackTitle}>📱 Vui lòng dùng App Mobile</Text>
                                    <Text style={styles.webFallbackText}>
                                        Tính năng quét QR điểm danh hoạt động tốt nhất trên ứng dụng di động.
                                    </Text>
                                    <CameraView
                                        style={styles.camera}
                                        facing="back"
                                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                                    />
                                </View>
                            ) : (
                                <CameraView
                                    style={styles.camera}
                                    facing="back"
                                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                                />
                            )}

                            {isProcessing && (
                                <View style={styles.processingOverlay}>
                                    <ActivityIndicator size="large" color="#fff" />
                                    <Text style={styles.processingText}>Đang xác thực...</Text>
                                </View>
                            )}

                            {/* Scan frame overlay */}
                            <View style={styles.frameOverlay}>
                                <View style={styles.frameBorder} />
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 10,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeIcon: {
        padding: 4,
    },
    instructionBar: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    instructionText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    frameOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        pointerEvents: 'none',
    },
    frameBorder: {
        width: 250,
        height: 250,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.5)',
        borderRadius: 20,
    },
    processingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    processingText: {
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 16,
        fontSize: 16,
    },
    resultContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    resultCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 360,
    },
    resultSuccess: {
        borderWidth: 2,
        borderColor: '#dcfce7',
    },
    resultError: {
        borderWidth: 2,
        borderColor: '#fee2e2',
    },
    resultMessage: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 28,
        lineHeight: 26,
    },
    resultActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    retryBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    retryBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
    },
    doneBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        alignItems: 'center',
    },
    doneBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    permissionCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        width: '80%',
        maxWidth: 400,
        alignItems: 'center',
    },
    permissionText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
        color: '#0f172a',
    },
    permissionButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    permissionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelBtn: {
        marginTop: 12,
        padding: 12,
    },
    cancelBtnText: {
        color: '#64748b',
        fontSize: 16,
    },
    webFallback: {
        flex: 1,
    },
    webFallbackTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 2,
    },
    webFallbackText: {
        color: '#ccc',
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 2,
    },
});
