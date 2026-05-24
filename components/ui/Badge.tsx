'use client';

/**
 * Badge Component
 *
 * Small status or label component for displaying categories,
 * counts, or status indicators.
 *
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="shopType" shopType="BARBERSHOP">Barbería</Badge>
 */

import React from 'react';
import type { ShopType } from '@prisma/client';
import { getShopColorClass } from '@/lib/design/tokens';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'shopType';
  size?: 'sm' | 'md' | 'lg';
  shopType?: ShopType;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', size = 'md', shopType, className = '', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full transition-colors';

    const variantStyles = {
      default: 'bg-slate-100 text-slate-700',
      success: 'bg-green-100 text-green-700',
      warning: 'bg-amber-100 text-amber-700',
      danger: 'bg-red-100 text-red-700',
      info: 'bg-blue-100 text-blue-700',
      shopType: shopType
        ? `${getShopColorClass(shopType, 'bg')} text-white`
        : 'bg-slate-100 text-slate-700',
    };

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };

    const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    return (
      <span ref={ref} className={classes} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
