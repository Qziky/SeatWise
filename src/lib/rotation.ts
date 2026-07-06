import {
  describeSeat,
  getActiveSeats,
  getSeatById,
  isFrontHalf
} from "@/lib/layout";
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
  strictness: "policy-first",
  skipEmptySeats: true
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
  const next = {
    ...defaultRotationPolicy,
    ...(policy ?? {})
  };
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
    strictness: next.strictness === "balanced" ? "balanced" : "policy-first",
    skipEmptySeats: next.skipEmptySeats !== false
  };
}

export function describeRotationPolicy(policy?: Partial<RotationPolicy> | null) {
  const normalized = normalizeRotationPolicy(policy);
  if (!normalized.enabled) return "轮换未启用";

  return [
    rotationPatternLabels[normalized.pattern],
    rotationDirectionLabels[normalized.direction],
    `第 ${normalized.rounds} 轮`,
    `${normalized.periodDays} 天/次`
  ].join(" · ");
}

export function getRotationTargets(args: {
  history: HistoryEntry[];
  layout: ClassroomLayout;
  policy?: Partial<RotationPolicy> | null;
}) {
  const policy = normalizeRotationPolicy(args.policy);
  const latest = args.history.at(-1);
  const targets = new Map<string, RotationTarget>();

  if (!policy.enabled || !latest) return targets;

  Object.entries(latest.plan.assignments).forEach(([fromSeatId, studentId]) => {
    if (!studentId) return;
    const fromSeat = getSeatById(args.layout, fromSeatId);
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
}): RotationMatchStats {
  const targets = getRotationTargets({
    history: args.history,
    layout: args.layout,
    policy: args.policy
  });
  const seatByStudent = new Map<string, string>();

  Object.entries(args.assignments).forEach(([seatId, studentId]) => {
    if (studentId) seatByStudent.set(studentId, seatId);
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
  limit?: number;
}) {
  const policy = normalizeRotationPolicy(args.policy);
  if (!policy.enabled) return [];

  const stats = getRotationMatchStats(args);
  if (stats.total === 0) return [];

  const studentsById = new Map(args.students.map((student) => [student.id, student]));
  const actualSeatByStudent = new Map<string, SeatCell>();

  Object.entries(args.assignments).forEach(([seatId, studentId]) => {
    if (!studentId) return;
    const seat = getSeatById(args.layout, seatId);
    if (seat) actualSeatByStudent.set(studentId, seat);
  });

  const tips: string[] = [];
  stats.targets.forEach((target, studentId) => {
    const actualSeat = actualSeatByStudent.get(studentId);
    if (!actualSeat || actualSeat.id === target.targetSeatId) return;

    const student = studentsById.get(studentId);
    const name = student?.name ?? "学生";
    const reason = inferDeviationReason(student, target.targetSeat, actualSeat, args.layout);
    tips.push(
      `${name} 本轮应到${describeSeat(target.targetSeat)}，${reason}调整到${describeSeat(actualSeat)}。`
    );
  });

  return tips.slice(0, args.limit ?? 6);
}

function getNextSeat(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  if (policy.pattern === "serpentine") return getNextSeatByPath(layout, fromSeat, policy);
  return getNextSeatByDelta(layout, fromSeat, policy);
}

function getNextSeatByPath(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  const seats = getEligibleSeats(layout, policy);
  const path = getSerpentinePath(seats);
  const index = path.findIndex((seat) => seat.id === fromSeat.id);
  if (index < 0 || path.length === 0) return undefined;

  const direction = pathDirection(policy.direction);
  const step = Math.max(policy.stepRows, policy.stepColumns);
  const effectiveRounds = policy.rounds % path.length;
  const targetIndex = wrapIndex(index + direction * step * effectiveRounds, path.length);
  return path[targetIndex];
}

function getNextSeatByDelta(layout: ClassroomLayout, fromSeat: SeatCell, policy: RotationPolicy) {
  const eligibleIds = new Set(getEligibleSeats(layout, policy).map((seat) => seat.id));
  const delta = getPatternDelta(layout, policy);
  if (!eligibleIds.has(fromSeat.id)) return undefined;

  if (policy.skipEmptySeats) {
    return advanceSeatBySuccessor(fromSeat, policy.rounds, (seat) =>
      getNextEligibleDeltaSeat(layout, seat, delta, eligibleIds)
    );
  }

  const rowCycle = delta.row === 0 ? 1 : layout.rows / greatestCommonDivisor(Math.abs(delta.row), layout.rows);
  const columnCycle = delta.column === 0 ? 1 : layout.columns / greatestCommonDivisor(Math.abs(delta.column), layout.columns);
  const effectiveRounds = policy.rounds % leastCommonMultiple(rowCycle, columnCycle);
  const row = wrapValue(fromSeat.row + delta.row * effectiveRounds, layout.rows);
  const column = wrapValue(fromSeat.column + delta.column * effectiveRounds, layout.columns);
  return getSeatById(layout, createSeatId(row, column));
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
  if (policy.pattern === "vertical") {
    const step = layout.podium === "top" || layout.podium === "bottom" ? policy.stepRows : policy.stepColumns;
    if (layout.podium === "top") return { row: policy.direction === "backward" ? step : -step, column: 0 };
    if (layout.podium === "bottom") return { row: policy.direction === "backward" ? -step : step, column: 0 };
    if (layout.podium === "left") return { row: 0, column: policy.direction === "backward" ? step : -step };
    return { row: 0, column: policy.direction === "backward" ? -step : step };
  }

  if (policy.pattern === "horizontal") {
    return { row: 0, column: policy.direction === "left" ? -policy.stepColumns : policy.stepColumns };
  }

  const row = policy.direction.startsWith("down") ? policy.stepRows : -policy.stepRows;
  const column = policy.direction.endsWith("right") ? policy.stepColumns : -policy.stepColumns;
  return { row, column };
}

function getEligibleSeats(layout: ClassroomLayout, policy: RotationPolicy) {
  return policy.skipEmptySeats ? getActiveSeats(layout) : layout.seats;
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
  if (student.specialNeeds && /靠前|听力|观察|反光/.test(student.specialNeeds)) {
    return "因特殊需求";
  }
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

function greatestCommonDivisor(a: number, b: number): number {
  let x = a;
  let y = b;

  while (y !== 0) {
    [x, y] = [y, x % y];
  }

  return Math.max(1, x);
}

function leastCommonMultiple(a: number, b: number) {
  return (a * b) / greatestCommonDivisor(a, b);
}

function isRotationPattern(value: unknown): value is RotationPattern {
  return value === "vertical" || value === "horizontal" || value === "diagonal" || value === "serpentine";
}
