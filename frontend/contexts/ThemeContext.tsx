import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightColors = {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceSecondary: '#F0F2F5',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
    border: '#E5E7EB',
    card: '#FFFFFF',
    cardShadow: 'rgba(0,0,0,0.08)',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
    inputBg: '#F9FAFB',
    skeleton: '#E5E7EB',
    skeletonHighlight: '#F3F4F6',
    overlay: 'rgba(0,0,0,0.5)',
    statusBar: 'dark-content',
};

export const darkColors = {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    primary: '#3B82F6',
    primaryLight: '#1E3A5F',
    border: '#334155',
    card: '#1E293B',
    cardShadow: 'rgba(0,0,0,0.3)',
    danger: '#F87171',
    dangerLight: '#450A0A',
    success: '#34D399',
    successLight: '#064E3B',
    warning: '#FBBF24',
    warningLight: '#451A03',
    tabBar: '#1E293B',
    tabBarBorder: '#334155',
    inputBg: '#334155',
    skeleton: '#334155',
    skeletonHighlight: '#475569',
    overlay: 'rgba(0,0,0,0.7)',
    statusBar: 'light-content',
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    colors: ThemeColors;
    mode: ThemeMode;
    isDark: boolean;
    setMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    colors: lightColors,
    mode: 'system',
    isDark: false,
    setMode: () => { },
    toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('system');

    useEffect(() => {
        AsyncStorage.getItem('themeMode').then((saved) => {
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                setModeState(saved);
            }
        });
    }, []);

    const isDark =
        mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

    const colors = isDark ? darkColors : lightColors;

    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode);
        AsyncStorage.setItem('themeMode', newMode);
    }, []);

    const toggleTheme = useCallback(() => {
        setMode(isDark ? 'light' : 'dark');
    }, [isDark, setMode]);

    return (
        <ThemeContext.Provider value={{ colors, mode, isDark, setMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
