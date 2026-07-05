import { describe, expect, it } from "vitest";
import { applyRuleTemplate, defaultRuleConfig } from "@/lib/rules";

describe("rule templates", () => {
  it("applies exam template with randomized seating preferences", () => {
    const rules = applyRuleTemplate(defaultRuleConfig, "exam");

    expect(rules.template).toBe("exam");
    expect(rules.visionPriority).toBe(false);
    expect(rules.heightBlocking).toBe(false);
    expect(rules.avoidDesk).toBe(true);
  });

  it("keeps relationships when switching templates", () => {
    const rules = applyRuleTemplate(
      {
        ...defaultRuleConfig,
        relationships: [
          {
            id: "rel-1",
            type: "avoid-desk",
            studentAId: "a",
            studentBId: "b",
            note: ""
          }
        ]
      },
      "fairness"
    );

    expect(rules.relationships).toHaveLength(1);
    expect(rules.fairnessRotation).toBe(true);
  });
});
