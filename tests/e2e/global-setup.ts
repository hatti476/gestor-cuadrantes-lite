/**
 * Playwright Global Setup — prepara la BD que usa la aplicacion bajo test.
 *
 * Dos modos, segun E2E_DATABASE_URL:
 *
 *   - Sin definir (playwright.config.ts): BD aislada prisma/test.db. El fichero
 *     se borra y se recrea desde cero en cada ejecucion.
 *
 *   - Definida (playwright.docker.config.ts): apunta a prisma/dev.db, la MISMA
 *     BD que usa el contenedor. En este modo NO se borra el fichero: el proceso
 *     de la app mantiene abierto el inode y seguiria leyendo el fichero
 *     eliminado. Se limpian las tablas y se resiembra conservando el inode.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/** BD contra la que se siembra. Ver cabecera para los dos modos. */
const TEST_DB_URL = process.env.E2E_DATABASE_URL ?? "file:./test.db";

/** Solo borramos el fichero cuando es nuestra BD aislada, nunca la del contenedor. */
const OWNS_DB_FILE = !process.env.E2E_DATABASE_URL;

async function clearTestData() {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  try {
    await prisma.$transaction([
      prisma.shiftChangeLog.deleteMany(),
      prisma.shiftAssignment.deleteMany(),
      prisma.schedule.deleteMany(),
      prisma.holiday.deleteMany(),
      prisma.employee.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.verificationToken.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedTestData() {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  try {
    // ─── Admin global (ADMIN) ──────────────────────────────────────────────────
    const adminPassword = await bcrypt.hash("Admin1234!", 12);
    await prisma.user.upsert({
      where: { email: "admin@cuadrantes.local" },
      update: { password: adminPassword, role: "ADMIN" },
      create: {
        email: "admin@cuadrantes.local",
        password: adminPassword,
        role: "ADMIN",
      },
    });
    console.log("✓ ADMIN: admin@cuadrantes.local");

    // ─── Técnico ejemplo (TECNICO con Employee) ────────────────────────────────
    const techPassword = await bcrypt.hash("Tecnico1234!", 12);
    const techUser = await prisma.user.upsert({
      where: { email: "tecnico@cuadrantes.local" },
      update: { password: techPassword, role: "TECNICO" },
      create: {
        email: "tecnico@cuadrantes.local",
        password: techPassword,
        role: "TECNICO",
        employee: {
          create: { name: "Técnico Ejemplo", rotationOrder: 1, shiftPreference: "M", active: true },
        },
      },
      include: { employee: true },
    });
    console.log("✓ TECNICO:", techUser.email, "| Employee:", techUser.employee?.name);

    // ─── 7 Técnicos adicionales (TECNICO con Employee) ─────────────────────────
    const employees: { id: string }[] = [];

    for (let i = 1; i <= 7; i++) {
      const email = `tecnico${i}@cuadrantes.local`;
      const user = await prisma.user.upsert({
        where: { email },
        update: { password: techPassword, role: "TECNICO" },
        create: {
          email,
          password: techPassword,
          role: "TECNICO",
          employee: { create: { name: `Técnico ${i}`, rotationOrder: i, shiftPreference: i % 2 === 0 ? "T" : "M", active: true } },
        },
        include: { employee: true },
      });
      console.log("✓ TECNICO:", user.email, "| Employee:", user.employee?.name);
      if (user.employee) employees.push({ id: user.employee.id });
    }

    // ─── Viewer ejemplo (VIEWER sin Employee) ──────────────────────────────────
    const viewerPassword = await bcrypt.hash("Viewer1234!", 12);
    await prisma.user.upsert({
      where: { email: "viewer@cuadrantes.local" },
      update: { password: viewerPassword, role: "VIEWER" },
      create: {
        email: "viewer@cuadrantes.local",
        password: viewerPassword,
        role: "VIEWER",
      },
    });
    console.log("✓ VIEWER: viewer@cuadrantes.local");

    // ─── Festivos nacionales de ejemplo 2026 ───────────────────────────────────
    const holidays2026 = [
      { date: new Date("2026-01-01"), description: "Año Nuevo" },
      { date: new Date("2026-01-06"), description: "Epifanía del Señor" },
      { date: new Date("2026-03-19"), description: "San José" },
      { date: new Date("2026-04-03"), description: "Viernes Santo" },
      { date: new Date("2026-05-01"), description: "Fiesta del Trabajo" },
      { date: new Date("2026-08-15"), description: "Asunción de la Virgen" },
      { date: new Date("2026-10-12"), description: "Fiesta Nacional de España" },
      { date: new Date("2026-11-01"), description: "Todos los Santos" },
      { date: new Date("2026-12-06"), description: "Día de la Constitución" },
      { date: new Date("2026-12-08"), description: "Inmaculada Concepción" },
      { date: new Date("2026-12-25"), description: "Natividad del Señor" },
    ];

    for (const h of holidays2026) {
      await prisma.holiday.upsert({
        where: { date: h.date },
        update: { description: h.description, year: h.date.getFullYear() },
        create: { date: h.date, description: h.description, year: h.date.getFullYear() },
      });
    }
    console.log(`✓ ${holidays2026.length} festivos nacionales 2026 sembrados`);

    // ─── Sembrar turnos de Mayo 2026 ───────────────────────────────────────────
    const SHIFT_PATTERNS: string[][] = [
      "MMMDDTTTDDNNNDDMMMDDTTTDDNNNDDM".split(""),
      "TTTDDNNNDDMMMDDTTTDDNNNDDMMMDDТ".replace("Т", "T").split(""),
      "NNNDDMMMDDTTTDDNNNDDMMMDDTTTDDN".split(""),
      "JJJJJDDJJJJJDDJJJJJDDJJJJJDDJJ".split(""),
      "MMMDDTTTDDVVVVVDDMMMDDTTTDDNNNDD".slice(0, 31).split(""),
      "BBBBBDDTTTDDNNNDDMMMDDTTTDDNNNDD".slice(0, 31).split(""),
      "MTNJDVBMTNJDVBMTNJDVBMTNJDVBMTD".slice(0, 31).split(""),
    ];

    const year = 2026;
    const month = 5;
    const daysInMonth = new Date(year, month, 0).getDate();

    let assignmentsCreated = 0;
    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const pattern = SHIFT_PATTERNS[empIdx] ?? [];
      const employeeId = employees[empIdx].id;

      for (let day = 1; day <= daysInMonth; day++) {
        const shiftType = pattern[day - 1];
        if (!shiftType) continue;

        const date = new Date(Date.UTC(year, month - 1, day));

        await prisma.shiftAssignment.upsert({
          where: { employeeId_date: { employeeId, date } },
          update: { shiftType },
          create: { employeeId, date, shiftType },
        });
        assignmentsCreated++;
      }
    }

    console.log(`✓ ${assignmentsCreated} turnos de Mayo 2026 sembrados`);

    // ─── Schedule record para Mayo 2026 ────────────────────────────────────────
    // Ya no hace falta raw SQL: projectId desapareció del schema, así que
    // podemos usar la API tipada con la clave única (year, month).
    await prisma.schedule.upsert({
      where: { year_month: { year, month } },
      update: { published: false, generatedAt: new Date() },
      create: { year, month, published: false, generatedAt: new Date() },
    });
    console.log(`✓ Schedule record Mayo 2026 creado`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error seeding:", error);
    await prisma.$disconnect();
    throw error;
  }
}

export default async function globalSetup() {
  const cwd = path.resolve(__dirname, "../../"); // gestor-cuadrantes/
  const prismaDir = path.join(cwd, "prisma");

  // 1. Solo si la BD es nuestra: eliminar el fichero y su WAL/journal.
  //    En modo Docker lo saltamos (ver cabecera): borrar el fichero dejaria a la
  //    app leyendo un inode huerfano.
  if (OWNS_DB_FILE) {
    for (const file of ["test.db", "test.db-wal", "test.db-shm", "test.db-journal"]) {
      for (const dir of [prismaDir, cwd]) {
        const p = path.join(dir, file);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    }
    console.log("\n[globalSetup] prisma/test.db eliminada — empezando con BD limpia");
  } else {
    console.log(`\n[globalSetup] Modo Docker: reutilizando ${TEST_DB_URL} (no se borra el fichero)`);
  }

  // 1b. El lock de Next.js dev solo estorba cuando Playwright levanta su propio
  //     servidor. En modo Docker el servidor ya corre en el contenedor: borrarlo
  //     seria inutil y podria interferir con el dev server en marcha.
  if (OWNS_DB_FILE) {
    const nextDevLock = path.join(cwd, ".next", "dev", "lock");
    if (fs.existsSync(nextDevLock)) {
      fs.unlinkSync(nextDevLock);
      console.log("[globalSetup] .next/dev/lock eliminado — el servidor de tests puede arrancar en 3001");
    }
  }

  const env = {
    ...process.env,
    DATABASE_URL: TEST_DB_URL,
    DOTENV_CONFIG_PATH: "none",
  };

  // 2. Aplicar migraciones. Si falla, es un error real del schema y debe
  //    propagarse: copiar dev.db como "plantilla" enmascaraba el fallo y dejaba
  //    la BD con un schema distinto al de las migraciones.
  console.log("[globalSetup] Aplicando migraciones...");
  execSync(`DATABASE_URL="${TEST_DB_URL}" npx prisma migrate deploy`, { env, cwd, stdio: "inherit" });

  // 3. Vaciar tablas de datos (el schema ya es correcto tras migrate deploy).
  await clearTestData();

  // 4. Sembrar datos de prueba (roles ADMIN/TECNICO/VIEWER).
  console.log("[globalSetup] Sembrando datos...");
  await seedTestData();

  console.log(`[globalSetup] ✓ BD de tests lista en ${TEST_DB_URL}\n`);

}