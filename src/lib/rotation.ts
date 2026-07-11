import { describeSeat, getActiveSeats, getSeatById, isFrontHalf } from "@/lib/layout";
import type {
  ClassroomLayout,
  HistoryEntry,
  RotationDirection,
  RotationPattern,
  RotationPolicy,
  RotationStrictness,
  SeatCell,
  Student
} from "@/lib/types";

export const rotationPatternLabels: Record<RotationPattern, string> = {
  vertical: "竖向滚动",
  horizontal: "横向滚动",
  diagonal: "斜向滚动",
  serpentine: "蛇形回环"
};

export const rotationDirectionLabels: Record<RotationDirection, string> = {
  forward: "向前",
  backward: "向后",
  left: "向左",
  right: "向右",
  "down-right": "右后",
  "down-left": "左后",
  "up-right": "右前",
  "up-left": "左前"
};

export const rotationStrictnessLabels: Record<RotationStrictness, string> = {
  "policy-first": "制度优先",
  balanced: "均衡处理"
};

export const defaultRotationPolicy: RotationPolicy = {
  enabled: true,
  pattern: "vertical",
  direction: "backward",
  rounds: 1,
  periodDays: 7,
  stepRows: 1,
  stepColumns: 1,
  strictness: "policy-first"
};

export interface RotationTarget {
  studentId: string;
  fromSeatId: string;
  targetSeatId: string;
  fromSeat: SeatCell;
  targetSeat: SeatCell;
}

export interface RotationMatchStats {
  matched: number;
  total: number;
  rate: number;
  targets: Map<string, RotationTarget>;
}

const directionsByPattern: Record<RotationPattern, RotationDirection[]> = {
  vertical: ["backward", "forward"],
  horizontal: ["right", "left"],
  diagonal: ["down-right", "down-left", "up-right", "up-left"],
  serpentine: ["backward", "forward", "right", "left"]
};

const defaultDirectionByPattern: Record<RotationPattern, RotationDirection> = {
  vertical: "backward",
  horizontal: "right",
  diagonal: "down-right",
  serpentine: "backward"
};

export function getRotationDirections(pattern: RotationPattern) {
  return directionsByPattern[pattern];
}

export function getDefaultRotationDirection(pattern: RotationPattern) {
  return defaultDirectionByPattern[pattern];
}

export function normalizeRotationPolicy(policy?: Partial<RotationPolicy> | null): RotationPolicy {
  const next = { ...defaultRotationPolicy, ...(policy ?? {}) };
  const pattern = isRotationPattern(next.pattern) ? next.pattern : defaultRotationPolicy.pattern;
  const direction = directionsByPattern[pattern].includes(next.direction)
    ? next.direction
    : defaultDirectionByPattern[pattern];

  return {
    enabled: Boolean(next.enabled),
    pattern,
    direction,
    rounds: normalizeRoundCount(next.rounds),
    periodDays: clampInteger(next.periodDays, 1, 60),
    stepRows: clampInteger(next.stepRows, 1, 12),
    stepColumns: clampInteger(next.stepColumns, 1, 12),
    strictness: next.strictness === "balanced" ? "balanced" : "policy-first"
  };
}

export function describeRotationPolicy(policy?: Partial<RotationPolicy> | null) {
  const normalized = normalizeRotationPolicy(policy);
  if (!normalized.enabled) return "轮换未启用";

  return [
    rotationPatternLabels[normalized.pattern],
    rotationDirectionLabels[normalized.direction],
    `第 ${normalized.rounds} 轮`,
    `建议每 ${normalized.periodDays} 天`
  ].join(" · ");
}

export function getRotationTargets(args: {
  history: HistoryEntry[];
  layout: ClassroomLayout;
  policy?: Partial<RotationPolicy> | null;
  validStudentIds?: ReadonlySet<string>;
}) {
  const policy = normalizeRotationPolicy(args.policy);
  const latest = args.history.at(-1);
  const targets = new Map<string, RotationTarget>();

  if (!policy.enabled || !latest) return targets;

  const activeSeatById = new Map(getActiveSeats(args.layout).map((seat) => [seat.id, seat]));
  Object.entries(latest.plan.assignments).forEach(([fromSeatId, studentId]) => {
    if (!studentId || (args.validStudentIds && !args.validStudentIds.has(studentId))) return;
    const fromSeat = activeSeatById.get(fromSeatId);
    if (!fromSeat) return;
    const targetSeat = getNextSeat(args.layout, fromSeat, policy);
    if (!targetSeat) return;

    targets.set(studentId, {
      studentId,
      fromSeatId,
      targetSeatId: targetSeat.id,
      fromSeat,
      targetSeat
    });
  });

  return targets;
}

