"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { Header } from "@/components/layout/header";
import { ShiftEditor } from "@/components/schedule/shift-editor";
import { SHIFT_COLORS, ShiftType } from "@/lib/constants/shift-colors";
import { ScheduleAssignment, ScheduleEmployee, MonthStatus, computeMonthStatus } from "@/lib/schedules/types";
import { calculateExtraPay, countShifts, EXTRA_PAY_RATES } from "@/lib/schedules/business-logic";
import { PrepPanel, MonthStatusBadge, PrepStep } from "@/components/schedule/prep-panel";
import { useToast } from "@/components/ui/toast-provider";

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const COUNTER_SHIFTS: ShiftType[] = ["M", "T", "N", "MF", "TF", "NF", "J", "D", "V", "B"];
const EXTRA_PAY_SHIFTS: Array<"MF" | "TF" | "N" | "NF" | "MN" | "TN" | "NN"> = [
  "MF",
  "TF",
  "N",
  "NF",
  "MN",
  "TN",
  "NN",
];

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function CountersTable({
  employees,
  assignments,
}: {
  employees: ScheduleEmployee[];
  assignments: ScheduleAssignment[];
}) {
  return (
    <div className="mt-2 w-fit overflow-x-auto rounded-lg border border-gray-200 shadow-sm" data-testid="counters-table">
      <table className="border-collapse text-xs min-w-max">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[140px]">
              Empleado
            </th>
            {COUNTER_SHIFTS.map((s) => (
              <th
                key={s}
                className="w-9 py-1 text-center border-b border-r border-gray-200"
              >
                <div
                  className="flex items-center justify-center w-7 h-7 mx-auto rounded-sm text-xs font-bold select-none"
                  style={{ backgroundColor: SHIFT_COLORS[s].color, color: SHIFT_COLORS[s].textColor }}
                >
                  {s}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, rowIndex) => {
            const empShifts = assignments
              .filter((a) => a.employeeId === emp.id)
              .map((a) => a.shiftType);
            const counters = countShifts(empShifts);
            const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50";
            return (
              <tr key={emp.id} className={`${rowBg} hover:bg-yellow-50/40 transition-colors`}>
                <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1 font-medium text-gray-700 border-r border-b border-gray-200 whitespace-nowrap`}>
                  {emp.name}
                </td>
                {COUNTER_SHIFTS.map((s) => {
                  const count = counters[s] ?? 0;
                  return (
                    <td
                      key={s}
                      className="w-9 h-8 py-1 text-center border-r border-b border-gray-200 font-mono tabular-nums"
                      style={{ color: count === 0 ? "#9E9E9E" : undefined }}
                      data-testid={`counter-${emp.id}-${s}`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExtraPayTable({
  employees,
  assignments,
  month,
}: {
  employees: ScheduleEmployee[];
  assignments: ScheduleAssignment[];
  month: number;
}) {
  const columns = month === 12 || month === 1
    ? EXTRA_PAY_SHIFTS
    : (EXTRA_PAY_SHIFTS.filter((shift) => shift !== "MN" && shift !== "TN" && shift !== "NN") as Array<"MF" | "TF" | "N" | "NF">);

  return (
    <div className="mt-2 w-fit overflow-x-auto rounded-lg border border-gray-200 shadow-sm" data-testid="extra-pay-legend">
      <table className="border-collapse text-xs min-w-max" data-testid="extra-pay-table">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[140px]">
              Empleado
            </th>
            {columns.map((shift) => (
              <th key={shift} className="w-9 py-1 text-center border-b border-r border-gray-200">
                <div
                  className="flex items-center justify-center w-7 h-7 mx-auto rounded-sm text-xs font-bold select-none"
                  style={{
                    backgroundColor: SHIFT_COLORS[shift].color,
                    color: SHIFT_COLORS[shift].textColor,
                  }}
                >
                  {shift}
                </div>
              </th>
            ))}
            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[96px]">
              P. Extra
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, rowIndex) => {
            const empShifts = assignments
              .filter((a) => a.employeeId === emp.id)
              .map((a) => a.shiftType);
            const counters = countShifts(empShifts);
            const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50";
            const extraPay = calculateExtraPay(
              Object.fromEntries(columns.map((shift) => [shift, counters[shift] ?? 0]))
            );

            return (
              <tr key={emp.id} className={`${rowBg} hover:bg-yellow-50/40 transition-colors`}>
                <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1 font-medium text-gray-700 border-r border-b border-gray-200 whitespace-nowrap`}>
                  {emp.name}
                </td>
                {columns.map((shift) => {
                  const count = counters[shift] ?? 0;
                  return (
                    <td
                      key={shift}
                      className="w-9 h-8 py-1 text-center border-r border-b border-gray-200 font-mono tabular-nums"
                      style={{ color: count === 0 ? "#9E9E9E" : undefined }}
                      data-testid={`extra-pay-${emp.id}-${shift}`}
                    >
                      {count}
                    </td>
                  );
                })}
                <td
                  className="px-3 py-1 text-right border-r border-b border-gray-200 font-semibold text-gray-700 font-mono tabular-nums"
                  data-testid={`extra-pay-${emp.id}-total`}
                >
                  {euroFormatter.format(extraPay)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function RatesLegend({ month }: { month: number }) {
  const shifts = month === 12 || month === 1
    ? EXTRA_PAY_SHIFTS
    : EXTRA_PAY_SHIFTS.filter((s) => s !== "MN" && s !== "TN" && s !== "NN");
  return (
    <div
      className="mt-2 rounded-lg border border-gray-200 shadow-sm bg-white px-4 py-3"
      data-testid="extra-pay-rates-legend"
    >
      <p className="text-xs font-semibold text-gray-600 mb-2">Tarifas</p>
      <div className="flex flex-col gap-2">
        {shifts.map((shift) => (
          <div key={shift} className="flex items-center gap-1.5">
            <span
              className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-bold select-none"
              style={{ backgroundColor: SHIFT_COLORS[shift].color, color: SHIFT_COLORS[shift].textColor }}
            >
              {shift}
            </span>
            <span className="text-xs text-gray-700 font-mono tabular-nums whitespace-nowrap">
              {euroFormatter.format(EXTRA_PAY_RATES[shift]!)}/turno
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const router = useRouter();
  const { showToast } = useToast();

  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5);

  // canEdit: solo ADMIN puede editar (RF-04)
  const canEdit = isAdmin;

  const [employees, setEmployees] = useState<ScheduleEmployee[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [holidayDates, setHolidayDates] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [monthStatus, setMonthStatus] = useState<MonthStatus>("ungenerated");
  const [published, setPublished] = useState(false);

  // Estado del panel de preparación
  const [prepStep, setPrepStep] = useState<PrepStep>(null);
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    date: string;
    currentShift?: string;
    assignmentId?: string;
  } | null>(null);

  // Estado para toggle preparación: guarda el turno previo antes de entrar en modo prep
  // key: "employeeId|YYYY-MM-DD" → value: shiftType anterior (o undefined si estaba vacía)
  const [prevShiftBeforePrep, setPrevShiftBeforePrep] = useState<Map<string, string | undefined>>(new Map());

  // Limpiar prevShiftBeforePrep al cambiar de mes o salir de modo prep
  useEffect(() => {
    // eslint-disable-next-line
    setPrevShiftBeforePrep(() => new Map());
  }, [year, month, prepStep]);

  // ---------------------------------------------------------------------------
  // Carga datos del mes
  // ---------------------------------------------------------------------------
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleRes, holidayRes, employeeRes] = await Promise.all([
        fetch(`/api/schedules?year=${year}&month=${month}`),
        fetch(`/api/holidays?year=${year}`),
        fetch(`/api/employees`),
      ]);
      if (!scheduleRes.ok) throw new Error("Error cargando cuadrante");
      const responseData: { assignments: ScheduleAssignment[]; monthStatus: MonthStatus; published?: boolean } = await scheduleRes.json();
      const data = responseData.assignments ?? [];

      // Cargar empleados desde la API (independientemente de si hay turnos)
      let sortedEmployees: ScheduleEmployee[] = [];
      if (employeeRes.ok) {
        const apiEmployees: (ScheduleEmployee & { userId?: string })[] = await employeeRes.json();
        sortedEmployees = apiEmployees
          .sort((a, b) => a.rotationOrder - b.rotationOrder)
          .map((e) => ({ ...e, userId: e.userId ?? null }));
      } else {
        // Fallback: extraer de asignaciones si la API falla
        const empMap = new Map<string, ScheduleEmployee>();
        data.forEach((a) => {
          if (a.employee && !empMap.has(a.employeeId)) {
            empMap.set(a.employeeId, a.employee);
          }
        });
        sortedEmployees = Array.from(empMap.values()).sort(
          (a, b) => a.rotationOrder - b.rotationOrder
        );
      }

      setEmployees(sortedEmployees);
      setAssignments(data);
      setMonthStatus(responseData.monthStatus ?? computeMonthStatus(data));
      setPublished(Boolean(responseData.published));

      // Filtrar festivos del mes actual
      if (holidayRes.ok) {
        const allHolidays: { date: string; description: string }[] = await holidayRes.json();
        const monthStr = String(month).padStart(2, "0");
        const prefix = `${year}-${monthStr}`;
        setHolidayDates(
          new Map(
            allHolidays
              .filter((h) => h.date.slice(0, 10).startsWith(prefix))
              .map((h) => [h.date.slice(0, 10), h.description])
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSchedule();
  }, [loadSchedule]);

  // ---------------------------------------------------------------------------
  // Navegación de mes
  // ---------------------------------------------------------------------------
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // ---------------------------------------------------------------------------
  // Clic en celda — normal o en modo prep
  // ---------------------------------------------------------------------------
  async function handleCellClick(employeeId: string, date: string, currentShift?: string) {
    // Modo preparación: asigna directamente V o D sin abrir el modal
    if (prepStep === "vacaciones" || prepStep === "libres") {
      const shiftType = prepStep === "vacaciones" ? "V" : "D";
      const cellKey = `${employeeId}|${date}`;

      const found = assignments.find(
        (a) => a.employeeId === employeeId && a.date.slice(0, 10) === date
      );
      const currentCellShift = found?.shiftType;

      if (currentCellShift === shiftType) {
        // Click 2+: la celda ya tiene el turno de prep → restaurar estado anterior
        const prevShift = prevShiftBeforePrep.get(cellKey);
        const restoreShift = prevShift ?? "D"; // default D si estaba vacía
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date, shiftType: restoreShift }),
        });
        // Limpiar el estado guardado para este cell
        setPrevShiftBeforePrep((prev) => {
          const next = new Map(prev);
          next.delete(cellKey);
          return next;
        });
      } else {
        // Click 1: la celda NO tiene el turno de prep → guardar estado actual y poner prep shift
        setPrevShiftBeforePrep((prev) => {
          const next = new Map(prev);
          next.set(cellKey, currentCellShift);
          return next;
        });
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date, shiftType }),
        });
      }
      await loadSchedule();
      return;
    }
    // Modo normal: abrir editor modal
    const found = assignments.find(
      (a) => a.employeeId === employeeId && a.date.slice(0, 10) === date
    );
    setEditingCell({ employeeId, date, currentShift, assignmentId: found?.id });
  }

  // ---------------------------------------------------------------------------
  // Guardar turno desde el editor
  // ---------------------------------------------------------------------------
  async function handleSaveShift(shiftType: string) {
    if (!editingCell) return;
    const { employeeId, date } = editingCell;

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, date, shiftType }),
    });
    if (res.ok) {
      showToast("Turno guardado", "success");
    } else {
      showToast("Error al guardar el turno", "error");
    }
    setEditingCell(null);
    await loadSchedule();
  }

  // ---------------------------------------------------------------------------
  // Eliminar turno desde el editor
  // ---------------------------------------------------------------------------
  async function handleDeleteShift() {
    if (!editingCell?.assignmentId) return;
    const res = await fetch(`/api/schedules?id=${editingCell.assignmentId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Turno eliminado", "success");
    } else {
      showToast("Error al eliminar el turno", "error");
    }
    setEditingCell(null);
    await loadSchedule();
  }

  // ---------------------------------------------------------------------------
  // Generación automática (con confirmación si ya hay datos)
  // ---------------------------------------------------------------------------
  const [generating, setGenerating] = useState(false);
  const [updatingPublication, setUpdatingPublication] = useState(false);

  const canPublish = canEdit;

  function requestGenerate() {
    if (monthStatus === "generated") {
      setShowConfirmGenerate(true);
    } else {
      void doGenerate();
    }
  }

  async function doGenerate() {
    setShowConfirmGenerate(false);
    setGenerating(true);
    try {
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) throw new Error();
      const { created } = await res.json();
      showToast(`Cuadrante generado — ${created} turnos asignados`, "success");
      await loadSchedule();
    } catch {
      showToast("Error al generar el cuadrante", "error");
    } finally {
      setGenerating(false);
    }
  }

  // Guardar preparación (marca el badge como "En preparación")
  function handleSavePreparation() {
    showToast("Preparación guardada", "success");
    // El estado ya refleja la preparación porque las celdas V/D existen en BD
    // Solo necesitamos recargar para asegurar el badge correcto
    void loadSchedule();
  }

  async function handleTogglePublication() {
    const nextPublished = !published;
    if (!nextPublished) {
      const confirmed = window.confirm("¿Despublicar el cuadrante de este mes?");
      if (!confirmed) return;
    }

    setUpdatingPublication(true);
    try {
      const res = await fetch("/api/schedules/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, published: nextPublished }),
      });
      if (!res.ok) throw new Error();
      const result: { published: boolean } = await res.json();
      setPublished(result.published);
      showToast(nextPublished ? "Cuadrante publicado" : "Cuadrante despublicado", nextPublished ? "success" : "warning");
      await loadSchedule();
    } catch {
      showToast("No se pudo actualizar la publicación", "error");
    } finally {
      setUpdatingPublication(false);
    }
  }

  // Cargar festivos automáticamente desde la API pública (nager.at) filtrada por CCAA
  // Solo ADMIN puede importar festivos
  async function handleAutoLoadHolidays() {
    setLoadingHolidays(true);
    try {
      const res = await fetch(`/api/holidays/public?year=${year}`);
      if (!res.ok) {
        showToast("No se pudieron cargar los festivos. Puedes añadirlos manualmente.", "error");
        return;
      }
      const publicHolidays: { date: string; description: string }[] = await res.json();

      // Filtrar solo los del mes actual
      const monthStr = String(month).padStart(2, "0");
      const monthHolidays = publicHolidays.filter((h) =>
        h.date.startsWith(`${year}-${monthStr}`)
      );

      if (monthHolidays.length === 0) {
        showToast("No hay festivos públicos este mes.", "info");
        return;
      }

      // Añadir los festivos a la BD (POST /api/holidays), ignorar duplicados (409)
      let added = 0;
      for (const h of monthHolidays) {
        const postRes = await fetch("/api/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: h.date, description: h.description }),
        });
        if (postRes.ok) added++;
        // 409 = ya existe, se ignora silenciosamente
      }

      if (added > 0) {
        showToast(`${added} festivo${added > 1 ? "s" : ""} añadido${added > 1 ? "s" : ""} correctamente`, "success");
        await loadSchedule(); // refresca contadores y holidayDates
      } else {
        showToast("Los festivos de este mes ya estaban registrados.", "info");
      }
    } catch {
      showToast("No se pudieron cargar los festivos. Puedes añadirlos manualmente.", "error");
    } finally {
      setLoadingHolidays(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Exportar CSV
  // ---------------------------------------------------------------------------
  function handleExportCSV() {
    if (employees.length === 0) {
      showToast("No hay datos que exportar", "info");
      return;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Cabecera
    const header = ["Empleado", ...days.map((d) => String(d))].join(",");

    // Filas
    const rows = employees.map((emp) => {
      const cells = days.map((day) => {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const a = assignments.find(
          (x) => x.employeeId === emp.id && x.date.slice(0, 10) === dateStr
        );
        return a ? a.shiftType : "";
      });
      return [emp.name, ...cells].join(",");
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cuadrante-${year}-${String(month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exportado", "success");
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  // Celdas bloqueadas por preparación manual (V manual o D manual)
  const lockedCells = new Set<string>(
    assignments
      .filter((a) => (a.shiftType === "V" || (a.shiftType === "D" && a.manual)))
      .map((a) => `${a.employeeId}|${a.date.slice(0, 10)}`)
  );
  const vacacionesCount = assignments.filter((a) => a.shiftType === "V").length;
  const libresCount = assignments.filter((a) => a.shiftType === "D" && a.manual).length;
  const bajasCount = assignments.filter((a) => a.shiftType === "B").length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 p-6">
        {/* Navegación de mes */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <button
            data-testid="btn-prev-month"
            onClick={prevMonth}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-lg"
          >
            ‹
          </button>
          <h2 className="text-xl font-semibold text-gray-800 min-w-[200px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            data-testid="btn-next-month"
            onClick={nextMonth}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-lg"
          >
            ›
          </button>
          {/* Badge de estado del mes */}
          {!loading && <MonthStatusBadge status={monthStatus} />}
          {canPublish && (
            <span
              data-testid="publication-status-badge"
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${published ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-600 border-gray-300"}`}
            >
              {published ? "Publicado" : "No publicado"}
            </span>
          )}
          {canEdit && prepStep && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1 print:hidden">
              Modo preparación — clic en celda para asignar {prepStep === "vacaciones" ? "V" : "D"}
            </span>
          )}
          {canEdit && !prepStep && (
            <span data-testid="edit-mode-banner" className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-1 print:hidden">
              Modo edición — clic en celda para asignar turno
            </span>
          )}
          <button
            data-testid="btn-export-csv"
            onClick={handleExportCSV}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors print:hidden"
          >
            Exportar CSV
          </button>
          <button
            data-testid="btn-print"
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors print:hidden"
          >
            Imprimir
          </button>
          {isAdmin && (
            <button
              data-testid="btn-holidays"
              onClick={() => router.push("/holidays")}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors print:hidden"
            >
              Festivos
            </button>
          )}
          {canPublish && (
            <button
              data-testid="btn-toggle-publication"
              onClick={handleTogglePublication}
              disabled={updatingPublication}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors print:hidden ${published ? "border-gray-200 bg-white hover:bg-gray-50 text-gray-700" : "border-green-200 bg-green-600 hover:bg-green-700 text-white"}`}
            >
              {updatingPublication ? "Actualizando..." : published ? "Despublicar" : "Publicar"}
            </button>
          )}
        </div>

        {/* Contenido principal: grid + panel de preparación */}
        <div className="flex gap-6 items-start">
          {/* Grid + contadores */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Cargando cuadrante...
              </div>
            ) : !canEdit && monthStatus === "unpublished" ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3 rounded-lg border border-dashed border-gray-200 bg-white" data-testid="unpublished-message">
                <span className="text-4xl">📭</span>
                <p className="text-base font-medium text-gray-600">Cuadrante no disponible aún</p>
              </div>
            ) : (
              <>
                <ScheduleGrid
                  year={year}
                  month={month}
                  employees={employees}
                  assignments={assignments}
                  holidayDates={holidayDates}
                  onCellClick={canEdit ? handleCellClick : undefined}
                  lockedCells={lockedCells}
                  allowLockedCellClick={canEdit && prepStep !== null}
                  currentUserId={session?.user?.id ?? null}
                />
                {employees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-4 items-start">
                    <CountersTable employees={employees} assignments={assignments} />
                    <ExtraPayTable employees={employees} assignments={assignments} month={month} />
                    <RatesLegend month={month} />
                  </div>
                )}
                {employees.length === 0 && monthStatus === "ungenerated" && (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2 mt-4">
                    <span className="text-4xl">📋</span>
                    <p className="text-sm">Sin turnos asignados este mes. Usa el panel para preparar y generar.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Panel de preparación (SUPER_ADMIN y PROJECT_ADMIN del proyecto activo) */}
          {canEdit && !loading && (
            <div className="w-56 flex-shrink-0 print:hidden">
              <PrepPanel
                monthStatus={monthStatus}
                activeStep={prepStep}
                onStepChange={setPrepStep}
                vacacionesCount={vacacionesCount}
                libresCount={libresCount}
                bajasCount={bajasCount}
                holidaysCount={holidayDates.size}
                onSavePreparation={handleSavePreparation}
                onGenerate={requestGenerate}
                generating={generating}
                isAdmin={isAdmin}
                onManageHolidays={() => router.push("/holidays")}
                onAutoLoadHolidays={handleAutoLoadHolidays}
                loadingHolidays={loadingHolidays}
              />
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-6 flex flex-wrap gap-3">
          {(["M","T","N","J","D","V","B"] as ShiftType[]).map((shift) => {
            const { color, textColor, label } = SHIFT_COLORS[shift];
            return (
              <div key={shift} className="flex items-center gap-1.5 text-sm">
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: color, color: textColor }}
                >
                  {shift}
                </span>
                <span className="text-gray-600">{label}</span>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal editor de turno */}
      {editingCell && (
        <ShiftEditor
          date={editingCell.date}
          currentShift={editingCell.currentShift}
          onSave={handleSaveShift}
          onDelete={editingCell.assignmentId ? handleDeleteShift : undefined}
          onClose={() => setEditingCell(null)}
        />
      )}

      {/* Modal de confirmación de generación */}
      {showConfirmGenerate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="confirm-generate-modal">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">¿Regenerar cuadrante?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Esto sobreescribirá las celdas no bloqueadas del mes. Las vacaciones, bajas y días libres marcados se conservarán. ¿Continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="btn-cancel-generate"
                onClick={() => setShowConfirmGenerate(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                data-testid="btn-confirm-generate"
                onClick={() => void doGenerate()}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Generar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
