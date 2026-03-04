import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/Colors';

interface SkeletonLoaderProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

export function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonLoaderProps) {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width: width as any, height, borderRadius, opacity },
                style,
            ]}
        />
    );
}

// Pre-built skeleton patterns
export function SkeletonCard() {
    return (
        <View style={styles.card}>
            <SkeletonLoader height={20} width="70%" style={{ marginBottom: 12 }} />
            <SkeletonLoader height={14} width="100%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={14} width="85%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={14} width="50%" />
        </View>
    );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
    return (
        <View style={styles.list}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: Colors.border || '#e2e8f0',
    },
    card: {
        backgroundColor: Colors.surface || '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border || '#e2e8f0',
    },
    list: {
        padding: 16,
    },
});
