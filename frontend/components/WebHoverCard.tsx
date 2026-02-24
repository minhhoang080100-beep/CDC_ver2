import React, { useState, useCallback } from 'react';
import { View, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface Props {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    hoverStyle?: ViewStyle;
}

/**
 * Wrapper that adds hover effects on web (shadow lift + cursor pointer).
 * On mobile, renders children as-is with no overhead.
 */
export default function WebHoverCard({ children, style, hoverStyle }: Props) {
    const [isHovered, setIsHovered] = useState(false);

    if (Platform.OS !== 'web') {
        return <View style={style}>{children}</View>;
    }

    return (
        <View
            style={[
                style,
                styles.webCard,
                isHovered && styles.hovered,
                isHovered && hoverStyle,
            ]}
            // @ts-ignore - web only events
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    webCard: {
        // @ts-ignore
        cursor: 'pointer' as any,
        // @ts-ignore
        transition: 'all 0.2s ease' as any,
    },
    hovered: {
        // @ts-ignore
        transform: [{ translateY: -2 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
});
