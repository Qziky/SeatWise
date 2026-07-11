import { beforeEach, describe, expect, it } from "vitest";
import {
  createBlankStudent,
  getCompatibleHistory,
  getSelectedPlan,
  isPlanStale,
  useSeatWiseStore
} from "@/store/useSeatWiseStore";

describe("useSeatWiseStore invariants", () => {
  beforeEach(() => {
    localStorage.clear();
    useSeatWiseStore.getState().resetSampleData();
  });

  it("marks generated plans stale after scoring inputs change", () => {
    useSeatWiseStore.getState().generatePlans();
    const generated = getSelectedPlan(useSeatWiseStore.getState());
    expect(generated).not.toBeNull();
    expect(isPlanStale(useSeatWiseStore.getState(), generated)).toBe(false);

    const student = useSeatWiseStore.getState().classroom.students[0];
    useSeatWiseStore.getState().updateStudent(student.id, { heightCm: 220 });

    const stale = getSelectedPlan(useSeatWiseStore.getState());
    expect(isPlanStale(useSeatWiseStore.getState(), stale)).toBe(true);
    useSeatWiseStore.getState().saveSelectedPlan("不应保存");
    expect(useSeatWiseStore.getState().history).toHaveLength(0);
  });

  it("generates ids in the store and rejects duplicate student numbers", () => {
    const draft = {
      ...createBlankStudent(),
      name: "测试学生",
      studentNo: "17"
    };

    const first = useSeatWiseStore.getState().importStudents([draft]);
    const second = useSeatWiseStore.getState().importStudents([{ ...draft, name: "重复学生" }]);
    const imported = useSeatWiseStore
      .getState()
      .classroom.students.filter((student) => student.studentNo === "17");

    expect(first).toEqual({ importedCount: 1, conflicts: [] });
    expect(second.importedCount).toBe(0);
    expect(second.conflicts).toEqual([
      { studentNo: "17", name: "重复学生", reason: "duplicate-student-no" }
    ]);
    expect(imported).toHaveLength(1);
    expect(imported[0].id).toMatch(/^student-/);
  });

  it("saves a self-contained minimal history snapshot", () => {
    useSeatWiseStore.getState().generatePlans();
    useSeatWiseStore.getState().saveSelectedPlan("首版");
    const saved = useSeatWiseStore.getState().history[0];
    const student = useSeatWiseStore.getState().classroom.students[0];
    const originalName = student.name;
    const originalRows = saved.layoutSnapshot.rows;

    useSeatWiseStore.getState().updateStudent(student.id, { name: "改名后" });
    useSeatWiseStore.getState().updateLayoutSize(2, 2);

    expect(saved.studentLabels[student.id].name).toBe(originalName);
    expect(saved.layoutSnapshot.rows).toBe(originalRows);
    expect(saved.layoutSignature).toContain(`${originalRows}x`);
    expect(saved.studentLabels[student.id]).not.toHaveProperty("remark");
    expect(saved.plan.warnings).toEqual([]);
    expect(saved.plan.reviewTips).toEqual([]);
  });

  it("starts a fresh rotation baseline after a layout A-B-A transition", () => {
    useSeatWiseStore.getState().generatePlans();
    useSeatWiseStore.getState().saveSelectedPlan("布局 A");
    const original = useSeatWiseStore.getState().classroom.layout;

    useSeatWiseStore.getState().updateLayoutSize(original.rows + 1, original.columns);
    useSeatWiseStore.getState().updateLayoutSize(original.rows, original.columns);
    const current = useSeatWiseStore.getState();

    expect(getCompatibleHistory(current.history, current.classroom.layout, current.layoutEpoch)).toEqual([]);
  });

  it("clears only candidate plans during fault recovery", () => {
    useSeatWiseStore.getState().generatePlans();
    const classroomId = useSeatWiseStore.getState().classroom.id;

    useSeatWiseStore.getState().clearPlans();

    expect(useSeatWiseStore.getState().plans).toEqual([]);
    expect(useSeatWiseStore.getState().selectedPlanId).toBeNull();
    expect(useSeatWiseStore.getState().classroom.id).toBe(classroomId);
  });

  it("migrates version 2 plans as stale and reconstructs legacy history snapshots", async () => {
    useSeatWiseStore.getState().generatePlans();
    const current = useSeatWiseStore.getState();
    const plan = structuredClone(current.plans[0]) as unknown as Record<string, unknown>;
    delete plan.sourceRevision;
    delete plan.generationSeed;
    delete plan.feasibility;
    const legacyEntry = {
      id: "legacy-history",
      classId: current.classroom.id,
      savedAt: "2026-07-01T00:00:00.000Z",
      plan,
      rules: current.rules,
      adjustmentNote: "旧版本"
    };

    localStorage.setItem(
      "seatwise-mvp",
      JSON.stringify({
        version: 2,
        state: {
          classroom: current.classroom,
          rules: current.rules,
          plans: [plan],
          selectedPlanId: plan.id,
          history: [legacyEntry]
        }
      })
    );

    await useSeatWiseStore.persist.rehydrate();
    const migrated = useSeatWiseStore.getState();

    expect(migrated.plans[0].sourceRevision).toBe(-1);
    expect(isPlanStale(migrated, migrated.plans[0])).toBe(true);
    expect(migrated.history[0].legacySnapshot).toBe(true);
    expect(migrated.history[0].layoutSnapshot.rows).toBe(current.classroom.layout.rows);
    expect(migrated.history[0].studentLabels[current.classroom.students[0].id].name).toBe(
      current.classroom.students[0].name
    );
  });
});
