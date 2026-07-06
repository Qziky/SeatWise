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
    <div className="inline-flex rounded-[7px] border border-ink/10 bg-white p-0.5 shadow-sm" role="tablist">
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
              "flex min-h-8 items-center gap-1.5 rounded-[5px] px-2 text-xs font-semibold transition",
              active ? "bg-fern text-white" : "text-ink/70 hover:bg-chalk"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
