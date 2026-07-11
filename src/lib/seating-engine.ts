import {
  describeSeat,
  getActiveSeats,
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
  PlanFeasibility,
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
  sourceRevision?: number;
  seed?: number;
}

export interface EvaluationResult {
  score: PlanScore;
  satisfied: string[];
  warnings: string[];
  reviewTips: string[];
  feasibility: PlanFeasibility;
}

interface GenerationContext {
  seatById: Map<string, SeatCell>;
  relationshipsByStudent: Map<string, RelationshipRule[]>;
  rotationTargets: Map<string, RotationTarget>;
  rotationOwnerBySeatId: Map<string, string>;
  fairnessRisks: Map<string, string[]>;
}

const templateWeights = {
  vision: { health: 0.28, height: 0.18, discipline: 0.18, gender: 0.1, fairness: 0.18, balance: 0.08 },
  fairness: { health: 0.18, height: 0.15, discipline: 0.15, gender: 0.08, fairness: 0.36, balance: 0.08 },
  discipline: { health: 0.18, height: 0.15, discipline: 0.34, gender: 0.1, fairness: 0.15, balance: 0.08 },
  peer: { health: 0.16, height: 0.14, discipline: 0.18, gender: 0.16, fairness: 0.18, balance: 0.18 },
  exam: { health: 0.1, height: 0.1, discipline: 0.35, gender: 0.05, fairness: 0.1, balance: 0.3 }
} satisfies Record<SeatingRuleConfig["template"], Record<keyof Omit<PlanScore, "total">, number>>;

export function generateSeatingCandidates(input: GenerateSeatingInput): SeatingPlan[] {
  assertUniqueStudentIds(input.students);
  if (!isValidLayout(input.layout)) return [];

  const activeSeats = getActiveSeats(input.layout);
  if (activeSeats.length === 0) return [];

  const requestedCount = clampInteger(input.count ?? 3, 1, 12);
  const rootSeed = normalizeSeed(input.seed ?? createRandomSeed());
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const validStudentIds = new Set(studentsById.keys());
  const lockState = getLockState(input.currentPlan, activeSeats, validStudentIds);
  const remainingStudents = input.students.filter((student) => !lockState.fixedStudentIds.has(student.id));
  const remainingSeats = activeSeats.filter(
    (seat) => !lockState.lockedSeatIds.has(seat.id) && !lockState.fixedSeatIds.has(seat.id)
  );
  const rotationTargets = getRotationTargets({
    history: input.history,
    layout: input.layout,
    policy: input.rules.rotationPolicy,
    validStudentIds
  });
  const context = createGenerationContext(input, activeSeats, rotationTargets);
  const plans: SeatingPlan[] = [];
  const attemptCount = Math.max(requestedCount * 10, 30);

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    const generationSeed = deriveSeed(rootSeed, attempt);
    const assignments = initializeAssignments(activeSeats);
    const seatByStudent = new Map<string, SeatCell>();

    Object.entries(lockState.fixedAssignments).forEach(([seatId, studentId]) => {
      assignments[seatId] = studentId;
      const seat = context.seatById.get(seatId);
      if (seat) seatByStudent.set(studentId, seat);
    });

    placeStudents({
      students: remainingStudents,
      seats: remainingSeats,
      assignments,
      seatByStudent,
      input,
      context,
      seed: generationSeed
    });
    repairHardRelationshipViolations(assignments, input, lockState, context);

    const evaluation = evaluatePlan(assignments, input);
    plans.push({
      id: `plan-${Date.now()}-${generationSeed}-${attempt}`,
      name: `方案 ${String.fromCharCode(65 + (attempt % 26))}`,
      createdAt: new Date().toISOString(),
      assignments,
      score: evaluation.score,
      satisfied: evaluation.satisfied,
      warnings: evaluation.warnings,
      reviewTips: evaluation.reviewTips,
      lockedSeatIds: [...lockState.lockedSeatIds],
      lockedStudentIds: [...lockState.lockedStudentIds],
      sourceRevision: input.sourceRevision ?? 0,
      generationSeed,
      feasibility: evaluation.feasibility
    });
  }

  const uniquePlans = plans
    .sort(comparePlans)
    .filter(
      (plan, index, all) =>
        index === all.findIndex((candidate) => signature(candidate.assignments) === signature(plan.assignments))
    );
  const minimumHardViolations = Math.min(...uniquePlans.map((plan) => plan.feasibility.hardViolations.length));

  return uniquePlans
    .filter((plan) => plan.feasibility.hardViolations.length === minimumHardViolations)
    .slice(0, requestedCount)
    .map((plan, index) => ({ ...plan, name: `方案 ${String.fromCharCode(65 + index)}` }));
}

