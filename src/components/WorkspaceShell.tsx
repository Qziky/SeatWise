"use client";

import {
  AlertTriangle,
  Download,
  History,
  Home,
  LayoutGrid,
  Menu,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { getActiveSeats } from "@/lib/layout";
import { ExportPanel } from "@/components/ExportPanel";
import { GeneratorPanel } from "@/components/GeneratorPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { LayoutEditor } from "@/components/LayoutEditor";
import { RuleConfigurator } from "@/components/RuleConfigurator";
import { StudentManager } from "@/components/StudentManager";
import { getSelectedPlan, isPlanStale, useSeatWiseStore } from "@/store/useSeatWiseStore";

const sections = [
  { id: "overview", label: "工作台", icon: Home },
  { id: "students", label: "学生", icon: Users },
  { id: "layout", label: "布局", icon: LayoutGrid },
  { id: "rules", label: "规则", icon: SlidersHorizontal },
  { id: "generate", label: "生成", icon: Sparkles },
  { id: "history", label: "历史", icon: History },
  { id: "export", label: "导出", icon: Download }
] as const;

export function WorkspaceShell() {
  const state = useSeatWiseStore();
  const selectedPlan = getSelectedPlan(state);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);
  const activeSeats = useMemo(() => getActiveSeats(state.classroom.layout).length, [state.classroom.layout]);

  useEffect(() => {
    if (!resetOpen || !resetDialogRef.current) return;
    if (!resetDialogRef.current.open) resetDialogRef.current.showModal();
    resetCancelRef.current?.focus();
  }, [resetOpen]);

  function openResetDialog(trigger: HTMLElement) {
    resetTriggerRef.current = trigger;
    setResetOpen(true);
  }

  function closeResetDialog() {
    resetDialogRef.current?.close();
    setResetOpen(false);
    window.setTimeout(() => resetTriggerRef.current?.focus(), 0);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-2 px-3 py-2 lg:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="导航"
              className="rounded-[7px] border border-ink/10 bg-white p-1.5 lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-ink text-xs font-black text-white">
              SW
            </div>
            <div>
              <div className="text-sm font-black leading-4 text-ink">SeatWise</div>
              <div className="text-[11px] font-semibold leading-4 text-ink/55">{state.classroom.name}</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-[6px] bg-white px-2 py-1 text-xs font-bold text-ink/70">
              学生 {state.classroom.students.length}
            </span>
            <span className="rounded-[6px] bg-white px-2 py-1 text-xs font-bold text-ink/70">
              可用座位 {activeSeats}
            </span>
            <button
              type="button"
              aria-haspopup="dialog"
              className="flex items-center gap-1.5 rounded-[7px] border border-ink/10 bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-chalk"
              onClick={(event) => openResetDialog(event.currentTarget)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              恢复示例数据
            </button>
          </div>
        </div>
        <nav className={cn("border-t border-ink/10 bg-white lg:hidden", !menuOpen && "hidden")}>
          <div className="flex gap-1.5 overflow-x-auto px-3 py-1.5">
            {sections.map((section) => (
              <NavButton
                key={section.id}
                active={state.activeSection === section.id}
                label={section.label}
                icon={section.icon}
                onClick={() => {
                  state.setActiveSection(section.id);
                  setMenuOpen(false);
                }}
              />
            ))}
            <button
              type="button"
              aria-haspopup="dialog"
              className="flex shrink-0 items-center gap-1.5 rounded-[7px] border border-coral/20 bg-coral/5 px-2.5 py-1.5 text-xs font-bold text-coral md:hidden"
              onClick={(event) => openResetDialog(event.currentTarget)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              恢复示例数据
            </button>
          </div>
        </nav>
      </header>

      <div className="mx-auto grid max-w-[1920px] gap-3 px-3 py-3 lg:grid-cols-[168px_minmax(0,1fr)] lg:px-4">
        <aside className="sticky top-[58px] hidden h-[calc(100vh-70px)] rounded-[8px] border border-ink/10 bg-white p-2 shadow-sm lg:block no-print">
          <nav className="space-y-1.5">
            {sections.map((section) => (
              <NavButton
                key={section.id}
                active={state.activeSection === section.id}
                label={section.label}
                icon={section.icon}
                onClick={() => state.setActiveSection(section.id)}
              />
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {state.activeSection === "overview" ? (
            <Overview
              activeSeats={activeSeats}
              selectedPlanScore={
                selectedPlan && !isPlanStale(state, selectedPlan) ? selectedPlan.score.total : null
              }
            />
          ) : null}
          {state.activeSection === "students" ? <StudentManager /> : null}
          {state.activeSection === "layout" ? <LayoutEditor /> : null}
          {state.activeSection === "rules" ? <RuleConfigurator /> : null}
          {state.activeSection === "generate" ? <GeneratorPanel /> : null}
          {state.activeSection === "history" ? <HistoryPanel /> : null}
          {state.activeSection === "export" ? <ExportPanel /> : null}
        </main>
      </div>
      {resetOpen ? (
        <dialog
          ref={resetDialogRef}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[8px] border border-ink/10 bg-white p-4 text-ink shadow-soft backdrop:bg-ink/35"
          role="alertdialog"
          aria-labelledby="reset-sample-title"
          aria-describedby="reset-sample-description"
          onCancel={(event) => {
            event.preventDefault();
            closeResetDialog();
          }}
        >
            <h2 id="reset-sample-title" className="flex items-center gap-2 text-base font-black text-ink">
              <AlertTriangle className="h-5 w-5 text-coral" />
              恢复示例数据
            </h2>
            <p id="reset-sample-description" className="mt-2 text-sm leading-6 text-ink/65">
              将覆盖当前 {state.classroom.students.length} 名学生、{state.plans.length} 个候选方案和 {state.history.length} 个历史版本。此操作不可撤销。
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="rounded-[7px] border border-ink/10 px-3 py-2 text-sm font-bold text-ink hover:bg-chalk"
                onClick={() => downloadBackup(state)}
              >
                导出备份
              </button>
              <button
                ref={resetCancelRef}
                type="button"
                className="rounded-[7px] border border-ink/10 px-3 py-2 text-sm font-bold text-ink hover:bg-chalk"
                onClick={closeResetDialog}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-[7px] bg-coral px-3 py-2 text-sm font-bold text-white hover:bg-coral/90"
                onClick={() => {
                  state.resetSampleData();
                  closeResetDialog();
                }}
              >
                确认覆盖
              </button>
            </div>
        </dialog>
      ) : null}
    </div>
  );
}

function downloadBackup(state: ReturnType<typeof useSeatWiseStore.getState>) {
  const content = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      classroom: state.classroom,
      rules: state.rules,
      plans: state.plans,
      history: state.history,
      inputRevision: state.inputRevision
    },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.classroom.name || "SeatWise"}-本地备份.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function NavButton({
  active,
  label,
  icon: Icon,
  onClick
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-9 w-full min-w-20 items-center justify-center gap-1.5 rounded-[7px] px-2 text-sm font-bold transition lg:justify-start",
        active ? "bg-fern text-white" : "text-ink/65 hover:bg-chalk hover:text-ink"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Overview({
  activeSeats,
  selectedPlanScore
}: {
  activeSeats: number;
  selectedPlanScore: number | null;
}) {
  const classroom = useSeatWiseStore((state) => state.classroom);
  const history = useSeatWiseStore((state) => state.history);
  const updateClassMeta = useSeatWiseStore((state) => state.updateClassMeta);
  const setActiveSection = useSeatWiseStore((state) => state.setActiveSection);
  const generatePlans = useSeatWiseStore((state) => state.generatePlans);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-fern">面向中国中小学班主任</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-ink md:text-3xl">智能排座位助手</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                兼顾视力、身高、同桌关系、公平轮换和隐私展示，几分钟生成可解释的班级座位表。
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-[7px] bg-fern px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-fern/90"
              onClick={generatePlans}
            >
              <Sparkles className="h-4 w-4" />
              生成方案
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="学生" value={classroom.students.length} />
            <Metric label="可用座位" value={activeSeats} />
            <Metric label="候选分数" value={selectedPlanScore ?? "-"} />
            <Metric label="历史版本" value={history.length} />
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-ink">班级信息</h2>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-ink/65">
              班级名称
              <input
                className="mt-1 w-full rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                value={classroom.name}
                onChange={(event) => updateClassMeta("name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ink/65">
              年级
              <input
                className="mt-1 w-full rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                value={classroom.grade}
                onChange={(event) => updateClassMeta("grade", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ink/65">
              学期
              <input
                className="mt-1 w-full rounded-[7px] border border-ink/10 px-2.5 py-1.5 text-sm"
                value={classroom.term}
                onChange={(event) => updateClassMeta("term", event.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <FlowButton label="维护学生名单" icon={Users} onClick={() => setActiveSection("students")} />
        <FlowButton label="设置教室布局" icon={LayoutGrid} onClick={() => setActiveSection("layout")} />
        <FlowButton label="配置排座规则" icon={SlidersHorizontal} onClick={() => setActiveSection("rules")} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[7px] border border-ink/10 bg-paper p-3">
      <div className="text-xs font-bold text-ink/55">{label}</div>
      <div className="mt-1 text-xl font-black text-ink">{value}</div>
    </div>
  );
}

function FlowButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-16 items-center justify-between rounded-[8px] border border-ink/10 bg-white p-3 text-left shadow-sm transition hover:border-fern/50 hover:bg-chalk"
      onClick={onClick}
    >
      <span className="text-sm font-bold text-ink">{label}</span>
      <Icon className="h-5 w-5 text-fern" />
    </button>
  );
}
