import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/export";
import { initialClassroom } from "@/lib/sample-data";
import type { SeatingPlan } from "@/lib/types";

describe("CSV export", () => {
  it("adds a UTF-8 BOM and neutralizes spreadsheet formulas", () => {
    const student = {
      ...initialClassroom.students[0],
      name: "=2+2",
      studentNo: "+SUM(1,1)"
    };
    const classroom = { ...initialClassroom, students: [student] };
    const seatId = classroom.layout.seats[0].id;
    const plan: SeatingPlan = {
      id: "plan",
      name: "方案 A",
      createdAt: "2026-07-11T00:00:00.000Z",
      assignments: { [seatId]: student.id },
      score: { total: 100, health: 100, height: 100, discipline: 100, gender: 100, fairness: 100, balance: 100 },
      satisfied: [],
      warnings: [],
      reviewTips: [],
      lockedSeatIds: [],
      lockedStudentIds: [],
      sourceRevision: 1,
      generationSeed: 1,
      feasibility: {
        status: "complete",
        assignedCount: 1,
        totalStudents: 1,
        unassignedStudentIds: [],
        hardViolations: []
      }
    };

    const csv = buildCsv({ mode: "teacher", classroom, plan });

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\"'=2+2\"");
    expect(csv).toContain("\"'+SUM(1,1)\"");
  });

  it("keeps teacher CSV empty-seat rows aligned with the ten-column header", () => {
    const classroom = { ...initialClassroom, students: [] };
    const seatId = classroom.layout.seats[0].id;
    const plan: SeatingPlan = {
      id: "empty-plan",
      name: "空座方案",
      createdAt: "2026-07-11T00:00:00.000Z",
      assignments: { [seatId]: null },
      score: { total: 0, health: 0, height: 0, discipline: 0, gender: 0, fairness: 0, balance: 0 },
      satisfied: [],
      warnings: [],
      reviewTips: [],
      lockedSeatIds: [],
      lockedStudentIds: [],
      sourceRevision: 1,
      generationSeed: 1,
      feasibility: {
        status: "complete",
        assignedCount: 0,
        totalStudents: 0,
        unassignedStudentIds: [],
        hardViolations: []
      }
    };

    const [, emptySeatRow] = buildCsv({ mode: "teacher", classroom, plan }).split("\r\n");

    expect(emptySeatRow.match(/,/g)).toHaveLength(9);
  });
});
