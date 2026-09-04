# SPEC-006 — Fixes Post-Refactor: Modo Preparación Toggle + Multi-Month View

## Metadatos

| Campo | Valor |
|-------|-------|
| ID | SPEC-006 |
| Tipo | fix |
| Estado | proposed |
| Prioridad | alta |
| Agentes asignados | @orchestrator, @qa, @backend, @frontend |
| Fecha de creación | 2026-09-04 |
| Sprint | Sprint-02 (post-refactor cleanup) |

---

## Descripción

Dos issues detectados tras el refactor de permisos/roles (Sprint 1):

1. **Bug modo preparación**: Al hacer click por segunda vez para eliminar una casilla V/D añadida en modo preparación, la celda se queda en blanco. Debería restaurar el estado inicial o D (día libre) por defecto.
2. **Feature perdida - Vista multi-mes**: El visor expandido (`/multi-month`) que permitía ver 3+ meses simultáneos (seleccionable) se rompió al eliminar `projectId` en Sprint 1. Necesita actualización para funcionar sin proyectos.

---

## Contexto y antecedentes

El Sprint 1 eliminó `Project`, `ProjectMember` y `projectId` de toda la aplicación. La vista multi-mes (`app/multi-month/page.tsx`) quedó referenciando APIs con `projectId` que ya no existen. Además, la lógica de toggle en modo preparación no restaura correctamente el estado previo.

---

## Historia de usuario

### Bug 1: Toggle preparación
Como **ADMIN preparando el mes**,
quiero **que al desmarcar una casilla V/D vuelva a su estado anterior (o D por defecto)**,
para **no dejar celdas en blanco accidentalmente**.

### Feature 2: Vista multi-mes
Como **usuario (cualquier rol)**,
quiero **ver el cuadrante expandido a 3-6 meses a la vez**,
para **planificar y visualizar la rotación a largo plazo**.

### Bug 3: Gestión usuarios ADMIN — DELETE faltante
Como **ADMIN**,
quiero **poder eliminar (borrar) un usuario completamente**,
para **limpiar usuarios de prueba o que ya no son necesarios**.

*Nota: La UI y APIs de gestión de usuarios (`/admin` + `/api/admin/users`) ya existen y funcionan para create/read/update/password. Solo falta el endpoint DELETE.*

---

## Criterios de aceptación

### Bug 1: Toggle preparación (app/page.tsx)
- [ ] AC-01: Click 1 en celda vacía → asigna V (modo vacaciones) o D (modo libres)
- [ ] AC-02: Click 2 en misma celda (ya tiene V/D del modo actual) → **restaura estado anterior** (si había turno M/T/N/etc. vuelve a ese; si estaba vacía → D por defecto)
- [ ] AC-03: Click 3 → vuelve a asignar V/D del modo actual
- [ ] AC-04: Solo afecta al modo preparación (`prepStep === "vacaciones" || "libres"`), no al modo edición normal
- [ ] AC-05: Tests unitarios para el comportamiento de toggle

### Feature 2: Vista multi-mes (app/multi-month/page.tsx)
- [ ] AC-06: Eliminar todo uso de `projectId` en queries y URLs
- [ ] AC-07: Fetch empleados vía `GET /api/employees` (sin projectId)
- [ ] AC-08: Fetch cuadrante vía `GET /api/schedules?year=X&month=Y` (sin projectId)
- [ ] AC-09: Fetch festivos vía `GET /api/holidays?year=Y` (sin projectId)
- [ ] AC-10: Selector de span (2/3/4/6 meses) funcional
- [ ] AC-11: Navegación mes central (year/month) funcional
- [ ] AC-12: Botón "Volver" navega a home `/`
- [ ] AC-13: Accesible para todos los roles (ADMIN, TECNICO, VIEWER) — solo lectura
- [ ] AC-14: Header sincronizado (sin selector de proyecto, badge proyecto activo si aplica)
- [ ] AC-15: Tests E2E @smoke: carga vista, cambia span, navega meses

### Bug 3: Gestión usuarios ADMIN — DELETE (app/api/admin/users/[id]/route.ts)
- [ ] AC-16: `DELETE /api/admin/users/[id]` — elimina usuario y su Employee asociado (si existe) en transacción
- [ ] AC-17: Solo ADMIN puede ejecutarlo (403 para TECNICO/VIEWER)
- [ ] AC-18: Validar que no se puede borrar a sí mismo (id === session.user.id → 400)
- [ ] AC-19: UI: botón "Eliminar" en tabla de usuarios (además de Editar/Contraseña)
- [ ] AC-20: Confirmación modal antes de borrar
- [ ] AC-21: Tests unitarios + E2E @smoke

