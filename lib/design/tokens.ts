/**
 * Design Tokens for Multi-Nicho System
 *
 * Centralized design tokens that adapt based on shop type.
 * Provides consistent styling across the application while
 * allowing niche-specific variations.
 *
 * Design Philosophy: "Luxury Tech" - Premium, minimal, professional
 * Inspired by Calendly with Dominican Republic cultural adaptation
 *
 * Niches supported:
 * - BARBERSHOP: Blue theme
 * - BEAUTY_SALON: Pink theme
 * - HYBRID/UNISEX: Purple theme
 */

import type { ShopType } from '@prisma/client';

// ==========================================
// LUXURY TECH PALETTE
// ==========================================

/**
 * Premium color palette - "Luxury Tech"
 * Deep navy inspired by Dominican Republic blue
 * Elegant red for strategic CTAs only
 */
export const luxuryPalette = {
  // Primary - Deep navy blue
  primary: {
    base: '#0E2A47' as const,
    light: '#1A3D5F' as const,
    lighter: '#2A5278' as const,
    dark: '#091C2E' as const,
  },

  // Accent - Elegant red (STRATEGIC USE ONLY - CTAs)
  accent: {
    base: '#A61E2E' as const,
    hover: '#8B1826' as const,
    light: '#C4263A' as const,
  },

  // Neutrals
  neutral: {
    white: '#FFFFFF' as const,
    charcoal: '#1C1F26' as const, // Primary text
    gray600: '#4B5563' as const, // Secondary text
    gray400: '#9CA3AF' as const, // Tertiary text
    gray200: '#E5E7EB' as const, // Borders
    ui: '#F5F7FA' as const, // Backgrounds
  },

  // Semantic colors
  success: '#10B981' as const,
  warning: '#F59E0B' as const,
  error: '#EF4444' as const,
  info: '#3B82F6' as const,
} as const;

// ==========================================
// UPDATED SPACING SYSTEM (More generous)
// ==========================================

/**
 * Spacing scale with additional spacious increments
 * 40-60% more padding for premium feel
 */
export const luxurySpacing = {
  section: '120px', // Hero sections
  container: '80px', // Content areas
  card: '48px', // Card padding
  element: '32px', // Component spacing
} as const;

// ==========================================
// UPDATED SHADOW SYSTEM (Subtle, refined)
// ==========================================

/**
 * Shadow scale - More subtle than default
 * Uses primary color for depth
 */
export const luxuryShadows = {
  card: '0 2px 8px rgba(14, 42, 71, 0.08)',
  cardHover: '0 8px 24px rgba(14, 42, 71, 0.12)',
  floating: '0 12px 48px rgba(14, 42, 71, 0.15)',
  subtle: '0 1px 3px rgba(0, 0, 0, 0.06)',
} as const;

// ==========================================
// ANIMATION EASING (Smooth, professional)
// ==========================================

/**
 * Easing functions for premium animations
 * Inspired by Calendly's smooth transitions
 */
export const luxuryEasing = {
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)' as const,
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)' as const,
  swift: 'cubic-bezier(0.2, 0, 0, 1)' as const,
} as const;

// ==========================================
// COLOR PALETTE BY SHOP TYPE
// ==========================================

/**
 * Color palette by shop type (for niche differentiation)
 * Note: Using solid colors, not gradients
 */
export const getColorPalette = (shopType: ShopType) => {
  const palettes = {
    BARBERSHOP: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
      },
      accent: 'blue',
    },
    BEAUTY_SALON: {
      primary: {
        50: '#fdf2f8',
        100: '#fce7f3',
        200: '#fbcfe8',
        300: '#f9a8d4',
        400: '#f472b6',
        500: '#ec4899',
        600: '#db2777',
        700: '#be185d',
        800: '#9d174d',
        900: '#831843',
      },
      accent: 'pink',
    },
    HYBRID: {
      primary: {
        50: '#f5f3ff',
        100: '#ede9fe',
        200: '#ddd6fe',
        300: '#c4b5fd',
        400: '#a78bfa',
        500: '#8b5cf6',
        600: '#7c3aed',
        700: '#6d28d9',
        800: '#5b21b6',
        900: '#4c1d95',
      },
      accent: 'purple',
    },
  };

  return palettes[shopType] || palettes.HYBRID;
};

/**
 * Spacing scale (8px grid system)
 */
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
} as const;

/**
 * Typography scale
 */
export const typography = {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
  fontSize: {
    xs: ['12px', { lineHeight: '16px' }],
    sm: ['14px', { lineHeight: '20px' }],
    base: ['16px', { lineHeight: '24px' }],
    lg: ['18px', { lineHeight: '28px' }],
    xl: ['20px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
    '4xl': ['36px', { lineHeight: '40px' }],
    '5xl': ['48px', { lineHeight: '1' }],
    '6xl': ['60px', { lineHeight: '1' }],
    '7xl': ['72px', { lineHeight: '1' }],
    '8xl': ['96px', { lineHeight: '1' }],
    '9xl': ['128px', { lineHeight: '1' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
} as const;

/**
 * Border radius scale
 * STANDARDIZED TO 16px (xl) for consistency
 */
export const borderRadius = {
  none: '0',
  sm: '4px',
  DEFAULT: '16px', // Changed from 4px to 16px for premium feel
  md: '12px',
  lg: '16px', // Standard rounded card
  xl: '16px', // All rounded elements use this
  '2xl': '20px', // Extra rounded
  '3xl': '24px', // Very rounded
  full: '9999px',
} as const;

/**
 * Shadow scale
 */
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',
} as const;

/**
 * Animation durations
 */
export const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',
  200: '200ms',
  300: '300ms',
  500: '500ms',
  700: '700ms',
  1000: '1000ms',
} as const;

/**
 * Animation timing functions
 */
export const transitionTimingFunction = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
} as const;

/**
 * Z-index scale
 */
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

/**
 * Breakpoints (for reference, Tailwind handles these)
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Get CSS class name for shop type color
 */
export const getShopColorClass = (shopType: ShopType, type: 'bg' | 'text' | 'border' = 'bg') => {
  const colorMap = {
    BARBERSHOP: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600' },
    BEAUTY_SALON: { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500' },
    HYBRID: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600' },
  };

  return colorMap[shopType]?.[type] || colorMap.HYBRID[type];
};

/**
 * Get gradient class for shop type
 */
export const getShopGradient = (shopType: ShopType) => {
  const gradientMap = {
    BARBERSHOP: 'from-blue-600 to-blue-500',
    BEAUTY_SALON: 'from-pink-500 to-pink-400',
    HYBRID: 'from-purple-600 to-purple-500',
  };

  return gradientMap[shopType] || gradientMap.HYBRID;
};

/**
 * Complete design token object
 */
export const designTokens = {
  // Luxury Tech palette
  luxuryPalette,
  luxurySpacing,
  luxuryShadows,
  luxuryEasing,

  // Standard tokens
  spacing,
  typography,
  borderRadius,
  shadows,
  transitionDuration,
  transitionTimingFunction,
  zIndex,
  breakpoints,

  // Helper functions
  getColorPalette,
  getShopColorClass,
  getShopGradient,
} as const;
