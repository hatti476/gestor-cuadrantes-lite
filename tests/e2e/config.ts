/**
 * Configuración centralizada para los tests E2E.
 * Todos los valores se leen de variables de entorno (.env.test).
 * Nunca hay credenciales ni URLs hardcodeadas en los specs.
 */

/** Credenciales y datos de los usuarios de prueba */
export const USERS = {
  admin: {
    email: process.env.ADMIN_EMAIL ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
  },
  tech: {
    email: process.env.TECH_EMAIL ?? "",
    password: process.env.TECH_PASSWORD ?? "",
  },
  viewer: {
    email: process.env.VIEWER_EMAIL ?? "",
    password: process.env.VIEWER_PASSWORD ?? "",
  },
} as const;

/**
 * Colores CSS de cada tipo de turno (rgb).
 * Fuente de verdad: lib/constants/shift-colors.ts
 */
export const SHIFT_COLORS = {
  M: "rgb(249, 115, 22)",   // #F97316 — Mañana
  T: "rgb(59, 130, 246)",   // #3B82F6 — Tarde
  N: "rgb(22, 163, 74)",    // #16A34A — Noche
  J: "rgb(234, 179, 8)",    // #EAB308 — Jornada normal
  D: "rgb(156, 163, 175)",  // #9CA3AF — Descanso
  V: "rgb(17, 24, 39)",     // #111827 — Vacaciones
  B: "rgb(17, 24, 39)",     // #111827 — Baja
} as const;

/** Rutas de la aplicación */
export const ROUTES = {
  home: "/",
  login: "/login",
  employees: "/employees",
  info: "/info",
  holidays: "/holidays",
} as const;
