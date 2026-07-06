"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Unlock, X } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
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

interface DetailState {
  left: number;
  seatId: string;
  top: number;
}

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
  const [detail, setDetail] = useState<DetailState | null>(null);
  const selectedSeat = detail ? classroom.layout.seats.find((seat) => seat.id === detail.seatId) ?? null : null;
  const selectedStudentId = selectedSeat ? plan?.assignments[selectedSeat.id] ?? null : null;
  const selectedStudent = selectedStudentId ? studentsById.get(selectedStudentId) ?? null : null;
  const selectedSeatLocked = Boolean(selectedSeat && plan?.lockedSeatIds.includes(selectedSeat.id));
  const selectedStudentLocked = Boolean(selectedStudent && plan?.lockedStudentIds.includes(selectedStudent.id));

  function openDetailFromElement(element: HTMLElement, seatId: string) {
    if (mode === "print") return;
    const rect = element.getBoundingClientRect();
    const bubbleWidth = Math.min(280, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - bubbleWidth - 12));
    const below = rect.bottom + 8;
    const top = below + 220 > window.innerHeight ? Math.max(12, rect.top - 218) : below;
    setDetail({ seatId, left, top });
  }

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
              student={student}
              studentLocked={studentLocked}
              selected={detail?.seatId === seat.id}
              onOpenDetail={(element) => openDetailFromElement(element, seat.id)}
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
                  {mode === "teacher" && (seatLocked || studentLocked) ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-coral"
                      title={seatLocked && studentLocked ? "座位和学生已锁定" : seatLocked ? "座位已锁定" : "学生已锁定"}
                    />
                  ) : null}
                </div>

                {student ? (
                  <DraggableStudent
                    student={student}
                    mode={mode}
                    locked={studentLocked}
                    disabled={readonly || mode === "print" || seatLocked || studentLocked}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-[11px] font-semibold text-ink/35">
                    {seat.attributes.includes("empty") ? "空座" : "待安排"}
                  </div>
                )}

                {mode === "teacher" ? <SeatAttributeMarkers attributes={visibleAttributes} /> : null}
              </div>
            </SeatDropCell>
          );
        })}
      </div>
      {detail && selectedSeat ? (
        <SeatDetailBubble
          seat={selectedSeat}
          student={selectedStudent}
          mode={mode}
          seatLocked={selectedSeatLocked}
          studentLocked={selectedStudentLocked}
          style={{ left: detail.left, top: detail.top }}
          onToggleSeatLock={onToggleSeatLock ? () => onToggleSeatLock(selectedSeat.id) : undefined}
          onToggleStudentLock={
            onToggleStudentLock && selectedStudent ? () => onToggleStudentLock(selectedStudent.id) : undefined
          }
          onClose={() => setDetail(null)}
        />
      ) : null}
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
  student,
  studentLocked,
  selected,
  onOpenDetail,
  children
}: {
  seat: SeatCell;
  mode: ViewMode;
  locked: boolean;
  readonly: boolean;
  empty: boolean;
  attributes: SeatAttribute[];
  student: Student | null;
  studentLocked: boolean;
  selected: boolean;
  onOpenDetail: (element: HTMLDivElement) => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: seat.id,
    disabled: readonly || empty || locked
  });
  const edge = attributes.includes("edge");
  const glare = attributes.includes("glare");
  const sensitive = mode === "teacher" && Boolean(student);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative cursor-pointer rounded-[7px] border transition",
        mode === "teacher" ? "min-h-[104px] p-1.5" : "min-h-[98px] p-1.5",
        empty
          ? "border-dashed border-ink/15 bg-stone-100 text-ink/35"
          : "border-ink/10 bg-paper",
        edge && !empty && "border-fern/35 bg-fern/[0.035]",
        glare && !empty && "bg-marigold/[0.035]",
        sensitive && "border-l-4",
        sensitive && visionAccentClass[student!.vision],
        isOver && "border-fern bg-chalk",
        (locked || studentLocked) && "border-coral/50 bg-coral/5",
        selected && "ring-2 ring-fern/45"
      )}
      title={mode === "teacher" ? getSeatAttributeTitle(attributes) : undefined}
      role="button"
      tabIndex={mode === "print" ? -1 : 0}
      onClick={(event) => onOpenDetail(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(event.currentTarget);
        }
      }}
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
  disabled
}: {
  student: Student;
  mode: ViewMode;
  locked: boolean;
  disabled: boolean;
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
        "relative flex min-h-[52px] flex-col gap-0.5 p-1 pb-3",
        !disabled && "touch-none",
        isDragging && "z-20 opacity-80 shadow-soft",
        locked && "text-coral"
      )}
      title={getStudentTitle(student, sensitive)}
    >
      <div>
        <div className="min-w-0">
          <div className="truncate whitespace-nowrap text-[13px] font-black leading-4 text-ink" title={visible.name}>
            {visible.name}
          </div>
          <div className="whitespace-nowrap text-[9px] font-semibold leading-3 text-ink/50">
            {visible.studentNo} {visible.gender}
          </div>
        </div>
      </div>

      {sensitive ? <StudentStatusMarkers student={student} /> : null}
    </div>
  );
}

