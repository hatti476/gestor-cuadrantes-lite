# SPEC-004 — Eliminar Gestión de Proyectos (UI + API)

## Metadatos

| Campo | Valor |
|-------|-------|
| ID | SPEC-004 |
| Tipo | feature |
| Estado | done |
| Prioridad | media |
| Agentes asignados | @orchestrator, @qa, @backend, @frontend, @devlead |
| Fecha de creación | 2026-08-27 |
| Sprint | Sprint-01 |

---

## Descripción

Eliminar toda la superficie de gestión de proyectos: página `/projects`, endpoints `/api/projects/*`, componente `ProjectSelector`, selector del `Header` y pestaña de proyectos en `/admin`. Limpiar la persistencia de proyecto activo en `localStorage`. Las queries al cuadrante y empleados dejan de requerir `projectId`.

---

## Contexto y antecedentes

Tras la migración de esquema (SPEC-002) y el refactor de permisos (SPEC-003), la capa multi-proyecto ya no existe en BD ni en lógica de permisos. Ahora hay que limpiar la UI y API que la exponían.

---

## Historia de usuario

Como **usuario final**,
quiero **una interfaz simplificada sin selector de proyectos**,
para **acceder directamente al cuadrante único del sistema**.

---

## Criterios de aceptación

- [x] AC-01: Directorio `app/projects/` eliminado completamente
- [x] AC-02: Directorio `app/api/projects/` eliminado completamente
- [x] AC-03: Componente `components/projects/project-selector.tsx` eliminado
- [x] AC-04: `components/layout/header.tsx` — eliminado `ProjectSelector` y referencias a proyecto activo
- [x] AC-05: `app/admin/page.tsx` — eliminada pestaña "Proyectos"; mantener solo gestión de usuarios
- [x] AC-06: `app/page.tsx` — eliminada lógica de `projectId` activo en `localStorage`; limpiados parámetros `projectId` en llamadas a `/api/schedules` y `/api/employees`
- [x] AC-07: Eliminados hooks/utils que lean `localStorage` para proyecto activo
- [x] AC-08: **RF-02**: Sin concepto de proyecto en ninguna capa visible
- [x] AC-09: Motor de generación (`lib/schedules/monthly-schedule-engine.ts`) **no se toca** en este sprint
- [x] AC-10: Endpoints `/api/schedules` y `/api/employees` funcionan sin `projectId`
- [x] AC-11: Navegar a `/projects` retorna 404
- [x] AC-12: Header no muestra selector de proyecto
- [x] AC-13: `/admin` muestra únicamente pestaña de usuarios
- [x] AC-14: Cuadrante principal carga empleados y turnos correctamente sin `projectId`
- [x] AC-15: `npm run ci:check` — 0 imports rotos referenciando rutas/modelos eliminados

---

## Referencias visuales

- Captura del Header sin selector de proyecto: `./assets/SPEC-004-header-sin-proyecto.png`
- Captura de /admin solo con pestaña usuarios: `./assets/SPEC-004-admin-solo-usuarios.png`

---

## Flujo del usuario

1. Eliminar `app/projects/` y `app/api/projects/`
2. Eliminar `components/projects/project-selector.tsx`
3. Limpiar `Header.tsx` — quitar ProjectSelector
4. Limpiar `app/admin/page.tsx` — quitar pestaña proyectos
5. Limpiar `app/page.tsx` — quitar localStorage projectId, limpiar query params
6. Verificar: `/projects` → 404, Header limpio, `/admin` solo usuarios, cuadrante carga
7. Ejecutar `npm run ci:check`

---

## Fuera de scope

- No tocar motor de generación de cuadrantes
- No modificar permisos (hecho en SPEC-003)
- No tocar tests (se hace en SPEC-005)

---

## Notas técnicas para los agentes

- Módulo probable: `app/projects/`, `app/api/projects/`, `components/projects/`, `components/layout/header.tsx`, `app/admin/page.tsx`, `app/page.tsx`
- Dependencias externas: ninguna
- Riesgo de regresión: **medio** — roturas de import si no se limpian bien

---

## Casos de test sugeridos

- Test E2E: `tests/e2e/navigation/no-projects.spec.ts`
  - `@smoke` `/projects` retorna 404
  - `@smoke` Header no contiene selector de proyecto
  - `@smoke` Panel `/admin` no muestra pestaña de proyectos

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-08-27 | @orchestrator | Creación de la spec |
| 2026-08-27 | @backend | `app/projects/` y `app/api/projects/` eliminados (commit f46b1bb) |
| 2026-08-27 | @frontend | `components/projects/project-selector.tsx` eliminado; `header.tsx` limpio; `app/admin/page.tsx` sin pestaña proyectos |
| 2026-08-27 | @frontend | `app/page.tsx` — eliminada lógica `activeProjectId` y `localStorage`; llamadas API sin `projectId` |
| 2026-08-27 | @qa | `npm run ci:check` — 0 errores |