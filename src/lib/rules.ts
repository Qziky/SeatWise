import type { RuleTemplate, SeatingRuleConfig } from "@/lib/types";
import { defaultRotationPolicy, normalizeRotationPolicy } from "@/lib/rotation";

export const defaultRuleConfig: SeatingRuleConfig = {
  template: "vision",
  visionPriority: true,
  heightBlocking: true,
  genderMix: true,
  fairnessRotation: true,
  rotationPolicy: defaultRotationPolicy,
  avoidDesk: true,
  relationships: []
};

export function normalizeRuleConfig(rules?: Partial<SeatingRuleConfig> | null): SeatingRuleConfig {
  return {
    ...defaultRuleConfig,
    ...(rules ?? {}),
    rotationPolicy: normalizeRotationPolicy(rules?.rotationPolicy),
    relationships: rules?.relationships ?? []
  };
}

export function applyRuleTemplate(
  current: SeatingRuleConfig,
  template: RuleTemplate
): SeatingRuleConfig {
  const base = { ...normalizeRuleConfig(current), template };

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
