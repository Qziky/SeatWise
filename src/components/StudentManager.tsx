"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { parseStudentPaste } from "@/lib/importer";
import { visionLabels } from "@/lib/types";
import type { Gender, Student, VisionStatus } from "@/lib/types";
import { createBlankStudent, useSeatWiseStore } from "@/store/useSeatWiseStore";

const genderOptions: Gender[] = ["男", "女", "未填"];
const visionOptions: VisionStatus[] = ["normal", "mild", "severe", "unknown"];

export function StudentManager() {
  const classroom = useSeatWiseStore((state) => state.classroom);
  const addStudent = useSeatWiseStore((state) => state.addStudent);
  const updateStudent = useSeatWiseStore((state) => state.updateStudent);
  const removeStudent = useSeatWiseStore((state) => state.removeStudent);
  const importStudents = useSeatWiseStore((state) => state.importStudents);
  const [draft, setDraft] = useState(createBlankStudent());
  const [pasteText, setPasteText] = useState(
    "姓名\t学号\t性别\t身高\t视力\t标签\t备注\t特殊需求\n秦朗\t17\t男\t159\t轻度关注\t互助搭配\t\t\n叶安\t18\t女\t146\t重点照顾\t需要靠前\t看黑板吃力\t前两排"
  );
  const [importMessage, setImportMessage] = useState("");
  const preview = useMemo(() => parseStudentPaste(pasteText), [pasteText]);

  function handleAddStudent() {
    if (!draft.name.trim()) return;
    addStudent({
      ...draft,
      name: draft.name.trim(),
      studentNo: draft.studentNo.trim() || String(classroom.students.length + 1).padStart(2, "0")
    });
    setDraft(createBlankStudent());
  }

  return (
    <section className="space-y-3">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink">学生档案</h2>
              <p className="mt-0.5 text-xs text-ink/60">{classroom.students.length} 名学生</p>
            </div>
          </div>

          <div className="grid gap-2 lg:hidden">
            {classroom.students.map((student) => (
              <StudentMobileCard
                key={student.id}
                student={student}
                onUpdate={(patch) => updateStudent(student.id, patch)}
                onRemove={() => removeStudent(student.id)}
              />
            ))}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto lg:block">
            <table className="min-w-[860px] w-full border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr className="text-xs font-bold text-ink/55">
                  <th className="border-b border-ink/10 px-1.5 py-1.5">姓名</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">学号</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">性别</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">身高</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">视力</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">标签</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">备注</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5">特殊需求</th>
                  <th className="border-b border-ink/10 px-1.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    onUpdate={(patch) => updateStudent(student.id, patch)}
                    onRemove={() => removeStudent(student.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Plus className="h-4 w-4 text-fern" />
              新增学生
            </h3>
            <div className="grid gap-2">
              <input
                className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                placeholder="姓名"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                  placeholder="学号"
                  value={draft.studentNo}
                  onChange={(event) => setDraft({ ...draft, studentNo: event.target.value })}
                />
                <input
                  className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                type="number"
                min={100}
                max={220}
                aria-label="身高"
                value={draft.heightCm}
                onChange={(event) => {
                  if (Number.isFinite(event.target.valueAsNumber)) {
                    setDraft({ ...draft, heightCm: event.target.valueAsNumber });
                  }
                }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                  value={draft.gender}
                  aria-label="性别"
                  onChange={(event) => setDraft({ ...draft, gender: event.target.value as Gender })}
                >
                  {genderOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <select
                  className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                  value={draft.vision}
                  aria-label="视力"
                  onChange={(event) => setDraft({ ...draft, vision: event.target.value as VisionStatus })}
                >
                  {visionOptions.map((option) => (
                    <option key={option} value={option}>
                      {visionLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                placeholder="标签，用顿号分隔"
                value={draft.tags.join("、")}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tags: event.target.value
                      .split(/[、,，;；]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  })
                }
              />
              <textarea
                className="min-h-16 rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                placeholder="备注"
                value={draft.remark}
                onChange={(event) => setDraft({ ...draft, remark: event.target.value })}
              />
              <input
                className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                placeholder="特殊需求"
                value={draft.specialNeeds}
                onChange={(event) => setDraft({ ...draft, specialNeeds: event.target.value })}
              />
              <button
                type="button"
                className="rounded-[7px] bg-fern px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-fern/90"
                onClick={handleAddStudent}
                disabled={!draft.name.trim()}
              >
                添加学生
              </button>
            </div>
          </div>

          <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Upload className="h-4 w-4 text-coral" />
              复制粘贴导入
            </h3>
            <textarea
              className="min-h-28 w-full rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
              value={pasteText}
              aria-label="粘贴学生名单"
              onChange={(event) => {
                setPasteText(event.target.value);
                setImportMessage("");
              }}
            />
            <div className="mt-2 rounded-[7px] bg-chalk p-2 text-xs text-ink/70">
              已解析 {preview.rows.length} 行
              {preview.detectedHeaders.length ? `，识别表头：${preview.detectedHeaders.join("、")}` : ""}
              {preview.rejected.length ? `，${preview.rejected.length} 行待修正` : ""}
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-[7px] bg-coral px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-coral/90"
              disabled={preview.rows.length === 0}
              onClick={() => {
                const result = importStudents(preview.rows);
                const conflictText = result.conflicts.length
                  ? `，跳过 ${result.conflicts.length} 个重复学号`
                  : "";
                setImportMessage(`已导入 ${result.importedCount} 名学生${conflictText}。`);
                if (result.importedCount) setPasteText("");
              }}
            >
              确认导入 {preview.rows.length} 名
            </button>
            {importMessage ? (
              <p className="mt-2 rounded-[7px] bg-paper p-2 text-xs font-semibold text-ink/70" role="status">
                {importMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function StudentMobileCard({
  student,
  onUpdate,
  onRemove
}: {
  student: Student;
  onUpdate: (patch: Partial<Student>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-[8px] border border-ink/10 bg-paper p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-ink">{student.name || "未命名学生"}</div>
          <div className="mt-0.5 text-xs font-semibold text-ink/55">
            {student.studentNo || "未填学号"} · {student.gender}
          </div>
        </div>
        <button
          type="button"
          title="删除学生"
          className="rounded-[5px] p-1.5 text-coral hover:bg-coral/10"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-xs font-bold text-ink/55">
          姓名
          <input
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            value={student.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        </label>
        <label className="text-xs font-bold text-ink/55">
          学号
          <input
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            value={student.studentNo}
            onChange={(event) => onUpdate({ studentNo: event.target.value })}
          />
        </label>
        <label className="text-xs font-bold text-ink/55">
          性别
          <select
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            value={student.gender}
            onChange={(event) => onUpdate({ gender: event.target.value as Gender })}
          >
            {genderOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-ink/55">
          身高
          <input
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            type="number"
            min={100}
            max={220}
            value={student.heightCm}
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber)) {
                onUpdate({ heightCm: event.target.valueAsNumber });
              }
            }}
          />
        </label>
        <label className="text-xs font-bold text-ink/55">
          视力
          <select
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            value={student.vision}
            onChange={(event) => onUpdate({ vision: event.target.value as VisionStatus })}
          >
            {visionOptions.map((option) => (
              <option key={option} value={option}>
                {visionLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-ink/55">
          标签
          <input
            className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
            value={student.tags.join("、")}
            onChange={(event) =>
              onUpdate({
                tags: event.target.value
                  .split(/[、,，;；]/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
          />
        </label>
      </div>

      <label className="mt-2 block text-xs font-bold text-ink/55">
        备注
        <input
          className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
          value={student.remark}
          onChange={(event) => onUpdate({ remark: event.target.value })}
        />
      </label>
      <label className="mt-2 block text-xs font-bold text-ink/55">
        特殊需求
        <input
          className="mt-1 w-full rounded-[6px] border border-ink/10 bg-white px-2 py-1 text-sm"
          value={student.specialNeeds}
          onChange={(event) => onUpdate({ specialNeeds: event.target.value })}
        />
      </label>
    </article>
  );
}

function StudentRow({
  student,
  onUpdate,
  onRemove
}: {
  student: Student;
  onUpdate: (patch: Partial<Student>) => void;
  onRemove: () => void;
}) {
  return (
    <tr className="align-top">
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-20 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 姓名`}
          value={student.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-14 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 学号`}
          value={student.studentNo}
          onChange={(event) => onUpdate({ studentNo: event.target.value })}
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <select
          className="w-16 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 性别`}
          value={student.gender}
          onChange={(event) => onUpdate({ gender: event.target.value as Gender })}
        >
          {genderOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-16 rounded-[6px] border border-ink/10 px-1.5 py-1"
          type="number"
          min={100}
          max={220}
          aria-label={`${student.name} 身高`}
          value={student.heightCm}
          onChange={(event) => {
            if (Number.isFinite(event.target.valueAsNumber)) {
              onUpdate({ heightCm: event.target.valueAsNumber });
            }
          }}
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <select
          className="w-24 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 视力`}
          value={student.vision}
          onChange={(event) => onUpdate({ vision: event.target.value as VisionStatus })}
        >
          {visionOptions.map((option) => (
            <option key={option} value={option}>
              {visionLabels[option]}
            </option>
          ))}
        </select>
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-28 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 标签`}
          value={student.tags.join("、")}
          onChange={(event) =>
            onUpdate({
              tags: event.target.value
                .split(/[、,，;；]/)
                .map((item) => item.trim())
                .filter(Boolean)
            })
          }
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-36 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 备注`}
          value={student.remark}
          onChange={(event) => onUpdate({ remark: event.target.value })}
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <input
          className="w-36 rounded-[6px] border border-ink/10 px-1.5 py-1"
          aria-label={`${student.name} 特殊需求`}
          value={student.specialNeeds}
          onChange={(event) => onUpdate({ specialNeeds: event.target.value })}
        />
      </td>
      <td className="border-b border-ink/5 px-1.5 py-1.5">
        <button
          type="button"
          title="删除学生"
          className="rounded-[5px] p-1.5 text-coral hover:bg-coral/10"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
