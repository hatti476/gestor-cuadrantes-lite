import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] — actualizar usuario y employee
// Solo ADMIN
// Body: {
//   name?: string, email?: string, globalRole?: "ADMIN" | "TECNICO" | "VIEWER",
//   shiftPreference?: string | null, active?: boolean
// }
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Prohibido: solo ADMIN" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body requerido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Validar rol si viene
  const VALID_ROLES = ["ADMIN", "TECNICO", "VIEWER"] as const;
  type ValidRole = typeof VALID_ROLES[number];
  const globalRole = typeof b.globalRole === "string" ? b.globalRole : undefined;
  if (globalRole && !VALID_ROLES.includes(globalRole as ValidRole)) {
    return NextResponse.json({ error: "Rol inválido. Valores: ADMIN, TECNICO, VIEWER" }, { status: 400 });
  }

  // Validar email único
  if (typeof b.email === "string" && b.email.includes("@")) {
    const existing = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
    }
  }

  // Actualizar User
  const userUpdate: Record<string, unknown> = {};
  if (typeof b.email === "string" && b.email.includes("@")) {
    userUpdate.email = b.email.toLowerCase();
  }
  if (globalRole && VALID_ROLES.includes(globalRole as ValidRole)) {
    userUpdate.role = globalRole;
  }

  // Actualizar Employee (si existe)
  const empUpdate: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim().length >= 2) empUpdate.name = b.name.trim();
  if (b.shiftPreference !== undefined) empUpdate.shiftPreference = b.shiftPreference ?? null;
  if (typeof b.active === "boolean") empUpdate.active = b.active;

  // Manejar cambio de rol que afecta Employee
  const newRole = globalRole;
  const currentRole = user.role;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({ where: { id }, data: userUpdate });
    }
    if (user.employee && Object.keys(empUpdate).length > 0) {
      await tx.employee.update({ where: { id: user.employee.id }, data: empUpdate });
    }

    // Si cambia a TECNICO y no tiene Employee, crearlo
    if (newRole === "TECNICO" && currentRole !== "TECNICO" && !user.employee) {
      const maxOrder = await tx.employee.aggregate({ _max: { rotationOrder: true } });
      const nextOrder = (maxOrder._max.rotationOrder ?? 0) + 1;
      await tx.employee.create({
        data: {
          userId: id,
          name: (typeof b.name === "string" ? b.name : user.email.split("@")[0]),
          rotationOrder: nextOrder,
          shiftPreference: (typeof b.shiftPreference === "string" ? b.shiftPreference : null),
        },
      });
    }
    // Si cambia de TECNICO a ADMIN/VIEWER, eliminar Employee (opcional, mantener por historial)
    // Aquí optamos por mantener Employee pero marcar inactive si se desea
    if (currentRole === "TECNICO" && newRole && newRole !== "TECNICO" && user.employee) {
      // Desactivar employee para mantener historial
      await tx.employee.update({ where: { id: user.employee.id }, data: { active: false } });
    }
  });

  // Devolver usuario actualizado
  const updated = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      employee: {
        select: {
          id: true,
          name: true,
          rotationOrder: true,
          shiftPreference: true,
          active: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// PUT /api/admin/users/[id] — cambiar contraseña. Solo ADMIN.
// Body: { newPassword: string }
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Prohibido: solo ADMIN" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const newPassword: string = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json(
      { error: "Contraseña inválida: mínimo 8 caracteres, 1 mayúscula y 1 número" },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/[id] — eliminar usuario completamente. Solo ADMIN.
// Elimina User + Employee + ShiftAssignments en transacción.
// No permite auto-eliminación (id === session.user.id).
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Prohibido: solo ADMIN" }, { status: 403 });

  const { id } = await params;

  // Prevenir auto-eliminación
  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (user.employee) {
      // Eliminar asignaciones de turno asociadas al employee
      await tx.shiftAssignment.deleteMany({ where: { employeeId: user.employee.id } });
      // Eliminar employee
      await tx.employee.delete({ where: { id: user.employee.id } });
    }
    // Eliminar user
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}