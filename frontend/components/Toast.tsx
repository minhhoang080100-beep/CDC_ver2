import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';

export default function Toast() {
    const { visible, toastData } = useToast();
    const slideAnim = React.useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible && toastData) {
            Animated.spring(slideAnim, {
                toValue: Platform.OS === 'ios' ? 50 : 20,
                useNativeDriver: true,
                bounciness: 12,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, toastData]);

    if (!toastData) return null;

    const getIcon = () => {
        switch (toastData.type) {
            case 'success':
                return <CheckCircle2 color={Colors.status.success} size={24} />;
            case 'error':
                return <AlertCircle color={Colors.status.error} size={24} />;
            case 'info':
            default:
                return <Info color={Colors.status.info} size={24} />;
        }
    };

    const getBackgroundColor = () => {
        switch (toastData.type) {
            case 'success':
                return '#f0fdf4'; // Light green
            case 'error':
                return '#fef2f2'; // Light red
            case 'info':
            default:
                return '#eff6ff'; // Light blue
        }
    };

    const getBorderColor = () => {
        switch (toastData.type) {
            case 'success':
                return Colors.status.success;
            case 'error':
                return Colors.status.error;
            case 'info':
            default:
                return Colors.status.info;
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: getBackgroundColor(),
                    borderLeftColor: getBorderColor(),
                },
            ]}
        >
            <View style={styles.iconContainer}>{getIcon()}</View>
            <View style={styles.contentContainer}>
                <Text style={styles.message}>{toastData.message}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 6,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
            web: {
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                left: 'auto',
                right: 20,
                width: 320,
            },
        }),
    },
    iconContainer: {
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    message: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.text.primary,
    },
});
