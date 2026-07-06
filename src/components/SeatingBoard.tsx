"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CircleAlert,
  CornerDownRight,
  DoorOpen,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Minus,
  PanelLeft,
  Rows3,
  ScanEye,
  Sun,
  Tag,
  Tags,
  TrendingDown,
  TrendingUp,
  Unlock,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { getVisibleStudent, shouldShowSensitive } from "@/lib/privacy";
import type { ClassRoom, SeatingPlan, SeatAttribute, SeatCell, Student, ViewMode, VisionStatus } from "@/lib/types";
import { seatAttributeLabels, visionLabels } from "@/lib/types";

type SeatAttributeMarker = Exclude<SeatAttribute, "empty">;

const seatAttributeIcons: Record<SeatAttributeMarker, LucideIcon> = {
  window: PanelLeft,
  door: DoorOpen,
  glare: Sun,
  back: Rows3,
  edge: CornerDownRight
};

const visionAccentClass: Record<VisionStatus, string> = {
  normal: "border-l-fern/55 bg-white",
  mild: "border-l-marigold bg-marigold/5",
  severe: "border-l-coral bg-coral/5",
  unknown: "border-l-ink/20 bg-white"
};

const visionStatusIcons: Record<VisionStatus, LucideIcon> = {
  normal: Eye,
  mild: ScanEye,
  severe: CircleAlert,
  unknown: EyeOff
};

interface LegendItem {
  icon: LucideIcon;
  label: string;
}

const seatLegendItems: LegendItem[] = [
  { label: "靠窗", icon: PanelLeft },
  { label: "靠门", icon: DoorOpen },
  { label: "反光", icon: Sun },
  { label: "后排", icon: Rows3 },
  { label: "边缘", icon: CornerDownRight }
];

const visionLegendItems: LegendItem[] = [
  { label: "视力正常", icon: visionStatusIcons.normal },
  { label: "轻度关注", icon: visionStatusIcons.mild },
  { label: "重点照顾", icon: visionStatusIcons.severe },
  { label: "视力未填", icon: visionStatusIcons.unknown }
];

const heightLegendItems: LegendItem[] = [
  { label: "偏高", icon: TrendingUp },
  { label: "偏矮", icon: TrendingDown },
  { label: "常规身高", icon: Minus }
];

const noteLegendItems: LegendItem[] = [
  { label: "标签", icon: Tag },
  { label: "多标签", icon: Tags },
  { label: "特殊需求", icon: HeartPulse },
  { label: "已锁定", icon: Lock }
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

function HeightIcon({ heightCm }: { heightCm: number }) {
  if (heightCm >= 165) return <TrendingUp className="h-3 w-3" />;
  if (heightCm <= 150) return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
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
          const visibleAttributes = seat.attributes.filter(
            (attribute): attribute is Exclude<SeatAttribute, "empty"> => attribute !== "empty"
          );
          const markerAttributes = visibleAttributes;

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
                markerAttributes={markerAttributes}
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
        edge && !empty && "border-fern/45 bg-fern/[0.04] shadow-[inset_0_0_0_1px_rgba(36,132,105,0.12)]",
        glare && !empty && "bg-marigold/[0.035]",
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
  markerAttributes,
  mode,
  seat,
  seatLocked,
  student,
  studentLocked
}: {
  isTeacherMode: boolean;
  markerAttributes: SeatAttributeMarker[];
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
        isTeacherMode ? "min-h-[88px] gap-1" : "min-h-[82px] gap-1.5",
        markerAttributes.length && "pb-1.5"
      )}
      title={mode === "teacher" ? getSeatAttributeTitle(seat.attributes) : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold leading-none text-ink/45">
          {seat.row}-{seat.column}
        </span>
        {mode === "teacher" && (seatLocked || studentLocked) ? (
          <span
            title={seatLocked && studentLocked ? "座位和学生已锁定" : seatLocked ? "座位已锁定" : "学生已锁定"}
          >
            <Lock className="h-3 w-3 text-ink/55" />
          </span>
        ) : null}
      </div>

      {student ? (
        <DraggableStudent student={student} mode={mode} locked={studentLocked} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-[11px] font-semibold text-ink/35">
          {seat.attributes.includes("empty") ? "空座" : "待安排"}
        </div>
      )}

      {mode === "teacher" ? <SeatAttributeMarkers attributes={markerAttributes} /> : null}
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
  const markerAttributes = seat.attributes.filter(
    (attribute): attribute is SeatAttributeMarker => attribute !== "empty"
  );

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
          markerAttributes={markerAttributes}
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
      {attributes.includes("window") ? <div className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-sky-500/35" /> : null}
      {attributes.includes("door") ? <div className="absolute bottom-2 right-0 top-2 w-1 rounded-l-full bg-violet-500/35" /> : null}
      {attributes.includes("back") ? <div className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-ink/20" /> : null}
    </div>
  );
}

function SeatAttributeMarkers({ attributes }: { attributes: SeatAttributeMarker[] }) {
  if (!attributes.length) return <div className="min-h-3" />;

  return (
    <div className="flex min-h-3 items-center gap-0.5 text-ink/55" aria-hidden="true">
      {attributes.slice(0, 4).map((attribute) => (
        <SeatAttributeIcon key={attribute} attribute={attribute} />
      ))}
    </div>
  );
}

function SeatAttributeIcon({ attribute }: { attribute: SeatAttributeMarker }) {
  const Icon = seatAttributeIcons[attribute];

  return (
    <span title={seatAttributeLabels[attribute]}>
      <Icon className="h-3 w-3 shrink-0" />
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
      className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[7px] border border-ink/10 bg-paper px-2 py-1.5 text-[10px] font-semibold leading-none text-ink/60 no-print"
      style={{ minWidth }}
      aria-label="座位图标图例"
    >
      <LegendGroup title="座位" items={seatLegendItems} />
      {mode === "teacher" ? (
        <>
          <LegendGroup title="视力条" items={visionLegendItems} />
          <LegendGroup title="身高点" items={heightLegendItems} />
          <LegendGroup title="标记点" items={noteLegendItems} />
        </>
      ) : null}
    </div>
  );
}

function LegendGroup({ title, items }: { title: string; items: LegendItem[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink/40">{title}</span>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-0.5 whitespace-nowrap" title={item.label}>
          <LegendSwatch item={item} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function LegendSwatch({ item }: { item: LegendItem }) {
  const Icon = item.icon;

  return <Icon className="h-3 w-3 shrink-0 text-ink/55" />;
}

function StudentStatusMarkers({ student }: { student: Student }) {
  const VisionIcon = visionStatusIcons[student.vision];
  const visibleTags = student.tags.slice(0, 2);

  return (
    <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center gap-0.5 text-ink/55" aria-hidden="true">
      <span title={visionLabels[student.vision]}>
        <VisionIcon className="h-3 w-3 shrink-0" />
      </span>
      <span className="flex h-3 w-3 shrink-0 items-center justify-center" title={`${student.heightCm}cm`}>
        <HeightIcon heightCm={student.heightCm} />
      </span>
      {visibleTags.length === 1 ? (
        <span title={visibleTags[0]}>
          <Tag className="h-3 w-3 shrink-0" />
        </span>
      ) : null}
      {visibleTags.length > 1 ? (
        <span title={visibleTags.join("、")}>
          <Tags className="h-3 w-3 shrink-0" />
        </span>
      ) : null}
      {student.specialNeeds ? (
        <span title={student.specialNeeds}>
          <HeartPulse className="h-3 w-3 shrink-0" />
        </span>
      ) : null}
    </div>
  );
}