function SeatDetailBubble({
  seat,
  student,
  mode,
  seatLocked,
  studentLocked,
  style,
  onToggleSeatLock,
  onToggleStudentLock,
  onClose
}: {
  seat: SeatCell;
  student: Student | null;
  mode: ViewMode;
  seatLocked: boolean;
  studentLocked: boolean;
  style: CSSProperties;
  onToggleSeatLock?: () => void;
  onToggleStudentLock?: () => void;
  onClose: () => void;
}) {
  const sensitive = shouldShowSensitive(mode);
  const visibleAttributes = seat.attributes.filter((attribute) => attribute !== "empty");
  const canToggleLocks = mode === "teacher" && (onToggleSeatLock || (student && onToggleStudentLock));

  return (
    <div
      className="fixed z-50 w-[280px] max-w-[calc(100vw-24px)] rounded-[8px] border border-ink/10 bg-white p-3 text-left shadow-soft no-print"
      style={style}
      role="dialog"
      aria-label="座位详情"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-black text-ink">
            {seat.row}-{seat.column}
            {student ? ` · ${student.name}` : ""}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-ink/50">
            {visibleAttributes.length ? visibleAttributes.map((attribute) => seatAttributeLabels[attribute]).join("、") : "普通座位"}
          </div>
        </div>
        <button type="button" title="关闭详情" className="rounded-[5px] p-1 text-ink/45 hover:bg-chalk" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {student ? (
        <div className="space-y-2 text-xs leading-5 text-ink/70">
          <p className="font-semibold text-ink">
            {student.studentNo} · {student.gender}
            {sensitive ? ` · ${student.heightCm}cm · ${visionLabels[student.vision]}` : ""}
          </p>
          {sensitive && student.tags.length ? <p>标签：{student.tags.join("、")}</p> : null}
          {sensitive && student.specialNeeds ? <p>特殊需求：{student.specialNeeds}</p> : null}
          {sensitive && student.remark ? <p>备注：{student.remark}</p> : null}
          {!sensitive ? <p>公开视图仅显示姓名、学号和性别。</p> : null}
        </div>
      ) : (
        <p className="text-xs leading-5 text-ink/60">当前座位尚未安排学生。</p>
      )}

      {canToggleLocks ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-ink/10 pt-2">
          {onToggleSeatLock ? (
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-1 rounded-[6px] border px-2 py-1.5 text-xs font-bold",
                seatLocked ? "border-coral/30 bg-coral/10 text-coral" : "border-ink/10 text-ink/65 hover:bg-chalk"
              )}
              onClick={onToggleSeatLock}
            >
              {seatLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {seatLocked ? "解锁座位" : "锁座位"}
            </button>
          ) : null}
          {student && onToggleStudentLock ? (
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-1 rounded-[6px] border px-2 py-1.5 text-xs font-bold",
                studentLocked ? "border-coral/30 bg-coral/10 text-coral" : "border-ink/10 text-ink/65 hover:bg-chalk"
              )}
              onClick={onToggleStudentLock}
            >
              {studentLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {studentLocked ? "解锁学生" : "锁学生"}
            </button>
          ) : null}
        </div>
      ) : null}
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
