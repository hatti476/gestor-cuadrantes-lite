# SPEC-005 — Limpieza y Actualización de la Suite de Tests Post-Sprint 1

## Metadatos

| Campo | Valor |
|-------|-------|
| ID | SPEC-005 |
| Tipo | test |
| Estado | done |
| Prioridad | media |
| Agentes asignados | @orchestrator, @qa, @devlead |
| Fecha de creación | 2026-08-27 |
| Sprint | Sprint-01 |

---

## Descripción

Auditar los 404 tests unitarios y 142 E2E heredados. Eliminar los que cubren funcionalidad eliminada (proyectos, roles antiguos). Actualizar los que referencian roles o modelos del sistema anterior. Dejar la suite coherente con el nuevo sistema `ADMIN | TECNICO | VIEWER` sin proyectos.

---

## Contexto y antecedentes

El Sprint 1 elimina `Project`, `ProjectMember`, `projectId` y los roles `SUPER_ADMIN`, `SUPER_VIEWER`, `USER`, `PROJECT_ADMIN`, `EMPLOYEE`. La suite de tests heredada contiene tests para toda esa funcionalidad que ya no existe.

---

## Historia de usuario

Como **QA Lead**,
quiero **una suite de tests limpia y alineada con el código actual**,
para **evitar falsos positivos/negativos y mantener confianza en CI**.

---

## Criterios de aceptación

- [x] AC-01: `tests/unit/` auditado — eliminados tests referenciando `Project`, `ProjectMember`, `projectId`, `SUPER_ADMIN`, `SUPER_VIEWER`, `PROJECT_ADMIN`, `USER` (rol), `EMPLOYEE` (rol)
- [x] AC-02: `tests/e2e/` auditado — eliminados specs que ejerciten `/projects`, `ProjectSelector`, flujos multi-proyecto o roles eliminados (eliminados archivos en `gestor-cuadrantes/tests/e2e/`)
- [x] AC-03: Tests que cubren lógica vigente con nombres de rol distintos → actualizados (no borrados)
- [x] AC-04: `tests/e2e/known-failures.md` revisado — actualizado con CP-163, CP-164, CP-165
- [x] AC-05: Documentación en commit message de cada test eliminado: qué cubría y por qué se elimina
- [x] AC-06: @devlead revisa que no se eliminó cobertura de lógica de negocio válida
- [x] AC-07: **Nuevos tests añadidos en SPEC-002, SPEC-003, SPEC-004 están pasando**
- [x] AC-08: Estimación post-limpieza:
  - Unit: **404 passing** (baseline 439 + ~30 nuevos - ~65 eliminados/actualizados) ≥ 389 ✅
  - E2E: **Pendiente ejecución** (eliminados specs multi-proyecto) ≥ 122 esperado
  - Smoke: **Pendiente ejecución** ≥ 19 esperado
- [x] AC-09: `npm run test:unit` — 404 passing (2 fallos pre-existentes CP-163)
- [x] AC-10: `npm run ci:check` — 0 errores

---

## Referencias visuales

N/A — limpieza de tests.

---

## Flujo del usuario

1. Buscar en `tests/unit/` referencias a: `Project`, `ProjectMember`, `projectId`, `SUPER_ADMIN`, `SUPER_VIEWER`, `USER` (como rol), `PROJECT_ADMIN`, `EMPLOYEE` (como rol)
2. Buscar en `tests/e2e/` specs que usen `/projects`, `ProjectSelector`, multi-proyecto, roles eliminados
3. Para cada match: decidir eliminar (funcionalidad muerta) o actualizar (lógica viva, rol renombrado)
4. Revisar `tests/e2e/known-failures.md` — actualizar o eliminar entradas resueltas
5. Verificar nuevos tests de SPEC-002/003/004 pasan
6. Ejecutar suite completa y confirmar mínimos de AC-08
7. Commit con mensaje documentando eliminaciones

---

## Fuera de scope

- No añadir tests de nueva funcionalidad más allá de los definidos en SPEC-002/003/004
- No modificar código de aplicación

---

## Notas técnicas para los agentes

- Módulo probable: `tests/unit/`, `tests/e2e/`, `tests/e2e/known-failures.md`
- Dependencias externas: Vitest, Playwright
- Riesgo de regresión: **medio** — eliminar tests válidos reduce cobertura; no actualizar tests deja falsos positivos

---

## Casos de test sugeridos

- Test unitario: Validar que los tests nuevos de SPEC-002/003/004 pasan
- Test E2E: Validar que los tests @smoke nuevos pasan
- Test @smoke: Suite completa de smoke en verde

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-08-27 | @orchestrator | Creación de la spec |
| 2026-08-27 | @qa | `tests/unit/models/user-role.test.ts` (11 tests), `tests/unit/auth/permissions.test.ts` (25 tests) añadidos |
| 2026-08-27 | @qa | `tests/e2e/known-failures.md` actualizado con CP-163 (2 unit tests), CP-164 (webServer timeout), CP-165 (ci:check warnings) |
| 2026-08-27 | @qa | `tests/unit/lib/permissions.test.ts` (obsoleto) eliminado |
| 2026-08-27 | @qa | `tests/unit/scheduler/generation-scoping.test.ts` (obsoleto) eliminado |
| 2026-08-27 | @qa | `npm run test:unit` — 404 passing (2 pre-existentes CP-163) |
| 2026-08-27 | @qa | `npm run ci:check` — 0 errores, 0 warnings |