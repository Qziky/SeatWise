"use client";

import { Eye, Printer, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/types";

const modes: Array<{
  value: ViewMode;
  label: string;
  icon: typeof ShieldCheck;
}> = [
  { value: "teacher", label: "教师版", icon: ShieldCheck },
  { value: "student", label: "学生版", icon: Eye },
  { value: "print", label: "打印版", icon: Printer }
];

export function ViewModeToggle({
  value,
  onChange
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-[8px] border border-ink/10 bg-white p-1 shadow-sm" role="tablist">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={mode.label}
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition",
              active ? "bg-fern text-white" : "text-ink/70 hover:bg-chalk"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
