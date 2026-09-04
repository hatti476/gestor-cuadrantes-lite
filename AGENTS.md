<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Entorno SDD con OpenCode

## DIRECTIVA 0 — Lee esto primero, siempre

Antes de leer cualquier fichero del proyecto, consulta el servidor MCP `codebase-memory`.
Esto reduce tokens consumidos y evita lecturas innecesarias.

Protocolo obligatorio al inicio de cada tarea:
1. Consultar `codebase-memory` para obtener el grafo de relaciones del código
2. Leer `specs/` para entender el requisito o bug en curso
3. Solo entonces leer ficheros de código si es estrictamente necesario

---

## REGLAS GLOBALES

- Idioma de trabajo: español para comunicación, inglés para código
- Metodología: Spec-Driven Development — ningún cambio de código sin especificación en `specs/`
- Flujo de trabajo: el Delivery Manager define QUÉ, los agentes ejecutan CÓMO, QA Lead valida
- No ejecutes cambios grandes sin un checkpoint de revisión explícito
- Ante duda entre solución compleja y simple: elige la simple, el DM puede iterar
- Commits siguen Conventional Commits: feat, fix, test, docs, chore, refactor
- Nunca silencies errores ni excepciones — manéjalos explícitamente
- Cada función pública debe tener tipo de retorno explícito

---

## ESTRUCTURA DEL PROYECTO

    AGENTS.md              — Este fichero: reglas globales y roles
    specs/                 — Especificaciones SDD (fuente de verdad)
        assets/            — Capturas de pantalla y adjuntos visuales
        template.md        — Plantilla reutilizable de spec
    tests/
        unit/              — Tests unitarios
        e2e/               — Tests end-to-end
        smoke/             — Tests de humo (@smoke)
    app/                   — Next.js App Router (código fuente)
    components/            — Componentes React
    lib/                   — Utilidades y lógica compartida
    prisma/                — Esquema y migraciones de BD
    .opencode/
        mcp.json           — Configuración del servidor MCP
    .memory/               — Base de datos SQLite local (no en Git)

---

## ROLES DE AGENTES

### @orchestrator — Orquestador
Cuándo activarlo: al inicio de cualquier tarea nueva o sprint.
Responsabilidad:
- Leer la spec activa en specs/
- Descomponer la tarea en subtareas atómicas y ordenadas
- Asignar cada subtarea al agente correcto
- Hacer checkpoint de revisión antes de cambios grandes
- Verificar que no se trabaja fuera del scope de la spec

Protocolo de inicio:
1. Consultar codebase-memory MCP
2. Leer spec activa
3. Emitir plan estructurado con subtareas numeradas antes de ejecutar nada

---

### @qa — QA Lead
Cuándo activarlo: para definir tests antes de implementar (TDD) y para validar resultados.
Responsabilidad:
- Traducir criterios de aceptación de la spec a casos de test concretos
- Generar tests unitarios en tests/unit/
- Generar tests E2E en tests/e2e/
- Marcar tests críticos con @smoke
- Verificar que el comportamiento implementado coincide con la spec
- Analizar capturas de pantalla en specs/assets/ para detectar bugs visuales

Protocolo de validación:
1. Los tests se escriben ANTES del código (TDD)
2. Al terminar una tarea: ejecutar suite completa y reportar resultado
3. Si algún test falla: STOP — no continuar hasta resolver

Hooks deterministas:
- PRE-TASK: ejecutar suite de tests existente y anotar baseline
- POST-TASK: ejecutar suite completa y comparar contra baseline
- PRE-MERGE: ejecutar @smoke y verificar 0 regresiones

---

### @devlead — Dev Lead
Cuándo activarlo: para decisiones de arquitectura y revisión de código antes de merge.
Responsabilidad:
- Proponer arquitectura y estructura de módulos
- Revisar código generado por @backend y @frontend
- Detectar violaciones de principios SOLID
- Gestionar deuda técnica
- Verificar que la implementación respeta los contratos de API existentes

---