export function evaluatePlan(
  assignments: Record<string, string | null>,
  input: Pick<GenerateSeatingInput, "students" | "layout" | "rules" | "history">
): EvaluationResult {
  const activeSeats = getActiveSeats(input.layout);
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const validStudentIds = new Set(studentsById.keys());
  const seatByStudent = new Map<string, SeatCell>();

  activeSeats.forEach((seat) => {
    const studentId = assignments[seat.id];
    if (studentId && validStudentIds.has(studentId) && !seatByStudent.has(studentId)) {
      seatByStudent.set(studentId, seat);
    }
  });

  const health = scoreHealth(input.students, seatByStudent, input.layout, input.rules);
  const height = scoreHeight(input.students, seatByStudent, input.layout, input.rules);
  const discipline = scoreDiscipline(assignments, input.layout, input.rules);
  const gender = scoreGender(assignments, input.layout, studentsById, input.rules);
  const fairness = scoreFairness(
    input.students,
    assignments,
    seatByStudent,
    input.layout,
    input.history,
    input.rules
  );
  const balance = scoreBalance(assignments, input.layout, studentsById);
  const weights = templateWeights[input.rules.template];
  const assignedCount = seatByStudent.size;
  const coverage = input.students.length === 0 ? 1 : assignedCount / input.students.length;
  const weightedTotal =
    health * weights.health +
    height * weights.height +
    discipline * weights.discipline +
    gender * weights.gender +
    fairness * weights.fairness +
    balance * weights.balance;
  const hardRelationships = input.rules.avoidDesk
    ? relationshipViolations(assignments, input.layout, input.rules.relationships).filter(
        (relationship) => relationship.type === "avoid-desk"
      )
    : [];
  const hardViolations = hardRelationships.map((relationship) =>
    formatRelationshipWarning(relationship, studentsById)
  );
  const unassignedStudentIds = input.students
    .filter((student) => !seatByStudent.has(student.id))
    .map((student) => student.id);
  const feasibility: PlanFeasibility = {
    status: unassignedStudentIds.length === 0 && hardViolations.length === 0 ? "complete" : "partial",
    assignedCount,
    totalStudents: input.students.length,
    unassignedStudentIds,
    hardViolations
  };
  const warnings = [
    ...(input.rules.avoidDesk
      ? relationshipWarnings(assignments, input.layout, input.rules.relationships, studentsById)
      : []),
    ...visionWarnings(input.students, seatByStudent, input.layout, input.rules),
    ...heightWarnings(input.students, seatByStudent, input.layout, input.rules),
    ...(unassignedStudentIds.length > 0 ? [`${unassignedStudentIds.length} 名学生暂未安排座位。`] : [])
  ];

  const satisfied: string[] = [];
  if (input.rules.visionPriority) satisfied.push(`视力照顾评分 ${health} 分`);
  if (input.rules.heightBlocking) satisfied.push(`身高遮挡评分 ${height} 分`);
  if (input.rules.avoidDesk) satisfied.push(`同桌关系评分 ${discipline} 分`);
  if (input.rules.genderMix) satisfied.push(`男女搭配评分 ${gender} 分`);
  if (input.rules.fairnessRotation) satisfied.push(`轮换公平评分 ${fairness} 分`);

  return {
    score: {
      total: clamp(weightedTotal * coverage),
      health,
      height,
      discipline,
      gender,
      fairness,
      balance
    },
    satisfied,
    warnings: uniqueMessages(warnings),
    reviewTips: buildReviewTips(
      input.students,
      assignments,
      seatByStudent,
      input.layout,
      input.history,
      input.rules
    ),
    feasibility
  };
}

