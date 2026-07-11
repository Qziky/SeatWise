"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createId } from "@/lib/id";
import {
  createGridLayout,
  getActiveSeats,
  getLayoutSignature,
  toggleSeatAttribute as toggleAttribute
} from "@/lib/layout";
import { applyRuleTemplate, defaultRuleConfig, normalizeRuleConfig } from "@/lib/rules";
import { normalizeRotationPolicy } from "@/lib/rotation";
import { initialClassroom, initialHistory, sampleRules } from "@/lib/sample-data";
import {
  evaluatePlan,
  generateSeatingCandidates,
  moveStudentInAssignments
} from "@/lib/seating-engine";
import type {
  ClassRoom,
  HistoryEntry,
  ImportStudentsResult,
  PodiumDirection,
  RelationshipRuleType,
  RotationPolicy,
  RuleTemplate,
  SeatAttribute,
  SeatingPlan,
  SeatingRuleConfig,
  Student,
  StudentDraft,
  ViewMode
} from "@/lib/types";

type ActiveSection = "overview" | "students" | "layout" | "rules" | "generate" | "history" | "export";
type RuleFlag = "visionPriority" | "heightBlocking" | "genderMix" | "fairnessRotation" | "avoidDesk";

interface SeatWiseState {
  classroom: ClassRoom;
  rules: SeatingRuleConfig;
  plans: SeatingPlan[];
  selectedPlanId: string | null;
  history: typeof initialHistory;
  inputRevision: number;
  layoutEpoch: number;
  generationError: string | null;
  viewMode: ViewMode;
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  resetSampleData: () => void;
  updateClassMeta: (field: "name" | "grade" | "term", value: string) => void;
  addStudent: (student: Omit<Student, "id">) => void;
  updateStudent: (studentId: string, patch: Partial<Student>) => void;
  removeStudent: (studentId: string) => void;
  importStudents: (students: StudentDraft[]) => ImportStudentsResult;
  updateLayoutSize: (rows: number, columns: number) => void;
  updatePodium: (podium: PodiumDirection) => void;
  toggleSeatAttribute: (seatId: string, attribute: SeatAttribute) => void;
  toggleSeatLock: (seatId: string) => void;
  updateRuleFlag: (key: RuleFlag, value: boolean) => void;
  updateRotationPolicy: (patch: Partial<RotationPolicy>) => void;
  applyTemplate: (template: RuleTemplate) => void;
  addRelationship: (studentAId: string, studentBId: string, type: RelationshipRuleType, note: string) => void;
  removeRelationship: (relationshipId: string) => void;
  generatePlans: () => void;
  selectPlan: (planId: string) => void;
  moveStudentToSeat: (studentId: string, targetSeatId: string) => void;
  toggleStudentLock: (studentId: string) => void;
  regenerateUnlocked: () => void;
  saveSelectedPlan: (adjustmentNote: string) => void;
  clearPlans: () => void;
  setViewMode: (mode: ViewMode) => void;
}

type PersistedSeatWiseState = Pick<
  SeatWiseState,
  "classroom" | "rules" | "plans" | "selectedPlanId" | "history" | "inputRevision" | "layoutEpoch"
>;

