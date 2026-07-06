"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Unlock, X } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { getVisibleStudent, shouldShowSensitive } from "@/lib/privacy";
import type { ClassRoom, SeatingPlan, SeatAttribute, SeatCell, Student, ViewMode, VisionStatus } from "@/lib/types";
import { seatAttributeLabels, visionLabels } from "@/lib/types";

const visionAccentClass: Record<VisionStatus, string> = {
  normal: "border-l-fern/55 bg-white",
  mild: "border-l-marigold bg-marigold/5",
  severe: "border-l-coral bg-coral/5",
  unknown: "border-l-ink/20 bg-white"
};

interface LegendItem {
  className: string;
  description?: string;
  label: string;
  legendLabel?: string;
  shortLabel: string;
}

interface BorderLegendItem {
  className: string;
  description?: string;
  label: string;
  legendLabel?: string;
  shortLabel: string;
}

const visionStatusMarkerClass: Record<VisionStatus, string> = {
  normal: "border-fern/45 bg-fern/10 text-fern",
  mild: "border-marigold/45 bg-marigold/10 text-marigold",
  severe: "border-coral/45 bg-coral/10 text-coral",
  unknown: "border-ink/20 bg-ink/[0.04] text-ink/45"
};

const visionStatusShortLabels: Record<VisionStatus, string> = {
  normal: "正",
  mild: "轻",
  severe: "重",
  unknown: "未"
};

const visionLegendItems: LegendItem[] = [
  { label: "视力正常", legendLabel: "正常视力", description: "绿色，普通安排", shortLabel: "正", className: visionStatusMarkerClass.normal },
  { label: "轻度关注", legendLabel: "轻度视力", description: "黄色，尽量靠前", shortLabel: "轻", className: visionStatusMarkerClass.mild },
  { label: "重点照顾", legendLabel: "重点视力", description: "红色，优先靠前", shortLabel: "重", className: visionStatusMarkerClass.severe },
  { label: "视力未填", legendLabel: "视力未填", description: "灰色，资料待补", shortLabel: "未", className: visionStatusMarkerClass.unknown }
];

const heightLegendItems: LegendItem[] = [
  { label: "偏高", legendLabel: "身高偏高", description: "蓝色，高个尽量不挡后排", shortLabel: "高", className: "border-sky-500/45 bg-sky-500/10 text-sky-700" },
  { label: "偏矮", legendLabel: "身高偏矮", description: "绿色，矮个优先靠前", shortLabel: "矮", className: "border-fern/45 bg-fern/10 text-fern" }
];

const noteLegendItems: LegendItem[] = [
  { label: "标签", legendLabel: "有标签", description: "蓝色，学生有一个标签", shortLabel: "标", className: "border-sky-500/45 bg-sky-500/10 text-sky-700" },
  { label: "多标签", legendLabel: "多个标签", description: "紫色，学生有多个标签", shortLabel: "多", className: "border-violet-500/45 bg-violet-500/10 text-violet-700" },
  { label: "特殊需求", legendLabel: "特殊需求", description: "红色，需要教师复核", shortLabel: "特", className: "border-coral/45 bg-coral/10 text-coral" }
];

const seatBorderLegendItems: BorderLegendItem[] = [
  { label: "靠窗", legendLabel: "靠窗", description: "上蓝线", shortLabel: "窗", className: "border-t-2 border-t-sky-500/45 border-x-ink/10 border-b-ink/10 bg-sky-500/[0.04]" },
  { label: "靠门", legendLabel: "靠门", description: "右紫线", shortLabel: "门", className: "border-r-2 border-r-violet-500/45 border-y-ink/10 border-l-ink/10 bg-violet-500/[0.04]" },
  { label: "反光", legendLabel: "反光", description: "黄色边", shortLabel: "光", className: "border-marigold bg-marigold/5" },
  { label: "边缘", legendLabel: "边缘", description: "绿色边", shortLabel: "边", className: "border-fern/55 bg-fern/[0.04]" },
  { label: "后排", legendLabel: "后排", description: "下灰线", shortLabel: "后", className: "border-b-2 border-b-ink/25 border-x-ink/10 border-t-ink/10 bg-ink/[0.02]" }
];

