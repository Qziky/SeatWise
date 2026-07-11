const DEFAULT_PERSISTED_STATE_KEY = "seatwise-mvp";

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type ClearPersistedPlansResult = "plans-only" | "corrupt" | "failed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clearPersistedPlans(
  storage: StorageLike,
  key = DEFAULT_PERSISTED_STATE_KEY
): ClearPersistedPlansResult {
  let rawState: string | null;
  try {
    rawState = storage.getItem(key);
  } catch {
    return "failed";
  }
  if (!rawState) return "plans-only";

  let persistedState: unknown;
  try {
    persistedState = JSON.parse(rawState);
  } catch {
    return "corrupt";
  }
  if (!isRecord(persistedState) || !isRecord(persistedState.state)) return "corrupt";

  const nextState = { ...persistedState.state };
  delete nextState.plans;
  delete nextState.selectedPlanId;

  try {
    storage.setItem(key, JSON.stringify({ ...persistedState, state: nextState }));
    return "plans-only";
  } catch {
    return "failed";
  }
}

export function clearAllPersistedState(
  storage: StorageLike,
  key = DEFAULT_PERSISTED_STATE_KEY
) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