export const useSeatWiseStore = create<SeatWiseState>()(
  persist(
    (set, get) => ({
      classroom: initialClassroom,
      rules: sampleRules,
      plans: [],
      selectedPlanId: null,
      history: initialHistory,
      inputRevision: 0,
      layoutEpoch: 0,
      generationError: null,
      viewMode: "teacher",
      activeSection: "overview",
      setActiveSection: (section) => set({ activeSection: section }),
      resetSampleData: () =>
        set({
          classroom: initialClassroom,
          rules: sampleRules,
          plans: [],
          selectedPlanId: null,
          history: initialHistory,
          inputRevision: 0,
          layoutEpoch: 0,
          generationError: null,
          viewMode: "teacher",
          activeSection: "overview"
        }),
      updateClassMeta: (field, value) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            [field]: value,
            updatedAt: new Date().toISOString()
          }
        })),
      addStudent: (student) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            students: [...state.classroom.students, { ...normalizeStudentDraft(student), id: createId("student") }],
            updatedAt: new Date().toISOString()
          },
          ...markInputsChanged(state)
        })),
      updateStudent: (studentId, patch) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            students: state.classroom.students.map((student) =>
              student.id === studentId ? { ...student, ...normalizeStudentPatch(patch) } : student
            ),
            updatedAt: new Date().toISOString()
          },
          ...markInputsChanged(state)
        })),
      removeStudent: (studentId) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            students: state.classroom.students.filter((student) => student.id !== studentId),
            updatedAt: new Date().toISOString()
          },
          rules: {
            ...state.rules,
            relationships: state.rules.relationships.filter(
              (relationship) =>
                relationship.studentAId !== studentId && relationship.studentBId !== studentId
            )
          },
          ...markInputsChanged(state)
        })),
      importStudents: (students) => {
        const state = get();
        const usedStudentNumbers = new Set(
          state.classroom.students.map((student) => normalizeStudentNumber(student.studentNo)).filter(Boolean)
        );
        const accepted: Student[] = [];
        const conflicts: ImportStudentsResult["conflicts"] = [];

        students.forEach((draft) => {
          const normalized = normalizeStudentDraft(draft);
          if (!normalized.studentNo) {
            normalized.studentNo = getNextStudentNumber(usedStudentNumbers);
          }
          const studentNo = normalizeStudentNumber(normalized.studentNo);
          if (studentNo && usedStudentNumbers.has(studentNo)) {
            conflicts.push({
              studentNo: normalized.studentNo,
              name: normalized.name,
              reason: "duplicate-student-no"
            });
            return;
          }

          if (studentNo) usedStudentNumbers.add(studentNo);
          accepted.push({ ...normalized, id: createId("student") });
        });

        if (accepted.length) {
          set((current) => ({
            classroom: {
              ...current.classroom,
              students: [...current.classroom.students, ...accepted],
              updatedAt: new Date().toISOString()
            },
            ...markInputsChanged(current)
          }));
        }

        return { importedCount: accepted.length, conflicts };
      },
      updateLayoutSize: (rows, columns) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            layout: createGridLayout(
              Math.max(2, Math.min(12, rows)),
              Math.max(2, Math.min(12, columns)),
              state.classroom.layout.podium,
              state.classroom.layout.seats
            ),
            updatedAt: new Date().toISOString()
          },
          plans: [],
          selectedPlanId: null,
          inputRevision: state.inputRevision + 1,
          layoutEpoch: state.layoutEpoch + 1,
          generationError: null
        })),
      updatePodium: (podium) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            layout: createGridLayout(
              state.classroom.layout.rows,
              state.classroom.layout.columns,
              podium,
              state.classroom.layout.seats
            ),
            updatedAt: new Date().toISOString()
          },
          plans: [],
          selectedPlanId: null,
          inputRevision: state.inputRevision + 1,
          layoutEpoch: state.layoutEpoch + 1,
          generationError: null
        })),
      toggleSeatAttribute: (seatId, attribute) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            layout: {
              ...state.classroom.layout,
              seats: state.classroom.layout.seats.map((seat) =>
                seat.id === seatId ? toggleAttribute(seat, attribute) : seat
              )
            },
            updatedAt: new Date().toISOString()
          },
          plans: attribute === "empty" ? [] : state.plans,
          selectedPlanId: attribute === "empty" ? null : state.selectedPlanId,
          inputRevision: state.inputRevision + 1,
          layoutEpoch: state.layoutEpoch + 1,
          generationError: null
        })),
      toggleSeatLock: (seatId) =>
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === state.selectedPlanId
              ? {
                  ...plan,
                  lockedSeatIds: plan.lockedSeatIds.includes(seatId)
                    ? plan.lockedSeatIds.filter((id) => id !== seatId)
                    : [...plan.lockedSeatIds, seatId]
                }
              : plan
          )
        })),
      updateRuleFlag: (key, value) =>
        set((state) => ({
          rules: {
            ...state.rules,
            [key]: value
          },
          ...markInputsChanged(state)
        })),
      updateRotationPolicy: (patch) =>
        set((state) => ({
          rules: {
            ...state.rules,
            rotationPolicy: normalizeRotationPolicy({
              ...state.rules.rotationPolicy,
              ...patch
            })
          },
          ...markInputsChanged(state)
        })),
      applyTemplate: (template) =>
        set((state) => ({
          rules: applyRuleTemplate(state.rules, template),
          ...markInputsChanged(state)
        })),
      addRelationship: (studentAId, studentBId, type, note) => {
        if (!studentAId || !studentBId || studentAId === studentBId) return;
        set((state) => ({
          rules: {
            ...state.rules,
            relationships: [
              ...state.rules.relationships,
              {
                id: createId("rel"),
                studentAId,
                studentBId,
                type,
                note
              }
            ]
          },
          ...markInputsChanged(state)
        }));
      },
      removeRelationship: (relationshipId) =>
        set((state) => ({
          rules: {
            ...state.rules,
            relationships: state.rules.relationships.filter((relationship) => relationship.id !== relationshipId)
          },
          ...markInputsChanged(state)
        })),
      generatePlans: () => {
        const state = get();
        const validationError = getGenerationValidationError(state.classroom);
        if (validationError) {
          set({
            plans: [],
            selectedPlanId: null,
            generationError: validationError,
            activeSection: "generate"
          });
          return;
        }

        const seed = createGenerationSeed();
        const compatibleHistory = getCompatibleHistory(
          state.history,
          state.classroom.layout,
          state.layoutEpoch
        );
        const plans = generateSeatingCandidates({
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: compatibleHistory,
          sourceRevision: state.inputRevision,
          seed,
          count: 3
        });

        set({
          plans,
          selectedPlanId: plans[0]?.id ?? null,
          generationError: plans.length ? null : "当前条件下无法生成可用方案，请检查名单、座位和规则。",
          activeSection: "generate"
        });
      },
      selectPlan: (planId) => set({ selectedPlanId: planId }),
      moveStudentToSeat: (studentId, targetSeatId) => {
        const state = get();
        const selected = state.plans.find((plan) => plan.id === state.selectedPlanId);
        if (!selected || selected.sourceRevision !== state.inputRevision) return;
        if (selected.lockedStudentIds.includes(studentId) || selected.lockedSeatIds.includes(targetSeatId)) return;

        const sourceSeatId = Object.entries(selected.assignments).find(([, value]) => value === studentId)?.[0];
        if (sourceSeatId && selected.lockedSeatIds.includes(sourceSeatId)) return;
        const targetStudentId = selected.assignments[targetSeatId];
        if (targetStudentId && selected.lockedStudentIds.includes(targetStudentId)) return;

        const nextAssignments = moveStudentInAssignments(selected.assignments, studentId, targetSeatId);
        const compatibleHistory = getCompatibleHistory(
          state.history,
          state.classroom.layout,
          state.layoutEpoch
        );
        const evaluation = evaluatePlan(nextAssignments, {
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: compatibleHistory
        });

        set({
          plans: state.plans.map((plan) =>
            plan.id === selected.id
              ? {
                  ...plan,
                  assignments: nextAssignments,
                  score: evaluation.score,
                  satisfied: evaluation.satisfied,
                  warnings: evaluation.warnings,
                  reviewTips: evaluation.reviewTips,
                  feasibility: evaluation.feasibility
                }
              : plan
          )
        });
      },
      toggleStudentLock: (studentId) =>
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === state.selectedPlanId
              ? {
                  ...plan,
                  lockedStudentIds: plan.lockedStudentIds.includes(studentId)
                    ? plan.lockedStudentIds.filter((id) => id !== studentId)
                    : [...plan.lockedStudentIds, studentId]
                }
              : plan
          )
        })),
      regenerateUnlocked: () => {
        const state = get();
        const selected = state.plans.find((plan) => plan.id === state.selectedPlanId);
        const validationError = getGenerationValidationError(state.classroom);
        if (validationError) {
          set({ plans: [], selectedPlanId: null, generationError: validationError });
          return;
        }

        const seed = createGenerationSeed();
        const compatibleHistory = getCompatibleHistory(
          state.history,
          state.classroom.layout,
          state.layoutEpoch
        );
        const plans = generateSeatingCandidates({
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: compatibleHistory,
          currentPlan: selected,
          sourceRevision: state.inputRevision,
          seed,
          count: 3
        });

        set({
          plans,
          selectedPlanId: plans[0]?.id ?? null,
          generationError: plans.length ? null : "当前条件下无法生成可用方案，请检查名单、座位和规则。"
        });
      },
      saveSelectedPlan: (adjustmentNote) => {
        const state = get();
        const selected = state.plans.find((plan) => plan.id === state.selectedPlanId);
        if (
          !selected ||
          selected.sourceRevision !== state.inputRevision ||
          selected.feasibility.status !== "complete"
        ) {
          return;
        }

        const now = new Date().toISOString();
        const entry = {
          id: createId("history"),
          classId: state.classroom.id,
          savedAt: now,
          plan: createHistoryPlanSnapshot(selected),
          rules: cloneValue(state.rules),
          adjustmentNote,
          layoutSnapshot: cloneValue(state.classroom.layout),
          layoutSignature: getLayoutSignature(state.classroom.layout),
          layoutEpoch: state.layoutEpoch,
          studentLabels: Object.fromEntries(
            state.classroom.students.map((student) => [
              student.id,
              {
                id: student.id,
                name: student.name,
                studentNo: student.studentNo,
                gender: student.gender
              }
            ])
          )
        };

        set({
          history: [...state.history, entry].slice(-50),
          activeSection: "history"
        });
      },
      clearPlans: () => set({ plans: [], selectedPlanId: null, generationError: null }),
      setViewMode: (mode) => set({ viewMode: mode })
    }),
    {
      name: "seatwise-mvp",
      version: 3,
      migrate: (persistedState) => normalizePersistedState(persistedState as Partial<PersistedSeatWiseState> | undefined),
      merge: (persistedState, currentState) => {
        const persisted = normalizePersistedState(persistedState as Partial<PersistedSeatWiseState> | undefined);
        return {
          ...currentState,
          ...persisted
        };
      },
      partialize: (state) => ({
        classroom: state.classroom,
        rules: state.rules,
        plans: state.plans,
        selectedPlanId: state.selectedPlanId,
        history: state.history,
        inputRevision: state.inputRevision,
        layoutEpoch: state.layoutEpoch
      })
    }
  )
);

