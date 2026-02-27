import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextData {
    showToast: (options: ToastOptions) => void;
    hideToast: () => void;
    visible: boolean;
    toastData: ToastOptions | null;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [toastData, setToastData] = useState<ToastOptions | null>(null);

    const showToast = useCallback((options: ToastOptions) => {
        setToastData(options);
        setVisible(true);

        // Auto-hide after duration (default 3000ms)
        setTimeout(() => {
            hideToast();
        }, options.duration || 3000);
    }, []);

    const hideToast = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, visible, toastData }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
