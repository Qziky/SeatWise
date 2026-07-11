import { describe, expect, it } from "vitest";
import { createGridLayout } from "@/lib/layout";
import { defaultRuleConfig } from "@/lib/rules";
import { defaultRotationPolicy, getRotationMatchStats } from "@/lib/rotation";
import { initialClassroom, sampleRules } from "@/lib/sample-data";
import { evaluatePlan, generateSeatingCandidates } from "@/lib/seating-engine";
import type {
  ClassroomLayout,
  HistoryEntry,
  SeatingPlan,
  SeatingRuleConfig,
  Student
} from "@/lib/types";

const disabledRules: SeatingRuleConfig = {
  ...defaultRuleConfig,
  template: "exam",
  visionPriority: false,
  heightBlocking: false,
  genderMix: false,
  fairnessRotation: false,
  avoidDesk: false,
  relationships: [],
  rotationPolicy: { ...defaultRotationPolicy, enabled: false }
};

describe("seating engine", () => {
  it("generates scored candidate plans with revision and feasibility metadata", () => {
    const plans = generateSeatingCandidates({
      students: initialClassroom.students,
      layout: initialClassroom.layout,
      rules: sampleRules,
      history: [],
      count: 3,
      sourceRevision: 7,
      seed: 42
    });

    expect(plans).toHaveLength(3);
    expect(plans[0].score.total).toBeGreaterThan(0);
    expect(plans[0].satisfied.length).toBeGreaterThan(0);
    expect(plans[0].sourceRevision).toBe(7);
    expect(plans[0].feasibility.status).toBe("complete");
    expect(plans[0].generationSeed).toEqual(expect.any(Number));
  });

  it("returns no plan when all seats are unavailable", () => {
    const layout = createGridLayout(2, 2, "top");
    const unavailableLayout = {
      ...layout,
      seats: layout.seats.map((seat) => ({ ...seat, attributes: [...seat.attributes, "empty" as const] }))
    };

    expect(
      generateSeatingCandidates({
        students: [createStudent("a")],
        layout: unavailableLayout,
        rules: disabledRules,
        history: []
      })
    ).toEqual([]);
  });

  it("rejects duplicate student IDs instead of assigning one student twice", () => {
    expect(() =>
      generateSeatingCandidates({
        students: [createStudent("duplicate"), createStudent("duplicate")],
        layout: createGridLayout(1, 2, "top"),
        rules: disabledRules,
        history: []
      })
    ).toThrow("学生 ID 必须唯一");
  });

  it("marks over-capacity plans partial and discounts total score by coverage", () => {
    const plans = generateSeatingCandidates({
      students: [createStudent("a"), createStudent("b")],
      layout: createGridLayout(1, 1, "top"),
      rules: disabledRules,
      history: [],
      count: 1,
      seed: 1
    });

    expect(plans[0].feasibility).toMatchObject({
      status: "partial",
      assignedCount: 1,
      totalStudents: 2
    });
    expect(plans[0].feasibility.unassignedStudentIds).toHaveLength(1);
    expect(plans[0].score.total).toBe(50);
  });

  it("keeps avoid-desk relations hard when a valid arrangement exists", () => {
    const students = ["a", "b", "c", "d"].map(createStudent);
    const rules: SeatingRuleConfig = {
      ...disabledRules,
      avoidDesk: true,
      relationships: [
        {
          id: "avoid-a-b",
          type: "avoid-desk",
          studentAId: "a",
          studentBId: "b",
          note: ""
        }
      ]
    };
    const plans = generateSeatingCandidates({
      students,
      layout: createGridLayout(1, 4, "top"),
      rules,
      history: [],
      count: 3,
      seed: 5
    });

    expect(plans).toHaveLength(3);
    plans.forEach((plan) => {
      expect(plan.feasibility.hardViolations).toEqual([]);
      expect(plan.warnings.join(" ")).not.toContain("不能同桌");
      expect(areDeskMates(plan.assignments, "a", "b")).toBe(false);
    });
  });

  it("finds a multi-step hard-constraint arrangement around independent locks", () => {
    const students = Array.from({ length: 8 }, (_, index) => createStudent(String(index)));
    const allowedPairs = new Set(["0:1", "2:4", "3:6", "5:7"]);
    const relationships = [];
    for (let first = 0; first < students.length; first += 1) {
      for (let second = first + 1; second < students.length; second += 1) {
        if (allowedPairs.has(`${first}:${second}`)) continue;
        relationships.push({
          id: `avoid-${first}-${second}`,
          type: "avoid-desk" as const,
          studentAId: String(first),
          studentBId: String(second),
          note: ""
        });
      }
    }
    const currentPlan = createPlan(
      {
        "seat-r1-c1": "4",
        "seat-r1-c2": "1",
        "seat-r1-c3": "2",
        "seat-r1-c4": "0",
        "seat-r1-c5": "3",
        "seat-r1-c6": "5",
        "seat-r1-c7": "6",
        "seat-r1-c8": "7"
      },
      { lockedStudentIds: ["1"], lockedSeatIds: ["seat-r1-c3"] }
    );
    const plans = generateSeatingCandidates({
      students,
      layout: createGridLayout(1, 8, "top"),
      rules: { ...disabledRules, avoidDesk: true, relationships },
      history: [],
      currentPlan,
      count: 3,
      seed: 2026
    });

    expect(plans.length).toBeGreaterThan(0);
    plans.forEach((plan) => {
      expect(plan.feasibility.hardViolations).toEqual([]);
      expect(plan.assignments["seat-r1-c2"]).toBe("1");
      expect(plan.assignments["seat-r1-c3"]).toBe("2");
    });
  });

  it("reports an unavoidable hard relationship conflict", () => {
    const layout = createGridLayout(1, 2, "top");
    const students = [createStudent("a"), createStudent("b")];
    const assignments = { "seat-r1-c1": "a", "seat-r1-c2": "b" };
    const result = evaluatePlan(assignments, {
      students,
      layout,
      rules: {
        ...disabledRules,
        avoidDesk: true,
        relationships: [
          {
            id: "rel",
            type: "avoid-desk",
            studentAId: "a",
            studentBId: "b",
            note: ""
          }
        ]
      },
      history: []
    });

    expect(result.warnings.join("")).toContain("不能同桌");
    expect(result.feasibility.status).toBe("partial");
    expect(result.feasibility.hardViolations).toHaveLength(1);
    expect(result.score.discipline).toBeLessThan(100);
  });

  it("preserves student and seat locks independently during regeneration", () => {
    const layout = createGridLayout(2, 2, "top");
    const students = ["a", "b", "c", "d"].map(createStudent);
    const assignments = {
      "seat-r1-c1": "a",
      "seat-r1-c2": "b",
      "seat-r2-c1": "c",
      "seat-r2-c2": "d"
    };
    const studentLockedPlan = createPlan(assignments, {
      lockedStudentIds: ["a"],
      lockedSeatIds: []
    });
    const seatLockedPlan = createPlan(assignments, {
      lockedStudentIds: [],
      lockedSeatIds: ["seat-r1-c1"]
    });

    const studentLocked = generateSeatingCandidates({
      students,
      layout,
      rules: disabledRules,
      history: [],
      currentPlan: studentLockedPlan,
      count: 2,
      seed: 10
    });
    const seatLocked = generateSeatingCandidates({
      students,
      layout,
      rules: disabledRules,
      history: [],
      currentPlan: seatLockedPlan,
      count: 2,
      seed: 11
    });

    studentLocked.forEach((plan) => {
      expect(plan.assignments["seat-r1-c1"]).toBe("a");
      expect(plan.lockedStudentIds).toEqual(["a"]);
      expect(plan.lockedSeatIds).toEqual([]);
    });
    seatLocked.forEach((plan) => {
      expect(plan.assignments["seat-r1-c1"]).toBe("a");
      expect(plan.lockedSeatIds).toEqual(["seat-r1-c1"]);
      expect(plan.lockedStudentIds).toEqual([]);
    });
  });

  it("produces reproducible candidates from the same seed and variation from another seed", () => {
    const input = {
      students: Array.from({ length: 8 }, (_, index) => createStudent(String(index))),
      layout: createGridLayout(2, 4, "top"),
      rules: disabledRules,
      history: [],
      count: 3
    };
    const first = generateSeatingCandidates({ ...input, seed: 123 });
    const repeated = generateSeatingCandidates({ ...input, seed: 123 });
    const different = generateSeatingCandidates({ ...input, seed: 456 });

    expect(first.map((plan) => plan.assignments)).toEqual(repeated.map((plan) => plan.assignments));
    expect(first.map((plan) => plan.assignments)).not.toEqual(different.map((plan) => plan.assignments));
  });

  it("spreads under-capacity classes instead of filling only the first rows", () => {
    const plans = generateSeatingCandidates({
      students: Array.from({ length: 6 }, (_, index) => createStudent(String(index))),
      layout: createGridLayout(6, 6, "top"),
      rules: disabledRules,
      history: [],
      count: 1,
      seed: 7
    });
    const occupiedRows = new Set(
      Object.entries(plans[0].assignments)
        .filter(([, studentId]) => Boolean(studentId))
        .map(([seatId]) => Number(/seat-r(\d+)-/.exec(seatId)?.[1]))
    );

    expect(occupiedRows.size).toBeGreaterThanOrEqual(4);
  });

  it("does not emit disabled-rule warnings or review tips", () => {
    const layout = createGridLayout(2, 2, "top");
    const students = [
      { ...createStudent("a"), vision: "severe" as const, specialNeeds: "必须靠前" },
      createStudent("b")
    ];
    const assignments = { "seat-r2-c1": "a", "seat-r2-c2": "b" };
    const rules: SeatingRuleConfig = {
      ...disabledRules,
      relationships: [
        {
          id: "rel",
          type: "avoid-desk",
          studentAId: "a",
          studentBId: "b",
          note: ""
        }
      ]
    };
    const result = evaluatePlan(assignments, { students, layout, rules, history: [] });

    expect(result.warnings).toEqual([]);
    expect(result.reviewTips).toEqual([]);
    expect(result.feasibility.hardViolations).toEqual([]);
  });

  it("excludes unknown genders from the gender-mix denominator", () => {
    const layout = createGridLayout(1, 2, "top");
    const students = [createStudent("a"), createStudent("b")];
    const result = evaluatePlan(
      { "seat-r1-c1": "a", "seat-r1-c2": "b" },
      {
        students,
        layout,
        rules: { ...disabledRules, genderMix: true },
        history: []
      }
    );

    expect(result.score.gender).toBe(100);
  });

  it("prefers policy-first rotation targets when saved history exists", () => {
    const layout = createGridLayout(2, 2, "top");
    const students = ["a", "b", "c", "d"].map(createStudent);
    const history = createHistory(
      {
        "seat-r1-c1": "a",
        "seat-r1-c2": "b",
        "seat-r2-c1": "c",
        "seat-r2-c2": "d"
      },
      layout
    );
    const rules: SeatingRuleConfig = {
      ...disabledRules,
      fairnessRotation: true,
      rotationPolicy: {
        ...defaultRotationPolicy,
        pattern: "vertical",
        direction: "backward",
        strictness: "policy-first"
      }
    };

    const plans = generateSeatingCandidates({ students, layout, rules, history, count: 3, seed: 99 });
    const stats = getRotationMatchStats({
      assignments: plans[0].assignments,
      history,
      layout,
      policy: rules.rotationPolicy,
      validStudentIds: new Set(students.map((student) => student.id))
    });

    expect(stats.matched).toBeGreaterThanOrEqual(3);
    expect(plans[0].score.fairness).toBeGreaterThanOrEqual(80);
  });

  it("generates a 144-student plan within the performance budget", () => {
    const startedAt = performance.now();
    const plans = generateSeatingCandidates({
      students: Array.from({ length: 144 }, (_, index) => createStudent(String(index))),
      layout: createGridLayout(12, 12, "top"),
      rules: disabledRules,
      history: [],
      count: 3,
      seed: 144
    });
    const elapsed = performance.now() - startedAt;

    expect(plans[0].feasibility.assignedCount).toBe(144);
    expect(elapsed).toBeLessThan(500);
  });
});

