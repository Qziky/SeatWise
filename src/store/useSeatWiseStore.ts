"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createId } from "@/lib/id";
import { createGridLayout, toggleSeatAttribute as toggleAttribute } from "@/lib/layout";
import { applyRuleTemplate, defaultRuleConfig } from "@/lib/rules";
import { initialClassroom, initialHistory, sampleRules } from "@/lib/sample-data";
import {
  evaluatePlan,
  generateSeatingCandidates,
  moveStudentInAssignments
} from "@/lib/seating-engine";
import type {
  ClassRoom,
  PodiumDirection,
  RelationshipRuleType,
  RuleTemplate,
  SeatAttribute,
  SeatingPlan,
  SeatingRuleConfig,
  Student,
  ViewMode
} from "@/lib/types";

type ActiveSection = "overview" | "students" | "layout" | "rules" | "generate" | "history" | "export";

interface SeatWiseState {
  classroom: ClassRoom;
  rules: SeatingRuleConfig;
  plans: SeatingPlan[];
  selectedPlanId: string | null;
  history: typeof initialHistory;
  viewMode: ViewMode;
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  resetSampleData: () => void;
  updateClassMeta: (field: "name" | "grade" | "term", value: string) => void;
  addStudent: (student: Omit<Student, "id">) => void;
  updateStudent: (studentId: string, patch: Partial<Student>) => void;
  removeStudent: (studentId: string) => void;
  importStudents: (students: Student[]) => void;
  updateLayoutSize: (rows: number, columns: number) => void;
  updatePodium: (podium: PodiumDirection) => void;
  toggleSeatAttribute: (seatId: string, attribute: SeatAttribute) => void;
  toggleSeatLock: (seatId: string) => void;
  updateRuleFlag: (key: keyof Omit<SeatingRuleConfig, "template" | "relationships">, value: boolean) => void;
  applyTemplate: (template: RuleTemplate) => void;
  addRelationship: (studentAId: string, studentBId: string, type: RelationshipRuleType, note: string) => void;
  removeRelationship: (relationshipId: string) => void;
  generatePlans: () => void;
  selectPlan: (planId: string) => void;
  moveStudentToSeat: (studentId: string, targetSeatId: string) => void;
  toggleStudentLock: (studentId: string) => void;
  regenerateUnlocked: () => void;
  saveSelectedPlan: (adjustmentNote: string) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useSeatWiseStore = create<SeatWiseState>()(
  persist(
    (set, get) => ({
      classroom: initialClassroom,
      rules: sampleRules,
      plans: [],
      selectedPlanId: null,
      history: initialHistory,
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
            students: [...state.classroom.students, { ...student, id: createId("student") }],
            updatedAt: new Date().toISOString()
          }
        })),
      updateStudent: (studentId, patch) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            students: state.classroom.students.map((student) =>
              student.id === studentId ? { ...student, ...patch } : student
            ),
            updatedAt: new Date().toISOString()
          }
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
          }
        })),
      importStudents: (students) =>
        set((state) => ({
          classroom: {
            ...state.classroom,
            students: [...state.classroom.students, ...students],
            updatedAt: new Date().toISOString()
          }
        })),
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
          selectedPlanId: null
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
          selectedPlanId: null
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
          selectedPlanId: attribute === "empty" ? null : state.selectedPlanId
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
          }
        })),
      applyTemplate: (template) =>
        set((state) => ({
          rules: applyRuleTemplate(state.rules, template)
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
          }
        }));
      },
      removeRelationship: (relationshipId) =>
        set((state) => ({
          rules: {
            ...state.rules,
            relationships: state.rules.relationships.filter((relationship) => relationship.id !== relationshipId)
          }
        })),
      generatePlans: () => {
        const state = get();
        const plans = generateSeatingCandidates({
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: state.history,
          count: 3
        });

        set({
          plans,
          selectedPlanId: plans[0]?.id ?? null,
          activeSection: "generate"
        });
      },
      selectPlan: (planId) => set({ selectedPlanId: planId }),
      moveStudentToSeat: (studentId, targetSeatId) => {
        const state = get();
        const selected = state.plans.find((plan) => plan.id === state.selectedPlanId);
        if (!selected) return;
        if (selected.lockedStudentIds.includes(studentId) || selected.lockedSeatIds.includes(targetSeatId)) return;

        const sourceSeatId = Object.entries(selected.assignments).find(([, value]) => value === studentId)?.[0];
        if (sourceSeatId && selected.lockedSeatIds.includes(sourceSeatId)) return;

        const nextAssignments = moveStudentInAssignments(selected.assignments, studentId, targetSeatId);
        const evaluation = evaluatePlan(nextAssignments, {
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: state.history
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
                  reviewTips: evaluation.reviewTips
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
        const plans = generateSeatingCandidates({
          students: state.classroom.students,
          layout: state.classroom.layout,
          rules: state.rules,
          history: state.history,
          currentPlan: selected,
          count: 3
        });

        set({
          plans,
          selectedPlanId: plans[0]?.id ?? null
        });
      },
      saveSelectedPlan: (adjustmentNote) => {
        const state = get();
        const selected = state.plans.find((plan) => plan.id === state.selectedPlanId);
        if (!selected) return;

        set({
          history: [
            ...state.history,
            {
              id: createId("history"),
              classId: state.classroom.id,
              savedAt: new Date().toISOString(),
              plan: selected,
              rules: state.rules,
              adjustmentNote
            }
          ],
          activeSection: "history"
        });
      },
      setViewMode: (mode) => set({ viewMode: mode })
    }),
    {
      name: "seatwise-mvp",
      partialize: (state) => ({
        classroom: state.classroom,
        rules: state.rules,
        plans: state.plans,
        selectedPlanId: state.selectedPlanId,
        history: state.history,
        viewMode: state.viewMode,
        activeSection: state.activeSection
      })
    }
  )
);

export const getSelectedPlan = (state: SeatWiseState) =>
  state.plans.find((plan) => plan.id === state.selectedPlanId) ?? null;

export function createBlankStudent(): Omit<Student, "id"> {
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
