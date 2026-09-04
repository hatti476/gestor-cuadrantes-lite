"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { ShiftCell } from "@/components/schedule/shift-cell";
import { ShiftType } from "@/lib/constants/shift-colors";
import type { ScheduleAssignment, ScheduleEmployee } from "@/lib/schedules/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return { year: y, month: m };
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_SHORT_ES = ["D", "L", "M", "X", "J", "V", "S"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
}

// ── types ─────────────────────────────────────────────────────────────────────

interface MonthData {
  year: number;
  month: number;
  assignments: ScheduleAssignment[];
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MultiMonthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sin projectId: el sistema ahora es single-tenant global
  const yearParam  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()), 10);
  const monthParam = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

  const [employees, setEmployees] = useState<ScheduleEmployee[]>([]);
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [span, setSpan] = useState(3);

  // Auth guard: cualquier rol autenticado puede ver (read-only)
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const offset = Math.floor(span / 2);
      const periods: Array<{ year: number; month: number }> = [];
      for (let d = -offset; d < span - offset; d++) {
        periods.push(addMonths(yearParam, monthParam, d));
      }

      // Fetch holidays for all years that appear in the view
      const years = [...new Set(periods.map((p) => p.year))];

      const [empRes, ...restRes] = await Promise.all([
        fetch(`/api/employees`),
        ...periods.map((p) =>
          fetch(`/api/schedules?year=${p.year}&month=${p.month}`)
        ),
        ...years.map((y) => fetch(`/api/holidays?year=${y}`)),
      ]);

      if (!empRes.ok) throw new Error("Error al cargar empleados");

      const schedRes = restRes.slice(0, periods.length);
      const holidayRes = restRes.slice(periods.length);

      const apiEmployees: (ScheduleEmployee & { userId?: string })[] = await empRes.json();
      const sorted = apiEmployees
        .sort((a, b) => a.rotationOrder - b.rotationOrder)
        .map((e) => ({ ...e, userId: e.userId ?? null }));
      setEmployees(sorted);

      const data: MonthData[] = [];
      for (let i = 0; i < periods.length; i++) {
        const res = schedRes[i];
        const assignments: ScheduleAssignment[] = res.ok
          ? ((await res.json()).assignments ?? [])
          : [];
        data.push({ ...periods[i], assignments });
      }
      setMonthsData(data);

      // Build holiday set: "YYYY-MM-DD"
      const hDates = new Set<string>();
      for (const res of holidayRes) {
        if (res.ok) {
          const list: { date: string }[] = await res.json();
          list.forEach((h) => hDates.add(h.date.slice(0, 10)));
        }
      }
      setHolidayDates(hDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [yearParam, monthParam, span, status]);

  // Load on mount and when load function changes
  useEffect(() => {
    const runLoad = async () => {
      await load();
    };
    runLoad();
  }, [load]);

  if (status === "loading" || status === "unauthenticated") return null;

  // Build shift lookup: empId|YYYY-MM-DD → shiftType
  const shiftLookup = new Map<string, string>();
  for (const md of monthsData) {
    for (const a of md.assignments) {
      shiftLookup.set(`${a.employeeId}|${a.date.slice(0, 10)}`, a.shiftType);
    }
  }

  // Ordered column list: {year, month, day, dow}
  const columns: Array<{ year: number; month: number; day: number; dow: number }> = [];
  for (const md of monthsData) {
    const days = daysInMonth(md.year, md.month);
    for (let d = 1; d <= days; d++) {
      columns.push({ year: md.year, month: md.month, day: d, dow: dayOfWeek(md.year, md.month, d) });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 p-6">
        {/* Toolbar — mismo estilo que barra de herramientas de página principal */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.back()}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors print:hidden"
            data-testid="btn-back"
          >
            ‹ Volver
          </button>
          <h2 className="text-sm font-semibold text-gray-700">
            Vista ampliada — {MONTH_NAMES_ES[monthParam - 1]} {yearParam}
          </h2>
          <div className="ml-auto flex items-center gap-2 print:hidden">
            <span className="text-xs text-gray-600 font-medium">Meses:</span>
            <select
              id="span-select"
              value={span}
              onChange={(e) => setSpan(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {[2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>{n} meses</option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            >
              Imprimir
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Cargando cuadrante…
          </div>
        )}

        {/* Grid */}
        {!loading && !error && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
              <thead>
                {/* Month header row */}
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-3 py-2"
                    style={{ minWidth: 140, width: 140 }}
                  />
                  {monthsData.map((md) => (
                    <th
                      key={`${md.year}-${md.month}`}
                      colSpan={daysInMonth(md.year, md.month)}
                      className="border-b border-r border-gray-200 bg-indigo-50 text-indigo-700 font-semibold text-center py-1.5 px-2 text-xs"
                    >
                      {MONTH_NAMES_ES[md.month - 1]} {md.year}
                    </th>
                  ))}
                </tr>
                {/* Day header row */}
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-3 py-1.5 text-left text-xs font-medium text-gray-500"
                    style={{ minWidth: 140, width: 140 }}
                  >
                    Empleado
                  </th>
                  {columns.map((col) => {
                    const isWeekend = col.dow === 0 || col.dow === 6;
                    const isLastOfMonth =
                      col.day === daysInMonth(col.year, col.month);
                    const ds = dateStr(col.year, col.month, col.day);
                    const isHoliday = holidayDates.has(ds);
                    return (
                      <th
                        key={`h-${col.year}-${col.month}-${col.day}`}
                        className={`border-b border-gray-200 text-center py-0.5 ${
                          isLastOfMonth ? "border-r-2 border-r-gray-400" : ""
                        } ${
                          isHoliday
                            ? "bg-red-200 text-red-800"
                            : isWeekend
                            ? "bg-blue-200 text-blue-900"
                            : "bg-gray-50 text-gray-500"
                        }`}
                        style={{ minWidth: 26, width: 26 }}
                      >
                        <div className="text-[10px] font-medium leading-tight">{DAY_SHORT_ES[col.dow]}</div>
                        <div className="text-[10px] text-gray-400 leading-tight">{col.day}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => {
                  const isOwnRow = !!session?.user?.id && emp.userId === session.user.id;
                  const rowBg = isOwnRow
                    ? "bg-indigo-50"
                    : empIdx % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50/50";
                  return (
                  <tr
                    key={emp.id}
                    data-testid={isOwnRow ? "own-row-multimonth" : undefined}
                    className={`${rowBg} ${
                      isOwnRow ? "ring-2 ring-inset ring-indigo-300" : ""
                    }`}
                  >
                    {/* Employee name */}
                    <td
                      className={`sticky left-0 z-10 border-r border-gray-200 px-3 py-1 text-xs whitespace-nowrap ${
                        isOwnRow
                          ? `${rowBg} font-semibold text-indigo-700`
                          : `${
                              empIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } font-medium text-gray-800`
                      }`}
                      style={{ minWidth: 140, width: 140 }}
                    >
                      {isOwnRow && (
                        <span className="inline-block mr-1 text-indigo-400" aria-label="Tu fila">▶</span>
                      )}
                      {emp.name}
                    </td>
                    {/* Shift cells */}
                    {columns.map((col) => {
                      const ds = dateStr(col.year, col.month, col.day);
                      const shift = shiftLookup.get(`${emp.id}|${ds}`) ?? "";
                      const isWeekend = col.dow === 0 || col.dow === 6;
                      const isLastOfMonth = col.day === daysInMonth(col.year, col.month);
                      const isHoliday = holidayDates.has(ds);
                      const shiftConfig = shift as ShiftType;

                      return (
                        <td
                          key={ds}
                          className={`h-7 p-0.5 border-b border-gray-100 ${
                          isLastOfMonth ? "border-r-2 border-r-gray-400" : ""
                        } ${
                            isHoliday && !shift
                              ? "bg-red-50"
                              : isWeekend && !shift
                              ? "bg-blue-100"
                              : ""
                          }`}
                          style={{ minWidth: 26, width: 26 }}
                        >
                          {shift ? (
                            <ShiftCell shiftType={shiftConfig} />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
                {employees.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="text-center py-10 text-gray-400 text-sm"
                    >
                      Sin empleados en el sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}