const teacherBorderLegendItems: BorderLegendItem[] = [
  { label: "正常视力", legendLabel: "正常", description: "左绿线", shortLabel: "正", className: "border-l-4 border-l-fern/55 border-y-ink/10 border-r-ink/10 bg-white" },
  { label: "轻度关注", legendLabel: "轻度", description: "左黄线", shortLabel: "轻", className: "border-l-4 border-l-marigold border-y-ink/10 border-r-ink/10 bg-marigold/5" },
  { label: "重点照顾", legendLabel: "重点", description: "左红线", shortLabel: "重", className: "border-l-4 border-l-coral border-y-ink/10 border-r-ink/10 bg-coral/5" },
  { label: "锁定座位或学生", legendLabel: "锁定", description: "红边框", shortLabel: "锁", className: "border-coral/55 bg-coral/5" }
];

interface DetailState {
  left: number;
  seatId: string;
  top: number;
}

interface DragState {
  overSeatId: string;
  sourceSeatId: string;
  studentId: string;
}

function getSeatAttributeTitle(attributes: SeatAttribute[]) {
  const visible = attributes.filter((attribute) => attribute !== "empty");
  return visible.length ? visible.map((attribute) => seatAttributeLabels[attribute]).join("、") : "普通座位";
}

function getHeightMarker(heightCm: number): LegendItem | null {
  if (heightCm >= 165) return heightLegendItems[0];
  if (heightCm <= 150) return heightLegendItems[1];
  return null;
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewAssignments, setPreviewAssignments] = useState<Record<string, string | null> | null>(null);
  const visibleAssignments = previewAssignments ?? plan?.assignments ?? {};
  const selectedSeat = detail ? classroom.layout.seats.find((seat) => seat.id === detail.seatId) ?? null : null;
  const selectedStudentId = selectedSeat ? visibleAssignments[selectedSeat.id] ?? null : null;
  const selectedStudent = selectedStudentId ? studentsById.get(selectedStudentId) ?? null : null;
  const selectedSeatLocked = Boolean(selectedSeat && plan?.lockedSeatIds.includes(selectedSeat.id));
  const selectedStudentLocked = Boolean(selectedStudent && plan?.lockedStudentIds.includes(selectedStudent.id));
  const activeDragSeat = dragState
    ? classroom.layout.seats.find((seat) => seat.id === dragState.sourceSeatId) ?? null
    : null;
  const activeDragStudent = dragState ? studentsById.get(dragState.studentId) ?? null : null;
  const activeDragStudentLocked = Boolean(activeDragStudent && plan?.lockedStudentIds.includes(activeDragStudent.id));

  function openDetailFromElement(element: HTMLElement, seatId: string) {
    if (mode === "print") return;
    const rect = element.getBoundingClientRect();
    const bubbleWidth = Math.min(280, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - bubbleWidth - 12));
    const below = rect.bottom + 8;
    const top = below + 220 > window.innerHeight ? Math.max(12, rect.top - 218) : below;
    setDetail({ seatId, left, top });
  }

  function handleDragStart(event: DragStartEvent) {
    if (!plan) return;
    const studentId = String(event.active.id);
    const sourceSeatId = Object.entries(plan.assignments).find(([, value]) => value === studentId)?.[0];
    if (!sourceSeatId) return;

    setDetail(null);
    setDragState({ overSeatId: sourceSeatId, sourceSeatId, studentId });
    setPreviewAssignments(createDragPreviewAssignments(plan.assignments, studentId, sourceSeatId, sourceSeatId));
  }

  function handleDragOver(event: DragOverEvent) {
    if (!dragState || !plan) return;
    const overSeatId = event.over?.id ? String(event.over.id) : null;
    if (!overSeatId || overSeatId === dragState.overSeatId || !canPreviewDrop(overSeatId)) return;

    setDragState({ ...dragState, overSeatId });
    setPreviewAssignments(createDragPreviewAssignments(plan.assignments, dragState.studentId, dragState.sourceSeatId, overSeatId));
  }

  function canPreviewDrop(seatId: string) {
    if (!plan) return false;
    if (plan.lockedSeatIds.includes(seatId)) return false;
    const targetSeat = classroom.layout.seats.find((seat) => seat.id === seatId);
    if (!targetSeat || targetSeat.attributes.includes("empty")) return false;
    const targetStudentId = plan.assignments[seatId];
    return !targetStudentId || !plan.lockedStudentIds.includes(targetStudentId);
  }

  function resetDragPreview() {
    setDragState(null);
    setPreviewAssignments(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const studentId = String(event.active.id);
    const seatId = event.over?.id ? String(event.over.id) : null;
    resetDragPreview();
    if (!seatId || !onMoveStudent || !canPreviewDrop(seatId)) return;
    onMoveStudent(studentId, seatId);
  }

  const board = (
    <div className="w-full max-w-full overflow-x-auto pb-1" data-testid="seating-board-scroll">
      <SeatingLegend mode={mode} minWidth={boardMinWidth} />
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
          const studentId = visibleAssignments[seat.id] ?? null;
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
              attributes={seat.attributes}
              student={student}
              studentLocked={studentLocked}
              selected={detail?.seatId === seat.id}
              onOpenDetail={(element) => openDetailFromElement(element, seat.id)}
            >
              <SeatCardContent
                isTeacherMode={isTeacherMode}
                mode={mode}
                seat={seat}
                seatLocked={seatLocked}
                student={student}
                studentLocked={studentLocked}
              />
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={resetDragPreview}
      onDragEnd={handleDragEnd}
    >
      {board}
      <DragOverlay dropAnimation={null}>
        {activeDragSeat && activeDragStudent ? (
          <SeatDragOverlayCard
            seat={activeDragSeat}
            student={activeDragStudent}
            mode={mode}
            studentLocked={activeDragStudentLocked}
          />
        ) : null}
      </DragOverlay>
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
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: seat.id,
    disabled: readonly || empty || locked
  });
  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: student?.id ?? seat.id,
    disabled: readonly || empty || locked || studentLocked || !student
  });
  const edge = attributes.includes("edge");
  const glare = attributes.includes("glare");
  const windowSeat = attributes.includes("window");
  const doorSeat = attributes.includes("door");
  const backSeat = attributes.includes("back");
  const sensitive = mode === "teacher" && Boolean(student);
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  function setNodeRef(node: HTMLDivElement | null) {
    setDroppableNodeRef(node);
    setDraggableNodeRef(node);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...dragAttributes}
      className={cn(
        "relative cursor-pointer rounded-[7px] border transition-colors",
        mode === "teacher" ? "min-h-[104px] p-1.5" : "min-h-[98px] p-1.5",
        student && !readonly && !locked && !studentLocked && mode !== "print" && "touch-none",
        empty
          ? "border-dashed border-ink/15 bg-stone-100 text-ink/35"
          : "border-ink/10 bg-paper",
        windowSeat && !empty && "border-t-2 border-t-sky-500/45",
        doorSeat && !empty && "border-r-2 border-r-violet-500/45",
        backSeat && !empty && "border-b-2 border-b-ink/25",
        edge && !empty && "border-fern/45 bg-fern/[0.04] shadow-[inset_0_0_0_1px_rgba(36,132,105,0.12)]",
        glare && !empty && "border-marigold/45 bg-marigold/[0.035]",
        sensitive && "border-l-4",
        sensitive && visionAccentClass[student!.vision],
        isOver && "border-fern bg-chalk",
        (locked || studentLocked) && "border-coral/50 bg-coral/5",
        isDragging && "z-30 opacity-90 shadow-soft ring-2 ring-fern/35",
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

function createDragPreviewAssignments(
  assignments: Record<string, string | null>,
  studentId: string,
  sourceSeatId: string,
  targetSeatId: string
) {
  const next = { ...assignments };
  const targetStudentId = targetSeatId === sourceSeatId ? null : next[targetSeatId] ?? null;

  Object.entries(next).forEach(([seatId, assignedStudentId]) => {
    if (assignedStudentId === studentId) {
      next[seatId] = null;
    }
  });

  next[sourceSeatId] = targetStudentId === studentId ? null : targetStudentId;
  if (targetSeatId !== sourceSeatId) {
    next[targetSeatId] = null;
  }

  return next;
}

function SeatCardContent({
  isTeacherMode,
  mode,
  seat,
  seatLocked,
  student,
  studentLocked
}: {
  isTeacherMode: boolean;
  mode: ViewMode;
  seat: SeatCell;
  seatLocked: boolean;
  student: Student | null;
  studentLocked: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between",
        isTeacherMode ? "min-h-[88px] gap-1" : "min-h-[82px] gap-1.5"
      )}
      title={mode === "teacher" ? getSeatAttributeTitle(seat.attributes) : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold leading-none text-ink/45">
          {seat.row}-{seat.column}
        </span>
        {mode === "teacher" && (seatLocked || studentLocked) ? (
          <MiniTextBadge
            className={noteLegendItems[3].className}
            label={seatLocked && studentLocked ? "座位和学生已锁定" : seatLocked ? "座位已锁定" : "学生已锁定"}
            shortLabel="锁"
          />
        ) : null}
      </div>

      {student ? (
        <DraggableStudent student={student} mode={mode} locked={studentLocked} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-[11px] font-semibold text-ink/35">
          {seat.attributes.includes("empty") ? "空座" : "待安排"}
        </div>
      )}
    </div>
  );
}

function SeatDragOverlayCard({
  mode,
  seat,
  student,
  studentLocked
}: {
  mode: ViewMode;
  seat: SeatCell;
  student: Student;
  studentLocked: boolean;
}) {
  const isTeacherMode = mode === "teacher";

  return (
    <div
      className={cn(
        "relative w-[86px] cursor-grabbing rounded-[7px] border border-fern/45 bg-paper p-1.5 opacity-95 shadow-soft ring-2 ring-fern/35",
        mode === "teacher" ? "min-h-[104px]" : "min-h-[98px]",
        mode === "teacher" && "border-l-4",
        mode === "teacher" && visionAccentClass[student.vision]
      )}
    >
      <SeatCellPatterns attributes={seat.attributes} />
      <div className="relative z-10">
        <SeatCardContent
          isTeacherMode={isTeacherMode}
          mode={mode}
          seat={seat}
          seatLocked={false}
          student={student}
          studentLocked={studentLocked}
        />
      </div>
    </div>
  );
}

function SeatCellPatterns({ attributes }: { attributes: SeatAttribute[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {attributes.includes("glare") ? (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(222,145,43,0.15)_0,rgba(222,145,43,0.15)_3px,transparent_3px,transparent_10px)]" />
      ) : null}
      {attributes.includes("window") ? <div className="absolute left-2 right-2 top-0 h-1 rounded-b-full bg-sky-500/35" /> : null}
      {attributes.includes("door") ? <div className="absolute bottom-2 right-0 top-2 w-1 rounded-l-full bg-violet-500/35" /> : null}
      {attributes.includes("back") ? <div className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-ink/20" /> : null}
    </div>
  );
}

function MiniTextBadge({
  className,
  label,
  shortLabel
}: {
  className: string;
  label: string;
  shortLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded-[3px] border px-[2px] text-[8px] font-black leading-none",
        className
      )}
      title={label}
    >
      {shortLabel}
    </span>
  );
}

