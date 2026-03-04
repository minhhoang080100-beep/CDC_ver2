import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react-native';

const modes: { key: ThemeMode; icon: any; label: string }[] = [
    { key: 'light', icon: Sun, label: 'Sáng' },
    { key: 'dark', icon: Moon, label: 'Tối' },
    { key: 'system', icon: Monitor, label: 'Hệ thống' },
];

export default function ThemeToggle() {
    const { mode, setMode, colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {modes.map(({ key, icon: Icon, label }) => {
                const isActive = mode === key;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => setMode(key)}
                        style={[
                            styles.button,
                            isActive && { backgroundColor: colors.primary },
                        ]}
                    >
                        <Icon
                            size={16}
                            color={isActive ? '#FFFFFF' : colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.label,
                                { color: isActive ? '#FFFFFF' : colors.textSecondary },
                            ]}
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderRadius: 12,
        borderWidth: 1,
        padding: 3,
        gap: 2,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        gap: 5,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
    },
});
