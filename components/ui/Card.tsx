'use client';

/**
 * Card Component
 *
 * Reusable card component for displaying content.
 * Supports multiple variants and shop type coloring.
 *
 * @example
 * <Card variant="default" className="p-6">
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content</CardContent>
 * </Card>
 */

import React from 'react';
import type { ShopType } from '@prisma/client';
import { getShopColorClass } from '@/lib/design/tokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'shopType';
  shopType?: ShopType;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', shopType, className = '', ...props }, ref) => {
    const baseStyles = 'rounded-xl bg-white transition-all';

    const variantStyles = {
      default: 'border border-slate-200',
      bordered: 'border-2 border-slate-200',
      elevated: 'border border-slate-200 shadow-lg',
      shopType: shopType
        ? `border-2 ${getShopColorClass(shopType, 'border')} shadow-md`
        : 'border border-slate-200',
    };

    const classes = `${baseStyles} ${variantStyles[variant]} ${className}`;

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pb-4 ${className}`} {...props}>
      {children}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <h3 ref={ref} className={`text-xl font-bold text-slate-900 ${className}`} {...props}>
      {children}
    </h3>
  );
});

CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <p ref={ref} className={`text-sm text-slate-600 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <div ref={ref} className={`p-6 pt-4 flex items-center gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';
