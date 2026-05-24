'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to Sentry automatically via the root error boundary,
    // but log here too for local dev.
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-charcoal">Algo salió mal</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        No pudimos cargar esta sección. Intenta de nuevo en unos segundos — si el problema persiste,
        nuestro equipo ya fue notificado.
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={() => reset()}
        leftIcon={<RotateCw className="h-4 w-4" />}
      >
        Reintentar
      </Button>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground/70">ID: {error.digest}</p>
      )}
    </div>
  );
}