export function getFairnessRisks(history: HistoryEntry[], layout: ClassroomLayout, students: Student[]) {
  const recent = history.slice(-4);
  const riskByStudent = new Map<string, string[]>();
  const historySeats = recent.map((entry) => {
    const entryLayout = entry.layoutSnapshot ?? layout;
    const seatByStudent = new Map<string, SeatCell>();
    const seatById = new Map(entryLayout.seats.map((seat) => [seat.id, seat]));
    Object.entries(entry.plan.assignments).forEach(([seatId, studentId]) => {
      const seat = seatById.get(seatId);
      if (studentId && seat && !seat.attributes.includes("empty")) seatByStudent.set(studentId, seat);
    });
    return { layout: entryLayout, seatByStudent };
  });

  students.forEach((student) => {
    const seats = historySeats
      .map((entry) => {
        const seat = entry.seatByStudent.get(student.id);
        return seat ? { layout: entry.layout, seat } : null;
      })
      .filter((item): item is { layout: ClassroomLayout; seat: SeatCell } => Boolean(item));

    if (seats.length < 2) return;

    const reasons: string[] = [];
    if (seats.filter((item) => isBackSeat(item.layout, item.seat)).length >= Math.min(3, seats.length)) {
      reasons.push("长期后排");
    }
    if (seats.filter((item) => item.seat.attributes.includes("edge")).length >= Math.min(3, seats.length)) {
      reasons.push("长期边缘");
    }

    if (reasons.length) riskByStudent.set(student.id, reasons);
  });

  return riskByStudent;
}

