'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-white border-green-500 text-green-700',
  error: 'bg-white border-red-500 text-red-700',
  warning: 'bg-white border-amber-500 text-amber-700',
  info: 'bg-white border-[#0E2A47] text-[#0E2A47]',
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-[#0E2A47]',
};

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.variant];

  React.useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 shadow-lg max-w-sm w-full text-sm font-medium
        animate-in slide-in-from-right-5 fade-in duration-300 ${STYLES[toast.variant]}`}
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${ICON_STYLES[toast.variant]}`} aria-hidden="true" />
      <p className="flex-1 text-gray-800">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors text-gray-400 hover:text-gray-600
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, duration = 4000) => {
    const id = `toast-${++counter.current}`;
    setToasts(prev => [...prev.slice(-4), { id, variant, message, duration }]);
  }, []);

  const ctx: ToastContextValue = {
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d ?? 6000),
    warning: (m, d) => push('warning', m, d),
    info: (m, d) => push('info', m, d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-label="Notificaciones"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
