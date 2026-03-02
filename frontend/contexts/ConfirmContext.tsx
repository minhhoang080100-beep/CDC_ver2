import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ConfirmType = 'danger' | 'warning' | 'success' | 'info';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmType;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
}

interface ConfirmContextType {
    showConfirm: (options: ConfirmOptions) => void;
    hideConfirm: () => void;
    confirmState: ConfirmOptions | null;
    isVisible: boolean;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
    const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const showConfirm = (options: ConfirmOptions) => {
        setConfirmState({
            ...options,
            type: options.type || 'info',
            confirmText: options.confirmText || 'Xác nhận',
            cancelText: options.cancelText || 'Hủy',
        });
        setIsVisible(true);
    };

    const hideConfirm = () => {
        setIsVisible(false);
        // Minor delay to allow exit animation to run before clearing state
        setTimeout(() => setConfirmState(null), 300);
    };

    return (
        <ConfirmContext.Provider value={{ showConfirm, hideConfirm, confirmState, isVisible }}>
            {children}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (context === undefined) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};