export function getLongTermDeskMateRisks(history: HistoryEntry[], layout: ClassroomLayout) {
  const counts = new Map<string, { studentAId: string; studentBId: string; count: number }>();

  history.slice(-4).forEach((entry) => {
    const entryLayout = entry.layoutSnapshot ?? layout;
    deskPairs(entry.plan.assignments, entryLayout).forEach(([studentAId, studentBId]) => {
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

function placeStudents(args: {
  students: Student[];
  seats: SeatCell[];
  assignments: Record<string, string | null>;
  seatByStudent: Map<string, SeatCell>;
  input: GenerateSeatingInput;
  context: GenerationContext;
  seed: number;
}) {
  const random = seededRandom(args.seed);
  const hardDegree = getHardRelationshipDegree(args.input.rules);
  const orderedStudents = args.students
    .map((student) => ({ student, tieBreaker: random() }))
    .sort((a, b) => {
      const degreeDifference = (hardDegree.get(b.student.id) ?? 0) - (hardDegree.get(a.student.id) ?? 0);
      if (degreeDifference !== 0) return degreeDifference;
      const priorityDifference = getStudentPriority(b.student, args.input.rules) - getStudentPriority(a.student, args.input.rules);
      return priorityDifference || a.tieBreaker - b.tieBreaker;
    })
    .map((item) => item.student);
  const availableSeats = [...args.seats];
  const frontRankOccupancy = new Map<number, number>();
  const rowOccupancy = new Map<number, number>();
  const columnOccupancy = new Map<number, number>();

  args.seatByStudent.forEach((seat) => {
    increment(frontRankOccupancy, getFrontRank(args.input.layout, seat));
    increment(rowOccupancy, seat.row);
    increment(columnOccupancy, seat.column);
  });

  orderedStudents.forEach((student) => {
    if (availableSeats.length === 0) return;
    const safeSeats = args.input.rules.avoidDesk
      ? availableSeats.filter(
          (seat) => !hasHardRelationshipConflict(student.id, seat, args.seatByStudent, args.context)
        )
      : availableSeats;
    const candidates = safeSeats.length > 0 ? safeSeats : availableSeats;
    let selectedSeat = candidates[0];
    let selectedScore = Number.NEGATIVE_INFINITY;

    candidates.forEach((seat) => {
      const score =
        scoreStudentSeat(
          student,
          seat,
          args.input.layout,
          args.input.rules,
          args.seatByStudent,
          args.context
        ) +
        scoreRotationTarget(student, seat, args.input.rules, args.context) -
        (frontRankOccupancy.get(getFrontRank(args.input.layout, seat)) ?? 0) * 12 -
        (rowOccupancy.get(seat.row) ?? 0) * 2 -
        (columnOccupancy.get(seat.column) ?? 0) * 2 +
        random() * 12;

      if (score > selectedScore) {
        selectedScore = score;
        selectedSeat = seat;
      }
    });

    args.assignments[selectedSeat.id] = student.id;
    args.seatByStudent.set(student.id, selectedSeat);
    increment(frontRankOccupancy, getFrontRank(args.input.layout, selectedSeat));
    increment(rowOccupancy, selectedSeat.row);
    increment(columnOccupancy, selectedSeat.column);
    availableSeats.splice(availableSeats.findIndex((seat) => seat.id === selectedSeat.id), 1);
  });
}

function createGenerationContext(
  input: GenerateSeatingInput,
  activeSeats: SeatCell[],
  rotationTargets: Map<string, RotationTarget>
): GenerationContext {
  const relationshipsByStudent = new Map<string, RelationshipRule[]>();
  input.rules.relationships.forEach((relationship) => {
    addToMapArray(relationshipsByStudent, relationship.studentAId, relationship);
    addToMapArray(relationshipsByStudent, relationship.studentBId, relationship);
  });

  return {
    seatById: new Map(activeSeats.map((seat) => [seat.id, seat])),
    relationshipsByStudent,
    rotationTargets,
    rotationOwnerBySeatId: new Map(
      Array.from(rotationTargets.values()).map((target) => [target.targetSeatId, target.studentId])
    ),
    fairnessRisks: input.rules.fairnessRotation
      ? getFairnessRisks(input.history, input.layout, input.students)
      : new Map()
  };
}

function scoreStudentSeat(
  student: Student,
  seat: SeatCell,
  layout: ClassroomLayout,
  rules: SeatingRuleConfig,
  seatByStudent: Map<string, SeatCell>,
  context: GenerationContext
) {
  let score = 100;
  const frontRank = getFrontRank(layout, seat);
  const frontSpan = getFrontSpan(layout);
  const frontRatio = frontRank / Math.max(1, frontSpan);

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
    const risks = context.fairnessRisks.get(student.id) ?? [];
    if (risks.includes("长期后排") && isBackSeat(layout, seat)) score -= 40;
    if (risks.includes("长期边缘") && seat.attributes.includes("edge")) score -= 32;
  }

  if (rules.avoidDesk) {
    (context.relationshipsByStudent.get(student.id) ?? []).forEach((relationship) => {
      const relatedId = getRelatedStudentId(relationship, student.id);
      const relatedSeat = relatedId ? seatByStudent.get(relatedId) : undefined;
      if (!relatedSeat) return;
      if (relationship.type === "keep-apart" && isNearSeat(seat, relatedSeat)) score -= 46;
    });
  }

  return score;
}

function scoreRotationTarget(
  student: Student,
  seat: SeatCell,
  rules: SeatingRuleConfig,
  context: GenerationContext
) {
  if (!rules.fairnessRotation) return 0;
  const policy = normalizeRotationPolicy(rules.rotationPolicy);
  if (!policy.enabled || context.rotationTargets.size === 0) return 0;

  const target = context.rotationTargets.get(student.id);
  const targetSeatOwner = context.rotationOwnerBySeatId.get(seat.id);
  const targetBonus = policy.strictness === "policy-first" ? 140 : 80;
  const displacedPenalty = policy.strictness === "policy-first" ? -70 : -36;
  const missedPenalty = policy.strictness === "policy-first" ? -30 : -14;

  if (target?.targetSeatId === seat.id) return targetBonus;
  if (targetSeatOwner && targetSeatOwner !== student.id) return displacedPenalty;
  if (target) return missedPenalty;
  return 0;
}

function repairHardRelationshipViolations(
  assignments: Record<string, string | null>,
  input: GenerateSeatingInput,
  lockState: ReturnType<typeof getLockState>,
  context: GenerationContext
) {
  if (!input.rules.avoidDesk) return;
  const hardRelationships = input.rules.relationships.filter((relationship) => relationship.type === "avoid-desk");
  if (hardRelationships.length === 0) return;
  if (relationshipViolations(assignments, input.layout, hardRelationships).length === 0) return;

  const forbiddenPartners = createForbiddenPartnerIndex(hardRelationships);
  const deskGroups = new Map<string, SeatCell[]>();
  Array.from(context.seatById.values()).forEach((seat) => {
    addToMapArray(deskGroups, `${seat.row}:${Math.floor((seat.column - 1) / 2)}`, seat);
  });

  const fixedPartnerUnits: Array<{ seatId: string; fixedStudentId: string }> = [];
  const pairSeatUnits: string[][] = [];
  const singleSeatIds: string[] = [];
  const movableSeatIds: string[] = [];

  for (const seats of deskGroups.values()) {
    const orderedSeats = [...seats].sort((a, b) => a.column - b.column);
    const openSeatIds = orderedSeats
      .filter((seat) => !lockState.lockedSeatIds.has(seat.id) && !lockState.fixedSeatIds.has(seat.id))
      .map((seat) => seat.id);
    const fixedStudentIds = orderedSeats
      .filter((seat) => !openSeatIds.includes(seat.id))
      .map((seat) => assignments[seat.id])
      .filter((studentId): studentId is string => Boolean(studentId));

    if (
      fixedStudentIds.length === 2 &&
      !areHardRelationshipCompatible(fixedStudentIds[0], fixedStudentIds[1], forbiddenPartners)
    ) {
      return;
    }

    movableSeatIds.push(...openSeatIds);
    if (openSeatIds.length === 1 && fixedStudentIds.length === 1) {
      fixedPartnerUnits.push({ seatId: openSeatIds[0], fixedStudentId: fixedStudentIds[0] });
    } else if (openSeatIds.length === 2) {
      pairSeatUnits.push(openSeatIds);
    } else if (openSeatIds.length === 1) {
      singleSeatIds.push(openSeatIds[0]);
    }
  }

  const tokens: AssignmentToken[] = movableSeatIds.map((seatId, index) => ({
    key: assignments[seatId] ?? `__empty_${index}`,
    studentId: assignments[seatId],
    originalSeatId: seatId
  }));
  const solution = solveHardRelationshipAssignments(
    tokens,
    fixedPartnerUnits,
    pairSeatUnits.length,
    singleSeatIds.length,
    forbiddenPartners
  );
  if (!solution) return;

  movableSeatIds.forEach((seatId) => {
    assignments[seatId] = null;
  });
  solution.fixedPartners.forEach(({ seatId, token }) => {
    assignments[seatId] = token.studentId;
  });
  solution.pairs.forEach((pair, index) => {
    assignTokensToSeats(assignments, pairSeatUnits[index], pair);
  });
  assignTokensToSeats(assignments, singleSeatIds, solution.singles);
}

interface AssignmentToken {
  key: string;
  studentId: string | null;
  originalSeatId: string;
}

interface HardRelationshipSolution {
  fixedPartners: Array<{ seatId: string; token: AssignmentToken }>;
  pairs: Array<[AssignmentToken, AssignmentToken]>;
  singles: AssignmentToken[];
}

function solveHardRelationshipAssignments(
  tokens: AssignmentToken[],
  fixedPartnerUnits: Array<{ seatId: string; fixedStudentId: string }>,
  pairCount: number,
  singleCount: number,
  forbiddenPartners: Map<string, Set<string>>
): HardRelationshipSolution | null {
  const orderedFixedUnits = [...fixedPartnerUnits].sort(
    (a, b) =>
      (forbiddenPartners.get(b.fixedStudentId)?.size ?? 0) -
      (forbiddenPartners.get(a.fixedStudentId)?.size ?? 0)
  );

  function assignFixedPartners(
    unitIndex: number,
    remaining: AssignmentToken[],
    selected: Array<{ seatId: string; token: AssignmentToken }>
  ): HardRelationshipSolution | null {
    if (unitIndex === orderedFixedUnits.length) {
      const freeSolution = solveFreeDeskPairings(
        remaining,
        pairCount,
        singleCount,
        forbiddenPartners
      );
      return freeSolution ? { fixedPartners: selected, ...freeSolution } : null;
    }

    const unit = orderedFixedUnits[unitIndex];
    const candidates = remaining
      .map((token, index) => ({ token, index }))
      .filter(({ token }) =>
        areHardRelationshipCompatible(unit.fixedStudentId, token.studentId, forbiddenPartners)
      )
      .sort((a, b) =>
        Number(b.token.originalSeatId === unit.seatId) - Number(a.token.originalSeatId === unit.seatId)
      );

    for (const { token, index } of candidates) {
      const result = assignFixedPartners(
        unitIndex + 1,
        remaining.filter((_, candidateIndex) => candidateIndex !== index),
        [...selected, { seatId: unit.seatId, token }]
      );
      if (result) return result;
    }
    return null;
  }

  return assignFixedPartners(0, tokens, []);
}

function solveFreeDeskPairings(
  tokens: AssignmentToken[],
  pairCount: number,
  singleCount: number,
  forbiddenPartners: Map<string, Set<string>>
): Pick<HardRelationshipSolution, "pairs" | "singles"> | null {
  if (tokens.length !== pairCount * 2 + singleCount) return null;
  if (pairCount === 0) return { pairs: [], singles: tokens };

  const pivotIndex = tokens.reduce((bestIndex, token, index) => {
    const degree = token.studentId ? forbiddenPartners.get(token.studentId)?.size ?? 0 : -1;
    const best = tokens[bestIndex];
    const bestDegree = best.studentId ? forbiddenPartners.get(best.studentId)?.size ?? 0 : -1;
    return degree > bestDegree ? index : bestIndex;
  }, 0);
  const pivot = tokens[pivotIndex];
  const withoutPivot = tokens.filter((_, index) => index !== pivotIndex);

  if (singleCount > 0) {
    const result = solveFreeDeskPairings(withoutPivot, pairCount, singleCount - 1, forbiddenPartners);
    if (result) return { pairs: result.pairs, singles: [pivot, ...result.singles] };
  }

  const partnerCandidates = withoutPivot
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => areHardRelationshipCompatible(pivot.studentId, token.studentId, forbiddenPartners))
    .sort((a, b) => {
      const pivotSeat = contextDeskKey(pivot.originalSeatId);
      return Number(contextDeskKey(b.token.originalSeatId) === pivotSeat) -
        Number(contextDeskKey(a.token.originalSeatId) === pivotSeat);
    });

  for (const { token: partner, index } of partnerCandidates) {
    const remaining = withoutPivot.filter((_, candidateIndex) => candidateIndex !== index);
    const result = solveFreeDeskPairings(remaining, pairCount - 1, singleCount, forbiddenPartners);
    if (result) return { pairs: [[pivot, partner], ...result.pairs], singles: result.singles };
  }
  return null;
}

function createForbiddenPartnerIndex(relationships: RelationshipRule[]) {
  const result = new Map<string, Set<string>>();
  relationships.forEach((relationship) => {
    if (!result.has(relationship.studentAId)) result.set(relationship.studentAId, new Set());
    if (!result.has(relationship.studentBId)) result.set(relationship.studentBId, new Set());
    result.get(relationship.studentAId)?.add(relationship.studentBId);
    result.get(relationship.studentBId)?.add(relationship.studentAId);
  });
  return result;
}

function areHardRelationshipCompatible(
  firstStudentId: string | null,
  secondStudentId: string | null,
  forbiddenPartners: Map<string, Set<string>>
) {
  if (!firstStudentId || !secondStudentId) return true;
  return !forbiddenPartners.get(firstStudentId)?.has(secondStudentId);
}

function assignTokensToSeats(
  assignments: Record<string, string | null>,
  seatIds: string[],
  tokens: AssignmentToken[]
) {
  const remaining = [...tokens];
  seatIds.forEach((seatId) => {
    const originalIndex = remaining.findIndex((token) => token.originalSeatId === seatId);
    const token = remaining.splice(originalIndex >= 0 ? originalIndex : 0, 1)[0];
    assignments[seatId] = token?.studentId ?? null;
  });
}

function contextDeskKey(seatId: string) {
  const match = /^seat-r(\d+)-c(\d+)$/.exec(seatId);
  return match ? `${match[1]}:${Math.floor((Number(match[2]) - 1) / 2)}` : seatId;
}

function getLockState(
  plan: SeatingPlan | null | undefined,
  activeSeats: SeatCell[],
  validStudentIds: ReadonlySet<string>
) {
  const activeSeatIds = new Set(activeSeats.map((seat) => seat.id));
  const lockedSeatIds = new Set(
    (plan?.lockedSeatIds ?? []).filter((seatId) => activeSeatIds.has(seatId))
  );
  const lockedStudentIds = new Set(
    (plan?.lockedStudentIds ?? []).filter((studentId) => validStudentIds.has(studentId))
  );
  const fixedAssignments: Record<string, string> = {};
  const fixedSeatIds = new Set<string>();
  const fixedStudentIds = new Set<string>();

  activeSeats.forEach((seat) => {
    const studentId = plan?.assignments[seat.id];
    if (!studentId || !validStudentIds.has(studentId) || fixedStudentIds.has(studentId)) return;
    if (!lockedSeatIds.has(seat.id) && !lockedStudentIds.has(studentId)) return;
    fixedAssignments[seat.id] = studentId;
    fixedSeatIds.add(seat.id);
    fixedStudentIds.add(studentId);
  });

  return { lockedSeatIds, lockedStudentIds, fixedAssignments, fixedSeatIds, fixedStudentIds };
}

function initializeAssignments(seats: SeatCell[]) {
  return seats.reduce<Record<string, string | null>>((result, seat) => {
    result[seat.id] = null;
    return result;
  }, {});
}

function hasHardRelationshipConflict(
  studentId: string,
  seat: SeatCell,
  seatByStudent: Map<string, SeatCell>,
  context: GenerationContext
) {
  return (context.relationshipsByStudent.get(studentId) ?? []).some((relationship) => {
    if (relationship.type !== "avoid-desk") return false;
    const relatedId = getRelatedStudentId(relationship, studentId);
    const relatedSeat = relatedId ? seatByStudent.get(relatedId) : undefined;
    return Boolean(relatedSeat && isDeskMate(seat, relatedSeat));
  });
}

function getHardRelationshipDegree(rules: SeatingRuleConfig) {
  const result = new Map<string, number>();
  if (!rules.avoidDesk) return result;
  rules.relationships.forEach((relationship) => {
    if (relationship.type !== "avoid-desk") return;
    increment(result, relationship.studentAId);
    increment(result, relationship.studentBId);
  });
  return result;
}

function getStudentPriority(student: Student, rules: SeatingRuleConfig) {
  let result = 0;
  if (rules.visionPriority) {
    if (student.vision === "severe") result += 4;
    if (student.vision === "mild") result += 2;
    if (student.specialNeeds) result += 1;
  }
  if (rules.heightBlocking && (student.heightCm <= 150 || student.heightCm >= 168)) result += 1;
  return result;
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
    const frontScore = Math.max(0, 110 - getFrontRank(layout, seat) * (70 / Math.max(1, getFrontSpan(layout))));
    const glarePenalty = seat.attributes.includes("glare") ? 24 : 0;
    return sum + Math.max(0, frontScore - glarePenalty);
  }, 0);

  return clamp(score / concerned.length);
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
  return clamp(100 - violations.reduce((sum, item) => sum + (item.type === "avoid-desk" ? 42 : 18), 0));
}

function scoreGender(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  studentsById: Map<string, Student>,
  rules: SeatingRuleConfig
) {
  if (!rules.genderMix) return 100;
  const knownPairs = deskPairs(assignments, layout)
    .map(([a, b]) => [studentsById.get(a), studentsById.get(b)])
    .filter(
      (pair): pair is [Student, Student] =>
        Boolean(pair[0] && pair[1] && pair[0].gender !== "未填" && pair[1].gender !== "未填")
    );
  if (knownPairs.length === 0) return 100;

  const mixed = knownPairs.filter(([a, b]) => a.gender !== b.gender).length;
  return clamp((mixed / knownPairs.length) * 100);
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
  const validStudentIds = new Set(students.map((student) => student.id));
  const rotationStats = policy.enabled
    ? getRotationMatchStats({ assignments, history, layout, policy, validStudentIds })
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
    if (!seat || seat.attributes.includes("empty") || !student) return;
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
  return relationshipViolations(assignments, layout, relationships).map((relationship) =>
    formatRelationshipWarning(relationship, studentsById)
  );
}

function formatRelationshipWarning(relationship: RelationshipRule, studentsById: Map<string, Student>) {
  const a = studentsById.get(relationship.studentAId)?.name ?? "学生A";
  const b = studentsById.get(relationship.studentBId)?.name ?? "学生B";
  const action = relationship.type === "avoid-desk" ? "不能同桌" : "尽量分开";
  return `${a} 与 ${b} 的“${action}”关系未完全满足。`;
}

function relationshipViolations(
  assignments: Record<string, string | null>,
  layout: ClassroomLayout,
  relationships: RelationshipRule[]
) {
  const activeSeatById = new Map(getActiveSeats(layout).map((seat) => [seat.id, seat]));
  const seatByStudentId = new Map<string, SeatCell>();
  Object.entries(assignments).forEach(([seatId, studentId]) => {
    const seat = activeSeatById.get(seatId);
    if (studentId && seat) seatByStudentId.set(studentId, seat);
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
    if (!isFrontHalf(layout, seat)) return [`${student.name} 属于重点视力照顾，目前在${describeSeat(seat)}，建议复核。`];
    if (seat.attributes.includes("glare")) return [`${student.name} 已靠前，但座位标记为反光区域，建议复核。`];
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
    if (seat && student.heightCm >= 168 && isFrontHalf(layout, seat)) {
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
  const tips: string[] = [];
  const validStudentIds = new Set(students.map((student) => student.id));

  if (rules.fairnessRotation) {
    tips.push(
      ...getRotationDeviationTips({
        assignments,
        history,
        layout,
        policy: rules.rotationPolicy,
        students,
        validStudentIds,
        limit: 4
      })
    );
    const risks = getFairnessRisks(history, layout, students);
    risks.forEach((reasons, studentId) => {
      const student = students.find((item) => item.id === studentId);
      const seat = seatByStudent.get(studentId);
      if (student && seat) tips.push(`${student.name} 历史存在${reasons.join("、")}风险，本次在${describeSeat(seat)}。`);
    });
  }

  if (rules.visionPriority) {
    students.forEach((student) => {
      const seat = seatByStudent.get(student.id);
      if (seat && student.specialNeeds && /靠前|听力|观察|反光/.test(student.specialNeeds)) {
        tips.push(`${student.name} 有特殊需求：${student.specialNeeds}，本次安排在${describeSeat(seat)}。`);
      }
    });
  }

  return uniqueMessages(tips).slice(0, 6);
}

function deskPairs(assignments: Record<string, string | null>, layout: ClassroomLayout) {
  const pairs: Array<[string, string]> = [];
  const activeSeats = getActiveSeats(layout);
  const seatsByCoordinate = new Map(activeSeats.map((seat) => [`${seat.row}:${seat.column}`, seat]));
  activeSeats.forEach((seat) => {
    const mateColumn = seat.column % 2 === 1 ? seat.column + 1 : seat.column - 1;
    const mate = seatsByCoordinate.get(`${seat.row}:${mateColumn}`);
    if (!mate || seat.column > mate.column) return;
    const a = assignments[seat.id];
    const b = assignments[mate.id];
    if (a && b) pairs.push([a, b]);
  });
  return pairs;
}

function getRelatedStudentId(relationship: RelationshipRule, studentId: string) {
  if (relationship.studentAId === studentId) return relationship.studentBId;
  if (relationship.studentBId === studentId) return relationship.studentAId;
  return null;
}

function comparePlans(a: SeatingPlan, b: SeatingPlan) {
  const hardDifference = a.feasibility.hardViolations.length - b.feasibility.hardViolations.length;
  if (hardDifference !== 0) return hardDifference;
  const assignedDifference = b.feasibility.assignedCount - a.feasibility.assignedCount;
  return assignedDifference || b.score.total - a.score.total;
}

function isValidLayout(layout: ClassroomLayout) {
  if (!Number.isInteger(layout.rows) || !Number.isInteger(layout.columns) || layout.rows < 1 || layout.columns < 1) {
    return false;
  }
  const ids = new Set<string>();
  return layout.seats.every((seat) => {
    if (ids.has(seat.id)) return false;
    ids.add(seat.id);
    return (
      Number.isInteger(seat.row) &&
      Number.isInteger(seat.column) &&
      seat.row >= 1 &&
      seat.row <= layout.rows &&
      seat.column >= 1 &&
      seat.column <= layout.columns
    );
  });
}

function assertUniqueStudentIds(students: Student[]) {
  const ids = new Set<string>();
  students.forEach((student) => {
    if (ids.has(student.id)) throw new Error(`学生 ID 必须唯一：${student.id}`);
    ids.add(student.id);
  });
}

function addToMapArray<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function increment<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function seededRandom(seed: number) {
  let value = normalizeSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandomSeed() {
  return normalizeSeed(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
}

function deriveSeed(rootSeed: number, attempt: number) {
  let value = normalizeSeed(rootSeed + Math.imul(attempt + 1, 0x9e3779b1));
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return normalizeSeed(value);
}

function normalizeSeed(seed: number) {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1;
}

function clampInteger(value: number, min: number, max: number) {
  const next = Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(max, next));
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
