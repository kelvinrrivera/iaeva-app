/**
 * Service Catalog for Dominican Republic barbershops & salons
 *
 * Client-safe file — no server imports.
 * Used in onboarding and anywhere service presets are needed.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface CatalogService {
  name: string;
  category: string;      // UI grouping: "Cortes", "Barba", "Combos", etc.
  serviceType: string;   // Prisma ServiceType: HAIRCUT, BEARD, COLOR, STYLING, FACIAL, TREATMENT
  price: number;         // RD$ default
  duration: number;      // minutes
}

export interface RoleOption {
  value: string;
  label: string;
}

// ─── Duration Options ───────────────────────────────────────────────

export const DURATION_OPTIONS = [10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180];

// ─── Barbershop Catalog ─────────────────────────────────────────────

export const BARBERSHOP_CATALOG: CatalogService[] = [
  // Cortes
  { name: 'Corte Clasico',         category: 'Cortes',       serviceType: 'HAIRCUT',   price: 300,  duration: 30 },
  { name: 'Corte Moderno',         category: 'Cortes',       serviceType: 'HAIRCUT',   price: 400,  duration: 45 },
  { name: 'Corte Fade/Degradado',  category: 'Cortes',       serviceType: 'HAIRCUT',   price: 350,  duration: 40 },
  { name: 'Corte Nino',            category: 'Cortes',       serviceType: 'HAIRCUT',   price: 200,  duration: 20 },
  { name: 'Corte + Diseno',        category: 'Cortes',       serviceType: 'HAIRCUT',   price: 500,  duration: 50 },
  // Barba
  { name: 'Perfilado de Barba',    category: 'Barba',        serviceType: 'BEARD',     price: 250,  duration: 20 },
  { name: 'Afeitado Completo',     category: 'Barba',        serviceType: 'BEARD',     price: 300,  duration: 30 },
  { name: 'Barba + Cejas',         category: 'Barba',        serviceType: 'BEARD',     price: 350,  duration: 25 },
  // Combos
  { name: 'Corte + Barba',         category: 'Combos',       serviceType: 'HAIRCUT',   price: 600,  duration: 60 },
  { name: 'Corte + Barba + Cejas', category: 'Combos',       serviceType: 'HAIRCUT',   price: 700,  duration: 70 },
  { name: 'VIP Completo',          category: 'Combos',       serviceType: 'HAIRCUT',   price: 1000, duration: 90 },
  // Tratamientos
  { name: 'Tratamiento Capilar',   category: 'Tratamientos', serviceType: 'TREATMENT', price: 600,  duration: 45 },
  { name: 'Keratina',              category: 'Tratamientos', serviceType: 'TREATMENT', price: 2000, duration: 120 },
  // Otros
  { name: 'Cejas',                 category: 'Otros',        serviceType: 'FACIAL',    price: 100,  duration: 10 },
  { name: 'Black Mask',            category: 'Otros',        serviceType: 'FACIAL',    price: 200,  duration: 15 },
  { name: 'Lavado',                category: 'Otros',        serviceType: 'TREATMENT', price: 150,  duration: 15 },
];

// ─── Beauty Salon Catalog ───────────────────────────────────────────

export const BEAUTY_SALON_CATALOG: CatalogService[] = [
  // Cortes
  { name: 'Corte Dama',            category: 'Cortes',       serviceType: 'HAIRCUT',   price: 500,  duration: 60 },
  { name: 'Corte Nina',            category: 'Cortes',       serviceType: 'HAIRCUT',   price: 300,  duration: 30 },
  { name: 'Recorte de Puntas',     category: 'Cortes',       serviceType: 'HAIRCUT',   price: 300,  duration: 30 },
  // Color
  { name: 'Tinte',                 category: 'Color',        serviceType: 'COLOR',     price: 1500, duration: 120 },
  { name: 'Mechas/Highlights',     category: 'Color',        serviceType: 'COLOR',     price: 2000, duration: 150 },
  { name: 'Balayage',              category: 'Color',        serviceType: 'COLOR',     price: 2500, duration: 180 },
  { name: 'Retoque de Raiz',       category: 'Color',        serviceType: 'COLOR',     price: 800,  duration: 60 },
  // Styling
  { name: 'Brushing/Blowout',      category: 'Styling',      serviceType: 'STYLING',   price: 400,  duration: 45 },
  { name: 'Alisado',               category: 'Styling',      serviceType: 'STYLING',   price: 1500, duration: 120 },
  { name: 'Ondas/Rizos',           category: 'Styling',      serviceType: 'STYLING',   price: 500,  duration: 45 },
  { name: 'Peinado Especial',      category: 'Styling',      serviceType: 'STYLING',   price: 1000, duration: 60 },
  // Tratamientos
  { name: 'Tratamiento Profundo',  category: 'Tratamientos', serviceType: 'TREATMENT', price: 800,  duration: 60 },
  { name: 'Keratina',              category: 'Tratamientos', serviceType: 'TREATMENT', price: 2500, duration: 150 },
  { name: 'Botox Capilar',         category: 'Tratamientos', serviceType: 'TREATMENT', price: 2000, duration: 120 },
  // Otros
  { name: 'Cejas',                 category: 'Otros',        serviceType: 'FACIAL',    price: 150,  duration: 15 },
  { name: 'Maquillaje',            category: 'Otros',        serviceType: 'FACIAL',    price: 1000, duration: 45 },
];

// ─── Helpers ────────────────────────────────────────────────────────

export function getCatalogForShopType(shopType: string): CatalogService[] {
  switch (shopType) {
    case 'BARBERSHOP':   return BARBERSHOP_CATALOG;
    case 'BEAUTY_SALON': return BEAUTY_SALON_CATALOG;
    case 'HYBRID':       return [...BARBERSHOP_CATALOG, ...BEAUTY_SALON_CATALOG];
    default:             return BARBERSHOP_CATALOG;
  }
}

export function getCategoriesForShopType(shopType: string): string[] {
  const catalog = getCatalogForShopType(shopType);
  return [...new Set(catalog.map(s => s.category))];
}

/** Default services to pre-select (first 4 of the catalog) */
export function getDefaultServices(shopType: string): CatalogService[] {
  return getCatalogForShopType(shopType).slice(0, 4);
}