export function getRotationMatchStats(args: {
  assignments: Record<string, string | null>;
  history: HistoryEntry[];
  layout: ClassroomLayout;
  policy?: Partial<RotationPolicy> | null;
  validStudentIds?: ReadonlySet<string>;
}): RotationMatchStats {
  const targets = getRotationTargets(args);
  const seatByStudent = new Map<string, string>();

  Object.entries(args.assignments).forEach(([seatId, studentId]) => {
    if (studentId && (!args.validStudentIds || args.validStudentIds.has(studentId))) {
      seatByStudent.set(studentId, seatId);
    }
  });

  let matched = 0;
  targets.forEach((target) => {
    if (seatByStudent.get(target.studentId) === target.targetSeatId) matched += 1;
  });

  const total = targets.size;
  return {
    matched,
    total,
    rate: total ? Math.round((matched / total) * 100) : 100,
    targets
  };
}

export function getRotationDeviationTips(args: {
  assignments: Record<string, string | null>;
  history: HistoryEntry[];
  layout: ClassroomLayout;
  policy?: Partial<RotationPolicy> | null;
  students: Student[];
  validStudentIds?: ReadonlySet<string>;
  limit?: number;
}) {
  const policy = normalizeRotationPolicy(args.policy);
  if (!policy.enabled) return [];

  const validStudentIds = args.validStudentIds ?? new Set(args.students.map((student) => student.id));
  const stats = getRotationMatchStats({ ...args, validStudentIds });
  if (stats.total === 0) return [];

  const studentsById = new Map(args.students.map((student) => [student.id, student]));
  const actualSeatByStudent = new Map<string, SeatCell>();
  const activeSeatById = new Map(getActiveSeats(args.layout).map((seat) => [seat.id, seat]));

  Object.entries(args.assignments).forEach(([seatId, studentId]) => {
    if (!studentId || !validStudentIds.has(studentId)) return;
    const seat = activeSeatById.get(seatId);
    if (seat) actualSeatByStudent.set(studentId, seat);
  });

  const tips: string[] = [];
  stats.targets.forEach((target, studentId) => {
    const actualSeat = actualSeatByStudent.get(studentId);
    if (!actualSeat || actualSeat.id === target.targetSeatId) return;

    const student = studentsById.get(studentId);
    const name = student?.name ?? "学生";
    const reason = inferDeviationReason(student, target.targetSeat, actualSeat, args.layout);
    tips.push(`${name} 本轮应到${describeSeat(target.targetSeat)}，${reason}调整到${describeSeat(actualSeat)}。`);
  });

  return tips.slice(0, args.limit ?? 6);
}

function getNextSeat(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  if (policy.pattern === "serpentine") return getNextSeatByPath(layout, fromSeat, policy);
  return getNextSeatByDelta(layout, fromSeat, policy);
}

function getNextSeatByPath(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  const path = getSerpentinePath(getActiveSeats(layout));
  const index = path.findIndex((seat) => seat.id === fromSeat.id);
  if (index < 0 || path.length === 0) return undefined;

  const direction = pathDirection(policy.direction);
  const step = Math.max(policy.stepRows, policy.stepColumns);
  const effectiveRounds = policy.rounds % path.length;
  const targetIndex = wrapIndex(index + direction * step * effectiveRounds, path.length);
  return path[targetIndex];
}

function getNextSeatByDelta(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  const eligibleIds = new Set(getActiveSeats(layout).map((seat) => seat.id));
  if (!eligibleIds.has(fromSeat.id)) return undefined;
  const delta = getPatternDelta(layout, policy);

  return advanceSeatBySuccessor(fromSeat, policy.rounds, (seat) =>
    getNextEligibleDeltaSeat(layout, seat, delta, eligibleIds)
  );
}

function getNextEligibleDeltaSeat(
  layout: ClassroomLayout,
  fromSeat: SeatCell,
  delta: { row: number; column: number },
  eligibleIds: Set<string>
) {
  const maxAttempts = Math.max(1, layout.rows * layout.columns);
  let row = fromSeat.row;
  let column = fromSeat.column;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    row = wrapValue(row + delta.row, layout.rows);
    column = wrapValue(column + delta.column, layout.columns);
    const seat = getSeatById(layout, createSeatId(row, column));
    if (seat && eligibleIds.has(seat.id)) return seat;
  }

  return undefined;
}