const emptyScore = {
  total: 0,
  health: 0,
  height: 0,
  discipline: 0,
  gender: 0,
  fairness: 0,
  balance: 0
};

function createStudent(id: string, index = Number(id) || 0): Student {
  return {
    id,
    name: `学生${id}`,
    studentNo: String(index + 1).padStart(3, "0"),
    gender: "未填",
    heightCm: 155,
    vision: "normal",
    tags: [],
    remark: "",
    specialNeeds: ""
  };
}

function createPlan(
  assignments: Record<string, string | null>,
  locks: Pick<SeatingPlan, "lockedStudentIds" | "lockedSeatIds">
): SeatingPlan {
  return {
    id: "plan-history",
    name: "历史方案",
    createdAt: "2026-07-01T00:00:00.000Z",
    assignments,
    score: emptyScore,
    satisfied: [],
    warnings: [],
    reviewTips: [],
    ...locks,
    sourceRevision: 0,
    generationSeed: 1,
    feasibility: {
      status: "complete",
      assignedCount: Object.values(assignments).filter(Boolean).length,
      totalStudents: Object.values(assignments).filter(Boolean).length,
      unassignedStudentIds: [],
      hardViolations: []
    }
  };
}

function createHistory(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout
): HistoryEntry[] {
  return [
    {
      id: "history",
      classId: "class",
      savedAt: "2026-07-01T00:00:00.000Z",
      plan: createPlan(assignments, { lockedSeatIds: [], lockedStudentIds: [] }),
      rules: defaultRuleConfig,
      adjustmentNote: "",
      layoutSnapshot: layout,
      layoutSignature: `${layout.rows}x${layout.columns}:${layout.podium}`,
      studentLabels: {}
    }
  ];
}

function areDeskMates(assignments: Record<string, string | null>, first: string, second: string) {
  const firstSeat = Object.entries(assignments).find(([, studentId]) => studentId === first)?.[0];
  const secondSeat = Object.entries(assignments).find(([, studentId]) => studentId === second)?.[0];
  if (!firstSeat || !secondSeat) return false;
  const parse = (seatId: string) => {
    const match = /seat-r(\d+)-c(\d+)/.exec(seatId);
    return { row: Number(match?.[1]), column: Number(match?.[2]) };
  };
  const a = parse(firstSeat);
  const b = parse(secondSeat);
  return a.row === b.row && Math.floor((a.column - 1) / 2) === Math.floor((b.column - 1) / 2);
}
