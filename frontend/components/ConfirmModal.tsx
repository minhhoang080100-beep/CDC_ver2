import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform, ActivityIndicator } from 'react-native';
import { useConfirm, ConfirmType } from '../contexts/ConfirmContext';
import { Colors } from '../constants/Colors';
import { Trash2, AlertTriangle, ShieldCheck, Info } from 'lucide-react-native';

export default function ConfirmModal() {
    const { isVisible, confirmState, hideConfirm } = useConfirm();
    const [isExecuting, setIsExecuting] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 65,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 150,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isVisible]);

    if (!confirmState && !isVisible) return null;

    const handleConfirm = async () => {
        if (confirmState?.onConfirm) {
            setIsExecuting(true);
            try {
                await confirmState.onConfirm();
            } catch (error) {
                console.error("Action failed", error);
            } finally {
                setIsExecuting(false);
                hideConfirm();
            }
        }
    };

    const handleCancel = () => {
        if (!isExecuting) {
            if (confirmState?.onCancel) {
                confirmState.onCancel();
            }
            hideConfirm();
        }
    };

    const getIconConfig = (type?: ConfirmType) => {
        switch (type) {
            case 'danger':
                return { Icon: Trash2, color: Colors.status.error, bgColor: 'rgba(239, 68, 68, 0.1)' };
            case 'warning':
                return { Icon: AlertTriangle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' };
            case 'success':
                return { Icon: ShieldCheck, color: Colors.status.success, bgColor: 'rgba(16, 185, 129, 0.1)' };
            case 'info':
            default:
                return { Icon: Info, color: Colors.primary, bgColor: 'rgba(59, 130, 246, 0.1)' };
        }
    };

    const { Icon, color, bgColor } = getIconConfig(confirmState?.type);

    return (
        <Modal
            transparent
            visible={isVisible || fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) as unknown as boolean}
            animationType="none"
            onRequestClose={handleCancel}
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={handleCancel}
                />
                <Animated.View style={[
                    styles.modalContainer,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                            <Icon color={color} size={28} />
                        </View>

                        <Text style={styles.title}>{confirmState?.title}</Text>
                        <Text style={styles.message}>{confirmState?.message}</Text>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={handleCancel}
                                disabled={isExecuting}
                            >
                                <Text style={styles.cancelText}>{confirmState?.cancelText}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: color }]}
                                onPress={handleConfirm}
                                disabled={isExecuting}
                            >
                                {isExecuting ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.confirmText}>{confirmState?.confirmText}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }
        }),
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.divider,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    confirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    }
});
