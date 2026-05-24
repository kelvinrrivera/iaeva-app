'use client';

/**
 * Button Component
 *
 * Reusable button component with multiple variants and sizes.
 * Supports shop type coloring for multi-nicho system.
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="shopType" shopType="BARBERSHOP">Shop Colored</Button>
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ShopType } from '@prisma/client';
import { getShopGradient } from '@/lib/design/tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'shopType';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  fullWidth?: boolean;
  shopType?: ShopType;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      shopType,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary shadow-sm',
      secondary: 'bg-gray-100 text-charcoal hover:bg-gray-200 focus-visible:ring-primary',
      outline: 'border border-gray-200 text-charcoal hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-primary',
      ghost: 'text-charcoal hover:bg-gray-100 focus-visible:ring-primary',
      danger: 'bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent shadow-sm',
      shopType: shopType
        ? `bg-gradient-to-r ${getShopGradient(shopType)} text-white hover:opacity-90 focus-visible:ring-primary shadow-sm`
        : 'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary shadow-sm',
    };

    const sizeStyles = {
      xs: 'h-7 px-3 text-xs',
      sm: 'h-9 px-4 text-sm',
      md: 'h-10 px-5 text-sm',
      lg: 'h-11 px-6 text-sm',
      xl: 'h-12 px-8 text-base',
    };

    const widthStyles = fullWidth ? 'w-full' : '';

    const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`;

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={classes}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
