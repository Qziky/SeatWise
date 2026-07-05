"use client";

import { Download, FileImage, FileSpreadsheet, Printer } from "lucide-react";
import { exportSeatingPlan } from "@/lib/export";
import { getSelectedPlan, useSeatWiseStore } from "@/store/useSeatWiseStore";
import { SeatingBoard } from "@/components/SeatingBoard";
import { ViewModeToggle } from "@/components/ViewModeToggle";

export function ExportPanel() {
  const state = useSeatWiseStore();
  const selectedPlan = getSelectedPlan(state);

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm print-surface">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h2 className="text-lg font-bold text-ink">座位表导出</h2>
            <p className="mt-1 text-sm text-ink/60">{selectedPlan ? selectedPlan.name : "暂无方案"}</p>
          </div>
          <ViewModeToggle value={state.viewMode} onChange={state.setViewMode} />
        </div>
        <SeatingBoard classroom={state.classroom} plan={selectedPlan} mode={state.viewMode} readonly />
      </div>

      <aside className="space-y-4 no-print">
        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
            <Download className="h-4 w-4 text-fern" />
            导出格式
          </h3>
          <div className="grid gap-2">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-[8px] bg-fern px-4 py-2 font-bold text-white hover:bg-fern/90"
              disabled={!selectedPlan}
              onClick={() =>
                selectedPlan &&
                exportSeatingPlan({
                  format: "pdf",
                  mode: state.viewMode,
                  classroom: state.classroom,
                  plan: selectedPlan
                })
              }
            >
              <Printer className="h-4 w-4" />
              PDF / 打印
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-[8px] border border-ink/10 bg-white px-4 py-2 font-bold text-ink hover:bg-chalk"
              disabled={!selectedPlan}
              onClick={() =>
                selectedPlan &&
                exportSeatingPlan({
                  format: "image",
                  mode: state.viewMode,
                  classroom: state.classroom,
                  plan: selectedPlan
                })
              }
            >
              <FileImage className="h-4 w-4" />
              图片
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-[8px] border border-ink/10 bg-white px-4 py-2 font-bold text-ink hover:bg-chalk"
              disabled={!selectedPlan}
              onClick={() =>
                selectedPlan &&
                exportSeatingPlan({
                  format: "excel",
                  mode: state.viewMode,
                  classroom: state.classroom,
                  plan: selectedPlan
                })
              }
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel / CSV
            </button>
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-base font-bold text-ink">隐私范围</h3>
          <div className="space-y-2 text-sm text-ink/65">
            <p>教师版：姓名、学号、性别、身高、视力、标签、备注、特殊需求。</p>
            <p>学生版：姓名、学号、性别。</p>
            <p>打印版：默认采用公开字段。</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
