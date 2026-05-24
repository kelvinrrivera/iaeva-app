'use client';

import { ToastProvider } from '@/contexts/ToastContext';

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
