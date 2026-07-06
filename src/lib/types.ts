export type Gender = "男" | "女" | "未填";

export type VisionStatus = "normal" | "mild" | "severe" | "unknown";

export type SeatAttribute =
  | "window"
  | "door"
  | "glare"
  | "back"
  | "edge"
  | "empty";

export type PodiumDirection = "top" | "bottom" | "left" | "right";

export type RuleTemplate =
  | "vision"
  | "fairness"
  | "discipline"
  | "peer"
  | "exam";

export type RelationshipRuleType = "avoid-desk" | "keep-apart";

export type ViewMode = "teacher" | "student" | "print";

export type ExportFormat = "pdf" | "image" | "excel";

export type RotationPattern = "vertical" | "horizontal" | "diagonal" | "serpentine";

export type RotationDirection =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

export type RotationStrictness = "policy-first" | "balanced";

export interface RotationPolicy {
  enabled: boolean;
  pattern: RotationPattern;
  direction: RotationDirection;
  rounds: number;
  periodDays: number;
  stepRows: number;
  stepColumns: number;
  strictness: RotationStrictness;
  skipEmptySeats: boolean;
}

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  gender: Gender;
  heightCm: number;
  vision: VisionStatus;
  tags: string[];
  remark: string;
  specialNeeds: string;
}

export interface SeatCell {
  id: string;
  row: number;
  column: number;
  attributes: SeatAttribute[];
  locked?: boolean;
}

export interface ClassroomLayout {
  rows: number;
  columns: number;
  podium: PodiumDirection;
  seats: SeatCell[];
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  term: string;
  layout: ClassroomLayout;
  students: Student[];
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipRule {
  id: string;
  type: RelationshipRuleType;
  studentAId: string;
  studentBId: string;
  note: string;
}

export interface SeatingRuleConfig {
  template: RuleTemplate;
  visionPriority: boolean;
  heightBlocking: boolean;
  genderMix: boolean;
  fairnessRotation: boolean;
  rotationPolicy: RotationPolicy;
  avoidDesk: boolean;
  relationships: RelationshipRule[];
}

export interface PlanScore {
  total: number;
  health: number;
  height: number;
  discipline: number;
  gender: number;
  fairness: number;
  balance: number;
}

export interface SeatingPlan {
  id: string;
  name: string;
  createdAt: string;
  assignments: Record<string, string | null>;
  score: PlanScore;
  satisfied: string[];
  warnings: string[];
  reviewTips: string[];
  lockedSeatIds: string[];
  lockedStudentIds: string[];
}

export interface HistoryEntry {
  id: string;
  classId: string;
  savedAt: string;
  plan: SeatingPlan;
  rules: SeatingRuleConfig;
  adjustmentNote: string;
}

export interface ParsedStudentImport {
  rows: Student[];
  rejected: string[];
  detectedHeaders: string[];
}

export interface VisibleStudent {
  id: string;
  name: string;
  studentNo: string;
  gender: Gender;
  heightCm?: number;
  vision?: VisionStatus;
  tags?: string[];
  remark?: string;
  specialNeeds?: string;
}

export const seatAttributeLabels: Record<SeatAttribute, string> = {
  window: "靠窗",
  door: "靠门",
  glare: "反光",
  back: "后排",
  edge: "边缘",
  empty: "空座"
};

export const visionLabels: Record<VisionStatus, string> = {
  normal: "正常",
  mild: "轻度关注",
  severe: "重点照顾",
  unknown: "未填"
};

export const ruleTemplateLabels: Record<RuleTemplate, string> = {
  vision: "视力优先",
  fairness: "公平轮换",
  discipline: "纪律稳定",
  peer: "学习互助",
  exam: "考试随机"
};
