import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <Text style={styles.emoji}>😵</Text>
                    <Text style={styles.title}>Đã xảy ra lỗi</Text>
                    <Text style={styles.message}>
                        {this.state.error?.message || 'Ứng dụng gặp sự cố không mong muốn'}
                    </Text>
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <Text style={styles.buttonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: Colors.background,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