export const getSelectedPlan = (state: SeatWiseState) =>
  state.plans.find((plan) => plan.id === state.selectedPlanId) ?? null;

export const isPlanStale = (state: SeatWiseState, plan: SeatingPlan | null) =>
  Boolean(plan && plan.sourceRevision !== state.inputRevision);

function normalizePersistedState(state?: Partial<PersistedSeatWiseState>): PersistedSeatWiseState {
  const { classroom, hadDuplicateIds } = normalizeClassroom(state?.classroom);
  const inputRevision = normalizeRevision(state?.inputRevision);
  const layoutEpoch = normalizeRevision(state?.layoutEpoch);
  const plans = hadDuplicateIds
    ? []
    : (state?.plans ?? []).map((plan) => normalizePlan(plan, classroom, inputRevision));
  const selectedPlanId = plans.some((plan) => plan.id === state?.selectedPlanId)
    ? state?.selectedPlanId ?? null
    : null;

  return {
    classroom,
    rules: normalizeRuleConfig(state?.rules),
    plans,
    selectedPlanId,
    history:
      state?.history
        ?.filter((entry) => !entry.classId || entry.classId === classroom.id)
        .map((entry) => normalizeHistoryEntry(entry, classroom, inputRevision))
        .slice(-50) ?? initialHistory,
    inputRevision,
    layoutEpoch
  };
}

