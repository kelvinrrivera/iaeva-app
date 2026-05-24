'use client';

/**
 * Toast Component
 *
 * Notification component for displaying alerts and messages.
 *
 * @example
 * <Toast variant="success" message="Success message" onClose={() => {}} />
 */

import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  duration?: number;
}

const variantConfig = {
  success: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    icon: CheckCircle,
    textColor: 'text-green-900',
  },
  error: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    icon: AlertCircle,
    textColor: 'text-red-900',
  },
  warning: {
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    icon: AlertTriangle,
    textColor: 'text-amber-900',
  },
  info: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    icon: Info,
    textColor: 'text-blue-900',
  },
};

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  message,
  onClose,
  duration = 5000,
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  React.useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`
      flex items-start gap-3 p-4 rounded-xl border-2 shadow-lg
      ${config.bgColor} ${config.borderColor}
      animate-in slide-in-from-top duration-300
    `}>
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />

      <p className={`flex-1 text-sm font-semibold ${config.textColor}`}>
        {message}
      </p>

      {onClose && (
        <button
          onClick={onClose}
          className={`flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors ${config.iconColor}`}
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

/**
 * Toast Container for managing multiple toasts
 */
export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="fixed top-4 right-4 z-[1700] flex flex-col gap-3 max-w-sm w-full">
      {children}
    </div>
  );
};
