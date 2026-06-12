// localStorage-backed persistence for the Recruiting mock store.
// Data survives reloads; bump SEED_VERSION in seed.ts to force a reseed.

import { SEED_VERSION, buildSeed, type MockDbShape } from "./seed";

const STORAGE_KEY = "hrms.recruiting.mock.v2";

const canPersist = (): boolean => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const load = (): MockDbShape => {
  if (canPersist()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDbShape;
        if (parsed && parsed.version === SEED_VERSION) return parsed;
      }
    } catch {
      // corrupted payload — fall through to reseed
    }
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
};

const persist = (data: MockDbShape) => {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded etc. — mock keeps working in memory
  }
};

let db: MockDbShape = load();

export const getDb = (): MockDbShape => db;

export const saveDb = () => persist(db);

/** Reset demo data to the seed (useful for demos). */
export const resetMockData = () => {
  db = buildSeed();
  persist(db);
};

let idCounter = Date.now() % 100_000;
export const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

export const nowIso = (): string => new Date().toISOString();
