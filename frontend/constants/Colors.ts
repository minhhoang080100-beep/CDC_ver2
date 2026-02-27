export const Colors = {
    primary: '#0891b2', // cyan-600
    primaryDark: '#0e7490', // cyan-700
    secondary: '#06b6d4', // cyan-500
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceLight: '#f1f5f9',
    text: {
        primary: '#1e293b', // slate-800
        secondary: '#64748b', // slate-500
        light: '#ffffff',
        placeholder: '#94a3b8', // slate-400
    },
    border: '#cbd5e1',
    divider: '#e2e8f0',
    status: {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
    },
    header: {
        background: '#1e3a8a', // blue-900
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
