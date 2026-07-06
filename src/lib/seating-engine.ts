import {
  describeSeat,
  getActiveSeats,
  getBackRank,
  getFrontRank,
  getFrontSpan,
  getSeatById,
  isBackSeat,
  isDeskMate,
  isFrontHalf,
  isNearSeat
} from "@/lib/layout";
import {
  getRotationDeviationTips,
  getRotationMatchStats,
  getRotationTargets,
  normalizeRotationPolicy
} from "@/lib/rotation";
import type { RotationTarget } from "@/lib/rotation";
import type {
  ClassroomLayout,
  HistoryEntry,
  PlanScore,
  RelationshipRule,
  SeatingPlan,
  SeatingRuleConfig,
  SeatCell,
  Student
} from "@/lib/types";

export interface GenerateSeatingInput {
  students: Student[];
  layout: ClassroomLayout;
  rules: SeatingRuleConfig;
  history: HistoryEntry[];
  currentPlan?: SeatingPlan | null;
  count?: number;
}

interface EvaluationResult {
  score: PlanScore;
  satisfied: string[];
  warnings: string[];
  reviewTips: string[];
}

const templateWeights = {
  vision: { health: 0.28, height: 0.18, discipline: 0.18, gender: 0.1, fairness: 0.18, balance: 0.08 },
  fairness: { health: 0.18, height: 0.15, discipline: 0.15, gender: 0.08, fairness: 0.36, balance: 0.08 },
  discipline: { health: 0.18, height: 0.15, discipline: 0.34, gender: 0.1, fairness: 0.15, balance: 0.08 },
  peer: { health: 0.16, height: 0.14, discipline: 0.18, gender: 0.16, fairness: 0.18, balance: 0.18 },
  exam: { health: 0.1, height: 0.1, discipline: 0.35, gender: 0.05, fairness: 0.1, balance: 0.3 }
} satisfies Record<SeatingRuleConfig["template"], Record<keyof Omit<PlanScore, "total">, number>>;

export function generateSeatingCandidates(input: GenerateSeatingInput): SeatingPlan[] {
  const count = input.count ?? 3;
  const activeSeats = getActiveSeats(input.layout);
  const locked = getLockedAssignments(input.currentPlan);
  const lockedStudentIds = new Set(Object.values(locked).filter(Boolean) as string[]);
  const lockedSeatIds = new Set(Object.keys(locked));
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const remainingStudents = input.students.filter((student) => !lockedStudentIds.has(student.id));
  const remainingSeats = activeSeats.filter((seat) => !lockedSeatIds.has(seat.id));
  const rotationTargets = getRotationTargets({
    history: input.history,
    layout: input.layout,
    policy: input.rules.rotationPolicy
  });
  const plans: SeatingPlan[] = [];

  for (let attempt = 0; attempt < Math.max(count * 4, 12); attempt += 1) {
    const assignments = initializeAssignments(activeSeats);

    Object.entries(locked).forEach(([seatId, studentId]) => {
      if (studentId && studentsById.has(studentId)) {
        assignments[seatId] = studentId;
      }
    });

    const randomizedStudents = shuffle(remainingStudents, attempt + 11);
    const orderedSeats = orderSeatsForTemplate(input.layout, remainingSeats, input.rules, attempt);
    const available = [...randomizedStudents];

    orderedSeats.forEach((seat, seatIndex) => {
      if (available.length === 0) return;
      const candidate = chooseStudentForSeat({
        students: available,
        seat,
        assignments,
        layout: input.layout,
        rules: input.rules,
        history: input.history,
        rotationTargets,
        seed: attempt * 31 + seatIndex
      });

      assignments[seat.id] = candidate.id;
      available.splice(
        available.findIndex((student) => student.id === candidate.id),
        1
      );
    });

    const evaluation = evaluatePlan(assignments, input);
    plans.push({
      id: `plan-${Date.now()}-${attempt}`,
      name: `方案 ${String.fromCharCode(65 + (attempt % 26))}`,
      createdAt: new Date().toISOString(),
      assignments,
      score: evaluation.score,
      satisfied: evaluation.satisfied,
      warnings: [
        ...evaluation.warnings,
        ...(input.students.length > activeSeats.length
          ? [`学生数多于可用座位，${input.students.length - activeSeats.length} 名学生暂未安排。`]
          : [])
      ],
      reviewTips: evaluation.reviewTips,
      lockedSeatIds: Array.from(lockedSeatIds),
      lockedStudentIds: Array.from(lockedStudentIds)
    });
  }

  return plans
    .sort((a, b) => b.score.total - a.score.total)
    .filter(
      (plan, index, all) =>
        index === all.findIndex((candidate) => signature(candidate.assignments) === signature(plan.assignments))
    )
    .slice(0, count)
    .map((plan, index) => ({
      ...plan,
      name: `方案 ${String.fromCharCode(65 + index)}`
    }));
}

