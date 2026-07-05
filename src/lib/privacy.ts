import type { Student, ViewMode, VisibleStudent } from "@/lib/types";

export function getVisibleStudent(student: Student, mode: ViewMode): VisibleStudent {
  if (mode === "teacher") {
    return { ...student };
  }

  return {
    id: student.id,
    name: student.name,
    studentNo: student.studentNo,
    gender: student.gender
  };
}

export function shouldShowSensitive(mode: ViewMode) {
  return mode === "teacher";
}
