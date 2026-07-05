"use client";

import {
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
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { getActiveSeats } from "@/lib/layout";
import { ExportPanel } from "@/components/ExportPanel";
import { GeneratorPanel } from "@/components/GeneratorPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { LayoutEditor } from "@/components/LayoutEditor";
import { RuleConfigurator } from "@/components/RuleConfigurator";
import { StudentManager } from "@/components/StudentManager";
import { getSelectedPlan, useSeatWiseStore } from "@/store/useSeatWiseStore";

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
  const activeSeats = useMemo(() => getActiveSeats(state.classroom.layout).length, [state.classroom.layout]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="导航"
              className="rounded-[8px] border border-ink/10 bg-white p-2 lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-ink text-sm font-black text-white">
              SW
            </div>
            <div>
              <div className="text-base font-black text-ink">SeatWise</div>
              <div className="text-xs font-semibold text-ink/55">{state.classroom.name}</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-[6px] bg-white px-3 py-1.5 text-sm font-bold text-ink/70">
              学生 {state.classroom.students.length}
            </span>
            <span className="rounded-[6px] bg-white px-3 py-1.5 text-sm font-bold text-ink/70">
              可用座位 {activeSeats}
            </span>
            <button
              type="button"
              className="flex items-center gap-2 rounded-[8px] border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-chalk"
              onClick={state.resetSampleData}
            >
              <RefreshCw className="h-4 w-4" />
              示例数据
            </button>
          </div>
        </div>
        <nav className={cn("border-t border-ink/10 bg-white lg:hidden", !menuOpen && "hidden")}>
          <div className="flex gap-2 overflow-x-auto px-4 py-2">
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
          </div>
        </nav>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-6">
        <aside className="sticky top-[74px] hidden h-[calc(100vh-96px)] rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm lg:block no-print">
          <nav className="space-y-2">
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
            <Overview activeSeats={activeSeats} selectedPlanScore={selectedPlan?.score.total ?? null} />
          ) : null}
          {state.activeSection === "students" ? <StudentManager /> : null}
          {state.activeSection === "layout" ? <LayoutEditor /> : null}
          {state.activeSection === "rules" ? <RuleConfigurator /> : null}
          {state.activeSection === "generate" ? <GeneratorPanel /> : null}
          {state.activeSection === "history" ? <HistoryPanel /> : null}
          {state.activeSection === "export" ? <ExportPanel /> : null}
        </main>
      </div>
    </div>
  );
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
        "flex min-h-11 w-full min-w-24 items-center justify-center gap-2 rounded-[8px] px-3 text-sm font-bold transition lg:justify-start",
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[8px] border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-fern">面向中国中小学班主任</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-ink md:text-4xl">智能排座位助手</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ink/65">
                兼顾视力、身高、同桌关系、公平轮换和隐私展示，几分钟生成可解释的班级座位表。
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-[8px] bg-fern px-5 py-3 font-bold text-white shadow-sm hover:bg-fern/90"
              onClick={generatePlans}
            >
              <Sparkles className="h-4 w-4" />
              生成方案
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="学生" value={classroom.students.length} />
            <Metric label="可用座位" value={activeSeats} />
            <Metric label="候选分数" value={selectedPlanScore ?? "-"} />
            <Metric label="历史版本" value={history.length} />
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-ink">班级信息</h2>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-ink/65">
              班级名称
              <input
                className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
                value={classroom.name}
                onChange={(event) => updateClassMeta("name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ink/65">
              年级
              <input
                className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
                value={classroom.grade}
                onChange={(event) => updateClassMeta("grade", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ink/65">
              学期
              <input
                className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
                value={classroom.term}
                onChange={(event) => updateClassMeta("term", event.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <FlowButton label="维护学生名单" icon={Users} onClick={() => setActiveSection("students")} />
        <FlowButton label="设置教室布局" icon={LayoutGrid} onClick={() => setActiveSection("layout")} />
        <FlowButton label="配置排座规则" icon={SlidersHorizontal} onClick={() => setActiveSection("rules")} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[8px] border border-ink/10 bg-paper p-4">
      <div className="text-sm font-bold text-ink/55">{label}</div>
      <div className="mt-2 text-2xl font-black text-ink">{value}</div>
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
      className="flex min-h-24 items-center justify-between rounded-[8px] border border-ink/10 bg-white p-4 text-left shadow-sm transition hover:border-fern/50 hover:bg-chalk"
      onClick={onClick}
    >
      <span className="text-base font-bold text-ink">{label}</span>
      <Icon className="h-6 w-6 text-fern" />
    </button>
  );
}