export function evaluatePlan(
  assignments: Record<string, string | null>,
  input: Omit<GenerateSeatingInput, "count" | "currentPlan">
): EvaluationResult {
  const activeSeats = getActiveSeats(input.layout);
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const seatByStudent = new Map<string, SeatCell>();

  activeSeats.forEach((seat) => {
    const studentId = assignments[seat.id];
    if (studentId) seatByStudent.set(studentId, seat);
  });

  const health = scoreHealth(input.students, seatByStudent, input.layout, input.rules);
  const height = scoreHeight(input.students, seatByStudent, input.layout, input.rules);
  const discipline = scoreDiscipline(assignments, input.layout, input.rules);
  const gender = scoreGender(assignments, input.layout, studentsById, input.rules);
  const fairness = scoreFairness(input.students, assignments, seatByStudent, input.layout, input.history, input.rules);
  const balance = scoreBalance(assignments, input.layout, studentsById);
  const weights = templateWeights[input.rules.template];
  const total = Math.round(
    health * weights.health +
      height * weights.height +
      discipline * weights.discipline +
      gender * weights.gender +
      fairness * weights.fairness +
      balance * weights.balance
  );

  const warnings = [
    ...relationshipWarnings(assignments, input.layout, input.rules.relationships, studentsById),
    ...visionWarnings(input.students, seatByStudent, input.layout, input.rules),
    ...heightWarnings(input.students, seatByStudent, input.layout, input.rules)
  ];

  const satisfied: string[] = [];
  if (input.rules.visionPriority) satisfied.push(`视力照顾评分 ${health} 分`);
  if (input.rules.heightBlocking) satisfied.push(`身高遮挡评分 ${height} 分`);
  if (input.rules.avoidDesk) satisfied.push(`同桌关系评分 ${discipline} 分`);
  if (input.rules.genderMix) satisfied.push(`男女搭配评分 ${gender} 分`);
  if (input.rules.fairnessRotation) satisfied.push(`轮换公平评分 ${fairness} 分`);

  return {
    score: { total, health, height, discipline, gender, fairness, balance },
    satisfied,
    warnings: uniqueMessages(warnings),
    reviewTips: buildReviewTips(input.students, assignments, seatByStudent, input.layout, input.history, input.rules)
  };
}

export function getFairnessRisks(history: HistoryEntry[], layout: ClassroomLayout, students: Student[]) {
  const recent = history.slice(-4);
  const riskByStudent = new Map<string, string[]>();

  students.forEach((student) => {
    const seats = recent
      .map((entry) => findSeatForStudent(entry.plan.assignments, layout, student.id))
      .filter(Boolean) as SeatCell[];

    if (seats.length < 2) return;

    const reasons: string[] = [];
    if (seats.filter((seat) => isBackSeat(layout, seat)).length >= Math.min(3, seats.length)) {
      reasons.push("长期后排");
    }
    if (seats.filter((seat) => seat.attributes.includes("edge")).length >= Math.min(3, seats.length)) {
      reasons.push("长期边缘");
    }

    if (reasons.length) {
      riskByStudent.set(student.id, reasons);
    }
  });

  return riskByStudent;
}

export function getLongTermDeskMateRisks(history: HistoryEntry[], layout: ClassroomLayout) {
  const counts = new Map<string, { studentAId: string; studentBId: string; count: number }>();

  history.slice(-4).forEach((entry) => {
    deskPairs(entry.plan.assignments, layout).forEach(([studentAId, studentBId]) => {
      const sorted = [studentAId, studentBId].sort();
      const key = sorted.join(":");
      const current = counts.get(key) ?? { studentAId: sorted[0], studentBId: sorted[1], count: 0 };
      counts.set(key, { ...current, count: current.count + 1 });
    });
  });

  return Array.from(counts.values()).filter((item) => item.count >= 2);
}

export function moveStudentInAssignments(
  assignments: Record<string, string | null>,
  studentId: string,
  targetSeatId: string
) {
  const next = { ...assignments };
  const sourceSeatId = Object.entries(next).find(([, value]) => value === studentId)?.[0];
  const targetStudentId = next[targetSeatId] ?? null;

  if (!sourceSeatId || sourceSeatId === targetSeatId) return next;

  next[targetSeatId] = studentId;
  next[sourceSeatId] = targetStudentId;
  return next;
}