function DraggableStudent({
  student,
  mode,
  locked
}: {
  student: Student;
  mode: ViewMode;
  locked: boolean;
}) {
  const visible = getVisibleStudent(student, mode);
  const sensitive = shouldShowSensitive(mode);

  return (
    <div
      className={cn(
        "relative flex min-h-[52px] flex-col gap-0.5 p-1 pb-3",
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

function SeatingLegend({ mode, minWidth }: { mode: ViewMode; minWidth: number }) {
  if (mode === "print") return null;

  return (
    <div
      className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto rounded-[7px] border border-ink/10 bg-paper px-2 py-1.5 text-[10px] font-semibold leading-none text-ink/65 no-print"
      style={{ minWidth }}
      aria-label="座位标记图例"
    >
      <BorderLegendGroup title="座位环境" helper="格子边缘颜色代表座位环境" items={seatBorderLegendItems} />
      {mode === "teacher" ? (
        <>
          <LegendGroup title="学生状态" helper="格子底部小字代表学生状态" items={[...visionLegendItems.slice(1), ...heightLegendItems, ...noteLegendItems]} />
          <BorderLegendGroup title="教师视力线" helper="教师视图左侧彩线代表视力程度" items={teacherBorderLegendItems} />
        </>
      ) : null}
    </div>
  );
}

function LegendGroup({ title, helper, items }: { title: string; helper: string; items: LegendItem[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1" title={helper}>
      <span className="whitespace-nowrap text-ink/45">{title}</span>
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1 whitespace-nowrap rounded-[4px] bg-white/65 px-1.5 py-0.5"
          title={item.description ? `${item.label}：${item.description}` : item.label}
        >
          <LegendSwatch item={item} />
          <span className="text-ink/70">{item.legendLabel ?? item.label}</span>
        </span>
      ))}
    </div>
  );
}

function LegendSwatch({ item }: { item: LegendItem }) {
  return <MiniTextBadge className={item.className} label={item.label} shortLabel={item.shortLabel} />;
}

function BorderLegendGroup({ title, helper, items }: { title: string; helper: string; items: BorderLegendItem[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1" title={helper}>
      <span className="whitespace-nowrap text-ink/45">{title}</span>
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1 whitespace-nowrap rounded-[4px] bg-white/65 px-1.5 py-0.5"
          title={item.description ? `${item.label}：${item.description}` : item.label}
        >
          <span className={cn("h-3.5 w-5 shrink-0 rounded-[3px] border-2", item.className)} />
          <span className="text-ink/70">{item.legendLabel ?? item.label}</span>
          {item.description ? <span className="text-[9px] text-ink/38">{item.description}</span> : null}
        </span>
      ))}
    </div>
  );
}

function StudentStatusMarkers({ student }: { student: Student }) {
  const visibleTags = student.tags.slice(0, 2);
  const heightMarker = getHeightMarker(student.heightCm);
  const markers: LegendItem[] = [];

  if (student.vision !== "normal") {
    markers.push({
      className: visionStatusMarkerClass[student.vision],
      label: visionLabels[student.vision],
      shortLabel: visionStatusShortLabels[student.vision]
    });
  }

  if (heightMarker) markers.push(heightMarker);

  if (visibleTags.length === 1) {
    markers.push({ ...noteLegendItems[0], label: visibleTags[0] });
  }

  if (visibleTags.length > 1) {
    markers.push({ ...noteLegendItems[1], label: visibleTags.join("、") });
  }

  if (student.specialNeeds) {
    markers.push({ ...noteLegendItems[2], label: student.specialNeeds });
  }

  if (!markers.length) return null;

  return (
    <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center gap-0.5" aria-hidden="true">
      {markers.slice(0, 4).map((marker) => (
        <MiniTextBadge
          key={`${marker.shortLabel}-${marker.label}`}
          className={marker.className}
          label={marker.label}
          shortLabel={marker.shortLabel}
        />
      ))}
    </div>
  );
}