export function createBlankStudent(): StudentDraft {
  return {
    name: "",
    studentNo: "",
    gender: "未填",
    heightCm: 150,
    vision: "unknown",
    tags: [],
    remark: "",
    specialNeeds: ""
  };
}

export function createEmptyClassroom(): ClassRoom {
  const now = new Date().toISOString();
  return {
    id: createId("class"),
    name: "新班级",
    grade: "",
    term: "",
    layout: createGridLayout(6, 8, "top"),
    students: [],
    createdAt: now,
    updatedAt: now
  };
}

export { defaultRuleConfig };

function markInputsChanged(state: Pick<SeatWiseState, "inputRevision">) {
  return {
    inputRevision: state.inputRevision + 1,
    generationError: null
  };
}

function normalizeClassroom(value?: ClassRoom) {
  const source = value ?? initialClassroom;
  const seenIds = new Set<string>();
  let hadDuplicateIds = false;
  const students = source.students.map((student) => {
    const normalized = normalizeStudent(student);
    if (normalized.id && !seenIds.has(normalized.id)) {
      seenIds.add(normalized.id);
      return normalized;
    }

    hadDuplicateIds = true;
    const id = createId("student");
    seenIds.add(id);
    return { ...normalized, id };
  });
  const layout = createGridLayout(
    source.layout.rows,
    source.layout.columns,
    source.layout.podium,
    source.layout.seats
  );

  return {
    classroom: { ...source, students, layout },
    hadDuplicateIds
  };
}

