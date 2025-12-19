'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const duration = toast.duration ?? 4000;
        setToasts(prev => [...prev, { ...toast, id }]);
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const value = useMemo(() => ({ pushToast }), [pushToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`min-w-[260px] rounded-lg border px-4 py-3 shadow-lg text-sm ${
                            t.type === 'success'
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : t.type === 'error'
                                    ? 'bg-red-50 border-red-200 text-red-800'
                                    : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}
                    >
                        {t.title && <div className="font-semibold mb-1">{t.title}</div>}
                        <div>{t.message}</div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