function advanceSeatBySuccessor(
  fromSeat: SeatCell,
  rounds: number,
  getSuccessor: (seat: SeatCell) => SeatCell | undefined
) {
  const seenIndexBySeatId = new Map<string, number>();
  const sequence: SeatCell[] = [];
  let current: SeatCell | undefined = fromSeat;

  while (current) {
    if (rounds < sequence.length) return sequence[rounds];

    const repeatIndex = seenIndexBySeatId.get(current.id);
    if (repeatIndex !== undefined) {
      const cycleLength = sequence.length - repeatIndex;
      const targetIndex = repeatIndex + ((rounds - repeatIndex) % cycleLength);
      return sequence[targetIndex];
    }

    seenIndexBySeatId.set(current.id, sequence.length);
    sequence.push(current);
    current = getSuccessor(current);
  }

  return undefined;
}

function getPatternDelta(layout: ClassroomLayout, policy: RotationPolicy) {
  const axes = getPodiumAxes(layout);

  if (policy.pattern === "vertical") {
    const direction = policy.direction === "backward" ? 1 : -1;
    return scaleVector(axes.back, policy.stepRows * direction);
  }

  if (policy.pattern === "horizontal") {
    const direction = policy.direction === "right" ? 1 : -1;
    return scaleVector(axes.right, policy.stepColumns * direction);
  }

  const depthDirection = policy.direction.startsWith("down") ? 1 : -1;
  const lateralDirection = policy.direction.endsWith("right") ? 1 : -1;
  return addVectors(
    scaleVector(axes.back, policy.stepRows * depthDirection),
    scaleVector(axes.right, policy.stepColumns * lateralDirection)
  );
}

function getPodiumAxes(layout: ClassroomLayout) {
  if (layout.podium === "top") return { back: { row: 1, column: 0 }, right: { row: 0, column: 1 } };
  if (layout.podium === "bottom") return { back: { row: -1, column: 0 }, right: { row: 0, column: -1 } };
  if (layout.podium === "left") return { back: { row: 0, column: 1 }, right: { row: -1, column: 0 } };
  return { back: { row: 0, column: -1 }, right: { row: 1, column: 0 } };
}

function scaleVector(vector: { row: number; column: number }, factor: number) {
  return { row: vector.row * factor, column: vector.column * factor };
}

function addVectors(a: { row: number; column: number }, b: { row: number; column: number }) {
  return { row: a.row + b.row, column: a.column + b.column };
}

function getSerpentinePath(seats: SeatCell[]) {
  return [...seats].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.row % 2 === 1 ? a.column - b.column : b.column - a.column;
  });
}

function inferDeviationReason(
  student: Student | undefined,
  targetSeat: SeatCell,
  actualSeat: SeatCell,
  layout: ClassroomLayout
) {
  if (!student) return "因其他规则";
  if (student.vision === "severe" && !isFrontHalf(layout, targetSeat) && isFrontHalf(layout, actualSeat)) {
    return "因视力照顾";
  }
  if (student.specialNeeds && /靠前|听力|观察|反光/.test(student.specialNeeds)) return "因特殊需求";
  if (student.heightCm >= 168 && isFrontHalf(layout, targetSeat) && !isFrontHalf(layout, actualSeat)) {
    return "因身高遮挡";
  }
  return "因其他规则";
}

function pathDirection(direction: RotationDirection) {
  return ["backward", "right", "down-right", "down-left"].includes(direction) ? 1 : -1;
}

function createSeatId(row: number, column: number) {
  return `seat-r${row}-c${column}`;
}

function wrapIndex(index: number, size: number) {
  return ((index % size) + size) % size;
}

function wrapValue(value: number, size: number) {
  return wrapIndex(value - 1, size) + 1;
}

function clampInteger(value: number, min: number, max: number) {
  const next = Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(max, next));
}

function normalizeRoundCount(value: number) {
  if (!Number.isFinite(value)) return defaultRotationPolicy.rounds;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(value)));
}

function isRotationPattern(value: unknown): value is RotationPattern {
  return value === "vertical" || value === "horizontal" || value === "diagonal" || value === "serpentine";
}
