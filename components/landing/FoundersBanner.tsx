'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface FounderStatus {
  totalSlots: number;
  claimedSlots: number;
  remainingSlots: number;
  isOpen: boolean;
  discountPct: number;
}

export default function FoundersBanner() {
  const [status, setStatus] = useState<FounderStatus | null>(null);

  useEffect(() => {
    fetch('/api/founders/status')
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  // Don't render until we have data — avoid layout shift, and don't render
  // anything if the program is closed.
  if (!status || !status.isOpen) return null;

  const percentClaimed = Math.round((status.claimedSlots / status.totalSlots) * 100);

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="font-bold">
            🎁 Promoción Fundadores: {status.discountPct}% de descuento de por vida
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${percentClaimed}%` }}
            />
          </div>
          <span className="text-white/90 text-xs font-semibold whitespace-nowrap">
            {status.remainingSlots} de {status.totalSlots} cupos restantes
          </span>
          <Link
            href="/onboarding?plan=TEAM"
            className="inline-flex items-center gap-1 px-3 py-1 bg-white text-emerald-700 text-xs font-bold rounded-full hover:bg-emerald-50 transition-colors shrink-0"
          >
            Reservar mi cupo →
          </Link>
        </div>
      </div>
    </div>
  );
}