function initializeAssignments(seats: SeatCell[]) {
  return seats.reduce<Record<string, string | null>>((result, seat) => {
    result[seat.id] = null;
    return result;
  }, {});
}

function getLockedAssignments(plan?: SeatingPlan | null) {
  if (!plan) return {};
  const lockedStudentIds = new Set(plan.lockedStudentIds);
  const lockedSeatIds = new Set(plan.lockedSeatIds);

  return Object.entries(plan.assignments).reduce<Record<string, string | null>>((result, [seatId, studentId]) => {
    if (lockedSeatIds.has(seatId) || (studentId && lockedStudentIds.has(studentId))) {
      result[seatId] = studentId;
    }
    return result;
  }, {});
}

function orderSeatsForTemplate(
  layout: ClassroomLayout,
  seats: SeatCell[],
  rules: SeatingRuleConfig,
  seed: number
) {
  const shuffled = shuffle(seats, seed + 7);

  if (rules.template === "exam") return shuffled;

  return shuffled.sort((a, b) => {
    const frontDiff = getFrontRank(layout, a) - getFrontRank(layout, b);
    if (rules.template === "vision" && frontDiff !== 0) return frontDiff;
    if (rules.template === "fairness" && frontDiff !== 0) return getBackRank(layout, a) - getBackRank(layout, b);
    return frontDiff || a.column - b.column;
  });
}

function chooseStudentForSeat(args: {
  students: Student[];
  seat: SeatCell;
  assignments: Record<string, string | null>;
  layout: ClassroomLayout;
  rules: SeatingRuleConfig;
  history: HistoryEntry[];
  rotationTargets: Map<string, RotationTarget>;
  seed: number;
}) {
  const random = seededRandom(args.seed);
  const scores = args.students.map((student) => ({
    student,
    score:
      scoreStudentSeat(student, args.seat, args.assignments, args.layout, args.rules, args.history) +
      scoreRotationTarget(student, args.seat, args.rules, args.rotationTargets) +
      random() * 8
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores[0].student;
}

function scoreRotationTarget(
  student: Student,
  seat: SeatCell,
  rules: SeatingRuleConfig,
  rotationTargets: Map<string, RotationTarget>
) {
  if (!rules.fairnessRotation) return 0;
  const policy = normalizeRotationPolicy(rules.rotationPolicy);
  if (!policy.enabled || rotationTargets.size === 0) return 0;

  const target = rotationTargets.get(student.id);
  const targetSeatOwner = Array.from(rotationTargets.values()).find((item) => item.targetSeatId === seat.id);
  const targetBonus = policy.strictness === "policy-first" ? 140 : 80;
  const displacedPenalty = policy.strictness === "policy-first" ? -70 : -36;
  const missedPenalty = policy.strictness === "policy-first" ? -30 : -14;

  if (target?.targetSeatId === seat.id) return targetBonus;
  if (targetSeatOwner && targetSeatOwner.studentId !== student.id) return displacedPenalty;
  if (target) return missedPenalty;
  return 0;
}

function scoreStudentSeat(
  student: Student,
  seat: SeatCell,
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig,
  history: HistoryEntry[]
) {
  let score = 100;
  const frontRank = getFrontRank(layout, seat);
  const frontSpan = getFrontSpan(layout);
  const frontRatio = frontRank / frontSpan;

  if (rules.visionPriority) {
    if (student.vision === "severe") score += (1 - frontRatio) * 70;
    if (student.vision === "mild") score += (1 - frontRatio) * 36;
    if (seat.attributes.includes("glare") && student.vision !== "normal") score -= 35;
    if (/靠前|听力|观察/.test(student.specialNeeds)) score += (1 - frontRatio) * 30;
  }

  if (rules.heightBlocking) {
    score += ((student.heightCm - 145) / 30) * frontRatio * 28;
    if (student.heightCm >= 165 && isFrontHalf(layout, seat)) score -= 24;
  }

  if (rules.fairnessRotation) {
    const risks = getFairnessRisks(history, layout, [student]).get(student.id) ?? [];
    if (risks.includes("长期后排") && isBackSeat(layout, seat)) score -= 40;
    if (risks.includes("长期边缘") && seat.attributes.includes("edge")) score -= 32;
  }

  score += relationshipSeatPenalty(student, seat, assignments, layout, rules);
  return score;
}

function relationshipSeatPenalty(
  student: Student,
  seat: SeatCell,
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.avoidDesk) return 0;

  let penalty = 0;
  const seatById = new Map(layout.seats.map((item) => [item.id, item]));

  rules.relationships.forEach((relationship) => {
    const relatedId =
      relationship.studentAId === student.id
        ? relationship.studentBId
        : relationship.studentBId === student.id
          ? relationship.studentAId
          : null;

    if (!relatedId) return;
    const relatedSeatId = Object.entries(assignments).find(([, value]) => value === relatedId)?.[0];
    const relatedSeat = relatedSeatId ? seatById.get(relatedSeatId) : null;
    if (!relatedSeat) return;

    if (relationship.type === "avoid-desk" && isDeskMate(seat, relatedSeat)) penalty -= 120;
    if (relationship.type === "keep-apart" && isNearSeat(seat, relatedSeat)) penalty -= 46;
  });

  return penalty;
}

function scoreHealth(
  students: Student[],
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.visionPriority) return 100;
  const concerned = students.filter((student) => student.vision === "severe" || student.vision === "mild");
  if (concerned.length === 0) return 100;

  const score = concerned.reduce((sum, student) => {
    const seat = seatByStudent.get(student.id);
    if (!seat) return sum;
    const frontScore = Math.max(0, 110 - getFrontRank(layout, seat) * (70 / getFrontSpan(layout)));
    const glarePenalty = seat.attributes.includes("glare") ? 24 : 0;
    return sum + Math.max(0, frontScore - glarePenalty);
  }, 0);

  return clamp(Math.round(score / concerned.length));
}

function scoreHeight(
  students: Student[],
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.heightBlocking) return 100;
  const seated = students
    .map((student) => ({ student, seat: seatByStudent.get(student.id) }))
    .filter((item): item is { student: Student; seat: SeatCell } => Boolean(item.seat));

  if (seated.length === 0) return 100;

  const penalties = seated.reduce((sum, item) => {
    if (item.student.heightCm >= 165 && isFrontHalf(layout, item.seat)) return sum + 16;
    if (item.student.heightCm <= 150 && !isFrontHalf(layout, item.seat)) return sum + 7;
    return sum;
  }, 0);

  return clamp(100 - penalties);
}

