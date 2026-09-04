/**
 * Lógica de negocio para empleados — funciones puras y testeables.
 */

import { ROLES, type Role } from "@/lib/auth/permissions";

// Fuente de verdad única: los roles viven en lib/auth/permissions.ts.
// Antes esto declaraba ["SUPER_ADMIN", "USER"] (roles eliminados en el Sprint 1),
// lo que hacia inalcanzable POST /api/employees: esta validacion exigia los roles
// viejos y la del endpoint exigia TECNICO, condiciones mutuamente excluyentes.
export const VALID_ROLES = ROLES;
export type ValidRole = Role;

export const VALID_SHIFT_PREFERENCES = ["M", "T", "J", null] as const;
export type ValidShiftPreference = (typeof VALID_SHIFT_PREFERENCES)[number];

/** Valida que el valor sea una preferencia de turno válida: "M", "T", "J" o null */
export function isValidShiftPreference(value: unknown): value is ValidShiftPreference {
  return (VALID_SHIFT_PREFERENCES as readonly unknown[]).includes(value);
}

export function isValidRole(value: string): value is ValidRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

/** Valida email con regex básica — sin dependencias externas */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Valida que la contraseña tenga mínimo 8 caracteres, 1 mayúscula, 1 número */
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function validateCreateEmployee(body: unknown): {
  valid: boolean;
  error?: string;
  data?: CreateEmployeeInput;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Body requerido" };
  }

  const { name, email, password, role } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 2) {
    return { valid: false, error: "Nombre debe tener al menos 2 caracteres" };
  }
  if (typeof email !== "string" || !isValidEmail(email)) {
    return { valid: false, error: "Email inválido" };
  }
  if (typeof password !== "string" || !isValidPassword(password)) {
    return {
      valid: false,
      error: "Contraseña debe tener mínimo 8 caracteres, 1 mayúscula y 1 número",
    };
  }
  if (typeof role !== "string" || !isValidRole(role)) {
    return { valid: false, error: `Rol inválido. Valores válidos: ${VALID_ROLES.join(", ")}` };
  }

  return { valid: true, data: { name: name.trim(), email: email.trim(), password, role } };
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: string;
}

export function validateUpdateEmployee(body: unknown): {
  valid: boolean;
  error?: string;
  data?: UpdateEmployeeInput;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Body requerido" };
  }

  const { name, role } = body as Record<string, unknown>;
  const data: UpdateEmployeeInput = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      return { valid: false, error: "Nombre debe tener al menos 2 caracteres" };
    }
    data.name = name.trim();
  }

  if (role !== undefined) {
    if (typeof role !== "string" || !isValidRole(role)) {
      return { valid: false, error: `Rol inválido. Valores válidos: ${VALID_ROLES.join(", ")}` };
    }
    data.role = role;
  }

  if (!data.name && !data.role) {
    return { valid: false, error: "Se requiere al menos un campo: name o role" };
  }

  return { valid: true, data };
}
