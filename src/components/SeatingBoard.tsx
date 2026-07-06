"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/cn";
import { getVisibleStudent, shouldShowSensitive } from "@/lib/privacy";
import type { ClassRoom, SeatingPlan, SeatCell, Student, ViewMode } from "@/lib/types";
import { seatAttributeLabels, visionLabels } from "@/lib/types";

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
  const columnMinWidth = isTeacherMode ? 132 : 104;
  const boardMinWidth = Math.max(
    classroom.layout.columns * columnMinWidth + (classroom.layout.columns - 1) * 8 + 24,
    isTeacherMode ? 980 : 720
  );

  function handleDragEnd(event: DragEndEvent) {
    const studentId = String(event.active.id);
    const seatId = event.over?.id ? String(event.over.id) : null;
    if (!seatId || !onMoveStudent) return;
    onMoveStudent(studentId, seatId);
  }

  const board = (
    <div className="w-full max-w-full overflow-x-auto pb-2">
      <div
        className="grid gap-2 rounded-[8px] border border-ink/10 bg-white p-3 shadow-sm print-surface"
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

          return (
            <SeatDropCell
              key={seat.id}
              seat={seat}
              mode={mode}
              locked={seatLocked}
              readonly={readonly || mode === "print"}
              empty={seat.attributes.includes("empty")}
            >
              <div className={cn("flex flex-col justify-between gap-2", isTeacherMode ? "min-h-[126px]" : "min-h-[98px]")}>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[11px] font-semibold text-ink/45">
                    {seat.row}-{seat.column}
                  </span>
                  {onToggleSeatLock && mode === "teacher" && plan ? (
                    <button
                      type="button"
                      title={seatLocked ? "取消锁定座位" : "锁定座位"}
                      className={cn(
                        "no-print rounded-[6px] p-1 transition hover:bg-ink/10",
                        seatLocked ? "text-coral" : "text-ink/45"
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onToggleSeatLock(seat.id)}
                    >
                      {seatLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
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
                  <div className="flex flex-1 items-center justify-center rounded-[6px] border border-dashed border-ink/15 text-sm font-semibold text-ink/35">
                    {seat.attributes.includes("empty") ? "空座" : "待安排"}
                  </div>
                )}

                {mode === "teacher" ? (
                  <div className="flex min-h-5 flex-wrap gap-1">
                    {seat.attributes
                      .filter((attribute) => attribute !== "empty")
                      .slice(0, 3)
                      .map((attribute) => (
                        <span
                          key={attribute}
                          className="whitespace-nowrap rounded-[4px] bg-chalk px-1.5 py-0.5 text-[10px] font-semibold text-fern"
                        >
                          {seatAttributeLabels[attribute]}
                        </span>
                      ))}
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
        "rounded-[8px] border p-2 transition",
        mode === "teacher" ? "min-h-[148px]" : "min-h-[116px]",
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
        "relative flex min-h-[78px] flex-col gap-1 rounded-[8px] border border-ink/10 bg-white p-2 shadow-sm",
        !disabled && "touch-none hover:border-fern",
        isDragging && "z-20 opacity-80 shadow-soft",
        locked && "border-coral/50"
      )}
      title={sensitive ? `${student.name}｜${student.tags.join("、")}｜${student.remark}` : student.name}
    >
      <div className="pr-6">
        <div className="min-w-0">
          <div className="break-keep text-base font-black leading-5 text-ink">{visible.name}</div>
          <div className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-ink/50">
            {visible.studentNo} · {visible.gender}
          </div>
        </div>
        {onToggleStudentLock && mode === "teacher" ? (
          <button
            type="button"
            title={locked ? "取消锁定学生" : "锁定学生"}
            className={cn(
              "no-print absolute right-1.5 top-1.5 rounded-[6px] p-1 transition hover:bg-ink/10",
              locked ? "text-coral" : "text-ink/45"
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggleStudentLock(student.id)}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>

      {sensitive ? (
        <div className="mt-1 flex max-w-full flex-wrap gap-1 text-[10px] font-semibold">
          <span className="max-w-full whitespace-nowrap rounded-[4px] bg-chalk px-1.5 py-0.5 text-fern">
            {student.heightCm}cm
          </span>
          <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[4px] bg-marigold/15 px-1.5 py-0.5 text-marigold">
            {visionLabels[student.vision]}
          </span>
          {student.tags.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[4px] bg-coral/10 px-1.5 py-0.5 text-coral"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
