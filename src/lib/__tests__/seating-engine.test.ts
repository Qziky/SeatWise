import { describe, expect, it } from "vitest";
import { createGridLayout } from "@/lib/layout";
import { defaultRuleConfig } from "@/lib/rules";
import { defaultRotationPolicy, getRotationMatchStats } from "@/lib/rotation";
import { initialClassroom, sampleRules } from "@/lib/sample-data";
import { evaluatePlan, generateSeatingCandidates } from "@/lib/seating-engine";
import type { HistoryEntry, SeatingPlan, Student } from "@/lib/types";

describe("seating engine", () => {
  it("generates at least three scored candidate plans", () => {
    const plans = generateSeatingCandidates({
      students: initialClassroom.students,
      layout: initialClassroom.layout,
      rules: sampleRules,
      history: [],
      count: 3
    });

    expect(plans).toHaveLength(3);
    expect(plans[0].score.total).toBeGreaterThan(0);
    expect(plans[0].satisfied.length).toBeGreaterThan(0);
  });

  it("explains relationship conflicts when a hard relation cannot be satisfied", () => {
    const layout = createGridLayout(1, 2, "top");
    const students: Student[] = [
      {
        id: "a",
        name: "学生A",
        studentNo: "01",
        gender: "男",
        heightCm: 150,
        vision: "normal",
        tags: [],
        remark: "",
        specialNeeds: ""
      },
      {
        id: "b",
        name: "学生B",
        studentNo: "02",
        gender: "女",
        heightCm: 150,
        vision: "normal",
        tags: [],
        remark: "",
        specialNeeds: ""
      }
    ];
    const assignments = {
      "seat-r1-c1": "a",
      "seat-r1-c2": "b"
    };
    const result = evaluatePlan(assignments, {
      students,
      layout,
      rules: {
        ...defaultRuleConfig,
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
    expect(result.score.discipline).toBeLessThan(100);
  });

  it("prefers policy-first rotation targets when saved history exists", () => {
    const layout = createGridLayout(2, 2, "top");
    const students: Student[] = ["a", "b", "c", "d"].map((id, index) => ({
      id,
      name: `学生${id}`,
      studentNo: String(index + 1).padStart(2, "0"),
      gender: "未填",
      heightCm: 155,
      vision: "normal",
      tags: [],
      remark: "",
      specialNeeds: ""
    }));
    const history = createHistory({
      "seat-r1-c1": "a",
      "seat-r1-c2": "b",
      "seat-r2-c1": "c",
      "seat-r2-c2": "d"
    });
    const rules = {
      ...defaultRuleConfig,
      visionPriority: false,
      heightBlocking: false,
      genderMix: false,
      avoidDesk: false,
      relationships: [],
      rotationPolicy: {
        ...defaultRotationPolicy,
        pattern: "vertical" as const,
        direction: "backward" as const,
        strictness: "policy-first" as const
      }
    };

    const plans = generateSeatingCandidates({
      students,
      layout,
      rules,
      history,
      count: 3
    });
    const stats = getRotationMatchStats({
      assignments: plans[0].assignments,
      history,
      layout,
      policy: rules.rotationPolicy
    });

    expect(stats.matched).toBeGreaterThanOrEqual(3);
    expect(plans[0].score.fairness).toBeGreaterThanOrEqual(80);
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

function createHistory(assignments: Record<string, string | null>): HistoryEntry[] {
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
    lockedStudentIds: []
  };

  return [
    {
      id: "history",
      classId: "class",
      savedAt: "2026-07-01T00:00:00.000Z",
      plan,
      rules: defaultRuleConfig,
      adjustmentNote: ""
    }
  ];
}