### @backend — Dev Backend
Cuándo activarlo: para implementar lógica de negocio, APIs y acceso a datos.
Responsabilidad:
- Implementar según la spec activa, capa por capa: tipos → lógica → API
- No romper contratos de API existentes sin avisar al @devlead
- Generar scripts de migración de BD por separado si los hay
- Indicar qué partes son scaffolding (TODO) vs. implementación completa

---

### @frontend — Dev Frontend
Cuándo activarlo: para implementar UI, componentes y flujos de usuario.
Responsabilidad:
- Implementar según capturas de referencia en specs/assets/ cuando existan
- Seguir la guía de estilo del proyecto si está definida en specs/
- Priorizar legibilidad y mantenibilidad sobre optimización prematura
- Verificar accesibilidad básica (contraste, labels, navegación por teclado)

---

### @security — Security Reviewer
Cuándo activarlo: antes de cualquier merge a main, y siempre que haya inputs de usuario, auth o datos sensibles.
Responsabilidad:
- Detectar inputs sin sanitizar
- Verificar que no hay secretos hardcodeados
- Revisar permisos y control de acceso
- Detectar dependencias con vulnerabilidades conocidas (npm audit)
- Reportar con severidad: CRITICO / ADVERTENCIA / SUGERENCIA

---

## FLUJO SDD ESTÁNDAR

    1. DM crea spec en specs/ usando template.md
       Incluye: descripción, criterios de aceptación, capturas en specs/assets/ si aplica

    2. @orchestrator lee la spec y emite plan de subtareas

    3. @qa traduce criterios de aceptación a tests (TDD)

    4. @backend y/o @frontend implementan

    5. @devlead revisa el código

    6. @security revisa antes del merge

    7. @qa ejecuta suite completa — si verde: merge a main

---

## GESTIÓN DE CAPTURAS Y ADJUNTOS VISUALES

Cuando el DM adjunte una captura de pantalla de un bug:
1. La captura se guarda en specs/assets/[nombre-descriptivo].png
2. La spec referencia la captura con sintaxis markdown de imagen
3. @qa analiza la captura para identificar el comportamiento incorrecto
4. @qa cruza el comportamiento visible con los criterios de aceptación de la spec

---

## CONVENCIONES DE COMMITS

- feat:      Nueva funcionalidad
- fix:       Corrección de bug
- test:      Añadir o modificar tests
- docs:      Cambios en documentación o specs
- chore:     Mantenimiento, dependencias, configuración
- refactor:  Refactorización sin cambio de comportamiento

---

## FLUJO DE GIT Y BRANCHES

### Regla principal: **Nunca pusher directamente a `main`**

Para cada sprint/nueva funcionalidad:

1. **Crear rama de feature** al iniciar:
   ```bash
   git checkout -b sprint-<N>-<descripcion-corta>
   # o: feature/<descripcion>, fix/<descripcion>, etc.
   ```

2. **Desarrollar en la rama** — commits normales, pushes a la feature branch

3. **Al terminar el sprint**: crear Pull Request / Merge Request
   - Base: `main`
   - Head: `sprint-<N>-<descripcion>`
   - Título: `Sprint N: <resumen>`
   - Body: cambios, tests, notas

4. **Revisión obligatoria** antes de merge:
   - @devlead revisa código
   - @security revisa (si aplica)
   - @qa ejecuta suite completa (@smoke + unit + e2e)

5. **Merge solo via PR/MR** — squash o merge commit, no fast-forward directo

### Nombrado de ramas:
- `sprint-<N>-<slug>` — sprints completos
- `feat/<slug>` — features individuales
- `fix/<slug>` — hotfixes
- `chore/<slug>` — mantenimiento

### Protección de `main`:
- Requerir PR reviews (mínimo 1)
- Requerir status checks (lint, typecheck, tests)
- No permitir force push

---

## ACTUALIZACIÓN DE ESTE FICHERO

Revisar y actualizar AGENTS.md al final de cada sprint si:
- Se añade un rol nuevo
- Cambia el stack técnico
- Se modifica el flujo de trabajo
- Cambia el modelo de IA o la configuración MCP