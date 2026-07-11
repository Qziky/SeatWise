"use client";

import { AlertTriangle, Clock3, RotateCw, UsersRound } from "lucide-react";
import { getLayoutSignature } from "@/lib/layout";
import { getRotationDeviationTips } from "@/lib/rotation";
import { getFairnessRisks, getLongTermDeskMateRisks } from "@/lib/seating-engine";
import type { ClassRoom, HistoryEntry, Student } from "@/lib/types";
import { useSeatWiseStore } from "@/store/useSeatWiseStore";
import { SeatingBoard } from "@/components/SeatingBoard";

export function HistoryPanel() {
  const classroom = useSeatWiseStore((state) => state.classroom);
  const history = useSeatWiseStore((state) => state.history);
  const viewMode = useSeatWiseStore((state) => state.viewMode);
  const currentLayoutSignature = getLayoutSignature(classroom.layout);
  const currentLayoutHistory = history.filter(
    (entry) => entry.layoutSignature === currentLayoutSignature
  );
  const currentStudentIds = new Set(classroom.students.map((student) => student.id));
  const risks = getFairnessRisks(currentLayoutHistory, classroom.layout, classroom.students);
  const deskMateRisks = getLongTermDeskMateRisks(currentLayoutHistory, classroom.layout).filter(
    (risk) => currentStudentIds.has(risk.studentAId) && currentStudentIds.has(risk.studentBId)
  );
  const studentsById = new Map(classroom.students.map((student) => [student.id, student]));
  const latest = history.at(-1);
  const latestClassroom = latest ? createHistoryClassroom(latest, classroom) : null;
  const latestComparableHistory = latest
    ? history.slice(0, -1).filter((entry) => entry.layoutSignature === latest.layoutSignature)
    : [];
  const latestRotationDeviationTips = latest
    ? getRotationDeviationTips({
        assignments: latest.plan.assignments,
        history: latestComparableHistory,
        layout: latest.layoutSnapshot,
        policy: latest.rules.rotationPolicy,
        students: latestClassroom?.students ?? [],
        validStudentIds: new Set(Object.keys(latest.studentLabels))
      })
    : [];

  return (
    <section className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold text-ink">
            <Clock3 className="h-5 w-5 text-fern" />
            座位历史
          </h2>
          {history.length ? (
            <div className="space-y-2">
              {[...history].reverse().map((entry, index) => (
                <article key={entry.id} className="rounded-[8px] border border-ink/10 bg-paper p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ink">版本 {history.length - index}</h3>
                      <p className="mt-0.5 text-xs text-ink/60">
                        {new Date(entry.savedAt).toLocaleString("zh-CN")} · 总分 {entry.plan.score.total}
                      </p>
                    </div>
                    <span className="rounded-[5px] bg-fern px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {entry.rules.template}
                    </span>
                  </div>
                  {entry.adjustmentNote ? (
                    <p className="mt-2 rounded-[7px] bg-white p-2 text-xs text-ink/70">{entry.adjustmentNote}</p>
                  ) : null}
                  {entry.legacySnapshot ? (
                    <p className="mt-2 text-[11px] font-semibold text-marigold">
                      旧数据按迁移时的布局近似恢复
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-ink/20 bg-paper p-6 text-center text-sm text-ink/60">
              还没有保存过的座位版本
            </div>
          )}
        </div>

        {latest && latestClassroom ? (
          <div className="min-w-0 rounded-[8px] border border-ink/10 bg-white p-2 shadow-sm md:p-3">
            <h3 className="mb-2 text-sm font-bold text-ink">最新保存方案</h3>
            <SeatingBoard
              classroom={latestClassroom}
              plan={latest.plan}
              mode={viewMode === "teacher" ? "student" : viewMode}
              readonly
            />
            {viewMode === "teacher" ? (
              <p className="mt-2 text-xs text-ink/50">历史快照仅保留姓名、学号和性别。</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="space-y-3">
        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <AlertTriangle className="h-4 w-4 text-coral" />
            轮换风险
          </h3>
          {risks.size || deskMateRisks.length ? (
            <div className="space-y-1.5">
              {Array.from(risks.entries()).map(([studentId, reasons]) => (
                <div key={studentId} className="rounded-[7px] bg-coral/10 p-2 text-xs font-semibold text-coral">
                  {studentsById.get(studentId)?.name ?? "学生"}：{reasons.join("、")}
                </div>
              ))}
              {deskMateRisks.map((risk) => (
                <div
                  key={`${risk.studentAId}-${risk.studentBId}`}
                  className="rounded-[7px] bg-marigold/15 p-2 text-xs font-semibold text-marigold"
                >
                  {studentsById.get(risk.studentAId)?.name ?? "学生A"} 与{" "}
                  {studentsById.get(risk.studentBId)?.name ?? "学生B"}：长期同桌 {risk.count} 次
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[7px] bg-chalk p-2 text-xs font-bold text-fern">暂无长期后排、边缘或同桌风险</div>
          )}
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <RotateCw className="h-4 w-4 text-fern" />
            轮换偏离
          </h3>
          {latestRotationDeviationTips.length ? (
            <div className="space-y-1.5">
              {latestRotationDeviationTips.map((tip) => (
                <div key={tip} className="rounded-[7px] bg-paper p-2 text-xs font-semibold text-ink/70">
                  {tip}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[7px] bg-chalk p-2 text-xs font-bold text-fern">
              暂无最新方案的轮换偏离
            </div>
          )}
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <UsersRound className="h-4 w-4 text-marigold" />
            学生轨迹
          </h3>
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
            {classroom.students.map((student) => {
              const seats = history
                .map((entry) => {
                  const seatId = Object.entries(entry.plan.assignments).find(([, value]) => value === student.id)?.[0];
                  return entry.layoutSnapshot.seats.find((seat) => seat.id === seatId);
                })
                .filter(Boolean);

              return (
                <div key={student.id} className="rounded-[7px] border border-ink/10 bg-paper p-2">
                  <div className="text-sm font-bold text-ink">{student.name}</div>
                  <div className="mt-0.5 text-xs text-ink/60">
                    {seats.length
                      ? seats.map((seat) => `${seat?.row}-${seat?.column}`).join("、")
                      : "暂无记录"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </section>
  );
}

function createHistoryClassroom(entry: HistoryEntry, current: ClassRoom): ClassRoom {
  const students: Student[] = Object.values(entry.studentLabels).map((student) => ({
    ...student,
    heightCm: 150,
    vision: "unknown",
    tags: [],
    remark: "",
    specialNeeds: ""
  }));

  return {
    ...current,
    layout: entry.layoutSnapshot,
    students
  };
}