function normalizeStudent(student: Student): Student {
  return {
    ...student,
    ...normalizeStudentDraft(student),
    id: student.id || createId("student")
  };
}

function normalizeStudentDraft(student: StudentDraft): StudentDraft {
  const height = Number(student.heightCm);
  return {
    name: String(student.name ?? "").trim(),
    studentNo: String(student.studentNo ?? "").trim(),
    gender: student.gender === "男" || student.gender === "女" ? student.gender : "未填",
    heightCm: Number.isFinite(height) ? Math.max(100, Math.min(220, Math.round(height))) : 150,
    vision: ["normal", "mild", "severe", "unknown"].includes(student.vision)
      ? student.vision
      : "unknown",
    tags: Array.isArray(student.tags)
      ? Array.from(new Set(student.tags.map((tag) => String(tag).trim()).filter(Boolean)))
      : [],
    remark: String(student.remark ?? "").trim(),
    specialNeeds: String(student.specialNeeds ?? "").trim()
  };
}

function normalizeStudentPatch(patch: Partial<Student>): Partial<Student> {
  const normalized = { ...patch };
  if (patch.heightCm !== undefined) {
    const height = Number(patch.heightCm);
    normalized.heightCm = Number.isFinite(height)
      ? Math.max(100, Math.min(220, Math.round(height)))
      : 150;
  }
  if (patch.tags) {
    normalized.tags = Array.from(
      new Set(patch.tags.map((tag) => String(tag).trim()).filter(Boolean))
    );
  }
  return normalized;
}

