import { describe, expect, it, vi } from "vitest";
import { clearAllPersistedState, clearPersistedPlans } from "@/lib/persistence-recovery";

function createStorage(raw: string | null) {
  let value = raw;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
    read: () => value
  };
}

describe("persisted plan recovery", () => {
  it("removes only plans and preserves classroom, rules and history", () => {
    const storage = createStorage(JSON.stringify({
      version: 3,
      state: {
        classroom: { id: "classroom" },
        rules: { visionPriority: true },
        plans: [{ id: "broken-plan" }],
        selectedPlanId: "broken-plan",
        history: [{ id: "history" }]
      }
    }));

    expect(clearPersistedPlans(storage)).toBe("plans-only");
    const persisted = JSON.parse(storage.read() as string);
    expect(persisted.state).not.toHaveProperty("plans");
    expect(persisted.state).not.toHaveProperty("selectedPlanId");
    expect(persisted.state.classroom).toEqual({ id: "classroom" });
    expect(persisted.state.rules).toEqual({ visionPriority: true });
    expect(persisted.state.history).toEqual([{ id: "history" }]);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not delete valid data when writing the recovered state fails", () => {
    const raw = JSON.stringify({ version: 3, state: { classroom: { id: "classroom" }, plans: [] } });
    const storage = createStorage(raw);
    storage.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(clearPersistedPlans(storage)).toBe("failed");
    expect(storage.read()).toBe(raw);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("requires a separate explicit operation for corrupt data", () => {
    const storage = createStorage("not-json");

    expect(clearPersistedPlans(storage)).toBe("corrupt");
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(clearAllPersistedState(storage)).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });
});
