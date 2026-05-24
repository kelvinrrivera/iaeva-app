/**
 * Dynamic Terminology System for Hair Services
 *
 * This module provides terminology that adapts based on the shop type (barbershop,
 * beauty salon, or hybrid). It handles gender agreement in Spanish
 * and provides contextual vocabulary for each business type.
 */

import type { ShopType } from '@prisma/client';

/**
 * Professional terminology by shop type
 */
export interface ProfessionalTerminology {
  // How to refer to a staff member (singular)
  professional: string;
  // How to refer to staff members (plural)
  professionals: string;
  // How to refer to a staff member with article (el/la)
  professionalWithArticle: string;
  // How to refer to staff members with article (los/las)
  professionalsWithArticle: string;
  // Male form of professional
  professionalMale: string;
  // Female form of professional
  professionalFemale: string;
}

/**
 * Client terminology by shop type
 */
export interface ClientTerminology {
  // How to refer to a customer (singular)
  client: string;
  // How to refer to customers (plural)
  clients: string;
  // How to refer to a customer with article (el/la)
  clientWithArticle: string;
  // How to refer to customers with article (los/las)
  clientsWithArticle: string;
  // Male form of client
  clientMale: string;
  // Female form of client
  clientFemale: string;
}

/**
 * Action terminology by shop type
 */
export interface ActionTerminology {
  // Main action verb (cortar/estilizar/realizar)
  mainAction: string;
  // Infinitive form
  infinitive: string;
  // Gerund form (-ando/-iendo)
  gerund: string;
  // Past participle
  pastParticiple: string;
}

/**
 * UI labels by shop type
 */
export interface UITerminology {
  // Labels for common actions
  bookAppointment: string;
  viewServices: string;
  viewStaff: string;
  viewCalendar: string;
  manageShop: string;
}

/**
 * Complete terminology set for a shop type
 */
export interface ShopTerminology {
  shopType: ShopType;
  // Professional terminology
  professional: ProfessionalTerminology;
  // Client terminology
  client: ClientTerminology;
  // Action terminology
  action: ActionTerminology;
  // UI terminology
  ui: UITerminology;
}

/**
 * Terminology for BARBERSHOP
 */
const BARBERSHOP_TERMINOLOGY: ShopTerminology = {
  shopType: 'BARBERSHOP',

  professional: {
    professional: 'Barbero',
    professionals: 'Barberos',
    professionalWithArticle: 'el barbero',
    professionalsWithArticle: 'los barberos',
    professionalMale: 'barbero',
    professionalFemale: 'barbera', // Some shops use "barbera" for women
  },

  client: {
    client: 'Cliente',
    clients: 'Clientes',
    clientWithArticle: 'el cliente',
    clientsWithArticle: 'los clientes',
    clientMale: 'cliente',
    clientFemale: 'clienta', // Most clients are men but some women
  },

  action: {
    mainAction: 'Cortar',
    infinitive: 'cortar',
    gerund: 'cortando',
    pastParticiple: 'cortado',
  },

  ui: {
    bookAppointment: 'Agendar Corte',
    viewServices: 'Ver Servicios',
    viewStaff: 'Ver Barberos',
    viewCalendar: 'Ver Calendario',
    manageShop: 'Gestionar Barbería',
  },
};

/**
 * Terminology for BEAUTY_SALON
 */
const BEAUTY_SALON_TERMINOLOGY: ShopTerminology = {
  shopType: 'BEAUTY_SALON',

  professional: {
    professional: 'Estilista',
    professionals: 'Estilistas',
    professionalWithArticle: 'el estilista',
    professionalsWithArticle: 'los estilistas',
    professionalMale: 'estilista',
    professionalFemale: 'estilista',
  },

  client: {
    client: 'Clienta',
    clients: 'Clientas',
    clientWithArticle: 'la clienta',
    clientsWithArticle: 'las clientas',
    clientMale: 'cliente',
    clientFemale: 'clienta',
  },

  action: {
    mainAction: 'Estilizar',
    infinitive: 'estilizar',
    gerund: 'estilizando',
    pastParticiple: 'estilizado',
  },

  ui: {
    bookAppointment: 'Agendar Cita',
    viewServices: 'Ver Servicios',
    viewStaff: 'Ver Estilistas',
    viewCalendar: 'Ver Calendario',
    manageShop: 'Gestionar Salón',
  },
};

