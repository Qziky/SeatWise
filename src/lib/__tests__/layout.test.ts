import { describe, expect, it } from "vitest";
import { createGridLayout, getActiveSeats, isDeskMate } from "@/lib/layout";

describe("layout helpers", () => {
  it("creates a grid layout and marks back and edge seats", () => {
    const layout = createGridLayout(3, 4, "top");

    expect(layout.seats).toHaveLength(12);
    expect(layout.seats.find((seat) => seat.id === "seat-r3-c2")?.attributes).toContain("back");
    expect(layout.seats.find((seat) => seat.id === "seat-r2-c1")?.attributes).toContain("edge");
  });

  it("returns active seats and detects desk mates by row pairs", () => {
    const layout = createGridLayout(2, 4, "top");
    const first = layout.seats.find((seat) => seat.id === "seat-r1-c1");
    const second = layout.seats.find((seat) => seat.id === "seat-r1-c2");
    const third = layout.seats.find((seat) => seat.id === "seat-r1-c3");

    expect(getActiveSeats(layout)).toHaveLength(8);
    expect(first && second && isDeskMate(first, second)).toBe(true);
    expect(first && third && isDeskMate(first, third)).toBe(false);
  });

  it("normalizes non-integer and out-of-range dimensions", () => {
    const layout = createGridLayout(3.5, 99, "top");

    expect(layout.rows).toBe(4);
    expect(layout.columns).toBe(12);
    expect(layout.seats).toHaveLength(48);
    expect(layout.seats.some((seat) => seat.attributes.includes("back"))).toBe(true);
  });
});
