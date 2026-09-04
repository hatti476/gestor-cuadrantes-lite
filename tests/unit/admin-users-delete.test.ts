import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userDelete = vi.fn();
  const userUpdate = vi.fn();
  const employeeFindUnique = vi.fn();
  const employeeDelete = vi.fn();
  const employeeUpdate = vi.fn();
  const shiftAssignmentDeleteMany = vi.fn();
  const transaction = vi.fn((callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
    shiftAssignment: { deleteMany: vi.fn() },
    employee: { delete: vi.fn() },
    user: { delete: vi.fn() },
  }));

  return {
    mockPrisma: {
      user: { findUnique: userFindUnique, delete: userDelete, update: userUpdate },
      employee: { findUnique: employeeFindUnique, delete: employeeDelete, update: employeeUpdate },
      shiftAssignment: { deleteMany: shiftAssignmentDeleteMany },
      $transaction: transaction,
    },
  };
});

// Mock next-auth before importing the route
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  NextAuth: vi.fn((options: Record<string, unknown>) => options),
  __esModule: true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth/permissions", () => ({
  isAdmin: vi.fn(),
}));

// Mock authOptions to avoid NextAuth initialization
vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [],
    callbacks: {},
  },
}));

import { getServerSession } from "next-auth";
import { isAdmin } from "@/lib/auth/permissions";
import { DELETE } from "@/app/api/admin/users/[id]/route";

describe("DELETE /api/admin/users/[id] (Bug 3: Admin delete user)", () => {
  const mockSession = {
    user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
    expires: "2099-12-31",
  };

  const mockUserWithEmployee = {
    id: "user-2",
    email: "user@test.com",
    role: "TECNICO",
    password: "hashed",
    employee: { id: "emp-2", userId: "user-2", name: "Test User", rotationOrder: 1 },
  };

  const mockUserWithoutEmployee = {
    id: "user-3",
    email: "viewer@test.com",
    role: "VIEWER",
    password: "hashed",
    employee: null,
  };

  const createMockRequest = (url: string = "http://localhost/api/admin/users/user-2") => {
    return new NextRequest(url, { method: "DELETE" });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AC-16: DELETE elimina User + Employee + ShiftAssignments en transacción", () => {
    it("elimina usuario con employee y sus asignaciones en transacción", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithEmployee);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          shiftAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
          employee: { delete: vi.fn().mockResolvedValue({}) },
          user: { delete: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createMockRequest();
      const response = await DELETE(req, { params: Promise.resolve({ id: "user-2" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("elimina usuario sin employee (solo User)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithoutEmployee);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          shiftAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          employee: { delete: vi.fn() },
          user: { delete: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createMockRequest("http://localhost/api/admin/users/user-3");
      const response = await DELETE(req, { params: Promise.resolve({ id: "user-3" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  describe("AC-17: DELETE retorna 403 para TECNICO/VIEWER", () => {
    it("retorna 403 si sesión es TECNICO", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "tech-1", email: "tech@test.com", role: "TECNICO" },
        expires: "2099-12-31",
      });
      vi.mocked(isAdmin).mockReturnValue(false);

      const req = createMockRequest();
      const response = await DELETE(req, { params: Promise.resolve({ id: "user-2" }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Prohibido: solo ADMIN");
    });

    it("retorna 403 si sesión es VIEWER", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "viewer-1", email: "viewer@test.com", role: "VIEWER" },
        expires: "2099-12-31",
      });
      vi.mocked(isAdmin).mockReturnValue(false);

      const req = createMockRequest();
      const response = await DELETE(req, { params: Promise.resolve({ id: "user-2" }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Prohibido: solo ADMIN");
    });

    it("retorna 403 si no hay sesión", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = createMockRequest();
      const response = await DELETE(req, { params: Promise.resolve({ id: "user-2" }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("No autorizado");
    });
  });

  describe("AC-18: DELETE retorna 400 si intenta borrarse a sí mismo", () => {
    it("retorna 400 cuando id === session.user.id", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithEmployee);

      const req = createMockRequest("http://localhost/api/admin/users/admin-1");
      const response = await DELETE(req, { params: Promise.resolve({ id: "admin-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No puedes eliminarte a ti mismo");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("AC-21: DELETE retorna 404 si usuario no existe", () => {
    it("retorna 404 si usuario no encontrado", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/admin/users/nonexistent");
      const response = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Usuario no encontrado");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});