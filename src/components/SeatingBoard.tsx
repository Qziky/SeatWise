"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/cn";
import { getVisibleStudent, shouldShowSensitive } from "@/lib/privacy";
import type { ClassRoom, SeatingPlan, SeatAttribute, SeatCell, Student, ViewMode, VisionStatus } from "@/lib/types";
import { seatAttributeLabels, visionLabels } from "@/lib/types";

const seatAttributeDotClass: Record<Exclude<SeatAttribute, "empty">, string> = {
  window: "bg-sky-500",
  door: "bg-violet-500",
  glare: "bg-marigold",
  back: "bg-ink/45",
  edge: "bg-fern"
};

const visionAccentClass: Record<VisionStatus, string> = {
  normal: "border-l-fern/55 bg-white",
  mild: "border-l-marigold bg-marigold/5",
  severe: "border-l-coral bg-coral/5",
  unknown: "border-l-ink/20 bg-white"
};

const visionDotClass: Record<VisionStatus, string> = {
  normal: "bg-fern",
  mild: "bg-marigold",
  severe: "bg-coral",
  unknown: "bg-ink/30"
};

const tagDotClass = ["bg-coral/80", "bg-sky-500", "bg-violet-500"];

function heightDotClass(heightCm: number) {
  if (heightCm >= 165) return "bg-sky-500";
  if (heightCm <= 150) return "bg-fern";
  return "bg-ink/25";
}

function getSeatAttributeTitle(attributes: SeatAttribute[]) {
  const visible = attributes.filter((attribute) => attribute !== "empty");
  return visible.length ? visible.map((attribute) => seatAttributeLabels[attribute]).join("、") : "普通座位";
}

function getStudentTitle(student: Student, sensitive: boolean) {
  if (!sensitive) return student.name;

  return [
    `${student.name} ${student.studentNo} ${student.gender}`,
    `${student.heightCm}cm`,
    visionLabels[student.vision],
    student.tags.length ? student.tags.join("、") : "",
    student.specialNeeds,
    student.remark
  ]
    .filter(Boolean)
    .join("｜");
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
  const columnMinWidth = isTeacherMode ? 78 : 66;
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
          const visibleAttributes = seat.attributes.filter(
            (attribute): attribute is Exclude<SeatAttribute, "empty"> => attribute !== "empty"
          );

          return (
            <SeatDropCell
              key={seat.id}
              seat={seat}
              mode={mode}
              locked={seatLocked}
              readonly={readonly || mode === "print"}
              empty={seat.attributes.includes("empty")}
              attributes={seat.attributes}
            >
              <div
                className={cn(
                  "flex flex-col justify-between",
                  isTeacherMode ? "min-h-[88px] gap-1" : "min-h-[82px] gap-1.5",
                  visibleAttributes.length && "pb-1.5"
                )}
                title={mode === "teacher" ? getSeatAttributeTitle(seat.attributes) : undefined}
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

                {mode === "teacher" ? <SeatAttributeMarkers attributes={visibleAttributes} /> : null}
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
  attributes,
  children
}: {
  seat: SeatCell;
  mode: ViewMode;
  locked: boolean;
  readonly: boolean;
  empty: boolean;
  attributes: SeatAttribute[];
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: seat.id,
    disabled: readonly || empty || locked
  });
  const edge = attributes.includes("edge");
  const glare = attributes.includes("glare");

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative overflow-hidden rounded-[7px] border transition",
        mode === "teacher" ? "min-h-[104px] p-1.5" : "min-h-[98px] p-1.5",
        empty
          ? "border-dashed border-ink/15 bg-stone-100 text-ink/35"
          : "border-ink/10 bg-paper",
        edge && !empty && "border-fern/35 bg-fern/[0.035]",
        glare && !empty && "bg-marigold/[0.035]",
        isOver && "border-fern bg-chalk",
        locked && "border-coral/50 bg-coral/5"
      )}
      title={mode === "teacher" ? getSeatAttributeTitle(attributes) : undefined}
    >
      {!empty ? <SeatCellPatterns attributes={attributes} /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SeatCellPatterns({ attributes }: { attributes: SeatAttribute[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {attributes.includes("glare") ? (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(222,145,43,0.15)_0,rgba(222,145,43,0.15)_3px,transparent_3px,transparent_10px)]" />
      ) : null}
      {attributes.includes("window") ? <div className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-sky-500/35" /> : null}
      {attributes.includes("door") ? <div className="absolute bottom-2 right-0 top-2 w-1 rounded-l-full bg-violet-500/35" /> : null}
      {attributes.includes("back") ? <div className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-ink/20" /> : null}
      {attributes.includes("edge") ? <div className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-fern/35" /> : null}
    </div>
  );
}

function SeatAttributeMarkers({ attributes }: { attributes: Array<Exclude<SeatAttribute, "empty">> }) {
  if (!attributes.length) return <div className="min-h-3" />;

  return (
    <div className="flex min-h-3 items-center gap-0.5" aria-hidden="true">
      {attributes.slice(0, 4).map((attribute) => (
        <span
          key={attribute}
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", seatAttributeDotClass[attribute])}
          title={seatAttributeLabels[attribute]}
        />
      ))}
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
        "relative flex min-h-[52px] flex-col gap-0.5 rounded-[6px] border border-l-4 border-ink/10 p-1.5 pb-3 shadow-sm",
        sensitive ? visionAccentClass[student.vision] : "border-l-ink/20 bg-white",
        !disabled && "touch-none hover:border-fern",
        isDragging && "z-20 opacity-80 shadow-soft",
        locked && "border-coral/50"
      )}
      title={getStudentTitle(student, sensitive)}
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

      {sensitive ? <StudentStatusMarkers student={student} /> : null}
    </div>
  );
}

function StudentStatusMarkers({ student }: { student: Student }) {
  return (
    <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center gap-0.5" aria-hidden="true">
      <span className={cn("h-1.5 w-4 shrink-0 rounded-full", visionDotClass[student.vision])} title={visionLabels[student.vision]} />
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", heightDotClass(student.heightCm))} title={`${student.heightCm}cm`} />
      {student.tags.slice(0, 2).map((tag, index) => (
        <span key={tag} className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tagDotClass[index])} title={tag} />
      ))}
      {student.specialNeeds ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/55" title={student.specialNeeds} /> : null}
    </div>
  );
}
