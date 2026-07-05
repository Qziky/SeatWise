import { getSeatById } from "@/lib/layout";
import { getVisibleStudent } from "@/lib/privacy";
import type { ClassRoom, ExportFormat, SeatingPlan, Student, ViewMode } from "@/lib/types";

export function exportSeatingPlan(args: {
  format: ExportFormat;
  mode: ViewMode;
  classroom: ClassRoom;
  plan: SeatingPlan;
}) {
  if (typeof window === "undefined") return;

  if (args.format === "pdf") {
    window.print();
    return;
  }

  if (args.format === "excel") {
    const csv = buildCsv(args);
    downloadBlob(csv, "text/csv;charset=utf-8", `${args.classroom.name}-座位表.csv`);
    return;
  }

  const svg = buildSvg(args);
  downloadBlob(svg, "image/svg+xml;charset=utf-8", `${args.classroom.name}-座位表.svg`);
}

function buildCsv(args: {
  mode: ViewMode;
  classroom: ClassRoom;
  plan: SeatingPlan;
}) {
  const studentsById = new Map(args.classroom.students.map((student) => [student.id, student]));
  const headers =
    args.mode === "teacher"
      ? ["排", "列", "姓名", "学号", "性别", "身高", "视力", "标签", "备注", "特殊需求"]
      : ["排", "列", "姓名", "学号", "性别"];

  const rows = Object.entries(args.plan.assignments).map(([seatId, studentId]) => {
    const seat = getSeatById(args.classroom.layout, seatId);
    const student = studentId ? studentsById.get(studentId) : null;
    const visible = student ? getVisibleStudent(student, args.mode) : null;

    if (!seat || !visible) {
      return [seat?.row ?? "", seat?.column ?? "", "", "", ""];
    }

    const base = [seat.row, seat.column, visible.name, visible.studentNo, visible.gender];
    if (args.mode !== "teacher") return base;

    return [
      ...base,
      visible.heightCm ?? "",
      visible.vision ?? "",
      visible.tags?.join("、") ?? "",
      visible.remark ?? "",
      visible.specialNeeds ?? ""
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function buildSvg(args: {
  mode: ViewMode;
  classroom: ClassRoom;
  plan: SeatingPlan;
}) {
  const cellWidth = 116;
  const cellHeight = 70;
  const gap = 12;
  const padding = 48;
  const width = padding * 2 + args.classroom.layout.columns * cellWidth + (args.classroom.layout.columns - 1) * gap;
  const height = padding * 2 + args.classroom.layout.rows * cellHeight + (args.classroom.layout.rows - 1) * gap + 64;
  const studentsById = new Map<string, Student>(args.classroom.students.map((student) => [student.id, student]));

  const cells = args.classroom.layout.seats
    .map((seat) => {
      const x = padding + (seat.column - 1) * (cellWidth + gap);
      const y = padding + 52 + (seat.row - 1) * (cellHeight + gap);
      const student = args.plan.assignments[seat.id]
        ? studentsById.get(args.plan.assignments[seat.id] as string)
        : null;
      const visible = student ? getVisibleStudent(student, args.mode) : null;
      const fill = seat.attributes.includes("empty") ? "#e8e1d2" : "#f8fbf8";
      const text = visible ? `${visible.name} ${visible.studentNo}` : "空";
      return `<g><rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="8" fill="${fill}" stroke="#6b7a70" stroke-width="1"/><text x="${x + cellWidth / 2}" y="${y + 39}" text-anchor="middle" font-size="18" fill="#17202a">${escapeXml(text)}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfaf6"/><text x="${padding}" y="${padding}" font-size="28" font-weight="700" fill="#17202a">${escapeXml(args.classroom.name)} 座位表</text>${cells}</svg>`;
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
