import type { RuleTemplate, SeatingRuleConfig } from "@/lib/types";

export const defaultRuleConfig: SeatingRuleConfig = {
  template: "vision",
  visionPriority: true,
  heightBlocking: true,
  genderMix: true,
  fairnessRotation: true,
  avoidDesk: true,
  relationships: []
};

export function applyRuleTemplate(
  current: SeatingRuleConfig,
  template: RuleTemplate
): SeatingRuleConfig {
  const base = { ...current, template };

  if (template === "vision") {
    return {
      ...base,
      visionPriority: true,
      heightBlocking: true,
      genderMix: true,
      fairnessRotation: true,
      avoidDesk: true
    };
  }

  if (template === "fairness") {
    return {
      ...base,
      visionPriority: true,
      heightBlocking: true,
      genderMix: false,
      fairnessRotation: true,
      avoidDesk: true
    };
  }

  if (template === "discipline") {
    return {
      ...base,
      visionPriority: true,
      heightBlocking: true,
      genderMix: true,
      fairnessRotation: false,
      avoidDesk: true
    };
  }

  if (template === "peer") {
    return {
      ...base,
      visionPriority: true,
      heightBlocking: true,
      genderMix: true,
      fairnessRotation: true,
      avoidDesk: true
    };
  }

  return {
    ...base,
    visionPriority: false,
    heightBlocking: false,
    genderMix: false,
    fairnessRotation: false,
    avoidDesk: true
  };
}