// ─── Role Options ───────────────────────────────────────────────────

const ALL_ROLES: Array<RoleOption & { shopTypes: string[] }> = [
  { value: 'Barbero',       label: 'Barbero',       shopTypes: ['BARBERSHOP', 'HYBRID'] },
  { value: 'Barbera',       label: 'Barbera',       shopTypes: ['BARBERSHOP', 'HYBRID'] },
  { value: 'Estilista',     label: 'Estilista',     shopTypes: ['BEAUTY_SALON', 'HYBRID'] },
  { value: 'Recepcionista', label: 'Recepcionista', shopTypes: ['BARBERSHOP', 'BEAUTY_SALON', 'HYBRID'] },
  { value: 'Manager',       label: 'Manager',       shopTypes: ['BARBERSHOP', 'BEAUTY_SALON', 'HYBRID'] },
  { value: 'Otro',          label: 'Otro',          shopTypes: ['BARBERSHOP', 'BEAUTY_SALON', 'HYBRID'] },
];

export function getRolesForShopType(shopType: string): RoleOption[] {
  return ALL_ROLES
    .filter(r => r.shopTypes.includes(shopType))
    .map(({ value, label }) => ({ value, label }));
}

// ─── Phone Formatting ───────────────────────────────────────────────

/** Auto-format Dominican phone number as user types: (809) 123-4567 */
export function formatPhoneAsYouType(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Strip leading country code '1' if present
  const local = digits.startsWith('1') && digits.length > 10
    ? digits.substring(1)
    : digits;

  if (local.length <= 3) return local;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

/** Clean formatted phone to E.164 for API calls: +18091234567 */
export function phoneToE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/** Validate Dominican phone: 10 digits starting with 809/829/849 */
export function isDRPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('1') && digits.length === 11
    ? digits.substring(1)
    : digits;
  return local.length === 10 && ['809', '829', '849'].includes(local.substring(0, 3));
}