/**
 * Terminology for HYBRID (salón unisex - barbería y belleza, gender-neutral)
 */
const HYBRID_TERMINOLOGY: ShopTerminology = {
  shopType: 'HYBRID',

  professional: {
    professional: 'Profesional',
    professionals: 'Profesionales',
    professionalWithArticle: 'el profesional',
    professionalsWithArticle: 'los profesionales',
    professionalMale: 'barbero/estilista',
    professionalFemale: 'barbera/estilista',
  },

  client: {
    client: 'Cliente',
    clients: 'Clientes',
    clientWithArticle: 'el cliente',
    clientsWithArticle: 'los clientes',
    clientMale: 'cliente',
    clientFemale: 'clienta',
  },

  action: {
    mainAction: 'Atender',
    infinitive: 'atender',
    gerund: 'atendiendo',
    pastParticiple: 'atendido',
  },

  ui: {
    bookAppointment: 'Agendar Cita',
    viewServices: 'Ver Servicios',
    viewStaff: 'Ver Profesionales',
    viewCalendar: 'Ver Calendario',
    manageShop: 'Gestionar Negocio',
  },
};

/**
 * Get terminology for a specific shop type
 *
 * @param shopType - The type of shop
 * @returns Complete terminology set for the shop type
 */
export function getTerminology(shopType: ShopType): ShopTerminology {
  switch (shopType) {
    case 'BARBERSHOP':
      return BARBERSHOP_TERMINOLOGY;
    case 'BEAUTY_SALON':
      return BEAUTY_SALON_TERMINOLOGY;
    case 'HYBRID':
      return HYBRID_TERMINOLOGY;
    default:
      return BARBERSHOP_TERMINOLOGY;
  }
}

/**
 * Get professional label with proper gender agreement
 *
 * @param shopType - The type of shop
 * @param gender - 'male' | 'female' | 'neutral'
 * @returns The appropriate professional label
 */
export function getProfessionalLabel(
  shopType: ShopType,
  gender: 'male' | 'female' | 'neutral' = 'neutral'
): string {
  const terminology = getTerminology(shopType);

  switch (gender) {
    case 'male':
      return terminology.professional.professionalMale;
    case 'female':
      return terminology.professional.professionalFemale;
    default:
      return terminology.professional.professional;
  }
}

/**
 * Get client label with proper gender agreement
 *
 * @param shopType - The type of shop
 * @param gender - 'male' | 'female' | 'neutral'
 * @returns The appropriate client label
 */
export function getClientLabel(
  shopType: ShopType,
  gender: 'male' | 'female' | 'neutral' = 'neutral'
): string {
  const terminology = getTerminology(shopType);

  switch (gender) {
    case 'male':
      return terminology.client.clientMale;
    case 'female':
      return terminology.client.clientFemale;
    default:
      return terminology.client.client;
  }
}

/**
 * Format a sentence with proper terminology
 *
 * @param template - Template string with placeholders
 * @param shopType - The type of shop
 * @param replacements - Additional replacements
 * @returns Formatted sentence
 *
 * @example
 * formatTemplate(
 *   "{professionalWithArticle} {mainAction} el cabello de {clientWithArticle}",
 *   "BARBERSHOP",
 *   { clientWithArticle: "la clienta" }
 * )
 * // Returns: "el barbero corta el cabello de la clienta"
 */
export function formatTemplate(
  template: string,
  shopType: ShopType,
  replacements: Record<string, string> = {}
): string {
  const terminology = getTerminology(shopType);

  let result = template;

  // Replace professional placeholders
  result = result.replace(/\{professional\}/g, terminology.professional.professional);
  result = result.replace(/\{professionals\}/g, terminology.professional.professionals);
  result = result.replace(/\{professionalWithArticle\}/g, terminology.professional.professionalWithArticle);
  result = result.replace(/\{professionalsWithArticle\}/g, terminology.professional.professionalsWithArticle);

  // Replace client placeholders
  result = result.replace(/\{client\}/g, terminology.client.client);
  result = result.replace(/\{clients\}/g, terminology.client.clients);
  result = result.replace(/\{clientWithArticle\}/g, terminology.client.clientWithArticle);
  result = result.replace(/\{clientsWithArticle\}/g, terminology.client.clientsWithArticle);

  // Replace action placeholders
  result = result.replace(/\{mainAction\}/g, terminology.action.mainAction);
  result = result.replace(/\{infinitive\}/g, terminology.action.infinitive);
  result = result.replace(/\{gerund\}/g, terminology.action.gerund);

  // Replace UI placeholders
  result = result.replace(/\{bookAppointment\}/g, terminology.ui.bookAppointment);
  result = result.replace(/\{viewServices\}/g, terminology.ui.viewServices);
  result = result.replace(/\{viewStaff\}/g, terminology.ui.viewStaff);
  result = result.replace(/\{viewCalendar\}/g, terminology.ui.viewCalendar);
  result = result.replace(/\{manageShop\}/g, terminology.ui.manageShop);

  // Replace custom placeholders
  Object.entries(replacements).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });

  return result;
}

