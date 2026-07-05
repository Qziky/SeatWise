import { cn } from "@/lib/cn";

export function ScoreBar({
  label,
  value,
  tone = "fern"
}: {
  label: string;
  value: number;
  tone?: "fern" | "coral" | "marigold";
}) {
  const color = tone === "coral" ? "bg-coral" : tone === "marigold" ? "bg-marigold" : "bg-fern";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-ink/65">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-[4px] bg-ink/10">
        <div className={cn("h-2 rounded-[4px]", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
