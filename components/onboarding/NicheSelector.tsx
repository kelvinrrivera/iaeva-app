'use client';

/**
 * NicheSelector Component
 *
 * Reusable component for selecting shop type (barbershop, beauty salon, hybrid)
 * Used in both landing page and onboarding flow.
 *
 * Features:
 * - Visual cards with niche-specific icons and colors
 * - Hover effects with color transitions
 * - Accessible keyboard navigation
 * - Responsive design
 */

import React, { useState } from 'react';
import { Scissors as BarberIcon, Sparkles as BeautyIcon, Palette as HybridIcon } from 'lucide-react';
import type { ShopType } from '@prisma/client';

interface NicheOption {
  value: ShopType;
  label: string;
  description: string;
  icon: typeof BarberIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const NICHE_OPTIONS: NicheOption[] = [
  {
    value: 'BARBERSHOP',
    label: 'Barbería',
    description: 'Cortes masculinos, perfiles de barba y cuidado para hombres',
    icon: BarberIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200 hover:border-blue-400',
  },
  {
    value: 'BEAUTY_SALON',
    label: 'Salón de Belleza',
    description: 'Cortes, tintes, tratamientos y styling para mujeres',
    icon: BeautyIcon,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50 hover:bg-pink-100',
    borderColor: 'border-pink-200 hover:border-pink-400',
  },
  {
    value: 'HYBRID',
    label: 'Salón Unisex',
    description: 'Negocio completo que atiende a mujeres y hombres',
    icon: HybridIcon,
    color: 'text-purple-600',
    bgColor: 'bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100',
    borderColor: 'border-purple-200 hover:border-purple-400',
  },
];

interface NicheSelectorProps {
  onSelect?: (shopType: ShopType) => void;
  selectedValue?: ShopType;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'grid' | 'row';
  className?: string;
}

export function NicheSelector({
  onSelect,
  selectedValue,
  size = 'md',
  layout = 'grid',
  className = '',
}: NicheSelectorProps) {
  const [selected, setSelected] = useState<ShopType | undefined>(selectedValue);

  const handleSelect = (option: NicheOption) => {
    setSelected(option.value);
    onSelect?.(option.value);
  };

  const sizeClasses = {
    sm: 'p-4 gap-3',
    md: 'p-6 gap-4',
    lg: 'p-8 gap-5',
  };

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const textSizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
  };

  const descriptionSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const gridClasses = layout === 'grid'
    ? 'grid grid-cols-3 gap-4'
    : 'flex flex-col md:flex-row gap-4';

  return (
    <div className={`${gridClasses} ${className}`}>
      {NICHE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option)}
            className={`
              ${sizeClasses[size]}
              rounded-xl border-2 transition-all duration-200
              ${option.bgColor} ${option.borderColor}
              ${isSelected ? 'border-current ring-2 ring-offset-2' : ''}
              flex flex-col items-center text-center
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              relative
            `}
            aria-pressed={isSelected}
            aria-label={`Seleccionar ${option.label}`}
          >
            {/* Checkmark badge */}
            {isSelected && (
              <div className={`
                absolute top-2 right-2
                w-5 h-5 rounded-full
                ${option.color} bg-white
                flex items-center justify-center shadow-sm
              `}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Icon */}
            <div className={`
              rounded-xl p-3 mb-3
              ${option.color} bg-white/60
            `}>
              <Icon className={iconSizeClasses[size]} />
            </div>

            {/* Content */}
            <span className={`
              ${textSizeClasses[size]}
              ${option.color}
              mb-1
            `}>
              {option.label}
            </span>
            <span className={`
              ${descriptionSizeClasses[size]}
              text-slate-500 leading-snug
            `}>
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact version of NicheSelector for inline use
 */
interface NicheSelectorCompactProps {
  value: ShopType;
  onChange?: (shopType: ShopType) => void;
  className?: string;
}

export function NicheSelectorCompact({
  value,
  onChange,
  className = '',
}: NicheSelectorCompactProps) {
  const option = NICHE_OPTIONS.find(opt => opt.value === value);
  if (!option) return null;

  const Icon = option.icon;

  return (
    <button
      onClick={() => onChange?.(value)}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5
        rounded-lg border-2
        ${option.bgColor} ${option.borderColor}
        ${option.color}
        font-semibold text-sm
        transition-all duration-200
        hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-offset-2
      `}
    >
      <Icon className="h-4 w-4" />
      <span>{option.label}</span>
    </button>
  );
}

/**
 * Get niche configuration by shop type
 */
export function getNicheConfig(shopType: ShopType): NicheOption | undefined {
  return NICHE_OPTIONS.find(opt => opt.value === shopType);
}

/**
 * Get all niche options
 */
export function getAllNicheOptions(): NicheOption[] {
  return NICHE_OPTIONS;
}
