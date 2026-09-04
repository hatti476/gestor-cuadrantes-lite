-- DropIndex
DROP INDEX "ProjectMember_projectId_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Project";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProjectMember";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rotationOrder" INTEGER NOT NULL,
    "shiftPreference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("active", "id", "name", "rotationOrder", "shiftPreference", "userId") SELECT "active", "id", "name", "rotationOrder", "shiftPreference", "userId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE TABLE "new_Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "publishedBy" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Schedule" ("generatedAt", "id", "month", "published", "publishedAt", "publishedBy", "year") SELECT "generatedAt", "id", "month", "published", "publishedAt", "publishedBy", "year" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE UNIQUE INDEX "Schedule_year_month_key" ON "Schedule"("year", "month");
CREATE TABLE "new_ScheduleSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ScheduleSnapshot" ("createdAt", "id", "month", "snapshot", "year") SELECT "createdAt", "id", "month", "snapshot", "year" FROM "ScheduleSnapshot";
DROP TABLE "ScheduleSnapshot";
ALTER TABLE "new_ScheduleSnapshot" RENAME TO "ScheduleSnapshot";
CREATE UNIQUE INDEX "ScheduleSnapshot_year_month_key" ON "ScheduleSnapshot"("year", "month");
CREATE TABLE "new_ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ShiftAssignment" ("date", "employeeId", "id", "manual", "shiftType") SELECT "date", "employeeId", "id", "manual", "shiftType" FROM "ShiftAssignment";
DROP TABLE "ShiftAssignment";
ALTER TABLE "new_ShiftAssignment" RENAME TO "ShiftAssignment";
CREATE UNIQUE INDEX "ShiftAssignment_employeeId_date_key" ON "ShiftAssignment"("employeeId", "date");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER'
);
INSERT INTO "new_User" ("email", "id", "password", "role") SELECT "email", "id", "password", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

