'use client';

/**
 * Terminology Context Provider
 *
 * This context provides dynamic terminology based on the shop type.
 * Components can consume this context to display appropriate terminology
 * for barbershops, beauty salons, or nail salons.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { ShopType } from '@prisma/client';
import { getTerminology, formatTemplate, getProfessionalLabel, getClientLabel } from '@/lib/terminology';

interface TerminologyContextValue {
  shopType: ShopType;
  terminology: ReturnType<typeof getTerminology>;
  formatTemplate: (template: string, replacements?: Record<string, string>) => string;
  getProfessional: (gender?: 'male' | 'female' | 'neutral') => string;
  getClient: (gender?: 'male' | 'female' | 'neutral') => string;
}

const TerminologyContext = createContext<TerminologyContextValue | undefined>(undefined);

interface TerminologyProviderProps {
  children: ReactNode;
  shopType: ShopType;
}

export function TerminologyProvider({ children, shopType }: TerminologyProviderProps) {
  const terminology = getTerminology(shopType);

  const formatTemplateWrapper = (
    template: string,
    replacements: Record<string, string> = {}
  ) => {
    return formatTemplate(template, shopType, replacements);
  };

  const getProfessionalWrapper = (gender?: 'male' | 'female' | 'neutral') => {
    return getProfessionalLabel(shopType, gender);
  };

  const getClientWrapper = (gender?: 'male' | 'female' | 'neutral') => {
    return getClientLabel(shopType, gender);
  };

  const value: TerminologyContextValue = {
    shopType,
    terminology,
    formatTemplate: formatTemplateWrapper,
    getProfessional: getProfessionalWrapper,
    getClient: getClientWrapper,
  };

  return (
    <TerminologyContext.Provider value={value}>
      {children}
    </TerminologyContext.Provider>
  );
}

/**
 * Hook to use the terminology context
 *
 * @example
 * const { terminology, getProfessional } = useTerminology();
 * console.log(terminology.professional.professional); // "Barbero" | "Estilista" | "Manicurista"
 * console.log(getProfessional('female')); // "Barbera" | "Estilista" | "Manicurista"
 */
export function useTerminology() {
  const context = useContext(TerminologyContext);

  if (context === undefined) {
    throw new Error('useTerminology must be used within a TerminologyProvider');
  }

  return context;
}

/**
 * Hook to get a specific terminology label
 *
 * @example
 * const professionalLabel = useTerminologyLabel('professional');
 * console.log(professionalLabel); // "Barbero" | "Estilista" | "Manicurista"
 */
export function useTerminologyLabel(label: keyof ReturnType<typeof getTerminology>) {
  const { terminology } = useTerminology();
  return terminology[label];
}

/**
 * Component to display professional label with proper gender
 *
 * @example
 * <ProfessionalLabel gender="female" />
 * // Renders: "Barbera" | "Estilista" | "Manicurista"
 */
export function ProfessionalLabel({
  gender = 'neutral',
  className = '',
}: {
  gender?: 'male' | 'female' | 'neutral';
  className?: string;
}) {
  const { getProfessional } = useTerminology();

  return (
    <span className={className}>
      {getProfessional(gender)}
    </span>
  );
}

/**
 * Component to display client label with proper gender
 *
 * @example
 * <ClientLabel gender="female" />
 * // Renders: "Clienta"
 */
export function ClientLabel({
  gender = 'neutral',
  className = '',
}: {
  gender?: 'male' | 'female' | 'neutral';
  className?: string;
}) {
  const { getClient } = useTerminology();

  return (
    <span className={className}>
      {getClient(gender)}
    </span>
  );
}

/**
 * Component to format a template string with terminology
 *
 * @example
 * <Template template="{professionalWithArticle} {mainAction} el cabello" />
 * // Renders: "el barbero corta el cabello" | "la estilista estiliza el cabello"
 */
export function Template({
  template,
  replacements = {},
  className = '',
}: {
  template: string;
  replacements?: Record<string, string>;
  className?: string;
}) {
  const { formatTemplate } = useTerminology();

  return (
    <span className={className}>
      {formatTemplate(template, replacements)}
    </span>
  );
}