/**
 * Get plural form with proper gender agreement
 *
 * @param word - Singular word
 * @param shopType - The type of shop
 * @returns Plural form
 */
export function pluralize(word: string, shopType: ShopType): string {
  const terminology = getTerminology(shopType);

  // Check if it's a professional or client word
  if (word.toLowerCase() === terminology.professional.professional.toLowerCase()) {
    return terminology.professional.professionals;
  }

  if (word.toLowerCase() === terminology.client.client.toLowerCase()) {
    return terminology.client.clients;
  }

  // Default Spanish pluralization
  if (word.endsWith('á') || word.endsWith('é') || word.endsWith('í') ||
      word.endsWith('ó') || word.endsWith('ú')) {
    return word.slice(0, -1) + word.slice(-1).replace('á', 'as').replace('é', 'es')
      .replace('í', 'is').replace('ó', 'os').replace('ú', 'us');
  }

  if (word.endsWith('z')) {
    return word.slice(0, -1) + 'ces';
  }

  return word + 's';
}

/**
 * Get gender-appropriate article
 *
 * @param shopType - The type of shop
 * @param gender - 'male' | 'female' | 'neutral'
 * @returns Appropriate article (el/la)
 */
export function getArticle(
  shopType: ShopType,
  gender: 'male' | 'female' | 'neutral' = 'neutral'
): string {
  const terminology = getTerminology(shopType);

  // For beauty salons, default to feminine
  if (shopType === 'BEAUTY_SALON' && gender === 'neutral') {
    return 'la';
  }

  return gender === 'female' ? 'la' : 'el';
}

/**
 * Common phrases by shop type
 */
export const getPhrases = (shopType: ShopType) => {
  const terminology = getTerminology(shopType);

  return {
    welcome: `Bienvenido a tu plataforma de gestión`,
    newAppointment: `Nueva Cita`,
    viewAllAppointments: `Ver Todas las Citas`,
    addNew: `Añadir Nuevo`,
    edit: `Editar`,
    delete: `Eliminar`,
    save: `Guardar`,
    cancel: `Cancelar`,
    confirm: `Confirmar`,
    back: `Volver`,
    next: 'Siguiente',
    previous: 'Anterior',
    done: 'Hecho',

    // Dynamic phrases
    professionalList: `Ver ${terminology.professional.professionals}`,
    addProfessional: `Añadir ${terminology.professional.professional}`,
    clientList: `Ver ${terminology.client.clients}`,
    addClient: `Añadir ${terminology.client.client}`,
    bookForClient: `Agendar para ${terminology.client.clientWithArticle}`,
  };
};

/**
 * Service type labels in Spanish (Hair Services Only)
 */
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  HAIRCUT: 'Corte',
  BEARD: 'Barba',
  COLOR: 'Tinte',
  STYLING: 'Peinado',
  FACIAL: 'Facial',
  TREATMENT: 'Tratamiento Capilar',
};

/**
 * Get service types available for a shop type
 */
export function getAvailableServiceTypes(shopType: ShopType): string[] {
  switch (shopType) {
    case 'BARBERSHOP':
      return ['HAIRCUT', 'BEARD'];
    case 'BEAUTY_SALON':
      return ['COLOR', 'STYLING', 'FACIAL', 'TREATMENT'];
    case 'HYBRID':
      return ['HAIRCUT', 'BEARD', 'COLOR', 'STYLING', 'FACIAL', 'TREATMENT'];
    default:
      return [];
  }
}
