import { addToInventory, type ResourceKey } from '../inventory';
import { BUILDINGS, DEMO_DISABLED_BUILDINGS } from '../recipes_v2';
import { syncFortressHullBonus } from './train';
import { SAVE_VERSION, bumpUidSeq, type WorldState } from './types';

/**
 * Older saves may carry turrets or a ram from before the train stopped fighting (Q12).
 * Take them down and hand their base materials back so nothing the player paid for is lost.
 */
function stripDisabledDefenses(w: WorldState): void {
  const refund = (type: keyof typeof BUILDINGS) => {
    for (const [k, v] of Object.entries(BUILDINGS[type].cost)) {
      if ((v ?? 0) > 0) addToInventory(w.backpack, k as ResourceKey, v!);
    }
  };
  for (const car of [...w.flatbeds, w.locoDeck]) {
    const before = car.buildings.length;
    car.buildings = car.buildings.filter((b) => {
      if (!DEMO_DISABLED_BUILDINGS.has(b.type)) return true;
      refund(b.type);
      return false;
    });
    if (car.buildings.length !== before && car.id >= 0) syncFortressHullBonus(car);
  }
  if (w.hasBumper) {
    refund('bumper');
    w.hasBumper = false;
    w.bumperTier = 1;
  }
  if (DEMO_DISABLED_BUILDINGS.has(w.selectedBuild)) w.selectedBuild = 'workbench';
}

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
  /** Saved by leaving the page mid-run (read once), rather than on arriving at a station. */
  suspended: boolean;
  /** Left mid-leg (between stations) rather than while parked at one. */
  onRoad: boolean;
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
    stripDisabledDefenses(restored);

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

/**
 * Saves follow design §6: the real save is the station checkpoint written on arrival.
 * Leaving the page mid-run writes a one-shot *suspend* save (SAVE_STORAGE_KEY) that "continue"
 * reads once and then deletes, so quitting is never a way to dodge a death.
 */
function writeKey(key: string, raw: string): boolean {
  const storage = getStorage();
  if (!storage) return true;
  try {
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

function removeKey(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** One-shot suspend save for leaving the page mid-run. A dead run is never suspended. */
export function saveSuspend(w: WorldState): boolean {
  if (!w.player.alive || w.deathReport || w.gameOver || w.victory) return false;
  return writeKey(SAVE_STORAGE_KEY, serializeWorld(w));
}

/** Drop the suspend save (back on the page, a death, or arriving somewhere new). */
export function clearSuspend(): void {
  removeKey(SAVE_STORAGE_KEY);
}

/** Save a station arrival checkpoint — the only persistent save. Supersedes any suspend save. */
export function saveStationSnapshot(w: WorldState): boolean {
  const raw = serializeWorld(w);
  memoryStationSnapshot = raw;
  w.lastSavedAt = Date.now();
  removeKey(SAVE_STORAGE_KEY);
  return writeKey(SAVE_STATION_KEY, raw);
}

function readKey(key: string): WorldState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? deserializeWorld(raw) : null;
  } catch {
    return null;
  }
}

/** "Continue": the suspend save if there is one (read once, then deleted), else the station checkpoint. */
export function loadWorld(): WorldState | null {
  const suspended = readKey(SAVE_STORAGE_KEY);
  removeKey(SAVE_STORAGE_KEY);
  return suspended ?? loadStationSnapshot();
}

export function loadStationSnapshot(): WorldState | null {
  const fromStorage = readKey(SAVE_STATION_KEY);
  if (fromStorage) return fromStorage;
  return memoryStationSnapshot ? deserializeWorld(memoryStationSnapshot) : null;
}

function summaryFor(key: string): SaveSummary | null {
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
      suspended: key === SAVE_STORAGE_KEY,
      onRoad: st.mode !== 'station',
    };
  } catch {
    return null;
  }
}

/** What "continue" would load: the suspend save first, else the station checkpoint. */
export function getSaveSummary(): SaveSummary | null {
  return summaryFor(SAVE_STORAGE_KEY) ?? summaryFor(SAVE_STATION_KEY);
}

export function hasSavedWorld(): boolean {
  return getSaveSummary() !== null;
}

export function clearSavedWorld(): void {
  memoryStationSnapshot = null;
  removeKey(SAVE_STORAGE_KEY);
  removeKey(SAVE_STATION_KEY);
}
