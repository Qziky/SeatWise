"use client";

import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { clearAllPersistedState, clearPersistedPlans } from "@/lib/persistence-recovery";

export default function WorkspaceError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function handleClearFaultyPlan() {
    const result = clearPersistedPlans(window.localStorage);
    if (result === "failed") {
      window.alert("浏览器拒绝访问本地缓存，故障方案未能清除。请在浏览器的站点设置中清理此应用的数据后重试。");
      return;
    }
    if (result === "corrupt") {
      const confirmed = window.confirm(
        "本地缓存格式已损坏，无法只移除故障方案。是否清除此应用的全部本地数据？"
      );
      if (!confirmed) return;
      if (!clearAllPersistedState(window.localStorage)) {
        window.alert("浏览器拒绝清除本地缓存。请在浏览器的站点设置中手动清理此应用的数据。");
        return;
      }
    }
    window.location.reload();
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-chalk px-4 py-12 text-ink">
      <section className="w-full max-w-xl rounded-[8px] border border-coral/25 bg-white p-6 shadow-soft" aria-labelledby="workspace-error-title">
        <div className="flex items-start gap-3">
          <span className="rounded-[7px] bg-coral/10 p-2 text-coral" aria-hidden="true">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h1 id="workspace-error-title" className="text-lg font-black">工作区暂时无法显示</h1>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              可以先重试；若问题来自已保存的候选方案，可清除故障方案后重新进入工作区。
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[7px] bg-fern px-3 py-2 text-sm font-bold text-white hover:bg-fern/90"
            onClick={reset}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            重试
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-coral/25 bg-coral/10 px-3 py-2 text-sm font-bold text-coral hover:bg-coral/15"
            onClick={handleClearFaultyPlan}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            清除故障方案
          </button>
        </div>

        <p className="mt-4 border-t border-ink/10 pt-3 text-xs leading-5 text-ink/50">
          清除故障方案只移除候选方案和当前方案选择，班级、学生、规则及历史记录会保留。本地缓存无法解析时，会在清除全部数据前再次确认。
        </p>
      </section>
    </main>
  );
}
