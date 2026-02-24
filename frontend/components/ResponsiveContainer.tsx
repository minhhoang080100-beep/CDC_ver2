import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface Props {
    children: React.ReactNode;
    noPadding?: boolean;
}

/**
 * Wraps content with max-width and centering on desktop.
 * On mobile, renders children as-is (full width).
 */
export default function ResponsiveContainer({ children, noPadding }: Props) {
    const { isDesktop, contentMaxWidth, sidebarWidth } = useResponsive();

    if (!isDesktop) {
        return <>{children}</>;
    }

    return (
        <View style={[
            styles.container,
            {
                marginLeft: sidebarWidth,
                paddingHorizontal: noPadding ? 0 : 24,
            }
        ]}>
            <View style={[
                styles.content,
                contentMaxWidth ? { maxWidth: contentMaxWidth } : {},
            ]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
    },
    content: {
        flex: 1,
        width: '100%' as any,
    },
});