function scoreDiscipline(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.avoidDesk || rules.relationships.length === 0) return 100;
  const violations = relationshipViolations(assignments, layout, rules.relationships);
  return clamp(100 - violations.reduce((sum, violation) => sum + (violation.type === "avoid-desk" ? 42 : 18), 0));
}

function scoreGender(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  studentsById: Map<string, Student>,
  rules: SeatingRuleConfig
) {
  if (!rules.genderMix) return 100;
  const pairs = deskPairs(assignments, layout)
    .map(([a, b]) => [studentsById.get(a), studentsById.get(b)])
    .filter((pair): pair is [Student, Student] => Boolean(pair[0] && pair[1]));

  if (pairs.length === 0) return 100;

  const mixed = pairs.filter(([a, b]) => a.gender !== "未填" && b.gender !== "未填" && a.gender !== b.gender).length;
  return clamp(Math.round((mixed / pairs.length) * 100));
}

function scoreFairness(
  students: Student[],
  assignments: Record<string, string | null>,
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  history: HistoryEntry[],
  rules: SeatingRuleConfig
) {
  if (!rules.fairnessRotation) return 100;
  const policy = normalizeRotationPolicy(rules.rotationPolicy);
  const rotationStats = policy.enabled
    ? getRotationMatchStats({
        assignments,
        history,
        layout,
        policy
      })
    : null;
  const risks = getFairnessRisks(history, layout, students);
  if (risks.size === 0 && (!rotationStats || rotationStats.total === 0)) return 92;

  let penalty = 0;
  if (rotationStats && rotationStats.total > 0) {
    const weight = policy.strictness === "policy-first" ? 70 : 45;
    penalty += Math.round((1 - rotationStats.rate / 100) * weight);
  }

  risks.forEach((reasons, studentId) => {
    const seat = seatByStudent.get(studentId);
    if (!seat) return;
    if (reasons.includes("长期后排") && isBackSeat(layout, seat)) penalty += 26;
    if (reasons.includes("长期边缘") && seat.attributes.includes("edge")) penalty += 22;
  });

  return clamp(100 - penalty);
}

function scoreBalance(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  studentsById: Map<string, Student>
) {
  const columns = new Map<number, { total: number; concerned: number }>();

  Object.entries(assignments).forEach(([seatId, studentId]) => {
    const seat = getSeatById(layout, seatId);
    const student = studentId ? studentsById.get(studentId) : null;
    if (!seat || !student) return;
    const current = columns.get(seat.column) ?? { total: 0, concerned: 0 };
    current.total += 1;
    if (student.tags.some((tag) => /容易|观察|活跃|分心/.test(tag))) current.concerned += 1;
    columns.set(seat.column, current);
  });

  const maxConcerned = Math.max(0, ...Array.from(columns.values()).map((item) => item.concerned));
  return clamp(100 - maxConcerned * 8);
}

