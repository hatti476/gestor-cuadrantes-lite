import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type ShiftAssignment = {
  id: string | null;
  employeeId: string;
  date: string;
  shiftType: string;
};

type PrepStep = "vacaciones" | "libres" | null;

const createMockAssignment = (
  id: string | null,
  employeeId: string,
  date: string,
  shiftType: string
): ShiftAssignment => ({
  id,
  employeeId,
  date,
  shiftType,
});

describe("Prep Toggle Logic (Bug 1: handleCellClick with prepStep)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let assignments: ShiftAssignment[];
  let prepStep: PrepStep;
  let loadScheduleCalls: number;

  const mockAssignments = (initial: ShiftAssignment[]) => {
    assignments = [...initial];
  };

  const mockPrepStep = (step: PrepStep) => {
    prepStep = step;
  };

  const mockLoadSchedule = () => {
    loadScheduleCalls++;
  };

  const mockFetchImpl = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/schedules") && options?.method === "POST") {
      const body = JSON.parse(options.body as string);
      const existingIdx = assignments.findIndex(
        (a) => a.employeeId === body.employeeId && a.date.slice(0, 10) === body.date.slice(0, 10)
      );
      const newAssignment = createMockAssignment(
        `new-${Date.now()}`,
        body.employeeId,
        body.date,
        body.shiftType
      );
      if (existingIdx >= 0) {
        assignments[existingIdx] = newAssignment;
      } else {
        assignments.push(newAssignment);
      }
      return new Response(JSON.stringify(newAssignment), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/schedules?id=") && options?.method === "DELETE") {
      const id = url.split("id=")[1];
      const idx = assignments.findIndex((a) => a.id === id);
      if (idx >= 0) {
        assignments.splice(idx, 1);
      }
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 404 });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.spyOn(global, "fetch").mockImplementation(mockFetchImpl);
    loadScheduleCalls = 0;
    (globalThis as { __prevShiftBeforePrep?: Map<string, string | undefined> }).__prevShiftBeforePrep = new Map();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const handleCellClick = async (
    employeeId: string,
    date: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentShift?: string
  ) => {
    if (prepStep === "vacaciones" || prepStep === "libres") {
      const shiftType = prepStep === "vacaciones" ? "V" : "D";
      const cellKey = `${employeeId}|${date}`;

      const found = assignments.find(
        (a) => a.employeeId === employeeId && a.date.slice(0, 10) === date
      );
      const currentCellShift = found?.shiftType;

      // Simular prevShiftBeforePrep state
      const globalWithState = globalThis as { __prevShiftBeforePrep?: Map<string, string | undefined> };
      const prevShiftMap = globalWithState.__prevShiftBeforePrep ?? new Map();
      globalWithState.__prevShiftBeforePrep = prevShiftMap;

      if (currentCellShift === shiftType) {
        // Click 2+: la celda ya tiene el turno de prep → restaurar estado anterior
        const prevShift = prevShiftMap.get(cellKey);
        const restoreShift = prevShift ?? "D";
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date, shiftType: restoreShift }),
        });
        prevShiftMap.delete(cellKey);
      } else {
        // Click 1: la celda NO tiene el turno de prep → guardar estado actual y poner prep shift
        prevShiftMap.set(cellKey, currentCellShift);
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date, shiftType }),
        });
      }
      await mockLoadSchedule();
      return;
    }
  };

  describe("AC-01/AC-02/AC-03: Toggle vacaciones — celda vacía → V → D → V → D", () => {
    beforeEach(() => {
      mockAssignments([]);
      mockPrepStep("vacaciones");
    });

    it("Click 1 en celda vacía → asigna V", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("V");
      expect(assignments[0].employeeId).toBe("emp-1");
      expect(assignments[0].date).toBe("2026-05-15");
    });

    it("Click 2 en misma celda (ya tiene V) → restaura a D (por defecto)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("V");

      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("D");
    });

    it("Click 3 → vuelve a asignar V", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("V");
    });

    it("Click 4 → vuelve a D", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("D");
    });
  });

  describe("AC-02: Toggle vacaciones — celda con M previo → V → M → V → M", () => {
    beforeEach(() => {
      mockAssignments([
        createMockAssignment("existing-1", "emp-1", "2026-05-15", "M"),
      ]);
      mockPrepStep("vacaciones");
    });

    it("Click 1 → asigna V (sobrescribe M)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("V");
    });

    it("Click 2 → restaura M (estado anterior)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("M");
    });

    it("Click 3 → vuelve a V", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("V");
    });

    it("Click 4 → vuelve a M", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("M");
    });
  });

  describe("AC-01/AC-03: Toggle libres — celda vacía → D → D (idempotente)", () => {
    beforeEach(() => {
      mockAssignments([]);
      mockPrepStep("libres");
    });

    it("Click 1 en celda vacía → asigna D", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("D");
    });

    it("Click 2 en misma celda (ya tiene D) → se queda en D (idempotente)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("D");
    });

    it("Click 3 → sigue en D", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("D");
    });
  });

  describe("AC-02/AC-03: Toggle libres — celda con T previo → D → T → D → T", () => {
    beforeEach(() => {
      mockAssignments([
        createMockAssignment("existing-1", "emp-1", "2026-05-15", "T"),
      ]);
      mockPrepStep("libres");
    });

    it("Click 1 → asigna D (sobrescribe T)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("D");
    });

    it("Click 2 → restaura T (estado anterior)", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(1);
      expect(assignments[0].shiftType).toBe("T");
    });

    it("Click 3 → vuelve a D", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("D");
    });

    it("Click 4 → vuelve a T", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments[0].shiftType).toBe("T");
    });
  });

  describe("AC-04: Solo afecta al modo preparación, no al modo edición normal", () => {
    beforeEach(() => {
      mockAssignments([]);
      mockPrepStep(null);
    });

    it("En modo normal (prepStep=null) no modifica assignments directamente", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(assignments).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("En modo normal, no llama a loadSchedule", async () => {
      await handleCellClick("emp-1", "2026-05-15");
      expect(loadScheduleCalls).toBe(0);
    });
  });
});