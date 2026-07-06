"use client";

import { GitFork, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { RelationshipRuleType, RuleTemplate } from "@/lib/types";
import { ruleTemplateLabels } from "@/lib/types";
import { useSeatWiseStore } from "@/store/useSeatWiseStore";

const templateDescriptions: Record<RuleTemplate, string> = {
  vision: "前排照顾与身高遮挡优先",
  fairness: "减少长期后排或边缘",
  discipline: "分散容易互相影响的组合",
  peer: "兼顾同桌和小组均衡",
  exam: "弱化偏好并增强随机性"
};

export function RuleConfigurator() {
  const classroom = useSeatWiseStore((state) => state.classroom);
  const rules = useSeatWiseStore((state) => state.rules);
  const updateRuleFlag = useSeatWiseStore((state) => state.updateRuleFlag);
  const applyTemplate = useSeatWiseStore((state) => state.applyTemplate);
  const addRelationship = useSeatWiseStore((state) => state.addRelationship);
  const removeRelationship = useSeatWiseStore((state) => state.removeRelationship);
  const [studentAId, setStudentAId] = useState(classroom.students[0]?.id ?? "");
  const [studentBId, setStudentBId] = useState(classroom.students[1]?.id ?? "");
  const [type, setType] = useState<RelationshipRuleType>("avoid-desk");
  const [note, setNote] = useState("");
  const studentById = new Map(classroom.students.map((student) => [student.id, student]));

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold text-ink">
            <SlidersHorizontal className="h-5 w-5 text-fern" />
            规则模板
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(ruleTemplateLabels) as RuleTemplate[]).map((template) => (
              <button
                type="button"
                key={template}
                className={cn(
                  "min-h-[82px] rounded-[8px] border p-2.5 text-left transition",
                  rules.template === template
                    ? "border-fern bg-chalk shadow-sm"
                    : "border-ink/10 bg-white hover:border-fern/50"
                )}
                onClick={() => applyTemplate(template)}
              >
                <div className="text-sm font-bold text-ink">{ruleTemplateLabels[template]}</div>
                <div className="mt-1 text-xs leading-5 text-ink/60">{templateDescriptions[template]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-ink">规则开关</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <RuleSwitch
              label="视力优先"
              checked={rules.visionPriority}
              onChange={(value) => updateRuleFlag("visionPriority", value)}
            />
            <RuleSwitch
              label="身高遮挡"
              checked={rules.heightBlocking}
              onChange={(value) => updateRuleFlag("heightBlocking", value)}
            />
            <RuleSwitch
              label="男女搭配"
              checked={rules.genderMix}
              onChange={(value) => updateRuleFlag("genderMix", value)}
            />
            <RuleSwitch
              label="公平轮换"
              checked={rules.fairnessRotation}
              onChange={(value) => updateRuleFlag("fairnessRotation", value)}
            />
            <RuleSwitch
              label="避免同桌"
              checked={rules.avoidDesk}
              onChange={(value) => updateRuleFlag("avoidDesk", value)}
            />
          </div>
        </div>
      </div>

      <aside className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
          <GitFork className="h-4 w-4 text-coral" />
          学生关系
        </h3>
        <div className="grid gap-2">
          <select
            className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
            value={studentAId}
            onChange={(event) => setStudentAId(event.target.value)}
          >
            {classroom.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
            value={studentBId}
            onChange={(event) => setStudentBId(event.target.value)}
          >
            {classroom.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value as RelationshipRuleType)}
          >
            <option value="avoid-desk">不能同桌</option>
            <option value="keep-apart">尽量分开</option>
          </select>
          <input
            className="rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
            placeholder="原因"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-[7px] bg-coral px-3 py-1.5 text-sm font-bold text-white hover:bg-coral/90"
            onClick={() => {
              addRelationship(studentAId, studentBId, type, note);
              setNote("");
            }}
            disabled={!studentAId || !studentBId || studentAId === studentBId}
          >
            <Plus className="h-3.5 w-3.5" />
            添加关系
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {rules.relationships.map((relationship) => (
            <div key={relationship.id} className="rounded-[7px] border border-ink/10 bg-paper p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink">
                    {studentById.get(relationship.studentAId)?.name ?? "学生A"} ·{" "}
                    {studentById.get(relationship.studentBId)?.name ?? "学生B"}
                  </div>
                  <div className="mt-0.5 text-xs text-ink/60">
                    {relationship.type === "avoid-desk" ? "不能同桌" : "尽量分开"}
                    {relationship.note ? `｜${relationship.note}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  title="删除关系"
                  className="rounded-[5px] p-1.5 text-coral hover:bg-coral/10"
                  onClick={() => removeRelationship(relationship.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function RuleSwitch({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-2 rounded-[7px] border border-ink/10 bg-paper px-3 py-2">
      <span className="text-sm font-bold text-ink">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-fern"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
