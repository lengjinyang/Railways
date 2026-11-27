import { SAVE_VERSION, bumpUidSeq, type WorldState } from './types';

export const SAVE_STORAGE_KEY = 'railways_save_v3';
export const SAVE_STATION_KEY = 'railways_station_save_v3';

export interface SaveSummary {
  savedAt: number;
  stationIdx: number;
  stationName: string;
  dayCount: number;
  totalDistance: number;
  flatbedCount: number;
  coreCharge: number;
}

interface SerializedPayload {
  version: number;
  savedAt: number;
  state: Record<string, unknown>;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

/** Serialize full WorldState to JSON (converts Sets, strips transient UI/callbacks). */
export function serializeWorld(w: WorldState): string {
  const savedAt = Date.now();
  const clone: Record<string, unknown> = {
    ...w,
    exploredFog: Array.from(w.exploredFog),
    exploredChunks: Array.from(w.exploredChunks),
    activeHint: null,
    holdAction: null,
    activeCard: null,
    tradeOpen: false,
    bagOpen: false,
    routeOpen: false,
    throttleOpen: false,
    openChestUid: null,
    openContainerUid: null,
    openFacilityUid: null,
    deathReport: null,
    particles: [],
    floats: [],
    flyingPickups: [],
    lootFeed: [],
    lastSavedAt: savedAt,
  };
  const payload: SerializedPayload = {
    version: SAVE_VERSION,
    savedAt,
    state: clone,
  };
  return JSON.stringify(payload);
}

/** Deserialize JSON string back into a live WorldState (validates version & restores Sets + uid sequence). */
export function deserializeWorld(raw: string): WorldState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedPayload>;
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state || typeof parsed.state !== 'object') {
      return null;
    }
    const s = parsed.state as Record<string, unknown>;
    if (!s.player || !Array.isArray(s.flatbeds) || !s.backpack) return null;

    const restored = {
      ...s,
      exploredFog: new Set<string>(Array.isArray(s.exploredFog) ? (s.exploredFog as string[]) : []),
      exploredChunks: new Set<string>(Array.isArray(s.exploredChunks) ? (s.exploredChunks as string[]) : []),
      activeHint: null,
      holdAction: null,
      activeCard: null,
      tradeOpen: false,
      bagOpen: false,
      routeOpen: false,
      throttleOpen: false,
      openChestUid: null,
      openContainerUid: null,
      openFacilityUid: null,
      deathReport: null,
      particles: [],
      floats: [],
      flyingPickups: [],
      lootFeed: [],
      lastSavedAt: parsed.savedAt ?? Date.now(),
    } as unknown as WorldState;

    // Older saves: the lantern used to hang on a hook on the locomotive.
    if ((restored.lanternHolder as string) === 'train' || !restored.lanternHolder) restored.lanternHolder = 'player';
    if (restored.lanternPos === undefined) restored.lanternPos = null;
    if (!Array.isArray(restored.nestEruptions)) restored.nestEruptions = [];
    if (!restored.locoDeck) {
      restored.locoDeck = { id: -1, baseWeight: 0, couplerKind: 'standard', couplerHp: 100, couplerWarnCd: 0, hull: [], buildings: [] };
    }

    let maxNum = 1000;
    const scanUid = (id?: string) => {
      if (!id) return;
      const m = id.match(/_(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    };
    for (const p of restored.locoHull) scanUid(p.uid);
    for (const c of restored.flatbeds) {
      for (const p of c.hull) scanUid(p.uid);
      for (const b of c.buildings) scanUid(b.uid);
    }
    for (const b of restored.locoDeck.buildings) scanUid(b.uid);
    for (const pr of restored.props) scanUid(pr.uid);
    for (const mn of restored.monsters) scanUid(mn.uid);
    for (const pk of restored.pickups) scanUid(pk.uid);
    for (const hz of restored.trackHazards) scanUid(hz.uid);
    for (const br of restored.stationBarriers) scanUid(br.uid);
    bumpUidSeq(maxNum + 50);

    return restored;
  } catch {
    return null;
  }
}

// In-memory station snapshot fallback (also enables deterministic rollback in headless Node verify!)
let memoryStationSnapshot: string | null = null;

export function saveWorld(w: WorldState, key = SAVE_STORAGE_KEY): boolean {
  const raw = serializeWorld(w);
  w.lastSavedAt = Date.now();
  const storage = getStorage();
  if (!storage) return true;
  try {
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

/** Save a station arrival checkpoint (used on death rollback instead of random carriage loss). */
export function saveStationSnapshot(w: WorldState): boolean {
  const raw = serializeWorld(w);
  memoryStationSnapshot = raw;
  w.lastSavedAt = Date.now();
  const storage = getStorage();
  if (!storage) return true;
  try {
    storage.setItem(SAVE_STATION_KEY, raw);
    storage.setItem(SAVE_STORAGE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function loadWorld(key = SAVE_STORAGE_KEY): WorldState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return deserializeWorld(raw);
  } catch {
    return null;
  }
}

export function loadStationSnapshot(): WorldState | null {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(SAVE_STATION_KEY);
      if (raw) {
        const parsed = deserializeWorld(raw);
        if (parsed) return parsed;
      }
    } catch {
      // fall through to memory snapshot
    }
  }
  return memoryStationSnapshot ? deserializeWorld(memoryStationSnapshot) : null;
}

export function getSaveSummary(key = SAVE_STORAGE_KEY): SaveSummary | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SerializedPayload>;
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) return null;
    const st = parsed.state as unknown as WorldState;
    if (!st.player || !Array.isArray(st.flatbeds)) return null;
    return {
      savedAt: parsed.savedAt ?? Date.now(),
      stationIdx: st.stationIdx ?? 0,
      stationName: st.stationName ?? '未知站点',
      dayCount: st.dayCount ?? 1,
      totalDistance: Math.round(st.totalDistance ?? 0),
      flatbedCount: st.flatbeds.length,
      coreCharge: +(st.boilerFuel ?? 0).toFixed(1),
    };
  } catch {
    return null;
  }
}

/** Seconds of play between automatic saves. */
export const AUTOSAVE_INTERVAL = 60;

/**
 * A calm moment to autosave: alive, not dying, nothing biting. Saving mid-fight would let
 * "continue" drop you back into a fight you were about to lose.
 */
export function isSafeToAutosave(w: WorldState): boolean {
  if (!w.player.alive || w.deathReport || w.gameOver || w.victory) return false;
  if (w.player.hp < w.player.maxHp * 0.2) return false;
  return !w.monsters.some((m) => m.hp > 0 && Math.hypot(m.x - w.player.x, m.y - w.player.y) < 170);
}

/** Autosave if it's a safe moment; `force` skips the combat check (page hidden / closing). */
export function autosaveWorld(w: WorldState, force = false): boolean {
  if (!w.player.alive || w.deathReport || w.gameOver || w.victory) return false;
  if (!force && !isSafeToAutosave(w)) return false;
  return saveWorld(w);
}

export function hasSavedWorld(key = SAVE_STORAGE_KEY): boolean {
  return getSaveSummary(key) !== null;
}

export function clearSavedWorld(): void {
  memoryStationSnapshot = null;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
    storage.removeItem(SAVE_STATION_KEY);
  } catch {
    // ignore
  }
}
