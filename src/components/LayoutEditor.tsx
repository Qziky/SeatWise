"use client";

import { DoorOpen, Grid3X3, PanelTop, RectangleHorizontal, Sun, Wind } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { PodiumDirection, SeatAttribute } from "@/lib/types";
import { seatAttributeLabels } from "@/lib/types";
import { useSeatWiseStore } from "@/store/useSeatWiseStore";

const podiumOptions: Array<{ value: PodiumDirection; label: string }> = [
  { value: "top", label: "上方" },
  { value: "bottom", label: "下方" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" }
];

const editableAttributes: Array<{ value: SeatAttribute; icon: typeof Sun }> = [
  { value: "window", icon: Wind },
  { value: "door", icon: DoorOpen },
  { value: "glare", icon: Sun },
  { value: "empty", icon: RectangleHorizontal }
];

export function LayoutEditor() {
  const classroom = useSeatWiseStore((state) => state.classroom);
  const updateLayoutSize = useSeatWiseStore((state) => state.updateLayoutSize);
  const updatePodium = useSeatWiseStore((state) => state.updatePodium);
  const toggleSeatAttribute = useSeatWiseStore((state) => state.toggleSeatAttribute);
  const [rows, setRows] = useState(classroom.layout.rows);
  const [columns, setColumns] = useState(classroom.layout.columns);
  const [selectedSeatId, setSelectedSeatId] = useState(classroom.layout.seats[0]?.id ?? "");
  const selectedSeat = useMemo(
    () => classroom.layout.seats.find((seat) => seat.id === selectedSeatId) ?? classroom.layout.seats[0],
    [classroom.layout.seats, selectedSeatId]
  );
  const activeSeats = classroom.layout.seats.filter((seat) => !seat.attributes.includes("empty")).length;

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink">
            <Grid3X3 className="h-5 w-5 text-fern" />
            教室布局
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-ink/65">
              行数
              <input
                className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
                type="number"
                min={2}
                max={12}
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
              />
            </label>
            <label className="text-sm font-semibold text-ink/65">
              列数
              <input
                className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
                type="number"
                min={2}
                max={12}
                value={columns}
                onChange={(event) => setColumns(Number(event.target.value))}
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-[8px] bg-fern px-4 py-2 font-bold text-white hover:bg-fern/90"
            onClick={() => updateLayoutSize(rows, columns)}
          >
            更新网格
          </button>

          <label className="mt-4 block text-sm font-semibold text-ink/65">
            讲台方向
            <select
              className="mt-1 w-full rounded-[8px] border border-ink/10 px-3 py-2"
              value={classroom.layout.podium}
              onChange={(event) => updatePodium(event.target.value as PodiumDirection)}
            >
              {podiumOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-[8px] bg-chalk p-3 text-sm font-semibold text-ink/70">
            <span>总座位 {classroom.layout.seats.length}</span>
            <span>可用 {activeSeats}</span>
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-ink">座位标记</h3>
          {selectedSeat ? (
            <>
              <div className="mb-3 rounded-[8px] bg-paper p-3 text-sm font-semibold text-ink/70">
                第 {selectedSeat.row} 排，第 {selectedSeat.column} 座
              </div>
              <div className="grid grid-cols-2 gap-2">
                {editableAttributes.map((attribute) => {
                  const Icon = attribute.icon;
                  const active = selectedSeat.attributes.includes(attribute.value);
                  return (
                    <button
                      type="button"
                      key={attribute.value}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-bold transition",
                        active
                          ? "border-fern bg-fern text-white"
                          : "border-ink/10 bg-white text-ink/70 hover:bg-chalk"
                      )}
                      onClick={() => toggleSeatAttribute(selectedSeat.id, attribute.value)}
                    >
                      <Icon className="h-4 w-4" />
                      {seatAttributeLabels[attribute.value]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSeat.attributes.map((attribute) => (
                  <span key={attribute} className="rounded-[4px] bg-marigold/15 px-2 py-1 text-xs font-bold text-marigold">
                    {seatAttributeLabels[attribute]}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 rounded-[8px] border border-ink/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-center gap-2 rounded-[8px] bg-ink px-4 py-3 text-sm font-bold text-white">
          <PanelTop className="h-4 w-4" />
          讲台：{podiumOptions.find((option) => option.value === classroom.layout.podium)?.label}
        </div>
        <div className="overflow-x-auto pb-2">
          <div
            className="grid min-w-[680px] gap-2"
            style={{ gridTemplateColumns: `repeat(${classroom.layout.columns}, minmax(72px, 1fr))` }}
          >
            {classroom.layout.seats.map((seat) => {
              const selected = seat.id === selectedSeat?.id;
              const empty = seat.attributes.includes("empty");
              return (
                <button
                  type="button"
                  key={seat.id}
                  className={cn(
                    "min-h-[82px] rounded-[8px] border p-2 text-left transition",
                    selected ? "border-fern bg-chalk shadow-sm" : "border-ink/10 bg-paper hover:border-fern/60",
                    empty && "border-dashed bg-stone-100 text-ink/35"
                  )}
                  onClick={() => setSelectedSeatId(seat.id)}
                >
                  <div className="text-xs font-bold text-ink/55">
                    {seat.row}-{seat.column}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {seat.attributes.slice(0, 3).map((attribute) => (
                      <span key={attribute} className="rounded-[4px] bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink/55">
                        {seatAttributeLabels[attribute]}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
