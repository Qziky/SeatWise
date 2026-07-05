import { describe, expect, it } from "vitest";
import { createGridLayout } from "@/lib/layout";
import { defaultRuleConfig } from "@/lib/rules";
import { initialClassroom, sampleRules } from "@/lib/sample-data";
import { evaluatePlan, generateSeatingCandidates } from "@/lib/seating-engine";
import type { Student } from "@/lib/types";

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
});
