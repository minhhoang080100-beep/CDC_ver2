import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, Platform } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface QRScannerModalProps {
    visible: boolean;
    activityId: string | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

export default function QRScannerModal({ visible, activityId, onClose, onSuccess }: QRScannerModalProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const { token } = useAuth();
    const { showToast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (visible && !permission?.granted && permission?.canAskAgain) {
            requestPermission();
        }
        if (visible) {
            setScanned(false);
            setIsProcessing(false);
        }
    }, [visible]);

    if (!visible) return null;

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.permissionText}>Chúng tôi cần cấp quyền sử dụng Camera để quét mã QR điểm danh.</Text>
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <Text style={styles.permissionButtonText}>Cấp quyền Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>Đóng</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || isProcessing || !activityId) return;
        setScanned(true);
        setIsProcessing(true);

        try {
            const parsed = JSON.parse(data);
            if (!parsed.id || !parsed.unionId) {
                throw new Error("Invalid QR data");
            }

            const response = await api.post(`/api/activities/${activityId}/checkin`, { qr_data: data }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showToast({ message: response.data.message || 'Điểm danh thành công', type: 'success' });
            onSuccess(response.data.message);
            // Delay a bit before allowing next scan
            setTimeout(() => {
                setScanned(false);
                setIsProcessing(false);
            }, 2000);

        } catch (error: any) {
            console.error('Scan error:', error);
            const msg = error.response?.data?.detail || 'Mã QR không hợp lệ hoặc không có quyền';
            showToast({ message: msg, type: 'error' });
            setTimeout(() => {
                setScanned(false);
                setIsProcessing(false);
            }, 2000);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.scannerContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Quét QR Điểm danh</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
                            <X color="#ffffff" size={24} />
                        </TouchableOpacity>
                    </View>

                    {Platform.OS === 'web' ? (
                        <View style={styles.webFallbackContainer}>
                            <Text style={styles.webFallbackText}>Quét QR qua Camera Web có thể không ổn định hoặc chưa được hỗ trợ tốt trên môi trường giả lập. Vui lòng check in bằng App Mobile.</Text>
                            <CameraView
                                style={styles.camera}
                                facing="back"
                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                barcodeScannerSettings={{
                                    barcodeTypes: ["qr"],
                                }}
                            />
                        </View>
                    ) : (
                        <CameraView
                            style={styles.camera}
                            facing="back"
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        />
                    )}

                    {scanned && (
                        <View style={styles.scanningOverlay}>
                            <Text style={styles.scanningText}>Đang xử lý...</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
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
    closeButton: {
        marginTop: 12,
        padding: 12,
    },
    closeButtonText: {
        color: Colors.text.secondary,
        fontSize: 16,
    },
    scannerContainer: {
        width: '100%',
        height: '100%',
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
    camera: {
        flex: 1,
        width: '100%',
    },
    scanningOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -60 }, { translateY: -20 }],
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    scanningText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    webFallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    webFallbackText: {
        color: '#fff',
        textAlign: 'center',
        padding: 20,
        position: 'absolute',
        top: 20,
        zIndex: 2,
    }
});
