import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeatingBoard } from "@/components/SeatingBoard";
import type { ClassRoom, SeatingPlan } from "@/lib/types";

const classroom: ClassRoom = {
  id: "class-1",
  name: "测试班",
  grade: "七年级",
  term: "2026 春",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  students: [
    {
      id: "student-1",
      name: "张三",
      studentNo: "01",
      gender: "男",
      heightCm: 160,
      vision: "normal",
      tags: [],
      remark: "",
      specialNeeds: ""
    }
  ],
  layout: {
    rows: 2,
    columns: 2,
    podium: "top",
    seats: [
      { id: "seat-1", row: 1, column: 1, attributes: [] },
      { id: "seat-2", row: 1, column: 2, attributes: [] },
      { id: "seat-3", row: 2, column: 1, attributes: ["empty"] },
      { id: "seat-4", row: 2, column: 2, attributes: [] }
    ]
  }
};

function createPlan(overrides: Partial<SeatingPlan> = {}): SeatingPlan {
  return {
    id: "plan-1",
    name: "测试方案",
    createdAt: "2026-01-01T00:00:00.000Z",
    assignments: {
      "seat-1": "student-1",
      "seat-2": null,
      "seat-3": null,
      "seat-4": null
    },
    score: {
      total: 100,
      health: 100,
      height: 100,
      discipline: 100,
      gender: 100,
      fairness: 100,
      balance: 100
    },
    satisfied: [],
    warnings: [],
    reviewTips: [],
    lockedSeatIds: [],
    lockedStudentIds: [],
    sourceRevision: 1,
    generationSeed: 1,
    feasibility: {
      status: "complete",
      assignedCount: 1,
      totalStudents: 1,
      unassignedStudentIds: [],
      hardViolations: []
    },
    ...overrides
  };
}

describe("SeatingBoard", () => {
  it.each([
    {
      description: "只锁定座位",
      plan: createPlan({ lockedSeatIds: ["seat-1"] }),
      title: "座位已锁定"
    },
    {
      description: "只锁定学生",
      plan: createPlan({ lockedStudentIds: ["student-1"] }),
      title: "学生已锁定"
    }
  ])("$description 时正常显示锁定徽标", ({ plan, title }) => {
    render(<SeatingBoard classroom={classroom} plan={plan} mode="teacher" />);

    expect(screen.getByTitle(title)).toHaveTextContent("锁");
  });

  it("支持键盘打开和关闭详情，并通过选择器移动学生", async () => {
    const onMoveStudent = vi.fn();
    const sourceSeat = render(
      <SeatingBoard
        classroom={classroom}
        plan={createPlan({ lockedSeatIds: ["seat-4"] })}
        mode="teacher"
        onMoveStudent={onMoveStudent}
      />
    ).getByRole("button", { name: "1-1 张三，查看详情" });

    sourceSeat.focus();
    fireEvent.keyDown(sourceSeat, { key: "Enter" });

    const dialog = screen.getByRole("dialog", { name: "座位详情" });
    await waitFor(() => expect(dialog).toHaveFocus());

    const targetSelect = screen.getByRole("combobox", { name: "移动到座位" });
    expect(within(targetSelect).getByRole("option", { name: "第 1 排第 2 列（空）" })).toBeInTheDocument();
    expect(within(targetSelect).queryByRole("option", { name: /第 2 排第 1 列/ })).not.toBeInTheDocument();
    expect(within(targetSelect).queryByRole("option", { name: /第 2 排第 2 列/ })).not.toBeInTheDocument();

    fireEvent.change(targetSelect, { target: { value: "seat-2" } });
    fireEvent.click(screen.getByRole("button", { name: "移动学生" }));

    expect(onMoveStudent).toHaveBeenCalledWith("student-1", "seat-2");
    await waitFor(() => expect(sourceSeat).toHaveFocus());

    fireEvent.keyDown(sourceSeat, { key: " " });
    const reopenedDialog = screen.getByRole("dialog", { name: "座位详情" });
    await waitFor(() => expect(reopenedDialog).toHaveFocus());

    fireEvent.keyDown(reopenedDialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "座位详情" })).not.toBeInTheDocument();
    await waitFor(() => expect(sourceSeat).toHaveFocus());
  });
});
