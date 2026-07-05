import { createId } from "@/lib/id";
import type { Gender, ParsedStudentImport, Student, VisionStatus } from "@/lib/types";

const headerAliases: Record<string, keyof Student> = {
  姓名: "name",
  名字: "name",
  name: "name",
  学号: "studentNo",
  编号: "studentNo",
  studentno: "studentNo",
  性别: "gender",
  gender: "gender",
  身高: "heightCm",
  身高cm: "heightCm",
  height: "heightCm",
  视力: "vision",
  vision: "vision",
  标签: "tags",
  tags: "tags",
  备注: "remark",
  remark: "remark",
  特殊需求: "specialNeeds",
  specialneeds: "specialNeeds"
};

const fallbackOrder: Array<keyof Student> = [
  "name",
  "studentNo",
  "gender",
  "heightCm",
  "vision",
  "tags",
  "remark",
  "specialNeeds"
];

export function parseStudentPaste(input: string): ParsedStudentImport {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], rejected: [], detectedHeaders: [] };
  }

  const firstColumns = splitRow(lines[0]);
  const mappedHeaders = firstColumns.map(mapHeader).filter(Boolean) as Array<keyof Student>;
  const hasHeader = mappedHeaders.length >= Math.max(2, Math.ceil(firstColumns.length / 2));
  const detectedHeaders = hasHeader ? firstColumns : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rejected: string[] = [];
  const rows: Student[] = [];

  dataLines.forEach((line, index) => {
    const columns = splitRow(line);
    const partial: Partial<Student> = {};

    columns.forEach((value, columnIndex) => {
      const key = hasHeader ? mapHeader(firstColumns[columnIndex] ?? "") : fallbackOrder[columnIndex];
      if (!key) return;
      assignImportValue(partial, key, value);
    });

    const name = partial.name?.trim();
    if (!name) {
      rejected.push(`第${index + 1}行缺少姓名：${line}`);
      return;
    }

    rows.push({
      id: createId("student"),
      name,
      studentNo: partial.studentNo?.trim() || String(rows.length + 1).padStart(2, "0"),
      gender: normalizeGender(partial.gender),
      heightCm: normalizeHeight(partial.heightCm),
      vision: normalizeVision(partial.vision),
      tags: Array.isArray(partial.tags) ? partial.tags : splitTags(String(partial.tags ?? "")),
      remark: partial.remark?.trim() ?? "",
      specialNeeds: partial.specialNeeds?.trim() ?? ""
    });
  });

  return { rows, rejected, detectedHeaders };
}

function splitRow(row: string) {
  const delimiter = row.includes("\t") ? "\t" : row.includes(",") ? "," : /\s{2,}/;
  return row.split(delimiter).map((item) => item.trim());
}

function mapHeader(value: string) {
  return headerAliases[value.trim().toLowerCase().replace(/[()（）\s]/g, "")];
}

function assignImportValue(partial: Partial<Student>, key: keyof Student, value: string) {
  if (key === "tags") {
    partial.tags = splitTags(value);
    return;
  }

  if (key === "heightCm") {
    partial.heightCm = normalizeHeight(value);
    return;
  }

  if (key === "vision") {
    partial.vision = normalizeVision(value);
    return;
  }

  if (key === "gender") {
    partial.gender = normalizeGender(value);
    return;
  }

  partial[key] = value as never;
}

function splitTags(value: string) {
  return value
    .split(/[、;；|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGender(value: unknown): Gender {
  const text = String(value ?? "").trim();
  if (["男", "m", "male", "boy"].includes(text.toLowerCase())) return "男";
  if (["女", "f", "female", "girl"].includes(text.toLowerCase())) return "女";
  return "未填";
}

function normalizeHeight(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
}

function normalizeVision(value: unknown): VisionStatus {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (/(重点|高度|严重|差|近视|severe|high)/.test(text)) return "severe";
  if (/(轻|一般|关注|mild)/.test(text)) return "mild";
  if (/(正常|好|normal|ok)/.test(text)) return "normal";
  return "unknown";
}
