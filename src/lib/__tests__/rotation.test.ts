import { describe, expect, it } from "vitest";
import { createGridLayout } from "@/lib/layout";
import { defaultRuleConfig } from "@/lib/rules";
import { defaultRotationPolicy, getRotationMatchStats, getRotationTargets } from "@/lib/rotation";
import type { HistoryEntry, SeatingPlan } from "@/lib/types";

const emptyScore = {
  total: 0,
  health: 0,
  height: 0,
  discipline: 0,
  gender: 0,
  fairness: 0,
  balance: 0
};

function createHistory(
  assignments: Record<string, string | null>,
  layout = createGridLayout(6, 8, "top")
): HistoryEntry[] {
  const plan: SeatingPlan = {
    id: "plan-history",
    name: "历史方案",
    createdAt: "2026-07-01T00:00:00.000Z",
    assignments,
    score: emptyScore,
    satisfied: [],
    warnings: [],
    reviewTips: [],
    lockedSeatIds: [],
    lockedStudentIds: [],
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

  return [
    {
      id: "history",
      classId: "class",
      savedAt: "2026-07-01T00:00:00.000Z",
      plan,
      rules: defaultRuleConfig,
      adjustmentNote: "",
      layoutSnapshot: layout,
      layoutSignature: `${layout.rows}x${layout.columns}:${layout.podium}`,
      studentLabels: {}
    }
  ];
}

describe("rotation helpers", () => {
  it("moves seats vertically toward the back with wraparound", () => {
    const layout = createGridLayout(2, 2, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c1": "a",
        "seat-r2-c1": "b"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "vertical",
        direction: "backward"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r2-c1");
    expect(targets.get("b")?.targetSeatId).toBe("seat-r1-c1");
  });

  it("moves seats horizontally with wraparound", () => {
    const layout = createGridLayout(2, 2, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c2": "a"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "horizontal",
        direction: "right"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r1-c1");
  });

  it("moves seats diagonally with row and column wraparound", () => {
    const layout = createGridLayout(2, 2, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r2-c2": "a"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "diagonal",
        direction: "down-right"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r1-c1");
  });

  it("moves seats along a serpentine path", () => {
    const layout = createGridLayout(2, 3, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c3": "a"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "serpentine",
        direction: "backward"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r2-c3");
  });

  it("always skips seats marked empty", () => {
    const layout = createGridLayout(3, 2, "top");
    const seats = layout.seats.map((seat) =>
      seat.id === "seat-r2-c1" ? { ...seat, attributes: [...seat.attributes, "empty" as const] } : seat
    );
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c1": "a"
      }, { ...layout, seats }),
      layout: { ...layout, seats },
      policy: {
        ...defaultRotationPolicy,
        pattern: "vertical",
        direction: "backward"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r3-c1");
  });

  it("calculates multiple rounds without simulating every future seating plan", () => {
    const layout = createGridLayout(3, 2, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c1": "a"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "vertical",
        direction: "backward",
        rounds: 2
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r3-c1");
  });

  it("cycles through skipped empty seats across arbitrary rounds", () => {
    const layout = createGridLayout(3, 2, "top");
    const seats = layout.seats.map((seat) =>
      seat.id === "seat-r2-c1" ? { ...seat, attributes: [...seat.attributes, "empty" as const] } : seat
    );
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c1": "a"
      }, { ...layout, seats }),
      layout: { ...layout, seats },
      policy: {
        ...defaultRotationPolicy,
        pattern: "vertical",
        direction: "backward",
        rounds: 2
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r1-c1");
  });

  it("uses modular arithmetic for very large serpentine rounds", () => {
    const layout = createGridLayout(2, 3, "top");
    const targets = getRotationTargets({
      history: createHistory({
        "seat-r1-c1": "a"
      }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "serpentine",
        direction: "backward",
        rounds: 1_000_000
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe("seat-r2-c2");
  });

  it("returns no targets without saved history", () => {
    const layout = createGridLayout(2, 2, "top");
    const stats = getRotationMatchStats({
      assignments: {},
      history: [],
      layout,
      policy: defaultRotationPolicy
    });

    expect(stats.total).toBe(0);
    expect(stats.rate).toBe(100);
  });

  it("filters students that no longer exist from targets and statistics", () => {
    const layout = createGridLayout(2, 2, "top");
    const history = createHistory(
      {
        "seat-r1-c1": "active",
        "seat-r1-c2": "deleted"
      },
      layout
    );
    const validStudentIds = new Set(["active"]);
    const stats = getRotationMatchStats({
      assignments: { "seat-r2-c1": "active" },
      history,
      layout,
      policy: defaultRotationPolicy,
      validStudentIds
    });

    expect(stats.total).toBe(1);
    expect(stats.matched).toBe(1);
    expect(stats.targets.has("deleted")).toBe(false);
  });

  it.each([
    ["top", "seat-r3-c3"],
    ["bottom", "seat-r1-c1"],
    ["left", "seat-r1-c3"],
    ["right", "seat-r3-c1"]
  ] as const)("interprets diagonal directions relative to a %s podium", (podium, expectedSeatId) => {
    const layout = createGridLayout(3, 3, podium);
    const targets = getRotationTargets({
      history: createHistory({ "seat-r2-c2": "a" }, layout),
      layout,
      policy: {
        ...defaultRotationPolicy,
        pattern: "diagonal",
        direction: "down-right"
      }
    });

    expect(targets.get("a")?.targetSeatId).toBe(expectedSeatId);
  });
});
