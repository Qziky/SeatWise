"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { getSelectedPlan, useSeatWiseStore } from "@/store/useSeatWiseStore";
import { ScoreBar } from "@/components/ScoreBar";
import { SeatingBoard } from "@/components/SeatingBoard";
import { ViewModeToggle } from "@/components/ViewModeToggle";

export function GeneratorPanel() {
  const state = useSeatWiseStore();
  const selectedPlan = getSelectedPlan(state);
  const [note, setNote] = useState("");

  return (
    <section className="space-y-3">
      <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm no-print">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">生成方案</h2>
            <p className="mt-0.5 text-xs text-ink/60">
              {state.classroom.students.length} 名学生 · {state.classroom.layout.rows} 行 {state.classroom.layout.columns} 列
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ViewModeToggle value={state.viewMode} onChange={state.setViewMode} />
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-[7px] bg-fern px-3 py-1.5 text-sm font-bold text-white hover:bg-fern/90"
              onClick={state.generatePlans}
            >
              <Sparkles className="h-4 w-4" />
              生成
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-[7px] border border-ink/10 bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-chalk"
              onClick={state.regenerateUnlocked}
              disabled={!selectedPlan}
            >
              <RefreshCw className="h-4 w-4" />
              重排未锁定
            </button>
          </div>
        </div>
      </div>

      {state.plans.length ? (
        <div className="grid gap-2 md:grid-cols-3 no-print">
          {state.plans.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={cn(
                "rounded-[8px] border p-3 text-left transition",
                plan.id === state.selectedPlanId
                  ? "border-fern bg-chalk shadow-sm"
                  : "border-ink/10 bg-white hover:border-fern/50"
              )}
              onClick={() => state.selectPlan(plan.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{plan.name}</span>
                <span className="rounded-[5px] bg-ink px-1.5 py-0.5 text-xs font-bold text-white">{plan.score.total}</span>
              </div>
              {state.viewMode === "teacher" ? (
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <ScoreBar label="视力" value={plan.score.health} />
                  <ScoreBar
                    label="纪律"
                    value={plan.score.discipline}
                    tone={plan.score.discipline < 70 ? "coral" : "fern"}
                  />
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[8px] border border-ink/10 bg-white p-2 shadow-sm print-surface md:p-3">
          {selectedPlan ? (
            <SeatingBoard
              classroom={state.classroom}
              plan={selectedPlan}
              mode={state.viewMode}
              onMoveStudent={state.moveStudentToSeat}
              onToggleSeatLock={state.toggleSeatLock}
              onToggleStudentLock={state.toggleStudentLock}
            />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-ink/20 bg-paper text-center">
              <Sparkles className="mb-3 h-8 w-8 text-fern" />
              <div className="text-base font-bold text-ink">等待生成座位方案</div>
              <button
                type="button"
                className="mt-3 rounded-[7px] bg-fern px-3 py-1.5 text-sm font-bold text-white hover:bg-fern/90"
                onClick={state.generatePlans}
              >
                生成 3 个候选方案
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-3 no-print">
          {state.viewMode === "teacher" ? (
            <>
              <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
                <h3 className="mb-2 text-sm font-bold text-ink">方案评分</h3>
                {selectedPlan ? (
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                    <ScoreBar label="总分" value={selectedPlan.score.total} tone="marigold" />
                    <ScoreBar label="视力照顾" value={selectedPlan.score.health} />
                    <ScoreBar label="身高遮挡" value={selectedPlan.score.height} />
                    <ScoreBar label="纪律风险" value={selectedPlan.score.discipline} />
                    <ScoreBar label="男女搭配" value={selectedPlan.score.gender} />
                    <ScoreBar label="公平轮换" value={selectedPlan.score.fairness} />
                    <ScoreBar label="小组均衡" value={selectedPlan.score.balance} />
                  </div>
                ) : (
                  <p className="text-sm text-ink/60">暂无评分</p>
                )}
              </div>

              <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
                  <AlertTriangle className="h-4 w-4 text-coral" />
                  冲突提示
                </h3>
                {selectedPlan?.warnings.length ? (
                  <ul className="space-y-1.5">
                    {selectedPlan.warnings.map((warning) => (
                      <li key={warning} className="rounded-[7px] bg-coral/10 p-2 text-xs font-semibold text-coral">
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-[7px] bg-chalk p-2 text-xs font-bold text-fern">
                    <CheckCircle2 className="h-4 w-4" />
                    暂无明显冲突
                  </div>
                )}
              </div>

              <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
                <h3 className="mb-2 text-sm font-bold text-ink">复核提示</h3>
                {selectedPlan?.reviewTips.length ? (
                  <ul className="space-y-1.5">
                    {selectedPlan.reviewTips.map((tip) => (
                      <li key={tip} className="rounded-[7px] bg-paper p-2 text-xs text-ink/70">
                        {tip}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink/60">暂无复核提示</p>
                )}
              </div>

              <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Save className="h-4 w-4 text-marigold" />
                  保存版本
                </h3>
                <textarea
                  className="min-h-16 w-full rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                  placeholder="调整说明"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button
                  type="button"
                  className="mt-2 w-full rounded-[7px] bg-marigold px-3 py-1.5 text-sm font-bold text-white hover:bg-marigold/90"
                  disabled={!selectedPlan}
                  onClick={() => {
                    state.saveSelectedPlan(note);
                    setNote("");
                  }}
                >
                  确认保存
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-ink">公开视图</h3>
              <p className="text-xs leading-5 text-ink/65">当前仅展示姓名、学号和性别。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
