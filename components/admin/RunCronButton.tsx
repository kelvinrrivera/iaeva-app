'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

export default function RunCronButton({ path, label }: { path: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () => {
    if (!confirm(`Ejecutar ${path} manualmente ahora?`)) return;
    start(async () => {
      try {
        const res = await fetch('/api/admin/crons/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const result = await res.json();
        if (!res.ok) {
          alert(`Error: ${result.error || 'falló'}`);
        } else {
          alert('Ejecutado correctamente');
          router.refresh();
        }
      } catch (e: any) {
        alert(`Error: ${e?.message}`);
      }
    });
  };

  return (
    <button
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
    >
      <Play className="h-3 w-3" /> {pending ? 'Ejecutando…' : label}
    </button>
  );
}
