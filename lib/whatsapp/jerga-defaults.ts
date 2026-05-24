/**
 * Barbershop slang dictionaries by country (ISO 3166-1 alpha-2).
 * Pre-loaded for new shops so the chatbot understands local vocabulary.
 * Each shop can customize their own dictionary from Settings.
 */

const JERGA_DO = `- "El final" = Algo excelente, un corte perfecto
- "Cerquillo" = Definición de bordes (frente y sienes)
- "La grasa" = Estilo, brillo, que el corte quedó impecable
- "Pasar la uno / la cero" = Niveles de máquina cortapelo
- "Luz / clarito" = Error en el degradado (hueco o trasquilón)
- "Bajar los vidrios" = Cortar volumen de la parte de arriba
- "Con to' los poderes" = Servicio completo (corte + barba + cejas + lavado)
- "Limpio / nítido / nítidito" = Corte bien ejecutado, sin manchas
- "Habilitar / habilitame" = Reservar un turno
- "El flow / el swag" = El estilo general después del corte
- "Retoque" = Servicio rápido solo de cerquillo o barba
- "Montame en la lista" = Ponme en cola / agéndame
- "Guárdame el puesto" = Reserva mi turno
- "Que corte" = Que se vea la piel (high fade muy marcado)
- "Déjamela bajita" (barba) = Barba corta con línea definida
- "Aótame" = Hazme / Ponme (ej: "aótame un corte")
- "Darse un retoque" = Servicio rápido antes de un evento`;

const JERGA_CO = `- "Motilado" = Corte de pelo
- "Peluqueada" = Sesión de corte
- "A ras / al rape" = Muy corto, casi a la piel
- "Degradado" = Fade (corte gradual)
- "Tupé" = Volumen arriba, copete
- "Hágame la barba" = Servicio de barba
- "¿Hay turno?" = ¿Puedo agendar?
- "Perfilado" = Definición de bordes y líneas
- "Parcero / parce" = Hermano, amigo (trato informal)
- "¿A cómo está el corte?" = ¿Cuánto cuesta?
- "Bacano" = Excelente, genial
- "Nítido" = Limpio, bien hecho
- "Retoque" = Servicio rápido de mantenimiento`;

const JERGA_PR = `- "Recorte" = Corte de pelo
- "Bajame los lados" = Fade en los laterales
- "Blending" = Degradado suave y uniforme
- "Shape up / lainap" = Definición de líneas (frente y sienes)
- "Taper" = Degradado sutil
- "Con to'" = Servicio completo
- "¿Pa cuándo tienen?" = ¿Cuándo hay disponibilidad?
- "Chavos" = Dinero (ej: "¿cuántos chavos es?")
- "Brutal" = Excelente, quedó muy bien
- "Papi" = Trato informal (como "bro")
- "Afeitá" = Afeitada de barba
- "Retoque" = Mantenimiento rápido
- "Máquina cero / uno" = Niveles de cortapelo`;

const JERGA_DEFAULT = `- "Fade / degradado" = Corte gradual de abajo hacia arriba
- "Retoque" = Servicio rápido de mantenimiento
- "Barba" = Servicio de arreglo de barba
- "¿Hay turno?" = ¿Puedo agendar una cita?
- "¿A cuánto está el corte?" = Precio del servicio
- "Servicio completo" = Corte + barba + cejas + lavado`;

/** Map of country code → default jerga */
const JERGA_BY_COUNTRY: Record<string, string> = {
  DO: JERGA_DO,
  CO: JERGA_CO,
  PR: JERGA_PR,
};

/**
 * Get the default jerga for a given country code.
 * Falls back to a generic Spanish barbershop dictionary.
 */
export function getDefaultJerga(countryCode?: string | null): string {
  if (countryCode && JERGA_BY_COUNTRY[countryCode.toUpperCase()]) {
    return JERGA_BY_COUNTRY[countryCode.toUpperCase()];
  }
  return JERGA_DEFAULT;
}

/** Backwards-compatible export — defaults to Dominican Republic */
export const DEFAULT_JERGA = JERGA_DO;
