/**
 * Colors.ts — Backward-compatible static color tokens.
 *
 * PREFERRED: use `useTheme().colors` from ThemeContext for theme-aware colors.
 * This file re-exports the light theme as a static fallback for non-component
 * code (e.g. navigation config, constants) that cannot use React hooks.
 */
import { lightColors } from '../contexts/ThemeContext';

export const Colors = {
    // ─── Core (mapped from ThemeContext lightColors) ──────────
    primary: lightColors.primary,
    primaryDark: '#1d4ed8',  // deeper shade for pressed states
    secondary: '#06b6d4',

    background: lightColors.background,
    surface: lightColors.surface,
    surfaceLight: lightColors.surfaceSecondary,

    text: {
        primary: lightColors.text,
        secondary: lightColors.textSecondary,
        light: '#ffffff',
        placeholder: lightColors.textTertiary,
    },

    border: lightColors.border,
    divider: '#e2e8f0',

    status: {
        success: lightColors.success,
        error: lightColors.danger,
        warning: lightColors.warning,
        info: '#3b82f6',
    },

    header: {
        background: '#1e3a8a',
        text: '#ffffff',
    },

    gradients: {
        primary: ['#0891b2', '#0e7490'] as const,
        header: ['#1e3a8a', '#172554'] as const,
        auth: ['#1e3a8a', '#0f172a'] as const,
    },

    shadows: {
        sm: {
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 2,
        },
        md: {
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
        },
        lg: {
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 8,
        }
    }
};

