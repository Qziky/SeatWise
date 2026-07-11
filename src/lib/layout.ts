import type { ClassroomLayout, PodiumDirection, SeatAttribute, SeatCell } from "@/lib/types";

export function createSeatId(row: number, column: number) {
  return `seat-r${row}-c${column}`;
}

export function createGridLayout(
  rows = 6,
  columns = 8,
  podium: PodiumDirection = "top",
  previousSeats: SeatCell[] = []
): ClassroomLayout {
  const normalizedRows = normalizeDimension(rows);
  const normalizedColumns = normalizeDimension(columns);
  const previousById = new Map(previousSeats.map((seat) => [seat.id, seat]));
  const seats: SeatCell[] = [];

  for (let row = 1; row <= normalizedRows; row += 1) {
    for (let column = 1; column <= normalizedColumns; column += 1) {
      const id = createSeatId(row, column);
      const previous = previousById.get(id);
      const autoAttributes = inferSeatAttributes(row, column, normalizedRows, normalizedColumns, podium);
      const preserved = previous?.attributes.filter(
        (attribute) => !["back", "edge"].includes(attribute)
      );

      seats.push({
        id,
        row,
        column,
        attributes: uniqueAttributes([...(preserved ?? []), ...autoAttributes]),
        locked: previous?.locked ?? false
      });
    }
  }

  return { rows: normalizedRows, columns: normalizedColumns, podium, seats };
}

export function getLayoutSignature(layout: ClassroomLayout) {
  const seats = [...layout.seats]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((seat) => `${seat.id}:${[...seat.attributes].sort().join(",")}`)
    .join("|");

  return `${layout.rows}x${layout.columns}:${layout.podium}:${seats}`;
}

export function inferSeatAttributes(
  row: number,
  column: number,
  rows: number,
  columns: number,
  podium: PodiumDirection
): SeatAttribute[] {
  const attributes: SeatAttribute[] = [];
  const isEdge = row === 1 || row === rows || column === 1 || column === columns;
  const isBack =
    (podium === "top" && row === rows) ||
    (podium === "bottom" && row === 1) ||
    (podium === "left" && column === columns) ||
    (podium === "right" && column === 1);

  if (isEdge) attributes.push("edge");
  if (isBack) attributes.push("back");
  return attributes;
}

export function uniqueAttributes(attributes: SeatAttribute[]) {
  return Array.from(new Set(attributes));
}

export function toggleSeatAttribute(cell: SeatCell, attribute: SeatAttribute): SeatCell {
  const hasAttribute = cell.attributes.includes(attribute);
  return {
    ...cell,
    attributes: hasAttribute
      ? cell.attributes.filter((item) => item !== attribute)
      : [...cell.attributes, attribute]
  };
}

export function getActiveSeats(layout: ClassroomLayout) {
  return layout.seats.filter((seat) => !seat.attributes.includes("empty"));
}

export function getSeatById(layout: ClassroomLayout, seatId: string) {
  return layout.seats.find((seat) => seat.id === seatId);
}

export function getFrontRank(layout: ClassroomLayout, seat: SeatCell) {
  if (layout.podium === "top") return seat.row;
  if (layout.podium === "bottom") return layout.rows - seat.row + 1;
  if (layout.podium === "left") return seat.column;
  return layout.columns - seat.column + 1;
}

export function getBackRank(layout: ClassroomLayout, seat: SeatCell) {
  return getFrontSpan(layout) - getFrontRank(layout, seat) + 1;
}

export function getFrontSpan(layout: ClassroomLayout) {
  return layout.podium === "top" || layout.podium === "bottom" ? layout.rows : layout.columns;
}

export function isFrontHalf(layout: ClassroomLayout, seat: SeatCell) {
  return getFrontRank(layout, seat) <= Math.ceil(getFrontSpan(layout) / 2);
}

export function isBackSeat(layout: ClassroomLayout, seat: SeatCell) {
  return seat.attributes.includes("back") || getFrontRank(layout, seat) === getFrontSpan(layout);
}

export function isDeskMate(a: SeatCell, b: SeatCell) {
  if (a.row !== b.row) return false;
  const pairA = Math.floor((a.column - 1) / 2);
  const pairB = Math.floor((b.column - 1) / 2);
  return pairA === pairB && Math.abs(a.column - b.column) === 1;
}

export function isNearSeat(a: SeatCell, b: SeatCell) {
  const rowDistance = Math.abs(a.row - b.row);
  const columnDistance = Math.abs(a.column - b.column);
  return rowDistance + columnDistance <= 2;
}

export function describeSeat(seat: SeatCell) {
  return `第${seat.row}排第${seat.column}座`;
}

function normalizeDimension(value: number) {
  const normalized = Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(1, Math.min(12, normalized));
}
