"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/cn";
import { getVisibleStudent, shouldShowSensitive } from "@/lib/privacy";
import type { ClassRoom, SeatingPlan, SeatCell, Student, ViewMode } from "@/lib/types";
import { seatAttributeLabels } from "@/lib/types";

const compactVisionLabels: Record<Student["vision"], string> = {
  normal: "正常",
  mild: "轻关",
  severe: "重照",
  unknown: "未填"
};

const compactTagLabels: Record<string, string> = {
  需要靠前: "靠前",
  近期观察: "观察",
  近期需关注: "关注",
  小组带动: "带动",
  容易分心: "分心",
  互助搭配: "互助",
  适合后排: "后排",
  小组稳定: "稳定"
};

function compactTagLabel(tag: string) {
  return compactTagLabels[tag] ?? tag.slice(0, 2);
}

export function SeatingBoard({
  classroom,
  plan,
  mode,
  readonly = false,
  onMoveStudent,
  onToggleSeatLock,
  onToggleStudentLock
}: {
  classroom: ClassRoom;
  plan: SeatingPlan | null;
  mode: ViewMode;
  readonly?: boolean;
  onMoveStudent?: (studentId: string, seatId: string) => void;
  onToggleSeatLock?: (seatId: string) => void;
  onToggleStudentLock?: (studentId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const studentsById = new Map(classroom.students.map((student) => [student.id, student]));
  const isTeacherMode = mode === "teacher";
  const columnMinWidth = isTeacherMode ? 72 : 66;
  const gridGap = isTeacherMode ? 4 : 5;
  const boardPadding = isTeacherMode ? 16 : 18;
  const boardMinWidth = Math.max(
    classroom.layout.columns * columnMinWidth + (classroom.layout.columns - 1) * gridGap + boardPadding,
    isTeacherMode ? 604 : 560
  );

  function handleDragEnd(event: DragEndEvent) {
    const studentId = String(event.active.id);
    const seatId = event.over?.id ? String(event.over.id) : null;
    if (!seatId || !onMoveStudent) return;
    onMoveStudent(studentId, seatId);
  }

  const board = (
    <div className="w-full max-w-full overflow-x-auto pb-1" data-testid="seating-board-scroll">
      <div
        className={cn(
          "grid rounded-[8px] border border-ink/10 bg-white shadow-sm print-surface",
          isTeacherMode ? "gap-1 p-2" : "gap-1.5 p-2"
        )}
        data-testid="seating-board-grid"
        style={{
          gridTemplateColumns: `repeat(${classroom.layout.columns}, minmax(${columnMinWidth}px, 1fr))`,
          minWidth: boardMinWidth
        }}
      >
        {classroom.layout.seats.map((seat) => {
          const studentId = plan?.assignments[seat.id] ?? null;
          const student = studentId ? studentsById.get(studentId) ?? null : null;
          const seatLocked = Boolean(plan?.lockedSeatIds.includes(seat.id));
          const studentLocked = Boolean(student && plan?.lockedStudentIds.includes(student.id));
          const visibleAttributes = seat.attributes.filter((attribute) => attribute !== "empty");

          return (
            <SeatDropCell
              key={seat.id}
              seat={seat}
              mode={mode}
              locked={seatLocked}
              readonly={readonly || mode === "print"}
              empty={seat.attributes.includes("empty")}
            >
              <div
                className={cn(
                  "flex flex-col justify-between",
                  isTeacherMode ? "min-h-[88px] gap-1" : "min-h-[82px] gap-1.5"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold leading-none text-ink/45">
                    {seat.row}-{seat.column}
                  </span>
                  {onToggleSeatLock && mode === "teacher" && plan ? (
                    <button
                      type="button"
                      title={seatLocked ? "取消锁定座位" : "锁定座位"}
                      className={cn(
                        "no-print rounded-[4px] p-0.5 transition hover:bg-ink/10",
                        seatLocked ? "text-coral" : "text-ink/45"
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onToggleSeatLock(seat.id)}
                    >
                      {seatLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                  ) : null}
                </div>

                {student ? (
                  <DraggableStudent
                    student={student}
                    mode={mode}
                    locked={studentLocked}
                    disabled={readonly || mode === "print" || seatLocked || studentLocked}
                    onToggleStudentLock={onToggleStudentLock}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-[5px] border border-dashed border-ink/15 text-[11px] font-semibold text-ink/35">
                    {seat.attributes.includes("empty") ? "空座" : "待安排"}
                  </div>
                )}

                {mode === "teacher" ? (
                  <div className="flex min-h-4 max-w-full items-center gap-0.5 overflow-hidden">
                    {visibleAttributes.slice(0, 2).map((attribute) => (
                      <span
                        key={attribute}
                        className="shrink-0 whitespace-nowrap rounded-[3px] bg-chalk px-1 py-0.5 text-[9px] font-semibold leading-none text-fern"
                      >
                        {seatAttributeLabels[attribute]}
                      </span>
                    ))}
                    {visibleAttributes.length > 2 ? (
                      <span className="shrink-0 rounded-[3px] bg-ink/5 px-1 py-0.5 text-[9px] font-semibold leading-none text-ink/45">
                        +{visibleAttributes.length - 2}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SeatDropCell>
          );
        })}
      </div>
    </div>
  );

  if (readonly || mode === "print") return board;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {board}
    </DndContext>
  );
}

function SeatDropCell({
  seat,
  mode,
  locked,
  readonly,
  empty,
  children
}: {
  seat: SeatCell;
  mode: ViewMode;
  locked: boolean;
  readonly: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: seat.id,
    disabled: readonly || empty || locked
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-[7px] border transition",
        mode === "teacher" ? "min-h-[104px] p-1.5" : "min-h-[98px] p-1.5",
        empty
          ? "border-dashed border-ink/15 bg-stone-100 text-ink/35"
          : "border-ink/10 bg-paper",
        isOver && "border-fern bg-chalk",
        locked && "border-coral/50 bg-coral/5"
      )}
    >
      {children}
    </div>
  );
}

function DraggableStudent({
  student,
  mode,
  locked,
  disabled,
  onToggleStudentLock
}: {
  student: Student;
  mode: ViewMode;
  locked: boolean;
  disabled: boolean;
  onToggleStudentLock?: (studentId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
    disabled
  });
  const visible = getVisibleStudent(student, mode);
  const sensitive = shouldShowSensitive(mode);
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "relative flex min-h-[54px] flex-col gap-0.5 rounded-[6px] border border-ink/10 bg-white p-1.5 shadow-sm",
        !disabled && "touch-none hover:border-fern",
        isDragging && "z-20 opacity-80 shadow-soft",
        locked && "border-coral/50"
      )}
      title={sensitive ? `${student.name}｜${student.tags.join("、")}｜${student.remark}` : student.name}
    >
      <div className="pr-4">
        <div className="min-w-0">
          <div className="truncate whitespace-nowrap text-[13px] font-black leading-4 text-ink" title={visible.name}>
            {visible.name}
          </div>
          <div className="whitespace-nowrap text-[9px] font-semibold leading-3 text-ink/50">
            {visible.studentNo} {visible.gender}
          </div>
        </div>
        {onToggleStudentLock && mode === "teacher" ? (
          <button
            type="button"
            title={locked ? "取消锁定学生" : "锁定学生"}
            className={cn(
              "no-print absolute right-1 top-1 rounded-[4px] p-0.5 transition hover:bg-ink/10",
              locked ? "text-coral" : "text-ink/45"
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggleStudentLock(student.id)}
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
        ) : null}
      </div>

      {sensitive ? (
        <div className="mt-0.5 flex max-w-full items-center gap-0.5 text-[9px] font-semibold leading-none">
          <span className="shrink-0 whitespace-nowrap rounded-[3px] bg-chalk px-1 py-0.5 text-fern">
            {student.heightCm}cm
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-[3px] bg-marigold/15 px-1 py-0.5 text-marigold">
            {compactVisionLabels[student.vision]}
          </span>
          {student.tags.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="hidden shrink-0 whitespace-nowrap rounded-[3px] bg-coral/10 px-1 py-0.5 text-coral lg:inline-block"
              title={tag}
            >
              {compactTagLabel(tag)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