function relationshipWarnings(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  relationships: RelationshipRule[],
  studentsById: Map<string, Student>
) {
  return relationshipViolations(assignments, layout, relationships).map((violation) => {
    const a = studentsById.get(violation.studentAId)?.name ?? "学生A";
    const b = studentsById.get(violation.studentBId)?.name ?? "学生B";
    const action = violation.type === "avoid-desk" ? "不能同桌" : "尽量分开";
    return `${a} 与 ${b} 的“${action}”关系未完全满足。`;
  });
}

function relationshipViolations(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  relationships: RelationshipRule[]
) {
  const seatByStudentId = new Map<string, SeatCell>();
  layout.seats.forEach((seat) => {
    const studentId = assignments[seat.id];
    if (studentId) seatByStudentId.set(studentId, seat);
  });

  return relationships.filter((relationship) => {
    const a = seatByStudentId.get(relationship.studentAId);
    const b = seatByStudentId.get(relationship.studentBId);
    if (!a || !b) return false;
    return relationship.type === "avoid-desk" ? isDeskMate(a, b) : isNearSeat(a, b);
  });
}

function visionWarnings(
  students: Student[],
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.visionPriority) return [];

  return students.flatMap((student) => {
    if (student.vision !== "severe") return [];
    const seat = seatByStudent.get(student.id);
    if (!seat) return [`${student.name} 属于重点视力照顾，但暂未安排座位。`];
    if (!isFrontHalf(layout, seat)) {
      return [`${student.name} 属于重点视力照顾，目前在${describeSeat(seat)}，建议复核。`];
    }
    if (seat.attributes.includes("glare")) {
      return [`${student.name} 已靠前，但座位标记为反光区域，建议复核。`];
    }
    return [];
  });
}

function heightWarnings(
  students: Student[],
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig
) {
  if (!rules.heightBlocking) return [];

  return students.flatMap((student) => {
    const seat = seatByStudent.get(student.id);
    if (!seat) return [];
    if (student.heightCm >= 168 && isFrontHalf(layout, seat)) {
      return [`${student.name} 身高较高且位于前半区，可能遮挡后排。`];
    }
    return [];
  });
}

function buildReviewTips(
  students: Student[],
  assignments: Record<string, string | null>,
  seatByStudent: Map<string, SeatCell>,
  layout: ClassroomLayout,
  history: HistoryEntry[],
  rules: SeatingRuleConfig
) {
  const risks = getFairnessRisks(history, layout, students);
  const tips: string[] = getRotationDeviationTips({
    assignments,
    history,
    layout,
    policy: rules.rotationPolicy,
    students,
    limit: 4
  });

  risks.forEach((reasons, studentId) => {
    const student = students.find((item) => item.id === studentId);
    const seat = seatByStudent.get(studentId);
    if (!student || !seat) return;
    tips.push(`${student.name} 历史存在${reasons.join("、")}风险，本次在${describeSeat(seat)}。`);
  });

  students.forEach((student) => {
    const seat = seatByStudent.get(student.id);
    if (!seat) return;
    if (student.specialNeeds && /靠前|听力|观察|反光/.test(student.specialNeeds)) {
      tips.push(`${student.name} 有特殊需求：${student.specialNeeds}，本次安排在${describeSeat(seat)}。`);
    }
  });

  return uniqueMessages(tips).slice(0, 6);
}

function deskPairs(assignments: Record<string, string | null>, layout: ClassroomLayout) {
  const pairs: Array<[string, string]> = [];
  const seats = getActiveSeats(layout);

  seats.forEach((seat) => {
    const mate = seats.find((candidate) => candidate.id !== seat.id && isDeskMate(seat, candidate));
    if (!mate || seat.id > mate.id) return;
    const a = assignments[seat.id];
    const b = assignments[mate.id];
    if (a && b) pairs.push([a, b]);
  });

  return pairs;
}

function findSeatForStudent(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  studentId: string
) {
  const seatId = Object.entries(assignments).find(([, value]) => value === studentId)?.[0];
  return seatId ? getSeatById(layout, seatId) : undefined;
}

function shuffle<T>(items: T[], seed: number) {
  const next = [...items];
  const random = seededRandom(seed);

  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }

  return next;
}

function seededRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages));
}

function signature(assignments: Record<string, string | null>) {
  return Object.entries(assignments)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([seatId, studentId]) => `${seatId}:${studentId ?? "-"}`)
    .join("|");
}