function normalizeStudentNumber(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function getNextStudentNumber(usedStudentNumbers: ReadonlySet<string>) {
  let value = 1;
  while (usedStudentNumbers.has(String(value).padStart(2, "0"))) value += 1;
  return String(value).padStart(2, "0");
}

function normalizeRevision(value: number | undefined) {
  return Number.isFinite(value) && (value as number) >= 0 ? Math.round(value as number) : 0;
}

function normalizePlan(plan: SeatingPlan, classroom: ClassRoom, inputRevision: number): SeatingPlan {
  const raw = plan as Partial<SeatingPlan>;
  const activeSeatIds = new Set(getActiveSeats(classroom.layout).map((seat) => seat.id));
  const studentIds = new Set(classroom.students.map((student) => student.id));
  const assignedStudentIds = new Set<string>();
  const assignments: Record<string, string | null> = {};

  activeSeatIds.forEach((seatId) => {
    const studentId = raw.assignments?.[seatId] ?? null;
    if (studentId && studentIds.has(studentId) && !assignedStudentIds.has(studentId)) {
      assignments[seatId] = studentId;
      assignedStudentIds.add(studentId);
    } else {
      assignments[seatId] = null;
    }
  });

  const unassignedStudentIds = classroom.students
    .filter((student) => !assignedStudentIds.has(student.id))
    .map((student) => student.id);
  const hardViolations = raw.feasibility?.hardViolations ?? [];
  const feasibility = {
    status:
      unassignedStudentIds.length || hardViolations.length ? ("partial" as const) : ("complete" as const),
    assignedCount: assignedStudentIds.size,
    totalStudents: classroom.students.length,
    unassignedStudentIds,
    hardViolations
  };

  return {
    ...plan,
    assignments,
    lockedSeatIds: (raw.lockedSeatIds ?? []).filter((id) => activeSeatIds.has(id)),
    lockedStudentIds: (raw.lockedStudentIds ?? []).filter((id) => studentIds.has(id)),
    sourceRevision: Number.isFinite(raw.sourceRevision) ? (raw.sourceRevision as number) : inputRevision - 1,
    generationSeed: Number.isFinite(raw.generationSeed) ? (raw.generationSeed as number) : 0,
    feasibility
  };
}

function normalizeHistoryEntry(entry: HistoryEntry, classroom: ClassRoom, inputRevision: number): HistoryEntry {
  const raw = entry as Partial<HistoryEntry>;
  const layoutSnapshot = raw.layoutSnapshot
    ? createGridLayout(
        raw.layoutSnapshot.rows,
        raw.layoutSnapshot.columns,
        raw.layoutSnapshot.podium,
        raw.layoutSnapshot.seats
      )
    : cloneValue(classroom.layout);
  const studentLabels =
    raw.studentLabels ??
    Object.fromEntries(
      classroom.students.map((student) => [
        student.id,
        { id: student.id, name: student.name, studentNo: student.studentNo, gender: student.gender }
      ])
    );
  const snapshotStudents: Student[] = Object.values(studentLabels).map((student) => ({
    ...student,
    heightCm: 150,
    vision: "unknown",
    tags: [],
    remark: "",
    specialNeeds: ""
  }));

  return {
    ...entry,
    plan: createHistoryPlanSnapshot(
      normalizePlan(
        entry.plan,
        { ...classroom, layout: layoutSnapshot, students: snapshotStudents },
        inputRevision
      )
    ),
    rules: normalizeRuleConfig(entry.rules),
    layoutSnapshot,
    layoutSignature: raw.layoutSignature ?? getLayoutSignature(layoutSnapshot),
    layoutEpoch: normalizeRevision(raw.layoutEpoch),
    studentLabels,
    legacySnapshot: raw.layoutSnapshot ? raw.legacySnapshot : true
  };
}

function getGenerationValidationError(classroom: ClassRoom) {
  const ids = classroom.students.map((student) => student.id);
  if (new Set(ids).size !== ids.length) return "学生数据包含重复标识，请重新导入名单。";
  if (classroom.students.length === 0) return "请先添加至少一名学生。";
  if (getActiveSeats(classroom.layout).length === 0) return "当前没有可用座位，请先调整教室布局。";
  return null;
}

export function getCompatibleHistory(
  history: HistoryEntry[],
  layout: ClassRoom["layout"],
  layoutEpoch = 0
) {
  const signature = getLayoutSignature(layout);
  let start = history.length;
  while (start > 0) {
    const entry = history[start - 1];
    if (entry.layoutSignature !== signature || normalizeRevision(entry.layoutEpoch) !== layoutEpoch) break;
    start -= 1;
  }
  return history.slice(start);
}

function createGenerationSeed() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createHistoryPlanSnapshot(plan: SeatingPlan): SeatingPlan {
  return {
    ...cloneValue(plan),
    warnings: [],
    reviewTips: []
  };
}
