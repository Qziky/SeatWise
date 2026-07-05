import { describe, expect, it } from "vitest";
import { getVisibleStudent } from "@/lib/privacy";
import type { Student } from "@/lib/types";

const student: Student = {
  id: "stu-1",
  name: "张浩",
  studentNo: "01",
  gender: "男",
  heightCm: 158,
  vision: "severe",
  tags: ["需要靠前"],
  remark: "敏感备注",
  specialNeeds: "前排"
};

describe("privacy helpers", () => {
  it("keeps sensitive fields in teacher mode", () => {
    expect(getVisibleStudent(student, "teacher")).toMatchObject({
      remark: "敏感备注",
      vision: "severe"
    });
  });

  it("hides sensitive fields in student and print modes", () => {
    expect(getVisibleStudent(student, "student")).not.toHaveProperty("remark");
    expect(getVisibleStudent(student, "print")).not.toHaveProperty("vision");
  });
});