---

## Referencias visuales

- Vista multi-mes original: `specs/assets/multi-month-view.png` (pendiente captura)
- Comportamiento toggle preparación: `specs/assets/prep-toggle.gif` (pendiente captura)

---

## Flujo del usuario

### Bug 1: Toggle preparación
1. ADMIN entra en modo "Vacaciones" (botón panel prep)
2. Click en celda vacía → se pone V (naranja)
3. Click de nuevo en misma celda → **vuelve a D (gris) por defecto** o al turno que tenía antes
4. Click de nuevo → V otra vez

### Feature 2: Vista multi-mes
1. Usuario navega a `/multi-month?year=2026&month=5&span=3`
2. Ve 3 meses centrados en Mayo 2026 (Abr-May-Jun)
3. Cambia selector a 6 meses → ve 6 meses
4. Cambia mes central via URL params → recarga vista
5. Botón "Volver" → home `/`

---

## Fuera de scope

- Edición de turnos en vista multi-mes (solo lectura)
- Generación automática desde multi-mes
- Panel de preparación en multi-mes

---

## Notas técnicas para los agentes

### Bug 1: Toggle preparación
**Archivo**: `app/page.tsx` líneas 326-348 (`handleCellClick` con `prepStep`)

Lógica actual (problemática):
```typescript
const found = assignments.find(...);
if (found?.shiftType === shiftType) {
  // Quitar la asignación → DELETE → queda null (en blanco)
  await fetch(`/api/schedules?id=${found.id}`, { method: "DELETE" });
} else {
  await fetch("/api/schedules", { method: "POST", body: { employeeId, date, shiftType } });
}
```

**Fix propuesto**: Guardar estado previo antes del primer click, o consultar BD para saber qué tenía antes. O más simple: si `found` existe y coincide → DELETE; si NO existe (estaba vacía) → POST con D por defecto al desmarcar.

### Feature 2: Multi-mes
**Archivo**: `app/multi-month/page.tsx` — reescribir eliminando `projectId`

Cambios clave:
- L86: `fetch(/api/employees?projectId=...)` → `fetch(/api/employees)`
- L88: `fetch(/api/schedules?...&projectId=...)` → `fetch(/api/schedules?year=...&month=...)`
- L90: `fetch(/api/holidays?year=...)` — ya OK
- L55: `projectId` de searchParams → eliminar o ignorar
- L172: Título actualizado
- L334: "Sin empleados en este proyecto" → "Sin empleados en el sistema"

### Bug 3: DELETE usuario ADMIN
**Archivo**: `app/api/admin/users/[id]/route.ts` — añadir `export async function DELETE`

```typescript
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Prohibido: solo ADMIN" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, include: { employee: true } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (user.employee) {
      await tx.shiftAssignment.deleteMany({ where: { employeeId: user.employee.id } });
      await tx.employee.delete({ where: { id: user.employee.id } });
    }
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
```

**UI**: `app/admin/page.tsx` — `UsersTab`
- Añadir botón "Eliminar" junto a "Editar"/"Contraseña" (icono papelera, rojo)
- Modal confirmación: "¿Eliminar usuario X? Se borrarán todos sus datos (turnos, historial). No se puede deshacer."

---

## Casos de test sugeridos

### Unitarios (Bug 1)
- `tests/unit/prep-toggle.test.ts`
  - Toggle vacaciones: vacía → V → D → V → D
  - Toggle vacaciones: con M previo → V → M → V → M
  - Toggle libres: vacía → D → D (idempotente)
  - Toggle libres: con T previo → D → T → D → T

### Unitarios (Bug 3)
- `tests/unit/admin-users-delete.test.ts`
  - DELETE elimina User + Employee + ShiftAssignments en transacción
  - DELETE retorna 403 para TECNICO/VIEWER
  - DELETE retorna 400 si intenta borrarse a sí mismo
  - DELETE retorna 404 si usuario no existe

### E2E @smoke (Bug 3)
- `tests/e2e/admin-users.spec.ts` (ampliar existente)
  - `@smoke` ADMIN ve botón "Eliminar" en cada fila
  - `@smoke` Click Eliminar → modal confirmación → borra usuario
  - `@smoke` Usuario eliminado no aparece en lista ni puede loguearse

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-09-04 | @orchestrator | Creación de la spec |