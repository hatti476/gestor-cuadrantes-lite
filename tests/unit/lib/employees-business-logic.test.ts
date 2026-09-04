import { describe, it, expect } from "vitest";
import {
  isValidRole,
  isValidEmail,
  isValidPassword,
  validateCreateEmployee,
  validateUpdateEmployee,
  isValidShiftPreference,
  VALID_SHIFT_PREFERENCES,
} from "@/lib/employees/business-logic";

describe("isValidRole", () => {
  it("acepta los roles vigentes ADMIN, TECNICO y VIEWER", () => {
    expect(isValidRole("ADMIN")).toBe(true);
    expect(isValidRole("TECNICO")).toBe(true);
    expect(isValidRole("VIEWER")).toBe(true);
  });

  it("rechaza los roles eliminados en el Sprint 1", () => {
    expect(isValidRole("SUPER_ADMIN")).toBe(false);
    expect(isValidRole("USER")).toBe(false);
    expect(isValidRole("PROJECT_ADMIN")).toBe(false);
    expect(isValidRole("SUPER_VIEWER")).toBe(false);
    expect(isValidRole("EMPLOYEE")).toBe(false);
  });

  it("rechaza roles desconocidos", () => {
    expect(isValidRole("MANAGER")).toBe(false);
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("acepta emails válidos", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("tecnico1@cuadrantes.local")).toBe(true);
  });

  it("rechaza emails inválidos", () => {
    expect(isValidEmail("noarroba")).toBe(false);
    expect(isValidEmail("@nodomain")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("acepta contraseñas fuertes", () => {
    expect(isValidPassword("Admin1234!")).toBe(true);
    expect(isValidPassword("Tecnico1234!")).toBe(true);
  });

  it("rechaza contraseñas débiles", () => {
    expect(isValidPassword("short1A")).toBe(false);   // menos de 8
    expect(isValidPassword("sinmayuscula1!")).toBe(false);
    expect(isValidPassword("SinNumero!")).toBe(false);
  });
});

describe("validateCreateEmployee", () => {
  const valid = {
    name: "Nuevo Técnico",
    email: "nuevo@cuadrantes.local",
    password: "Segura1234!",
    role: "TECNICO",
  };

  it("valida un body correcto", () => {
    const result = validateCreateEmployee(valid);
    expect(result.valid).toBe(true);
    expect(result.data?.name).toBe("Nuevo Técnico");
  });

  it("rechaza nombre corto", () => {
    const result = validateCreateEmployee({ ...valid, name: "A" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Nombre");
  });

  it("rechaza email inválido", () => {
    const result = validateCreateEmployee({ ...valid, email: "invalido" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Email");
  });

  it("rechaza contraseña débil", () => {
    const result = validateCreateEmployee({ ...valid, password: "debil" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Contraseña");
  });

  it("rechaza rol inválido", () => {
    const result = validateCreateEmployee({ ...valid, role: "SUPERUSER" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Rol");
  });

  it("recorta espacios del nombre", () => {
    const result = validateCreateEmployee({ ...valid, name: "  Ana García  " });
    expect(result.valid).toBe(true);
    expect(result.data?.name).toBe("Ana García");
  });
});

describe("validateUpdateEmployee", () => {
  it("valida actualización solo de nombre", () => {
    const result = validateUpdateEmployee({ name: "Nuevo Nombre" });
    expect(result.valid).toBe(true);
    expect(result.data?.name).toBe("Nuevo Nombre");
  });

  it("valida actualización solo de rol", () => {
    const result = validateUpdateEmployee({ role: "ADMIN" });
    expect(result.valid).toBe(true);
    expect(result.data?.role).toBe("ADMIN");
  });

  it("rechaza body vacío", () => {
    expect(validateUpdateEmployee({}).valid).toBe(false);
    expect(validateUpdateEmployee(null).valid).toBe(false);
  });

  it("rechaza rol inválido en update", () => {
    const result = validateUpdateEmployee({ role: "UNKNOWN" });
    expect(result.valid).toBe(false);
  });
});

describe("isValidShiftPreference", () => {
  it("acepta los valores válidos: M, T, J y null", () => {
    expect(isValidShiftPreference("M")).toBe(true);
    expect(isValidShiftPreference("T")).toBe(true);
    expect(isValidShiftPreference("J")).toBe(true);
    expect(isValidShiftPreference(null)).toBe(true);
  });

  it("rechaza valores no reconocidos", () => {
    expect(isValidShiftPreference("N")).toBe(false);
    expect(isValidShiftPreference("D")).toBe(false);
    expect(isValidShiftPreference("m")).toBe(false);  // minúscula
    expect(isValidShiftPreference("")).toBe(false);
    expect(isValidShiftPreference(undefined)).toBe(false);
    expect(isValidShiftPreference(0)).toBe(false);
  });

  it("VALID_SHIFT_PREFERENCES contiene exactamente M, T, J y null", () => {
    expect(VALID_SHIFT_PREFERENCES).toContain("M");
    expect(VALID_SHIFT_PREFERENCES).toContain("T");
    expect(VALID_SHIFT_PREFERENCES).toContain("J");
    expect(VALID_SHIFT_PREFERENCES).toContain(null);
    expect(VALID_SHIFT_PREFERENCES).toHaveLength(4);
  });
});
