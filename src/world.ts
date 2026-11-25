import {
  BACKPACK_TIERS,
  CHEST_COLS,
  CHEST_ROWS,
  ITEM_META,
  addToGrid,
  countAcrossGrids,
  countInGrid,
  createGrid,
  expandGrid,
  getGridUsedCells,
  getItemSize,
  pickupItemFromGrid,
  placeOrSwapInGrid,
  quickStackGrids,
  removeAcrossGrids,
  stripRandomGridItems,
  transferAllGrids,
  type BackpackTierDef,
  type GridInventory,
  type GridItem,
  type HeldGridItem,
  type ResourceKey,
} from './inventory';
import { BUILDINGS, CRAFT_RECIPES, type BuildingType } from './recipes_v2';
import { sfx } from './sfx';

export {
  BACKPACK_TIERS,
  ITEM_META,
  getGridUsedCells,
  getItemSize,
  type BackpackTierDef,
  type GridInventory,
  type GridItem,
  type HeldGridItem,
  type ResourceKey,
};

export const TILE = 44;
export const CAR_COLS = 5;
export const CAR_ROWS = 4;
export const CAR_W = CAR_COLS * TILE; // 220
export const CAR_H = CAR_ROWS * TILE; // 176
export const COUPLER_GAP = 26;
export const LOCO_COLS = 4;
export const LOCO_W = LOCO_COLS * TILE; // 176
export const LOCO_H = CAR_H; // 176
export const HALF_H = CAR_H / 2; // 88
export const DAY_LENGTH = 1200; // 20 min full day-night cycle (Minecraft-like!)
export const CITY_ESCAPE_METERS = 180; // Slow escape out of the burning metropolis before Exile Lands!
export const FIRST_LEG_METERS = 850;
export const STATION_BOUND_X = 1360;
export const STATION_BOUND_Y = 1040;
export const LANTERN_HOOK_X = 22;
export const LANTERN_HOOK_Y = 52;
export const BED_REST_HOURS = 4;

export type GearLevel = 0 | 1 | 2 | 3; // 0=停, 1=缓行, 2=常速, 3=全速
export const GEAR_LABELS = ['停车', '缓行', '常速', '全速'] as const;
export const GEAR_SPEEDS = [0, 72, 130, 205] as const; // px/sec
export const GEAR_FUEL_MULT = [0, 0.85, 1.0, 1.55] as const; // Fast travel burns significantly more fuel!

export type HotbarSlot = 0 | 1 | 2 | 3 | 4 | 5;
export type WeatherKind = 'clear' | 'rainstorm' | 'blizzard';
export type CouplerKind = 'standard' | 'crude';
export type HullSide = 'top' | 'bottom' | 'left' | 'right';
export type ZoneKind = 'fallen_city' | 'exile' | 'monster' | 'fantasy' | 'old_city';
export type ZoneTier = 1 | 2 | 3 | 4 | 5;
export type ToolLevel = 1 | 2 | 3;

export const ROMAN_TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export const TOOL_META: Record<ToolLevel, { name: string; short: string; icon: string; dmg: number; harvestDmg: number }> = {
  1: { name: '锈蚀撬棍 Lv.1', short: '撬棍1', icon: '🔧', dmg: 18, harvestDmg: 14 },
  2: { name: '重型铁镐 Lv.2', short: '铁镐2', icon: '⛏', dmg: 27, harvestDmg: 24 },
  3: { name: '蒸汽切割锯 Lv.3', short: '切割锯3', icon: '🪚', dmg: 38, harvestDmg: 35 },
};

export interface RouteOption {
  id: string;
  stationName: string;
  zone: Exclude<ZoneKind, 'fallen_city'>;
  tier: ZoneTier;
  distance: number;
  desc: string;
}

export interface StationRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  floorColor: string;
  reqTool: ToolLevel;
}

export interface StationWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StationRoad {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}

export interface StationBarrier {
  uid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  reqTool: ToolLevel;
  hp: number;
  maxHp: number;
  opened: boolean;
  label: string;
  hitFlash: number;
}

export const ZONE_META: Record<
  ZoneKind,
  { name: string; icon: string; color: string; bg: string; desc: string }
> = {
  fallen_city: {
    name: '陷落大城',
    icon: '🔥',
    color: '#ff922b',
    bg: '#1f1c1d',
    desc: '缓缓驶离烈火与废墟笼罩的大城市，正开往流放之地…',
  },
  exile: {
    name: '流放之地',
    icon: '🏚',
    color: '#e0b36c',
    bg: '#28221b',
    desc: '失去人性的强盗与少量怪物游荡在破败铁道旁',
  },
  monster: {
    name: '怪物区域',
    icon: '☠',
    color: '#ff6b6b',
    bg: '#2b1b19',
    desc: '充斥着不同种类的嗜血怪物，极度危险',
  },
  fantasy: {
    name: '奇幻区域',
    icon: '✨',
    color: '#c77dff',
    bg: '#1c172b',
    desc: '蕴藏魔法物品与秘法晶石，但里面的怪物更加强大',
  },
  old_city: {
    name: '旧城',
    icon: '🏛',
    color: '#74c0fc',
    bg: '#21262c',
    desc: '失落的城市遗迹，藏有远古造物与珍贵好东西',
  },
};

export interface HullPanel {
  uid: string;
  side: HullSide;
  idx: number;
  isDoor: boolean;
  doorOpen: boolean;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface PlacedBuilding {
  uid: string;
  type: BuildingType;
  carIdx: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  doorOpen?: boolean;
  planted?: boolean;
  growth?: number; // 0..100
  watered?: number;
  storedWater?: number;
  turretAngle?: number;
  turretCooldown?: number;
  chestGrid?: GridInventory;
  smeltKind?: 'charcoal' | 'food' | null;
  smeltProgress?: number; // 0..100
  smeltQueue?: number;
  onFire?: boolean;
  hitFlash?: number;
}

export interface FlatbedCar {
  id: number;
  baseWeight: number;
  couplerKind: CouplerKind;
  couplerHp: number; // 0..100 (crude couplers degrade while driving!)
  couplerWarnCd: number;
  hull: HullPanel[];
  buildings: PlacedBuilding[];
}

export interface WorldProp {
  uid: string;
  kind:
    | 'scrap_pile'
    | 'wood_crate'
    | 'dry_tree'
    | 'fuel_barrel'
    | 'parts_box'
    | 'seed_cache'
    | 'scrap_car'
    | 'arcane_crystal'
    | 'ancient_vault'
    | 'bandit_crate'
    | 'water_tower'
    | 'flatbed_siding'
    | 'npc_keeper'
    | 'npc_gardener'
    | 'loco_crane';
  mat?: 'wood' | 'metal' | 'barrel';
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  hitBounce?: number;
  hitOffX?: number;
  hitOffY?: number;
  label: string;
  interactOnly?: boolean;
  used?: boolean;
  drops?: Partial<Record<ResourceKey, number>>;
}

export interface TrackHazard {
  uid: string;
  kind: 'loose' | 'broken';
  x: number;
  width: number;
  triggered: boolean;
  repaired: boolean;
  alerted: boolean;
}

export interface PickupItem {
  uid: string;
  key: ResourceKey;
  amount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onTrain: boolean;
  age: number;
}

export interface MonsterEntity {
  uid: string;
  kind: 'bandit' | 'stalker' | 'clinger' | 'burrower' | 'elite' | 'arcane_wraith' | 'ruin_golem';
  tier: ZoneTier;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dps: number;
  onTrain: boolean;
  hitFlash: number;
  attackCd: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  ttl: number;
  fromTurret: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface CompanionNPC {
  id: 'gardener';
  name: string;
  x: number;
  y: number;
  status: string;
  actionTimer: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  mouseWorldX: number;
  mouseWorldY: number;
  mouseDown: boolean;
}

export interface InteractHint {
  x: number;
  y: number;
  label: string;
  action: () => void;
}

export interface DeathReport {
  deathNum: number;
  lostCarDesc: string;
  lostBuildings: string[];
  lostItems: Array<{ key: ResourceKey; count: number }>;
}

export interface QuestView {
  idx: number;
  total: number;
  title: string;
  desc: string;
  progress: string;
  done: boolean;
}

export interface LostWorldBanner {
  worldTitle: string;
  epigraph: string;
  zone: ZoneKind;
  tier: ZoneTier;
  rumors: string[];
  timer: number;
}

export interface WorldState {
  mode: 'city_escape' | 'station' | 'wasteland';
  stationIdx: number;
  stationName: string;
  legDistance: number;
  legTotal: number;
  totalDistance: number;
  worldScrollX: number;
  stationAnchorX: number;
  time: number;
  hitStop: number;

  // Railway Route Selection & Danger Zones (I-V along the rails!)
  zoneKind: ZoneKind;
  zoneTier: ZoneTier;
  prevZoneKind: ZoneKind | null;
  biomeSeamX: number;
  cityExitX: number;
  stationStreamed: boolean;
  disembarkedAtStation: boolean;
  stationWorldTitle: string;
  stationEpigraph: string;
  stationRumors: string[];
  lostWorldBanner: LostWorldBanner | null;
  exploredFog: Set<string>;
  discoveredLandmarks: number;
  zoneBanner: { kind: ZoneKind; tier: ZoneTier; timer: number } | null;
  availableRoutes: RouteOption[];
  selectedRoute: RouteOption | null;
  routeOpen: boolean;

  // Finite City Station Architecture (Roads, Rooms, Walls, Tool-Gated Barriers)
  stationRoads: StationRoad[];
  stationRooms: StationRoom[];
  stationWalls: StationWall[];
  stationBarriers: StationBarrier[];

  // Daily Bed Rest Limit & Low-Vital Warning Cooldowns
  lastSleepDay: number;
  vitalWarnCd: { hp: number; hunger: number; thirst: number; temp: number };

  // Train Lantern & Night Darkness Threat
  lanternHolder: 'train' | 'player';
  darkThreatLevel: number; // 0..1 when outdoors at night without lantern
  darkThreatTimer: number;
  wastelandStopTimer: number;
  wastelandSiegeCd: number;
  drivingRaidTimer: number;

  // Day/Night & Extreme Weather
  dayTime: number; // 0..1 (0.08..0.58 day, 0.66..0.94 night)
  dayCount: number;
  weather: WeatherKind;
  weatherTimer: number;
  lightningFlash: number;
  survivedHarshEvent: boolean;

  cameraX: number;
  cameraY: number;
  shake: number;

  // Train state
  locoLevel: 1 | 2;
  locoHp: number;
  locoMaxHp: number;
  locoHull: HullPanel[];
  hasBumper: boolean;
  boilerFuel: number;
  boilerMax: number;
  totalFuelAdded: number;
  gear: GearLevel;
  trainSpeed: number;
  chugTimer: number;
  flatbeds: FlatbedCar[];

  // Player state
  player: {
    x: number;
    y: number;
    angle: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    hunger: number;
    thirst: number;
    bodyTemp: number; // 0..100
    wellFedTimer: number;
    swingTimer: number;
    swingAngle: number;
    attackCd: number;
    hitFlash: number;
    invulnTimer: number;
    flashlightOn: boolean;
    toolLevel: ToolLevel;
    alive: boolean;
  };

  hotbar: HotbarSlot;
  buildMode: boolean;
  selectedBuild: BuildingType;
  backpackLevel: 1 | 2 | 3 | 4;
  backpack: GridInventory;
  heldItem: HeldGridItem | null;

  // Quest progression
  questIdx: number;

  // Entities
  props: WorldProp[];
  trackHazards: TrackHazard[];
  monsters: MonsterEntity[];
  pickups: PickupItem[];
  projectiles: Projectile[];
  particles: Particle[];
  floats: FloatingText[];
  decoyPos: { x: number; y: number; ttl: number } | null;
  companion: CompanionNPC | null;

  // Spawners & UI flags
  exploredChunks: Set<string>;
  hazardSpawnTimer: number;
  nightWavesLeft: number;
  nightWaveTimer: number;
  activeHint: InteractHint | null;
  tradeOpen: boolean;
  craftOpen: boolean;
  bagOpen: boolean;
  openChestUid: string | null;
  deathReport: DeathReport | null;
  gameOver: boolean;
  stats: {
    monstersKilled: number;
    propsHarvested: number;
    buildingsPlaced: number;
    railsLaid: number;
    stationsReached: number;
    deaths: number;
  };
}

let uidSeq = 1;
export function uid(prefix: string): string {
  return `${prefix}_${uidSeq++}`;
}

// --- Coordinate & Geometry Helpers ---
export function getCarBounds(carIdx: number): { left: number; right: number; top: number; bottom: number } {
  const right = -COUPLER_GAP - carIdx * (CAR_W + COUPLER_GAP);
  const left = right - CAR_W;
  return { left, right, top: -HALF_H, bottom: HALF_H };
}

export function getTileCenter(carIdx: number, col: number, row: number): { x: number; y: number } {
  const b = getCarBounds(carIdx);
  return {
    x: b.left + (col + 0.5) * TILE,
    y: b.top + (row + 0.5) * TILE,
  };
}

export function worldToTrainTile(
  w: WorldState,
  wx: number,
  wy: number
): { carIdx: number; col: number; row: number } | null {
  if (wy < -HALF_H || wy > HALF_H) return null;
  for (let i = 0; i < w.flatbeds.length; i++) {
    const b = getCarBounds(i);
    if (wx >= b.left && wx < b.right) {
      const col = Math.floor((wx - b.left) / TILE);
      const row = Math.floor((wy - b.top) / TILE);
      if (col >= 0 && col < CAR_COLS && row >= 0 && row < CAR_ROWS) {
        return { carIdx: i, col, row };
      }
    }
  }
  return null;
}

export function isPointOnTrain(w: WorldState, x: number, y: number, pad = 0): boolean {
  if (x >= -pad && x <= LOCO_W + pad && y >= -HALF_H - pad && y <= HALF_H + pad) return true;
  for (let i = 0; i < w.flatbeds.length; i++) {
    const b = getCarBounds(i);
    if (x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad) return true;
    // Coupler gangway matches the full open passage (idx 1..2 => y ∈ [-44, 44]) so walking back never hits an invisible wall!
    if (x >= b.right - pad && x <= b.right + COUPLER_GAP + pad && y >= -40 - pad && y <= 40 + pad) return true;
  }
  return false;
}

export function getCarIndexAtPoint(w: WorldState, x: number, y: number): number | null {
  if (x >= 0 && x <= LOCO_W && y >= -HALF_H && y <= HALF_H) return -1;
  for (let i = 0; i < w.flatbeds.length; i++) {
    const b = getCarBounds(i);
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return i;
  }
  return null;
}

// --- Car Hull & Door System (Edge-mounted, zero interior tile loss!) ---
export function createCarHull(cols: number, doorCol: number): HullPanel[] {
  const panels: HullPanel[] = [];
  for (let c = 0; c < cols; c++) {
    const isDoor = c === doorCol;
    panels.push({ uid: uid('hp'), side: 'top', idx: c, isDoor, doorOpen: false, hp: isDoor ? 90 : 95, maxHp: isDoor ? 90 : 95, hitFlash: 0 });
    panels.push({ uid: uid('hp'), side: 'bottom', idx: c, isDoor, doorOpen: false, hp: isDoor ? 90 : 95, maxHp: isDoor ? 90 : 95, hitFlash: 0 });
  }
  for (let r = 0; r < CAR_ROWS; r++) {
    panels.push({ uid: uid('hp'), side: 'left', idx: r, isDoor: false, doorOpen: false, hp: 95, maxHp: 95, hitFlash: 0 });
    panels.push({ uid: uid('hp'), side: 'right', idx: r, isDoor: false, doorOpen: false, hp: 95, maxHp: 95, hitFlash: 0 });
  }
  return panels;
}

export function isHullPassage(w: WorldState, carIdx: number, panel: HullPanel): boolean {
  if (panel.idx !== 1 && panel.idx !== 2) return false;
  if (carIdx === -1) {
    // Locomotive rear passage connects to Car 0
    return panel.side === 'left' && w.flatbeds.length > 0;
  }
  // Flatbed right passage always connects to Loco or Car i-1
  if (panel.side === 'right') return true;
  // Flatbed left passage connects to Car i+1 if present
  if (panel.side === 'left') return carIdx < w.flatbeds.length - 1;
  return false;
}

export function getHullSegment(
  carIdx: number,
  panel: HullPanel
): { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number } {
  const b = carIdx === -1 ? { left: 0, right: LOCO_W, top: -HALF_H, bottom: HALF_H } : getCarBounds(carIdx);
  if (panel.side === 'top') {
    const x1 = b.left + panel.idx * TILE;
    const x2 = x1 + TILE;
    return { x1, y1: b.top, x2, y2: b.top, cx: (x1 + x2) / 2, cy: b.top };
  }
  if (panel.side === 'bottom') {
    const x1 = b.left + panel.idx * TILE;
    const x2 = x1 + TILE;
    return { x1, y1: b.bottom, x2, y2: b.bottom, cx: (x1 + x2) / 2, cy: b.bottom };
  }
  if (panel.side === 'left') {
    const y1 = b.top + panel.idx * TILE;
    const y2 = y1 + TILE;
    return { x1: b.left, y1, x2: b.left, y2, cx: b.left, cy: (y1 + y2) / 2 };
  }
  const y1 = b.top + panel.idx * TILE;
  const y2 = y1 + TILE;
  return { x1: b.right, y1, x2: b.right, y2, cx: b.right, cy: (y1 + y2) / 2 };
}

export function getAllHullPanels(w: WorldState): Array<{ carIdx: number; panel: HullPanel }> {
  const out: Array<{ carIdx: number; panel: HullPanel }> = [];
  for (const p of w.locoHull) out.push({ carIdx: -1, panel: p });
  for (let i = 0; i < w.flatbeds.length; i++) {
    for (const p of w.flatbeds[i].hull) out.push({ carIdx: i, panel: p });
  }
  return out;
}

function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isPanelOpenOrBreached(w: WorldState, carIdx: number, side: HullSide, idx: number): boolean {
  const hull = carIdx === -1 ? w.locoHull : w.flatbeds[carIdx]?.hull;
  if (!hull) return false;
  const adj = hull.find((p) => p.side === side && p.idx === idx);
  if (!adj) return false;
  return adj.hp <= 0 || isHullPassage(w, carIdx, adj) || (adj.isDoor && adj.doorOpen);
}

/** Returns blocking hull panel if circle (nx, ny, radius) hits a closed door or intact hull wall. */
export function findBlockingHull(
  w: WorldState,
  nx: number,
  ny: number,
  radius: number
): { carIdx: number; panel: HullPanel; cx: number; cy: number } | null {
  const thresh = radius + 3.5;
  for (const { carIdx, panel } of getAllHullPanels(w)) {
    if (panel.hp <= 0) continue; // breached -> passable!
    if (isHullPassage(w, carIdx, panel)) continue; // open walkway between coupled cars
    if (panel.isDoor && panel.doorOpen) continue; // open door -> passable!
    const seg = getHullSegment(carIdx, panel);
    // Give generous doorway/passage clearance by trimming ends that touch an open door, breach, or passage
    const trimStart = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx - 1) ? 7 : 1;
    const trimEnd = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx + 1) ? 7 : 1;
    const horiz = panel.side === 'top' || panel.side === 'bottom';
    const x1 = horiz ? seg.x1 + trimStart : seg.x1;
    const x2 = horiz ? seg.x2 - trimEnd : seg.x2;
    const y1 = horiz ? seg.y1 : seg.y1 + trimStart;
    const y2 = horiz ? seg.y2 : seg.y2 - trimEnd;
    if (pointSegDist(nx, ny, x1, y1, x2, y2) < thresh) {
      return { carIdx, panel, cx: seg.cx, cy: seg.cy };
    }
  }
  return null;
}

export function isCarSealed(w: WorldState, carIdx: number): boolean {
  const hull = carIdx === -1 ? w.locoHull : w.flatbeds[carIdx]?.hull;
  if (!hull) return false;
  for (const p of hull) {
    if (isHullPassage(w, carIdx, p)) continue;
    if (p.hp <= 0) return false;
    if (p.isDoor && p.doorOpen) return false;
  }
  return true;
}

// --- Inventory & Chest Unified Access (POE2 Spatial Grid System) ---
export function getAllChestGrids(w: WorldState): GridInventory[] {
  const lists: GridInventory[] = [];
  for (const car of w.flatbeds) {
    for (const b of car.buildings) {
      if (b.type === 'chest' && b.chestGrid) lists.push(b.chestGrid);
    }
  }
  return lists;
}

export function getAllStorageGrids(w: WorldState): GridInventory[] {
  return [w.backpack, ...getAllChestGrids(w)];
}

export function getItemCount(w: WorldState, key: ResourceKey, includeChests = true): number {
  let total = includeChests ? countAcrossGrids(getAllStorageGrids(w), key) : countInGrid(w.backpack, key);
  if (w.heldItem && w.heldItem.key === key) total += w.heldItem.count;
  return total;
}

export function canAffordCost(w: WorldState, cost: Partial<Record<ResourceKey, number>>): boolean {
  for (const [k, v] of Object.entries(cost)) {
    if (getItemCount(w, k as ResourceKey, true) < (v ?? 0)) return false;
  }
  return true;
}

export function spendCost(w: WorldState, cost: Partial<Record<ResourceKey, number>>): boolean {
  if (!canAffordCost(w, cost)) return false;
  const lists = getAllStorageGrids(w);
  for (const [k, v] of Object.entries(cost)) {
    let need = v ?? 0;
    if (need <= 0) continue;
    const availInGrids = countAcrossGrids(lists, k as ResourceKey);
    const takeFromGrids = Math.min(availInGrids, need);
    if (takeFromGrids > 0) {
      removeAcrossGrids(lists, k as ResourceKey, takeFromGrids);
      need -= takeFromGrids;
    }
    if (need > 0 && w.heldItem && w.heldItem.key === k) {
      w.heldItem.count -= need;
      if (w.heldItem.count <= 0) w.heldItem = null;
    }
  }
  return true;
}

/** Direct pickup into player spatial grid first, then train chests if on/near train; drops overflow if no contiguous shape fits. */
export function giveItem(w: WorldState, key: ResourceKey, amount: number, dropOverflow = true): number {
  let rem = addToGrid(w.backpack, key, amount);
  if (rem > 0 && isPointOnTrain(w, w.player.x, w.player.y, 40)) {
    for (const chest of getAllChestGrids(w)) {
      rem = addToGrid(chest, key, rem);
      if (rem <= 0) break;
    }
  }
  if (rem > 0 && dropOverflow) {
    spawnPickup(w, key, rem, w.player.x, w.player.y + 16, isPointOnTrain(w, w.player.x, w.player.y));
    addFloat(w, w.player.x, w.player.y - 34, '🎒 背包网格形状不足！按 I 手动摆放或升级背包', '#ffd56b');
  }
  return amount - rem;
}

export function upgradeBackpack(w: WorldState): string | null {
  if (w.backpackLevel >= 4) return '背包已达最高等级';
  const nextLv = (w.backpackLevel + 1) as 2 | 3 | 4;
  const def = BACKPACK_TIERS[nextLv];
  if (!def.cost || !canAffordCost(w, def.cost)) return '升级材料不足';
  spendCost(w, def.cost);
  w.backpackLevel = nextLv;
  expandGrid(w.backpack, def.cols, def.rows);
  sfx.questDone();
  addFloat(w, w.player.x, w.player.y - 38, `🎒 背包升级为【${def.name}】(${def.cols}×${def.rows})！`, '#ffd56b');
  return null;
}

function getGridBySource(w: WorldState, source: 'backpack' | 'chest'): GridInventory | null {
  if (source === 'backpack') return w.backpack;
  const open = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  return open?.chestGrid ?? null;
}

export function pickUpGridItem(w: WorldState, source: 'backpack' | 'chest', uid: string): boolean {
  if (w.heldItem) return false;
  const grid = getGridBySource(w, source);
  if (!grid) return false;
  const removed = pickupItemFromGrid(grid, uid);
  if (!removed) return false;
  w.heldItem = {
    key: removed.key,
    count: removed.count,
    rotated: removed.rotated,
    fromSource: source,
    fromChestUid: source === 'chest' ? w.openChestUid : null,
    origX: removed.x,
    origY: removed.y,
    origRotated: removed.rotated,
  };
  sfx.uiClick();
  return true;
}

export function placeHeldItemAt(w: WorldState, source: 'backpack' | 'chest', x: number, y: number): boolean {
  if (!w.heldItem) return false;
  const grid = getGridBySource(w, source);
  if (!grid) return false;
  const res = placeOrSwapInGrid(grid, w.heldItem, x, y);
  if (!res.ok) {
    sfx.gridDeny();
    return false;
  }
  w.heldItem = res.nextHeld;
  sfx.gridPlace();
  return true;
}

export function rotateHeldItem(w: WorldState): void {
  if (!w.heldItem) return;
  const m = ITEM_META[w.heldItem.key];
  if (m.w === m.h) return;
  w.heldItem.rotated = !w.heldItem.rotated;
  sfx.gridRotate();
}

export function quickTransferGridItem(w: WorldState, source: 'backpack' | 'chest', uid: string): boolean {
  const from = getGridBySource(w, source);
  const to = getGridBySource(w, source === 'backpack' ? 'chest' : 'backpack');
  if (!from || !to) return false;
  const removed = pickupItemFromGrid(from, uid);
  if (!removed) return false;
  const rem = addToGrid(to, removed.key, removed.count);
  if (rem > 0) {
    // Put leftover back in original position
    from.items.push({ ...removed, count: rem });
    if (rem === removed.count) {
      sfx.gridDeny();
      return false;
    }
  }
  sfx.pickup();
  return true;
}

export function dropHeldItemToGround(w: WorldState): void {
  if (!w.heldItem) return;
  const item = w.heldItem;
  w.heldItem = null;
  spawnPickup(w, item.key, item.count, w.player.x + 20, w.player.y + 18, isPointOnTrain(w, w.player.x, w.player.y));
  sfx.swing();
  addFloat(w, w.player.x, w.player.y - 24, `丢弃 ${ITEM_META[item.key].short} ×${item.count}`, '#ced4da');
}

export function getNearbyPickups(w: WorldState, radius = 155): PickupItem[] {
  const px = w.player.x;
  const py = w.player.y;
  return w.pickups
    .filter((pk) => pk.amount > 0 && Math.hypot(pk.x - px, pk.y - py) <= radius)
    .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
}

export function pickUpGroundLoot(w: WorldState, pickupUid: string): boolean {
  if (w.heldItem) return false;
  const idx = w.pickups.findIndex((pk) => pk.uid === pickupUid && pk.amount > 0);
  if (idx < 0) return false;
  const pk = w.pickups[idx];
  const max = ITEM_META[pk.key].maxStack;
  const take = Math.min(max, pk.amount);
  pk.amount -= take;
  if (pk.amount <= 0) w.pickups.splice(idx, 1);

  w.heldItem = {
    key: pk.key,
    count: take,
    rotated: false,
    fromSource: 'ground',
    origX: 0,
    origY: 0,
    origRotated: false,
    origWorldX: pk.x,
    origWorldY: pk.y,
    origOnTrain: pk.onTrain,
  };
  sfx.uiClick();
  return true;
}

export function openGroundLootUI(w: WorldState, preferPickupUid?: string): boolean {
  const nearby = getNearbyPickups(w, 165);
  if (nearby.length === 0) return false;
  w.bagOpen = true;
  w.craftOpen = false;
  w.tradeOpen = false;
  w.routeOpen = false;
  if (!w.heldItem) {
    const target = (preferPickupUid ? nearby.find((pk) => pk.uid === preferPickupUid) : null) ?? nearby[0];
    if (target) pickUpGroundLoot(w, target.uid);
  }
  return true;
}

export function returnHeldItemSafely(w: WorldState): void {
  if (!w.heldItem) return;
  const held = w.heldItem;
  w.heldItem = null;
  if (held.fromSource === 'ground') {
    const gx = held.origWorldX ?? w.player.x + 18;
    const gy = held.origWorldY ?? w.player.y + 18;
    const onT = held.origOnTrain ?? isPointOnTrain(w, gx, gy);
    w.pickups.push({
      uid: uid('pk'),
      key: held.key,
      amount: held.count,
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      onTrain: onT,
      age: 0.4,
    });
    return;
  }
  const origGrid =
    held.fromSource === 'chest' && held.fromChestUid
      ? findBuildingByUid(w, held.fromChestUid)?.chestGrid ?? w.backpack
      : w.backpack;
  // Try original position first
  const res = placeOrSwapInGrid(origGrid, { ...held, rotated: held.origRotated }, held.origX, held.origY);
  if (res.ok && !res.nextHeld) return;
  // Otherwise fit anywhere in backpack or drop safely
  let rem = addToGrid(w.backpack, held.key, held.count);
  if (rem > 0) {
    spawnPickup(w, held.key, rem, w.player.x, w.player.y + 18, isPointOnTrain(w, w.player.x, w.player.y));
  }
}

export function quickStackToChests(w: WorldState): number {
  let moved = 0;
  const open = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  if (open?.chestGrid) {
    moved += quickStackGrids(w.backpack, open.chestGrid);
  } else {
    for (const chest of getAllChestGrids(w)) {
      moved += quickStackGrids(w.backpack, chest);
    }
  }
  if (moved > 0) {
    sfx.sort();
    addFloat(w, w.player.x, w.player.y - 24, `📦 一键存入同类 ×${moved}`, '#9ef0a8');
  }
  return moved;
}

export function depositAllToOpenChest(w: WorldState): void {
  const open = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  if (!open?.chestGrid) return;
  const moved = transferAllGrids(w.backpack, open.chestGrid);
  if (moved > 0) sfx.sort();
}

// --- Train Stats & Helpers ---
export function getTrainWeight(w: WorldState): number {
  let total = w.hasBumper ? BUILDINGS.bumper.weight : 0;
  for (const car of w.flatbeds) {
    total += car.baseWeight;
    for (const b of car.buildings) {
      total += BUILDINGS[b.type].weight;
    }
  }
  return +total.toFixed(1);
}

export function getTractionLimit(w: WorldState): number {
  return w.locoLevel === 2 ? 12 : 8;
}

export function isOverloaded(w: WorldState): boolean {
  return getTrainWeight(w) > getTractionLimit(w);
}

export function hasWorkbench(w: WorldState): boolean {
  return w.flatbeds.some((c) => c.buildings.some((b) => b.type === 'workbench'));
}

export function hasChest(w: WorldState): boolean {
  return w.flatbeds.some((c) => c.buildings.some((b) => b.type === 'chest'));
}

export function hasBed(w: WorldState): boolean {
  return w.flatbeds.some((c) => c.buildings.some((b) => b.type === 'bed'));
}

export function isNight(w: WorldState): boolean {
  return w.dayTime >= 0.625 && w.dayTime <= 0.925;
}

export function getClockLabel(w: WorldState): string {
  // dayTime 0.0 = 06:00, 0.25 = 12:00, 0.50 = 18:00, 0.75 = 00:00 (Minecraft 20-min day)
  const totalMins = Math.floor(((w.dayTime * 24 + 6) % 24) * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getDayPhaseLabel(w: WorldState): string {
  const t = w.dayTime;
  if (t < 0.05 || t > 0.925) return '🌅 黎明';
  if (t < 0.55) return '☀ 白昼';
  if (t < 0.625) return '🌇 黄昏';
  return '🌙 深夜（高危）';
}

export function getWeatherLabel(w: WorldState): string {
  if (w.weather === 'rainstorm') return '⛈ 暴雨';
  if (w.weather === 'blizzard') return '❄ 暴风雪';
  return '🌤 晴朗';
}

export function getZoneTierRoman(tier: ZoneTier): string {
  return ROMAN_TIERS[Math.max(0, Math.min(4, tier - 1))];
}

export function distToTrainDeck(w: WorldState, x: number, y: number): number {
  const minLeft = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
  const cx = Math.max(minLeft, Math.min(LOCO_W, x));
  const cy = Math.max(-HALF_H, Math.min(HALF_H, y));
  return Math.hypot(x - cx, y - cy);
}

export function playerHasActiveLantern(w: WorldState): boolean {
  return w.lanternHolder === 'player' && w.player.flashlightOn;
}

export function pickupOrPlaceLantern(w: WorldState): void {
  if (w.lanternHolder === 'train') {
    w.lanternHolder = 'player';
    w.player.flashlightOn = true;
    sfx.flashlight(true);
    addFloat(w, w.player.x, w.player.y - 26, '🏮 取下火车手提灯！（按 L 可开关，夜行防暗夜怪潮）', '#ffe08a');
  } else {
    w.lanternHolder = 'train';
    sfx.flashlight(false);
    addFloat(w, LANTERN_HOOK_X, LANTERN_HOOK_Y - 22, '🏮 已将提灯挂回车头挂钩', '#ffd56b');
  }
}

export function toggleFlashlight(w: WorldState): void {
  if (w.lanternHolder !== 'player') {
    addFloat(w, w.player.x, w.player.y - 24, '🏮 提灯还挂在车头！靠近车头南侧挂钩按 E 取下', '#ffd56b');
    return;
  }
  w.player.flashlightOn = !w.player.flashlightOn;
  sfx.flashlight(w.player.flashlightOn);
  addFloat(
    w,
    w.player.x,
    w.player.y - 24,
    w.player.flashlightOn ? '🏮 手提灯：已点亮（短距锥形视野）' : '🌑 手提灯：已熄灭（夜行极危！）',
    w.player.flashlightOn ? '#ffe08a' : '#ff8787'
  );
}

/** Exact fuel estimate for a railway leg at given gear (matches driving burn physics). */
export function estimateRouteFuel(w: WorldState, distanceMeters: number, gear: 1 | 2 | 3 = 2): number {
  const weightFactor = Math.max(0.75, 0.65 + getTrainWeight(w) / 14);
  const overloadMult = isOverloaded(w) ? 1.3 : 1.0;
  const speedMult = GEAR_FUEL_MULT[gear];
  return +((distanceMeters / 100) * weightFactor * overloadMult * speedMult).toFixed(1);
}

export function enterZone(w: WorldState, kind: ZoneKind, tier: ZoneTier): void {
  w.zoneKind = kind;
  w.zoneTier = tier;
  w.zoneBanner = { kind, tier, timer: 4.5 };
  sfx.enterZone(kind, tier);
  const zm = ZONE_META[kind];
  const label =
    kind === 'fallen_city'
      ? `${zm.icon} ${zm.name} · 正在逃离…`
      : `${zm.icon} 进入 ${zm.name}（危险等级 ${getZoneTierRoman(tier)}）`;
  addFloat(w, w.player.x, w.player.y - 48, label, zm.color);
}

export function buildNextRoutes(stationIdx: number): RouteOption[] {
  if (stationIdx === 0) {
    return [
      {
        id: 'st1_exile_water',
        stationName: '站2 · 流放水塔镇',
        zone: 'exile',
        tier: 1,
        distance: 760,
        desc: '沿流放之地铁路前行：以强盗为主，有蓄水塔、商人、园丁与重型龙门吊',
      },
      {
        id: 'st1_monster_cross',
        stationName: '站2 · 血锈岔口',
        zone: 'monster',
        tier: 2,
        distance: 980,
        desc: '驶入怪物区域（等级 II）：多种怪物盘踞，站内零件、油罐与密库更丰厚',
      },
    ];
  }
  if (stationIdx === 1) {
    return [
      {
        id: 'st2_old_city',
        stationName: '站3 · 旧城钟楼站',
        zone: 'old_city',
        tier: 3,
        distance: 1120,
        desc: '驶入失落旧城（等级 III）：废墟建筑藏有远古造物，深处需铁镐/切割锯破门',
      },
      {
        id: 'st2_monster_nest',
        stationName: '站3 · 枯骨干线',
        zone: 'monster',
        tier: 3,
        distance: 920,
        desc: '穿越怪物区域（等级 III）：路程较短，但沿途跳帮怪物密集凶猛',
      },
    ];
  }
  const nextTier = Math.min(5, stationIdx + 2) as ZoneTier;
  const highTier = Math.min(5, stationIdx + 3) as ZoneTier;
  const num = stationIdx + 2;
  return [
    {
      id: `st${num}_fantasy`,
      stationName: `站${num} · 秘法裂谷站`,
      zone: 'fantasy',
      tier: highTier,
      distance: 1260 + stationIdx * 120,
      desc: `驶入奇幻区域（等级 ${getZoneTierRoman(highTier)}）：产出秘法晶石与魔力药剂，但怪物极其强大`,
    },
    {
      id: `st${num}_old_city`,
      stationName: `站${num} · 旧城深层中枢`,
      zone: 'old_city',
      tier: nextTier,
      distance: 1180 + stationIdx * 100,
      desc: `深入失落旧城（等级 ${getZoneTierRoman(nextTier)}）：多座建筑遗迹与远古密库，急需高等级工具开启`,
    },
    {
      id: `st${num}_monster`,
      stationName: `站${num} · 终末荒野站`,
      zone: 'monster',
      tier: highTier,
      distance: 1020 + stationIdx * 80,
      desc: `直穿怪物区域（等级 ${getZoneTierRoman(highTier)}）：距离最短但怪物浪潮最猛`,
    },
  ];
}

export function selectRoute(w: WorldState, routeId: string): boolean {
  const found = w.availableRoutes.find((r) => r.id === routeId);
  if (!found) return false;
  w.selectedRoute = found;
  w.routeOpen = false;
  sfx.lever();
  const est = estimateRouteFuel(w, found.distance, 2);
  addFloat(
    w,
    w.player.x,
    w.player.y - 36,
    `🗺 已锁定目标：${found.stationName}（${found.distance}m，常速预计耗油 ~${est}）`,
    ZONE_META[found.zone].color
  );
  return true;
}

/** Sleep in bed: advances time by BED_REST_HOURS (4h), heals & warms player, once per day. */
export function restInBed(w: WorldState, cx = w.player.x, cy = w.player.y): string | null {
  if (w.lastSleepDay >= w.dayCount) {
    sfx.alert();
    const msg = '💤 今天已经在床上休息过了（每日限 1 次，明日黎明刷新）';
    addFloat(w, cx, cy - 18, msg, '#ffd56b');
    return msg;
  }
  w.dayTime += BED_REST_HOURS / 24;
  if (w.dayTime >= 1) {
    w.dayTime -= 1;
    w.dayCount++;
  }
  w.lastSleepDay = w.dayCount;
  w.player.hp = Math.min(w.player.maxHp, w.player.hp + 45);
  w.player.stamina = w.player.maxStamina;
  w.player.bodyTemp = 100;
  w.player.hunger = Math.max(15, w.player.hunger - 12);
  w.player.thirst = Math.max(15, w.player.thirst - 14);
  // Crops grow slightly while time passes
  for (const car of w.flatbeds) {
    for (const b of car.buildings) {
      if (b.type === 'planter' && b.planted && (b.growth ?? 0) < 100) {
        b.growth = Math.min(100, (b.growth ?? 0) + 25);
      }
    }
  }
  sfx.eat();
  addFloat(w, cx, cy - 22, `💤 沉睡了 ${BED_REST_HOURS} 小时（现在 ${getClockLabel(w)} · 生命+45 满体回暖）`, '#8de09e');
  return null;
}

export function getVitalWarnings(w: WorldState): string[] {
  const out: string[] = [];
  const p = w.player;
  if (p.hp <= 30) out.push(`🩸 生命垂危 (${Math.ceil(p.hp)}/${p.maxHp})：按 4 吃热麦饼/魔药 或 床铺休息！`);
  if (p.hunger <= 25) out.push(p.hunger <= 0 ? '🍖 已饿到极限正在掉血！立刻按 4 进食！' : `🍖 极度饥饿 (${Math.ceil(p.hunger)}%)：请按 4 进食`);
  if (p.thirst <= 25) out.push(p.thirst <= 0 ? '💧 严重脱水正在掉血！立刻按 4 喝水！' : `💧 严重口渴 (${Math.ceil(p.thirst)}%)：请按 4 喝水`);
  if (p.bodyTemp <= 35) out.push(p.bodyTemp <= 0 ? '🥶 严重失温正在掉血！速回封闭车厢靠近锅炉/熔炉！' : `🥶 体温过低 (${Math.ceil(p.bodyTemp)}%)：关门并靠近锅炉/熔炉取暖`);
  return out;
}

export function addFloat(w: WorldState, x: number, y: number, text: string, color = '#fff2cc'): void {
  w.floats.push({ x, y, text, color, life: 1.25 });
}

export function spawnParticles(
  w: WorldState,
  x: number,
  y: number,
  color: string,
  count = 7,
  speed = 110,
  dirAngle?: number
): void {
  for (let i = 0; i < count; i++) {
    const a = dirAngle !== undefined ? dirAngle + (Math.random() - 0.5) * 1.3 : Math.random() * Math.PI * 2;
    const sp = (0.35 + Math.random() * 0.75) * speed;
    w.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.24 + Math.random() * 0.28,
      maxLife: 0.52,
      size: 2 + Math.random() * 3.2,
      color,
    });
  }
}

export function spawnPickup(
  w: WorldState,
  key: ResourceKey,
  amount: number,
  x: number,
  y: number,
  onTrain = false
): void {
  if (amount <= 0) return;
  const a = Math.random() * Math.PI * 2;
  const sp = 55 + Math.random() * 75;
  w.pickups.push({
    uid: uid('pk'),
    key,
    amount,
    x,
    y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp,
    onTrain,
    age: 0,
  });
}

function makeBuilding(type: BuildingType, carIdx: number, col: number, row: number): PlacedBuilding {
  const def = BUILDINGS[type];
  return {
    uid: uid('bld'),
    type,
    carIdx,
    col,
    row,
    hp: def.maxHp,
    maxHp: def.maxHp,
    doorOpen: false,
    planted: false,
    growth: 0,
    watered: 0,
    storedWater: 0,
    turretAngle: Math.PI,
    turretCooldown: 0,
    chestGrid: type === 'chest' ? createGrid(CHEST_COLS, CHEST_ROWS) : undefined,
    smeltKind: null,
    smeltProgress: 0,
    smeltQueue: 0,
    onFire: false,
    hitFlash: 0,
  };
}

export function createFlatbed(id: number, couplerKind: CouplerKind, baseWeight = 2.6): FlatbedCar {
  return {
    id,
    baseWeight,
    couplerKind,
    couplerHp: 100,
    couplerWarnCd: 0,
    hull: createCarHull(CAR_COLS, 2),
    buildings: [],
  };
}

// --- Guided Onboarding Quest Chain (First 10–20 min Goals) ---
interface QuestDef {
  title: string;
  desc: string;
  check: (w: WorldState) => { done: boolean; progress: string };
  reward: Partial<Record<ResourceKey, number>>;
  rewardText: string;
}

const QUESTS: QuestDef[] = [
  {
    title: '① 驶离陷落大城，站内开箱搜刮起步物资',
    desc: '等列车驶入流放之地停稳后，按 E 开门下车，挥动撬棍拆解站内废弃建筑里的木箱与废铁',
    check: (w) => {
      const wood = getItemCount(w, 'wood');
      const scrap = getItemCount(w, 'scrap');
      const done = (wood >= 6 && scrap >= 6) || (hasWorkbench(w) && hasChest(w));
      return { done, progress: `木材 ${Math.min(wood, 6)}/6 · 废料 ${Math.min(scrap, 6)}/6` };
    },
    reward: { scrap: 2 },
    rewardText: '+2 废料',
  },
  {
    title: '② 从零建家：工作台与储物箱',
    desc: '按 B 在空车厢内自由摆放【工程工作台】和【储物木箱】（箱内材料可直取合成）',
    check: (w) => {
      const wb = hasWorkbench(w);
      const ch = hasChest(w);
      return { done: wb && ch, progress: `工作台 ${wb ? '✓' : '0/1'} · 储物箱 ${ch ? '✓' : '0/1'}` };
    },
    reward: { wood: 3 },
    rewardText: '+3 木材',
  },
  {
    title: '③ 收集稀缺燃料并添入锅炉',
    desc: '在废墟搜刮油桶或按 Tab 用木材压制木炭，到车头锅炉按 E 添煤（累计添入 ≥ 4）',
    check: (w) => {
      const added = Math.floor(w.totalFuelAdded);
      return { done: added >= 4, progress: `已添燃料 ${Math.min(added, 4)}/4` };
    },
    reward: { ammo: 4 },
    rewardText: '+4 霰弹',
  },
  {
    title: '④ 应对夜晚与暴风雪：照明或取暖',
    desc: '在车厢内建造 1 座【铁炉灶台】或【车厢壁灯】，并关好车门防怪闯入',
    check: (w) => {
      const ok = w.flatbeds.some((c) => c.buildings.some((b) => b.type === 'campfire' || b.type === 'lantern'));
      return { done: ok, progress: ok ? '已就绪 ✓' : '炉灶/壁灯 0/1' };
    },
    reward: { cookedFood: 1, fuel: 2 },
    rewardText: '+1 热麦饼 +2 燃料',
  },
  {
    title: '⑤ 选定下一站路线，备足燃料启程推进',
    desc: '在车头控制台选定下一座目标站点（查看预计耗油），添足锅炉燃料并拉油门出发推进 200m',
    check: (w) => {
      const d = Math.floor(Math.max(0, w.totalDistance - CITY_ESCAPE_METERS));
      return { done: d >= 200, progress: `荒原推进 ${Math.min(d, 200)}m / 200m` };
    },
    reward: { fuel: 2, parts: 1 },
    rewardText: '+2 燃料 +1 零件',
  },
  {
    title: '⑥ 车钩扩建：挂接或组装 2 号车厢',
    desc: '搜刮【正规车钩】或在工作台造【土制车钩】，到车尾或货场挂接第 2 节车厢',
    check: (w) => {
      const n = w.flatbeds.length;
      return { done: n >= 2, progress: `当前车厢 ${n}/2` };
    },
    reward: { fuel: 3 },
    rewardText: '+3 燃料',
  },
  {
    title: '⑦ 挺过黑夜或极端天气',
    desc: '在深夜、暴雨或暴风雪中保护车体与体温，活过一次严酷时刻',
    check: (w) => ({
      done: w.survivedHarshEvent,
      progress: w.survivedHarshEvent ? '已挺过 ✓' : '等待黑夜/暴雨/暴风雪考验',
    }),
    reward: { scrap: 4, parts: 1 },
    rewardText: '+4 废料 +1 零件',
  },
  {
    title: '⑧ 跨越漫长荒原，抵达水塔小站',
    desc: '规划燃料补给、修补断轨，驶完 1200m 抵达「站2 · 水塔小站」',
    check: (w) => {
      const ok = w.stationIdx >= 1;
      return { done: ok, progress: ok ? '已抵达 ✓' : `距下站 ${Math.max(0, Math.round(w.legTotal - w.legDistance))}m` };
    },
    reward: { scrap: 6, parts: 2 },
    rewardText: '+6 废料 +2 零件',
  },
];

export function getActiveQuest(w: WorldState): QuestView | null {
  if (w.questIdx >= QUESTS.length) return null;
  const q = QUESTS[w.questIdx];
  const st = q.check(w);
  return {
    idx: w.questIdx + 1,
    total: QUESTS.length,
    title: q.title,
    desc: q.desc,
    progress: st.progress,
    done: st.done,
  };
}

function updateQuests(w: WorldState): void {
  if (w.questIdx >= QUESTS.length) return;
  const q = QUESTS[w.questIdx];
  if (q.check(w).done) {
    for (const [k, v] of Object.entries(q.reward)) {
      giveItem(w, k as ResourceKey, v ?? 0);
    }
    sfx.questDone();
    addFloat(w, w.player.x, w.player.y - 42, `✅ 完成引导「${q.title}」奖励 ${q.rewardText}`, '#ffd56b');
    w.questIdx++;
  }
}

// --- Finite Structured Station Map Builders (Fixed Resource Nodes, Buildings & Tool-Gated Deep Zones) ---
function addRoomWithDoor(
  w: WorldState,
  x: number,
  y: number,
  rw: number,
  rh: number,
  doorSide: 'top' | 'bottom' | 'left' | 'right',
  reqTool: ToolLevel,
  label: string,
  floorColor: string,
  barrierHp?: number
): void {
  const t = 14;
  const dw = 56;
  w.stationRooms.push({ x, y, w: rw, h: rh, label, floorColor, reqTool });

  const makeBarrier = (bx: number, by: number, bw: number, bh: number): void => {
    const hp = barrierHp ?? (reqTool === 1 ? 30 : reqTool === 2 ? 75 : 130);
    const doorName = reqTool === 1 ? '木板封门 [Lv.1撬棍]' : reqTool === 2 ? '钢筋铁门 [需Lv.2铁镐]' : '合金防爆门 [需Lv.3切割锯]';
    w.stationBarriers.push({
      uid: uid('bar'),
      x: bx,
      y: by,
      w: bw,
      h: bh,
      reqTool,
      hp,
      maxHp: hp,
      opened: false,
      label: doorName,
      hitFlash: 0,
    });
  };

  // Top wall
  if (doorSide === 'top') {
    const seg = (rw - dw) / 2;
    w.stationWalls.push({ x, y, w: seg, h: t }, { x: x + seg + dw, y, w: seg, h: t });
    makeBarrier(x + seg, y, dw, t);
  } else {
    w.stationWalls.push({ x, y, w: rw, h: t });
  }
  // Bottom wall
  if (doorSide === 'bottom') {
    const seg = (rw - dw) / 2;
    w.stationWalls.push({ x, y: y + rh - t, w: seg, h: t }, { x: x + seg + dw, y: y + rh - t, w: seg, h: t });
    makeBarrier(x + seg, y + rh - t, dw, t);
  } else {
    w.stationWalls.push({ x, y: y + rh - t, w: rw, h: t });
  }
  // Left wall
  if (doorSide === 'left') {
    const seg = (rh - dw) / 2;
    w.stationWalls.push({ x, y, w: t, h: seg }, { x, y: y + seg + dw, w: t, h: seg });
    makeBarrier(x, y + seg, t, dw);
  } else {
    w.stationWalls.push({ x, y, w: t, h: rh });
  }
  // Right wall
  if (doorSide === 'right') {
    const seg = (rh - dw) / 2;
    w.stationWalls.push({ x: x + rw - t, y, w: t, h: seg }, { x: x + rw - t, y: y + seg + dw, w: t, h: seg });
    makeBarrier(x + rw - t, y + seg, t, dw);
  } else {
    w.stationWalls.push({ x: x + rw - t, y, w: t, h: rh });
  }
}

function getLostWorldLore(
  zone: Exclude<ZoneKind, 'fallen_city'>,
  tier: ZoneTier,
  stationIdx: number
): { title: string; epigraph: string; rumors: string[] } {
  const pool: Record<Exclude<ZoneKind, 'fallen_city'>, Array<{ title: string; epigraph: string; rumors: string[] }>> = {
    exile: [
      {
        title: '铁锈遗都 · 流放之城',
        epigraph: '铁轨尽头没有文明，只有被旧日风沙掩埋的锈蚀高塔，与散落荒野的无主珍宝。',
        rumors: ['🔗 军用正规车钩遗迹', '🌱 废弃温室种子库', '🏺 外围荒野远古圣匣'],
      },
      {
        title: '灰烬驿站 · 被遗忘的边陲',
        epigraph: '流放者曾在此点燃最后的篝火，如今唯余破败厂房与深处的封存金库。',
        rumors: ['⚙ 重型机务检修厂', '⛽ 荒野遗弃油罐队', '🏺 深层市政金库'],
      },
    ],
    monster: [
      {
        title: '猩红骸谷 · 失落的猎场',
        epigraph: '血色岩层下回荡着嗜血低吼，越远离铁轨深入未知，越能寻获前代远征队的遗物。',
        rumors: ['🛡 巨兽硬甲壳（升级背包）', '⛽ 战损油罐车队', '🏺 失落军械圣匣'],
      },
      {
        title: '裂齿荒城 · 嗜血禁区',
        epigraph: '整座城市已化作巢穴，但尘封的军工仓库与荒野祭坛里仍静卧着稀世宝藏。',
        rumors: ['🔩 军用精密零件库', '🛡 高阶巨兽甲壳', '🏺 远古造物密室'],
      },
    ],
    fantasy: [
      {
        title: '紫晶秘境 · 失落的星陨城',
        epigraph: '破碎的魔导尖塔仍在低语，秘法晶脉在迷雾深处闪烁着致命而诱人的微光。',
        rumors: ['🔮 秘法晶石矿脉', '🧪 古代炼金密室', '🏺 秘法远古圣匣'],
      },
      {
        title: '星辉废墟 · 秘法禁域',
        epigraph: '现实的法则在此扭曲，每一片未踏足的迷雾之后，都可能沉睡着上古魔导造物。',
        rumors: ['🔮 高纯秘法晶簇', '🧪 稀世魔力药剂', '🏺 失落星陨圣匣'],
      },
    ],
    old_city: [
      {
        title: '沉寂钟楼 · 失落的旧日王都',
        epigraph: '时间在石板大道上停摆，远古构装仍在守卫那些无人敢碰的鎏金地库。',
        rumors: ['🏺 鎏金远古造物地库', '🔗 帝国军用正规车钩', '🔩 黄金齿轮工坊'],
      },
      {
        title: '白石遗城 · 失落的黄金纪元',
        epigraph: '残破的拱门通往无垠废墟，深入迷雾的探索者将带回足以改写命运的远古造物。',
        rumors: ['🏺 远古档案圣匣', '🔮 皇室秘法藏品', '🔗 精密机车部件'],
      },
    ],
  };
  const list = pool[zone];
  return list[(stationIdx + tier) % list.length];
}

export function buildStationMap(
  w: WorldState,
  zone: Exclude<ZoneKind, 'fallen_city'>,
  tier: ZoneTier,
  stationName: string,
  anchorOffsetX = 0,
  preserveRoute = false
): void {
  const prevOnTrainMonsters = w.monsters.filter((m) => m.onTrain);
  const lore = getLostWorldLore(zone, tier, w.stationIdx);
  w.stationName = stationName;
  w.stationWorldTitle = lore.title;
  w.stationEpigraph = lore.epigraph;
  w.stationRumors = lore.rumors;
  w.disembarkedAtStation = false;
  w.exploredChunks.clear();
  w.exploredFog.clear();
  w.discoveredLandmarks = 0;
  w.stationAnchorX = anchorOffsetX;
  w.stationRoads = [];
  w.stationRooms = [];
  w.stationWalls = [];
  w.stationBarriers = [];
  if (!preserveRoute) {
    w.availableRoutes = buildNextRoutes(w.stationIdx);
    w.selectedRoute = null;
  }

  const isFirst = w.stationIdx === 0;
  const deepTier = Math.min(5, tier + 1) as ZoneTier;
  const vaultTier = Math.min(5, tier + 2) as ZoneTier;

  // City layout variation per zone/station so each stop feels like a brand-new city!
  const flipX = w.stationIdx % 2 === 1 ? -1 : 1;
  const fx = (x: number, width = 0): number => (flipX === 1 ? x : -x - width);
  const roadCol =
    zone === 'old_city'
      ? '#343a40'
      : zone === 'fantasy'
        ? '#2a223d'
        : zone === 'monster'
          ? '#362624'
          : '#38322c';

  // Full City Road Grid & Central Plaza (2720 × 2080 city scale!)
  w.stationRoads = [
    // North & South main boulevards parallel to railway
    { x: -1280, y: -265, w: 2560, h: 110, color: roadCol },
    { x: -1280, y: 155, w: 2560, h: 100, color: roadCol },
    // Outer north/south ring avenues
    { x: -1240, y: -640, w: 2480, h: 72, color: roadCol },
    { x: -1240, y: 580, w: 2480, h: 72, color: roadCol },
    // 3 North-South city avenues crossing between districts
    { x: -690, y: -980, w: 84, h: 1960, color: roadCol },
    { x: -55, y: -980, w: 110, h: 1960, color: roadCol },
    { x: 610, y: -980, w: 84, h: 1960, color: roadCol },
    // Central North Civic Plaza
    { x: -240, y: -560, w: 480, h: 250, color: zone === 'old_city' ? '#3d454d' : '#403932' },
  ];

  // --- Ring 1: Near-Rail Urban Blocks (Lv.1 Crowbar opens timber barricades) ---
  // 1) Station Waiting Hall (NW near track)
  addRoomWithDoor(w, fx(-560, 260), -510, 260, 210, 'bottom', 1, '🏚 车站候车大厅 [Lv.1]', '#2e332c');
  // 2) Corner General Store / Clinic (North-East near track)
  addRoomWithDoor(w, fx(280, 260), -510, 260, 210, 'bottom', 1, '🏪 废弃街角商店 [Lv.1]', '#34302a');
  // 3) South Residential Tenement (South-Center near track)
  addRoomWithDoor(w, fx(-540, 250), 290, 250, 210, 'top', 1, '🏚 旧街民居楼 [Lv.1]', '#332d28');
  // 4) East Freight Shed (East near track)
  addRoomWithDoor(w, fx(760, 260), -520, 260, 220, 'bottom', 1, '📦 货运编组仓 [Lv.1]', '#2f3236');

  // --- Ring 2: Mid-City Districts (Requires Lv.2 Heavy Pickaxe!) ---
  // 5) West Botanical Greenhouse / Municipal Hospital (Far West North)
  addRoomWithDoor(
    w,
    fx(-1180, 320),
    -560,
    320,
    250,
    'bottom',
    2,
    zone === 'fantasy' ? '🔒 秘法植物园 [需 Lv.2 铁镐]' : '🔒 市立温室与医务所 [需 Lv.2 铁镐]',
    '#27332c'
  );
  // 6) Railway Locomotive Depot (West South District)
  addRoomWithDoor(
    w,
    fx(-1160, 340),
    290,
    340,
    240,
    'top',
    2,
    '🔒 铁路机务检修厂 [需 Lv.2 铁镐]',
    '#2f2c36'
  );
  // 7) Municipal Armory / Watchtower Barracks (East South District)
  addRoomWithDoor(
    w,
    fx(760, 340),
    290,
    340,
    240,
    'top',
    2,
    zone === 'old_city' ? '🔒 旧城钟楼卫戍厅 [需 Lv.2 铁镐]' : '🔒 城市警备军械库 [需 Lv.2 铁镐]',
    '#382b2b'
  );

  // --- Ring 3: Deep City Forbidden Landmarks (Requires Lv.3 Steam Saw! Best Loot & Strongest Guards!) ---
  // 8) North Deep Landmark: Grand Cathedral / Arcane Sanctum / Ancient Archive
  addRoomWithDoor(
    w,
    fx(-210, 420),
    -960,
    420,
    260,
    'bottom',
    3,
    zone === 'fantasy'
      ? '🔒 秘法大教堂圣坛 [需 Lv.3 切割锯]'
      : zone === 'old_city'
        ? '🔒 失落旧城远古档案库 [需 Lv.3 切割锯]'
        : '🔒 市政深层金库大厅 [需 Lv.3 切割锯]',
    zone === 'fantasy' ? '#2c1e42' : '#242e38'
  );
  // 9) South Deep Landmark: Underground Power Vault / Reliquary
  addRoomWithDoor(
    w,
    fx(180, 360),
    700,
    360,
    250,
    'top',
    3,
    zone === 'fantasy'
      ? '🔒 以太核心实验室 [需 Lv.3 切割锯]'
      : zone === 'old_city'
        ? '🔒 远古能源中枢密库 [需 Lv.3 切割锯]'
        : '🔒 地下应急油库密室 [需 Lv.3 切割锯]',
    zone === 'fantasy' ? '#281d3b' : '#262d36'
  );

  const px = (x: number): number => x * flipX;

  // Fixed Finite City Resource Nodes distributed across streets, plazas, and all 9 buildings!
  w.props = [
    // Station Platform starter supplies
    { uid: uid('p'), kind: 'wood_crate', mat: 'wood', x: px(-180), y: -175, r: 20, hp: 32, maxHp: 32, hitFlash: 0, label: '月台旧木箱', drops: { wood: 5, rawFood: 1 } },
    { uid: uid('p'), kind: 'scrap_pile', mat: 'metal', x: px(-85), y: -180, r: 22, hp: 40, maxHp: 40, hitFlash: 0, label: '铁道废铁堆', drops: { scrap: 6 } },
    { uid: uid('p'), kind: 'dry_tree', mat: 'wood', x: px(-295), y: -185, r: 22, hp: 34, maxHp: 34, hitFlash: 0, label: '干枯枕木堆', drops: { wood: 6 } },
    { uid: uid('p'), kind: 'fuel_barrel', mat: 'barrel', x: px(120), y: -180, r: 18, hp: 36, maxHp: 36, hitFlash: 0, label: '月台油桶', drops: { fuel: 3, scrap: 2 } },

    // Building 1: Station Waiting Hall (Lv.1)
    { uid: uid('p'), kind: 'wood_crate', mat: 'wood', x: px(-480), y: -435, r: 20, hp: 32, maxHp: 32, hitFlash: 0, label: '候车行李箱', drops: { wood: 5, water: 2, rawFood: 2 } },
    { uid: uid('p'), kind: 'bandit_crate', mat: 'wood', x: px(-385), y: -395, r: 21, hp: 40, maxHp: 40, hitFlash: 0, label: '站务物资柜', drops: { scrap: 5, parts: 2, fuel: 2, ammo: 4 } },

    // Building 2: Corner Store (Lv.1)
    { uid: uid('p'), kind: 'seed_cache', mat: 'wood', x: px(360), y: -435, r: 22, hp: 36, maxHp: 36, hitFlash: 0, label: '杂货粮柜', drops: { seeds: 3, rawFood: 4, water: 3 } },
    { uid: uid('p'), kind: 'wood_crate', mat: 'wood', x: px(465), y: -395, r: 20, hp: 32, maxHp: 32, hitFlash: 0, label: '货架木箱', drops: { wood: 6, cookedFood: 1 } },

    // Building 3: South Residential Tenement (Lv.1)
    { uid: uid('p'), kind: 'wood_crate', mat: 'wood', x: px(-465), y: 395, r: 20, hp: 32, maxHp: 32, hitFlash: 0, label: '民居木柜', drops: { wood: 5, rawFood: 2, water: 2 } },
    { uid: uid('p'), kind: 'fuel_barrel', mat: 'barrel', x: px(-365), y: 425, r: 18, hp: 36, maxHp: 36, hitFlash: 0, label: '煤油暖炉罐', drops: { fuel: 3, scrap: 2 } },

    // Building 4: East Freight Shed (Lv.1) + Freight Siding Carriage
    { uid: uid('p'), kind: 'flatbed_siding', x: px(1080), y: -215, r: 42, hp: 999, maxHp: 999, hitFlash: 0, label: '废弃备用车厢（需车钩挂接）', interactOnly: true },
    { uid: uid('p'), kind: 'parts_box', mat: 'metal', x: px(845), y: -435, r: 20, hp: 45, maxHp: 45, hitFlash: 0, label: '货运零件箱', drops: { parts: 3, scrap: 5 } },
    { uid: uid('p'), kind: 'scrap_car', mat: 'metal', x: px(940), y: -380, r: 28, hp: 65, maxHp: 65, hitFlash: 0, label: '锈蚀货车', drops: { scrap: 7, parts: 2, fuel: 3 } },

    // Street / Plaza scattered wrecks (between buildings)
    { uid: uid('p'), kind: 'scrap_car', mat: 'metal', x: px(120), y: 360, r: 28, hp: 62, maxHp: 62, hitFlash: 0, label: '街心报废轿车', drops: { scrap: 6, fuel: 3, parts: 1 } },
    { uid: uid('p'), kind: 'dry_tree', mat: 'wood', x: px(-160), y: 460, r: 22, hp: 34, maxHp: 34, hitFlash: 0, label: '枯死行道树', drops: { wood: 6 } },
    { uid: uid('p'), kind: 'parts_box', mat: 'metal', x: px(420), y: 420, r: 20, hp: 48, maxHp: 48, hitFlash: 0, label: '路口工具箱', drops: { parts: 2, rails: 1, fuel: 2 } },

    // Building 5: West Greenhouse / Hospital (Lv.2 Pickaxe)
    { uid: uid('p'), kind: 'seed_cache', mat: 'wood', x: px(-1080), y: -470, r: 24, hp: 38, maxHp: 38, hitFlash: 0, label: '农科种子库', drops: { seeds: 5, rawFood: 5, water: 5 } },
    {
      uid: uid('p'),
      kind: zone === 'fantasy' ? 'arcane_crystal' : 'bandit_crate',
      mat: 'metal',
      x: px(-955),
      y: -430,
      r: 22,
      hp: 46,
      maxHp: 46,
      hitFlash: 0,
      label: zone === 'fantasy' ? '✨ 秘法温室晶簇' : '医疗与急救物资柜',
      drops: zone === 'fantasy' ? { magicShard: 2, arcanePotion: 2 } : { cookedFood: 3, water: 4, arcanePotion: 1 },
    },

    // Building 6: West Locomotive Depot (Lv.2 Pickaxe)
    { uid: uid('p'), kind: 'scrap_car', mat: 'metal', x: px(-1040), y: 405, r: 28, hp: 70, maxHp: 70, hitFlash: 0, label: '装甲检修车（含正规车钩）', drops: { scrap: 10, parts: 4, coupler: 1, fuel: 4 } },
    { uid: uid('p'), kind: 'fuel_barrel', mat: 'barrel', x: px(-910), y: 445, r: 18, hp: 38, maxHp: 38, hitFlash: 0, label: '高压储油罐', drops: { fuel: 5, scrap: 2 } },

    // Building 7: East Armory / Watchtower (Lv.2 Pickaxe)
    { uid: uid('p'), kind: 'parts_box', mat: 'metal', x: px(865), y: 400, r: 22, hp: 50, maxHp: 50, hitFlash: 0, label: '军械弹药箱', drops: { ammo: 14, parts: 4, rails: 2 } },
    {
      uid: uid('p'),
      kind: zone === 'old_city' ? 'ancient_vault' : 'fuel_barrel',
      mat: 'metal',
      x: px(1010),
      y: 435,
      r: 22,
      hp: 52,
      maxHp: 52,
      hitFlash: 0,
      label: zone === 'old_city' ? '🏛 卫戍远古遗物箱' : '军用燃油储罐',
      drops: zone === 'old_city' ? { ancientRelic: 1, scrap: 8, fuel: 4 } : { fuel: 5, scrap: 6 },
    },

    // Building 8: North Deep Landmark (Lv.3 Steam Saw — Top Tier City Treasure!)
    {
      uid: uid('p'),
      kind: zone === 'fantasy' ? 'arcane_crystal' : 'ancient_vault',
      mat: 'metal',
      x: px(-80),
      y: -855,
      r: 26,
      hp: 72,
      maxHp: 72,
      hitFlash: 0,
      label: zone === 'fantasy' ? '✨ 圣坛主魔晶' : '🏛 城市核心远古密箱',
      drops:
        zone === 'fantasy'
          ? { magicShard: 5, arcanePotion: 3, fuel: 6, parts: 4 }
          : { ancientRelic: 2, coupler: 1, parts: 5, fuel: 6, rails: 2 },
    },
    {
      uid: uid('p'),
      kind: zone === 'fantasy' ? 'arcane_crystal' : 'parts_box',
      mat: 'metal',
      x: px(110),
      y: -840,
      r: 22,
      hp: 54,
      maxHp: 54,
      hitFlash: 0,
      label: zone === 'fantasy' ? '✨ 秘法典藏箱' : '金库精密构件箱',
      drops: zone === 'fantasy' ? { magicShard: 3, fuel: 4 } : { ancientRelic: 1, parts: 4, ammo: 12 },
    },

    // Building 9: South Deep Landmark (Lv.3 Steam Saw)
    {
      uid: uid('p'),
      kind: zone === 'fantasy' ? 'arcane_crystal' : 'ancient_vault',
      mat: 'metal',
      x: px(320),
      y: 830,
      r: 26,
      hp: 70,
      maxHp: 70,
      hitFlash: 0,
      label: zone === 'fantasy' ? '✨ 以太核心反应晶' : '🏛 地下能源密箱',
      drops:
        zone === 'fantasy'
          ? { magicShard: 4, fuel: 6, arcanePotion: 2 }
          : { ancientRelic: 1, fuel: 8, parts: 4, coupler: 1 },
    },
    { uid: uid('p'), kind: 'fuel_barrel', mat: 'barrel', x: px(455), y: 855, r: 20, hp: 42, maxHp: 42, hitFlash: 0, label: '深层高压油罐', drops: { fuel: 6, rails: 2 } },
  ];

  // Station 2+ friendly camp facilities on North Civic Plaza
  if (!isFirst) {
    w.props.push(
      { uid: uid('p'), kind: 'water_tower', x: px(-130), y: -380, r: 34, hp: 999, maxHp: 999, hitFlash: 0, label: '城市蓄水塔（免费补水）', interactOnly: true },
      { uid: uid('p'), kind: 'npc_keeper', x: px(0), y: -350, r: 18, hp: 999, maxHp: 999, hitFlash: 0, label: '守城商人（交易物资/珍宝/车钩）', interactOnly: true }
    );
    if (!w.companion) {
      w.props.push({ uid: uid('p'), kind: 'npc_gardener', x: px(110), y: -350, r: 18, hp: 999, maxHp: 999, hitFlash: 0, label: '园丁（建床后可邀上车）', interactOnly: true });
    }
    if (w.locoLevel === 1) {
      w.props.push({ uid: uid('p'), kind: 'loco_crane', x: px(165), y: -475, r: 32, hp: 999, maxHp: 999, hitFlash: 0, label: '重型龙门吊（升车头II：30废+6零）', interactOnly: true });
    }
  }

  // City defenders scaled by ring depth: Street/Ring1 (tier) -> Ring2 Lv.2 rooms (tier+1) -> Ring3 Lv.3 vaults (tier+2)!
  const s1 = isFirst ? 'bandit' : pickZoneEnemyKind(zone, tier);
  const s2 = isFirst ? 'bandit' : pickZoneEnemyKind(zone, tier);
  const s3 = isFirst ? 'stalker' : pickZoneEnemyKind(zone, tier);
  const midGuard = zone === 'fantasy' ? 'arcane_wraith' : zone === 'old_city' ? 'ruin_golem' : isFirst ? 'bandit' : 'elite';
  const vaultBoss = zone === 'fantasy' ? 'arcane_wraith' : zone === 'old_city' ? 'ruin_golem' : 'elite';

  w.monsters = [
    // Ring 1 Street & Shallow Building Patrols
    createMonster(s1, px(-420), -445, false, tier),
    createMonster(s2, px(420), -430, false, tier),
    createMonster(s1, px(-410), 430, false, tier),
    createMonster(s3, px(900), -340, false, tier),
    createMonster(s3, px(180), 450, false, tier),
    // Ring 2 Mid-City Locked Building Guards (tier + 1)
    createMonster(midGuard, px(-1010), -420, false, deepTier),
    createMonster(midGuard, px(-990), 430, false, deepTier),
    createMonster(midGuard, px(940), 425, false, deepTier),
    // Ring 3 Deep Vault Boss Guards (tier + 2, strongest!)
    createMonster(vaultBoss, px(10), -820, false, vaultTier),
    createMonster(vaultBoss, px(390), 825, false, vaultTier),
  ];
  if (zone === 'monster' || tier >= 3) {
    w.monsters.push(
      createMonster(pickZoneEnemyKind(zone, deepTier), px(-640), -610, false, deepTier),
      createMonster(pickZoneEnemyKind(zone, deepTier), px(640), 615, false, deepTier)
    );
  }

  // Shift entire generated station to anchorOffsetX so it physically rolls in from ahead on the rails!
  if (anchorOffsetX !== 0) {
    for (const rd of w.stationRoads) rd.x += anchorOffsetX;
    for (const rm of w.stationRooms) rm.x += anchorOffsetX;
    for (const wl of w.stationWalls) wl.x += anchorOffsetX;
    for (const br of w.stationBarriers) br.x += anchorOffsetX;
    for (const pr of w.props) pr.x += anchorOffsetX;
    for (const m of w.monsters) m.x += anchorOffsetX;
  }
  if (prevOnTrainMonsters.length > 0) {
    w.monsters.push(...prevOnTrainMonsters);
  }
}

function pickZoneEnemyKind(zone: ZoneKind, tier: ZoneTier): MonsterEntity['kind'] {
  const r = Math.random();
  if (zone === 'exile' || zone === 'fallen_city') {
    if (r < 0.65) return 'bandit';
    return r < 0.85 ? 'stalker' : 'clinger';
  }
  if (zone === 'fantasy') {
    if (r < 0.58) return 'arcane_wraith';
    if (r < 0.82) return 'elite';
    return 'burrower';
  }
  if (zone === 'old_city') {
    if (r < 0.45) return 'ruin_golem';
    if (r < 0.72) return 'bandit';
    return tier >= 3 ? 'elite' : 'stalker';
  }
  if (r < 0.25 && tier >= 2) return 'elite';
  if (r < 0.52) return 'stalker';
  if (r < 0.78) return 'clinger';
  return 'burrower';
}

export function createMonster(
  kind: MonsterEntity['kind'],
  x: number,
  y: number,
  onTrain: boolean,
  tier: ZoneTier = 1
): MonsterEntity {
  const cfg = {
    bandit: { hp: 32, speed: 92, dps: 10, r: 13 },
    stalker: { hp: 36, speed: 95, dps: 12, r: 14 },
    clinger: { hp: 28, speed: 108, dps: 11, r: 13 },
    burrower: { hp: 32, speed: 102, dps: 11, r: 13 },
    elite: { hp: 95, speed: 94, dps: 18, r: 19 },
    arcane_wraith: { hp: 72, speed: 118, dps: 18, r: 15 },
    ruin_golem: { hp: 110, speed: 78, dps: 20, r: 18 },
  }[kind];
  const hpMult = [1, 1.25, 1.55, 1.9, 2.35][tier - 1] ?? 1;
  const dpsMult = [1, 1.15, 1.3, 1.45, 1.65][tier - 1] ?? 1;
  const maxHp = Math.round(cfg.hp * hpMult);
  return {
    uid: uid('m'),
    kind,
    tier,
    x,
    y,
    vx: 0,
    vy: 0,
    r: cfg.r,
    hp: maxHp,
    maxHp,
    speed: cfg.speed + (tier - 1) * 4,
    dps: Math.round(cfg.dps * dpsMult),
    onTrain,
    hitFlash: 0,
    attackCd: 0,
  };
}

export function createInitialWorld(): WorldState {
  // Car 0 starts EMPTY inside so the player builds their mobile home from scratch (#6)!
  const car0 = createFlatbed(0, 'standard', 2.5);
  const backpack = createGrid(BACKPACK_TIERS[1].cols, BACKPACK_TIERS[1].rows);
  addToGrid(backpack, 'wood', 3);
  addToGrid(backpack, 'scrap', 4);
  addToGrid(backpack, 'parts', 1);
  addToGrid(backpack, 'fuel', 1); // Scarce starting fuel (#2)!
  addToGrid(backpack, 'water', 6);
  addToGrid(backpack, 'rawFood', 3);
  addToGrid(backpack, 'cookedFood', 1);
  addToGrid(backpack, 'ammo', 8);
  addToGrid(backpack, 'rails', 1);
  addToGrid(backpack, 'seeds', 2);

  const w: WorldState = {
    mode: 'city_escape',
    stationIdx: 0,
    stationName: '陷落大城 · 逃离郊区',
    legDistance: 0,
    legTotal: CITY_ESCAPE_METERS,
    totalDistance: 0,
    worldScrollX: 0,
    stationAnchorX: 0,
    time: 0,
    hitStop: 0,

    zoneKind: 'fallen_city',
    zoneTier: 1,
    prevZoneKind: null,
    biomeSeamX: -99999,
    cityExitX: 1180,
    stationStreamed: false,
    disembarkedAtStation: false,
    stationWorldTitle: '陷落大城 · 逃离郊区',
    stationEpigraph: '火海吞噬了旧日的钟楼，唯有蒸汽机车还能带你冲向未知的铁道。',
    stationRumors: [],
    lostWorldBanner: null,
    exploredFog: new Set(),
    discoveredLandmarks: 0,
    zoneBanner: { kind: 'fallen_city', tier: 1, timer: 4.5 },
    availableRoutes: [],
    selectedRoute: null,
    routeOpen: false,

    stationRoads: [],
    stationRooms: [],
    stationWalls: [],
    stationBarriers: [],

    lastSleepDay: 0,
    vitalWarnCd: { hp: 0, hunger: 0, thirst: 0, temp: 0 },

    lanternHolder: 'train',
    darkThreatLevel: 0,
    darkThreatTimer: 6,
    wastelandStopTimer: 0,
    wastelandSiegeCd: 5,
    drivingRaidTimer: 16,

    dayTime: 0.08, // Morning start (~9.5 min daylight in 20-min Minecraft day)
    dayCount: 1,
    weather: 'clear',
    weatherTimer: 150,
    lightningFlash: 0,
    survivedHarshEvent: false,

    cameraX: -40,
    cameraY: 0,
    shake: 0,

    locoLevel: 1,
    locoHp: 160,
    locoMaxHp: 160,
    locoHull: createCarHull(LOCO_COLS, 1),
    hasBumper: false,
    boilerFuel: 4, // Enough to slowly escape the burning city, still scarce once in Exile Lands!
    boilerMax: 20,
    totalFuelAdded: 0,
    gear: 1, // Gently rolling out of the Fallen City at start!
    trainSpeed: GEAR_SPEEDS[1],
    chugTimer: 0,
    flatbeds: [car0],

    player: {
      x: -136,
      y: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      hunger: 85,
      thirst: 85,
      bodyTemp: 100,
      wellFedTimer: 0,
      swingTimer: 0,
      swingAngle: 0,
      attackCd: 0,
      hitFlash: 0,
      invulnTimer: 0,
      flashlightOn: true,
      toolLevel: 1,
      alive: true,
    },

    hotbar: 0,
    buildMode: false,
    selectedBuild: 'workbench',
    backpackLevel: 1,
    backpack,
    heldItem: null,
    questIdx: 0,

    props: [],
    trackHazards: [],
    monsters: [],
    pickups: [],
    projectiles: [],
    particles: [],
    floats: [],
    decoyPos: null,
    companion: null,

    exploredChunks: new Set(),
    hazardSpawnTimer: 14,
    nightWavesLeft: 0,
    nightWaveTimer: 0,
    activeHint: null,
    tradeOpen: false,
    craftOpen: false,
    bagOpen: false,
    openChestUid: null,
    deathReport: null,
    gameOver: false,
    stats: {
      monstersKilled: 0,
      propsHarvested: 0,
      buildingsPlaced: 0,
      railsLaid: 0,
      stationsReached: 0,
      deaths: 0,
    },
  };

  return w;
}

// --- Building, Coupling & Crafting Actions ---
export function tryPlaceBuilding(w: WorldState, wx: number, wy: number): string | null {
  const def = BUILDINGS[w.selectedBuild];
  if (def.requiresWorkbench && !hasWorkbench(w)) return '需要先在车上建造【工程工作台】';
  if (!canAffordCost(w, def.cost)) return '材料不足（已自动统计背包与车上所有储物箱）';

  if (def.locoFrontOnly) {
    if (w.hasBumper) return '车头已安装撞角';
    if (wx < LOCO_W - 20 || wx > LOCO_W + 70 || Math.abs(wy) > HALF_H) {
      return '请将【车头撞角】对准车头正前方安装';
    }
    spendCost(w, def.cost);
    w.hasBumper = true;
    w.stats.buildingsPlaced++;
    sfx.build();
    spawnParticles(w, LOCO_W + 15, 0, '#d98a36', 14, 140);
    addFloat(w, LOCO_W + 15, -24, '装上车头撞角！全速可撞飞怪物！', '#ffd56b');
    return null;
  }

  const tile = worldToTrainTile(w, wx, wy);
  if (!tile) return '请点击车厢内部 5×4 网格进行自由布置';
  const car = w.flatbeds[tile.carIdx];
  if (car.buildings.some((b) => b.col === tile.col && b.row === tile.row)) {
    return '该格子已有设施（右键可拆除回收）';
  }

  const center = getTileCenter(tile.carIdx, tile.col, tile.row);
  if (def.solid && Math.abs(w.player.x - center.x) < TILE / 2 + 11 && Math.abs(w.player.y - center.y) < TILE / 2 + 11) {
    return '不能把设施盖在自己脚下';
  }

  spendCost(w, def.cost);
  car.buildings.push(makeBuilding(w.selectedBuild, tile.carIdx, tile.col, tile.row));
  w.stats.buildingsPlaced++;
  sfx.build();
  spawnParticles(w, center.x, center.y, def.color, 10, 95);
  addFloat(w, center.x, center.y - 16, `建造 ${def.short}`, '#9ef0a8');

  if (isOverloaded(w) && w.gear === 3) {
    w.gear = 2;
    addFloat(w, w.player.x, w.player.y - 30, '⚠ 列车超载！已退出全速', '#ff8787');
  }
  return null;
}

export function tryRemoveBuilding(w: WorldState, wx: number, wy: number): boolean {
  const tile = worldToTrainTile(w, wx, wy);
  if (!tile) return false;
  const car = w.flatbeds[tile.carIdx];
  const idx = car.buildings.findIndex((b) => b.col === tile.col && b.row === tile.row);
  if (idx < 0) return false;
  const [removed] = car.buildings.splice(idx, 1);
  if (w.openChestUid === removed.uid) w.openChestUid = null;

  const c = getTileCenter(tile.carIdx, tile.col, tile.row);
  // Drop chest contents cleanly so nothing is lost when rearranging base!
  if (removed.chestGrid) {
    for (const it of removed.chestGrid.items) {
      if (it.count > 0) spawnPickup(w, it.key, it.count, c.x, c.y, true);
    }
  }

  const def = BUILDINGS[removed.type];
  for (const [k, v] of Object.entries(def.cost)) {
    const refund = Math.max(1, Math.floor((v ?? 0) * 0.75));
    giveItem(w, k as ResourceKey, refund);
  }
  sfx.hitMetal();
  spawnParticles(w, c.x, c.y, '#bbb', 8, 90);
  addFloat(w, c.x, c.y - 14, `拆除 ${def.short}（返还材料）`, '#ffd56b');
  return true;
}

export function craftItem(w: WorldState, recipeId: string): string | null {
  const rec = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!rec) return '未知配方';
  if (rec.id === 'upgrade_pickaxe' && w.player.toolLevel >= 2) return '已拥有 Lv.2 重型铁镐或更高级工具';
  if (rec.id === 'upgrade_saw' && w.player.toolLevel >= 3) return '已拥有 Lv.3 蒸汽切割锯';
  if (rec.id === 'upgrade_saw' && w.player.toolLevel < 2) return '请先锻造【Lv.2 重型铁镐】';
  if (rec.requiresWorkbench && !hasWorkbench(w)) return '需要在车上建造【工程工作台】';
  if (!canAffordCost(w, rec.cost)) return '材料不足（已自动包含车上所有箱子）';
  spendCost(w, rec.cost);
  if (rec.id === 'upgrade_pickaxe') {
    w.player.toolLevel = 2;
    sfx.questDone();
    addFloat(w, w.player.x, w.player.y - 28, '⛏ 锻造完成：Lv.2 重型铁镐（可破开 2 级钢筋铁门！）', '#ffd56b');
    return null;
  }
  if (rec.id === 'upgrade_saw') {
    w.player.toolLevel = 3;
    sfx.questDone();
    addFloat(w, w.player.x, w.player.y - 28, '🪚 组装完成：Lv.3 蒸汽切割锯（可切开 3 级合金防爆门！）', '#ffd56b');
    return null;
  }
  for (const [k, v] of Object.entries(rec.output)) {
    giveItem(w, k as ResourceKey, v ?? 0);
  }
  sfx.build();
  addFloat(w, w.player.x, w.player.y - 24, `合成：${rec.name}`, '#9ef0a8');
  return null;
}

export function tryAttachCarriage(w: WorldState, diyBuild: boolean): string | null {
  const hasStd = getItemCount(w, 'coupler') > 0;
  const hasCrude = getItemCount(w, 'crudeCoupler') > 0;
  if (!hasStd && !hasCrude) return '需要 1 个【正规车钩】或【土制车钩】才能挂接/组装新车厢！';
  const kind: CouplerKind = hasStd ? 'standard' : 'crude';
  const extraCost: Partial<Record<ResourceKey, number>> = diyBuild ? { scrap: 8, wood: 6 } : {};
  if (diyBuild && !canAffordCost(w, extraCost)) return '自建车厢还需要 废料 8 + 木材 6';

  spendCost(w, { [kind === 'standard' ? 'coupler' : 'crudeCoupler']: 1, ...extraCost });
  w.flatbeds.push(createFlatbed(w.flatbeds.length, kind, diyBuild ? 2.8 : 3.0));
  sfx.build();
  w.shake = 7;
  const over = isOverloaded(w);
  const warn = kind === 'crude' ? '（土制车钩易磨损，高速需及时检修！）' : '（正规车钩稳固可靠）';
  addFloat(
    w,
    w.player.x,
    w.player.y - 34,
    `🔗 挂接第 ${w.flatbeds.length} 节车厢！${warn}${over ? ' ⚠已超载' : ''}`,
    kind === 'crude' || over ? '#ffd56b' : '#9ef0a8'
  );
  return null;
}

export function shiftGear(w: WorldState, delta: number): void {
  if (!isPointOnTrain(w, w.player.x, w.player.y, 20)) {
    addFloat(w, w.player.x, w.player.y - 24, '需在列车上才能操作油门/刹车', '#ffd56b');
    return;
  }
  if (w.mode === 'station' && delta > 0 && !w.selectedRoute) {
    w.routeOpen = true;
    addFloat(w, 130, -30, '🗺 发车前请先选定下一座目标站点！', '#ffd56b');
    sfx.alert();
    return;
  }
  const maxGear: GearLevel = isOverloaded(w) ? 2 : 3;
  const next = Math.max(0, Math.min(maxGear, w.gear + delta)) as GearLevel;
  if (next === w.gear && delta > 0 && isOverloaded(w)) {
    addFloat(w, 130, -30, '⚠ 超载无法挂全速！', '#ff8787');
    sfx.alert();
    return;
  }
  w.gear = next;
  sfx.lever();
  addFloat(w, 130, -28, `档位：${GEAR_LABELS[w.gear]}${w.gear === 3 ? '（极速·高油耗）' : ''}`, '#ffd56b');
}

export function eatOrDrink(w: WorldState): void {
  let did = false;
  if (w.player.hp < 60 && getItemCount(w, 'arcanePotion') > 0) {
    spendCost(w, { arcanePotion: 1 });
    w.player.hp = Math.min(w.player.maxHp, w.player.hp + 55);
    w.player.stamina = w.player.maxStamina;
    w.player.bodyTemp = 100;
    w.player.wellFedTimer = Math.max(w.player.wellFedTimer, 110);
    spawnParticles(w, w.player.x, w.player.y, '#c77dff', 14, 130);
    addFloat(w, w.player.x, w.player.y - 24, '🧪 饮下魔力药剂！+55血 秘法充盈', '#e0aaff');
    did = true;
  } else if (getItemCount(w, 'cookedFood') > 0) {
    spendCost(w, { cookedFood: 1 });
    w.player.hunger = Math.min(100, w.player.hunger + 45);
    w.player.hp = Math.min(w.player.maxHp, w.player.hp + 15);
    w.player.bodyTemp = Math.min(100, w.player.bodyTemp + 20);
    w.player.wellFedTimer = 90;
    addFloat(w, w.player.x, w.player.y - 24, '🥖 吃热麦饼！饱食精力 +90s 回暖', '#9ef0a8');
    did = true;
  } else if (getItemCount(w, 'rawFood') > 0) {
    spendCost(w, { rawFood: 1 });
    w.player.hunger = Math.min(100, w.player.hunger + 22);
    addFloat(w, w.player.x, w.player.y - 24, '🌾 吃生口粮 +22饱食', '#d8f5a2');
    did = true;
  } else if (getItemCount(w, 'arcanePotion') > 0) {
    spendCost(w, { arcanePotion: 1 });
    w.player.hp = Math.min(w.player.maxHp, w.player.hp + 55);
    w.player.stamina = w.player.maxStamina;
    w.player.bodyTemp = 100;
    w.player.wellFedTimer = Math.max(w.player.wellFedTimer, 110);
    spawnParticles(w, w.player.x, w.player.y, '#c77dff', 14, 130);
    addFloat(w, w.player.x, w.player.y - 24, '🧪 饮下魔力药剂！+55血 秘法充盈', '#e0aaff');
    did = true;
  }
  if (w.player.thirst < 80 && getItemCount(w, 'water') > 0) {
    spendCost(w, { water: 1 });
    w.player.thirst = Math.min(100, w.player.thirst + 38);
    addFloat(w, w.player.x, w.player.y - 40, '💧 喝水 +38水分', '#74c0fc');
    did = true;
  }
  if (did) sfx.eat();
  else addFloat(w, w.player.x, w.player.y - 24, '背包与箱子里没有食物或水了', '#ff8787');
}

export function throwDecoy(w: WorldState, tx: number, ty: number): void {
  if (getItemCount(w, 'decoys') <= 0) {
    addFloat(w, w.player.x, w.player.y - 24, '没有诱饵肉块（按 Tab 合成）', '#ff8787');
    return;
  }
  spendCost(w, { decoys: 1 });
  const dx = tx - w.player.x;
  const dy = ty - w.player.y;
  const dist = Math.min(160, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  w.decoyPos = {
    x: w.player.x + Math.cos(ang) * dist,
    y: w.player.y + Math.sin(ang) * dist,
    ttl: 10,
  };
  sfx.swing();
  addFloat(w, w.decoyPos.x, w.decoyPos.y - 16, '🍖 诱饵生效 10s！', '#ffd56b');
}

// --- Primary Left-Click Action ---
export function handlePrimaryAction(w: WorldState, wx: number, wy: number): void {
  if (w.gameOver || !w.player.alive || w.deathReport) return;

  if (w.buildMode || w.hotbar === 5) {
    const err = tryPlaceBuilding(w, wx, wy);
    if (err) addFloat(w, wx, wy - 16, err, '#ff8787');
    return;
  }

  // Direct Left-Click on a nearby ground pickup -> open POE2 backpack with item in hand for manual placement!
  for (const pk of w.pickups) {
    if (pk.amount <= 0) continue;
    if (Math.hypot(pk.x - wx, pk.y - wy) <= 28 && Math.hypot(pk.x - w.player.x, pk.y - w.player.y) <= 165) {
      openGroundLootUI(w, pk.uid);
      return;
    }
  }

  if (w.hotbar === 3) {
    eatOrDrink(w);
    return;
  }
  if (w.hotbar === 4) {
    throwDecoy(w, wx, wy);
    return;
  }
  if (w.hotbar === 2) {
    if (tryLayRailAtFront(w)) return;
    addFloat(w, w.player.x, w.player.y - 24, '需停在断轨前并走到车头最前方铺轨', '#ffd56b');
    return;
  }

  if (w.player.attackCd > 0) return;

  // Slot 1: Shotgun
  if (w.hotbar === 1) {
    if (getItemCount(w, 'ammo') <= 0) {
      addFloat(w, w.player.x, w.player.y - 24, '弹药用完了！按 Tab 合成霰弹', '#ff8787');
      return;
    }
    spendCost(w, { ammo: 1 });
    w.player.attackCd = 0.42;
    const baseAng = Math.atan2(wy - w.player.y, wx - w.player.x);
    for (let p = -2; p <= 2; p++) {
      const a = baseAng + p * 0.08 + (Math.random() - 0.5) * 0.04;
      w.projectiles.push({
        x: w.player.x + Math.cos(a) * 18,
        y: w.player.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 560,
        vy: Math.sin(a) * 560,
        dmg: 11,
        ttl: 0.42,
        fromTurret: false,
      });
    }
    w.shake = Math.max(w.shake, 6.5);
    sfx.shotgun();
    spawnParticles(w, w.player.x + Math.cos(baseAng) * 18, w.player.y + Math.sin(baseAng) * 18, '#ffae42', 8, 180, baseAng);
    return;
  }

  // Slot 0: Crowbar (Melee + Juicy Harvest + Hull Breaching + Repair!)
  if (w.player.stamina < 8) {
    addFloat(w, w.player.x, w.player.y - 20, '体力不足！', '#ffd56b');
    return;
  }
  w.player.stamina = Math.max(0, w.player.stamina - 8);
  w.player.attackCd = 0.32;
  w.player.swingTimer = 0.2;
  const ang = Math.atan2(wy - w.player.y, wx - w.player.x);
  w.player.swingAngle = ang;
  sfx.swing();

  const wellFedMult = w.player.wellFedTimer > 0 ? 1.3 : 1.0;
  const toolMeta = TOOL_META[w.player.toolLevel];
  const hitX = w.player.x + Math.cos(ang) * 34;
  const hitY = w.player.y + Math.sin(ang) * 34;
  let hitAnything = false;

  // 1) Hit monsters
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - hitX, m.y - hitY) <= m.r + 28) {
      const dmg = Math.round(toolMeta.dmg * wellFedMult);
      damageMonster(w, m, dmg, Math.cos(ang) * 195, Math.sin(ang) * 195);
      w.hitStop = Math.max(w.hitStop, m.hp <= 0 ? 0.05 : 0.028);
      hitAnything = true;
    }
  }

  // 1.5) Hit tool-gated Station Barriers (deeper buildings require higher tool tier!)
  for (const bar of w.stationBarriers) {
    if (bar.opened) continue;
    const qx = Math.max(bar.x, Math.min(hitX, bar.x + bar.w));
    const qy = Math.max(bar.y, Math.min(hitY, bar.y + bar.h));
    if (Math.hypot(hitX - qx, hitY - qy) <= 26) {
      hitAnything = true;
      bar.hitFlash = 0.16;
      const cx = bar.x + bar.w / 2;
      const cy = bar.y + bar.h / 2;
      if (w.player.toolLevel < bar.reqTool) {
        sfx.alert();
        spawnParticles(w, cx, cy, '#ff8787', 6, 95);
        addFloat(w, cx, cy - 22, `🔒 需【${TOOL_META[bar.reqTool].name}】才能破开！（工作台制作）`, '#ff8787');
      } else {
        const dmg = Math.round(toolMeta.harvestDmg * wellFedMult);
        bar.hp = Math.max(0, bar.hp - dmg);
        w.hitStop = Math.max(w.hitStop, bar.hp <= 0 ? 0.06 : 0.03);
        w.shake = Math.max(w.shake, bar.hp <= 0 ? 9 : 4);
        if (bar.hp <= 0) {
          bar.opened = true;
          sfx.breakMetal();
          spawnParticles(w, cx, cy, '#ffd56b', 22, 190);
          addFloat(w, cx, cy - 22, `💥 已破开 ${bar.label}！小心内部强敌！`, '#9ef0a8');
        } else {
          sfx.hitMetal();
          spawnParticles(w, cx, cy, '#ffe08a', 8, 120, ang);
          addFloat(w, cx, cy - 18, `破门 -${dmg}`, '#ffd56b');
        }
      }
      break;
    }
  }

  // 2) Harvest props with tactile material feedback (#9)!
  for (const prop of w.props) {
    if (prop.interactOnly || prop.hp <= 0) continue;
    if (Math.hypot(prop.x - hitX, prop.y - hitY) <= prop.r + 30) {
      const dmg = Math.round(toolMeta.harvestDmg * wellFedMult);
      prop.hp -= dmg;
      prop.hitFlash = 0.14;
      prop.hitBounce = 0.16;
      prop.hitOffX = Math.cos(ang) * 7;
      prop.hitOffY = Math.sin(ang) * 7;
      hitAnything = true;

      const mat = prop.mat ?? 'metal';
      const broke = prop.hp <= 0;
      w.hitStop = Math.max(w.hitStop, broke ? 0.055 : 0.03);
      w.shake = Math.max(w.shake, broke ? 7 : 3.8);

      if (mat === 'wood') {
        if (broke) sfx.breakWood();
        else sfx.hitWood();
        spawnParticles(w, prop.x, prop.y, '#c79258', broke ? 18 : 8, broke ? 175 : 125, ang);
      } else if (mat === 'barrel') {
        if (broke) sfx.breakMetal();
        else sfx.hitBarrel();
        spawnParticles(w, prop.x, prop.y, broke ? '#ff7b29' : '#e0533c', broke ? 18 : 8, broke ? 180 : 125, ang);
      } else {
        if (broke) sfx.breakMetal();
        else sfx.hitMetal();
        spawnParticles(w, prop.x, prop.y, '#ffe08a', broke ? 18 : 9, broke ? 190 : 135, ang);
      }

      addFloat(w, prop.x, prop.y - 18, broke ? `💥 拆解!` : `-${dmg}`, broke ? '#ffd56b' : '#f5d36c');
      if (broke) {
        w.stats.propsHarvested++;
        if (prop.drops) {
          for (const [k, amt] of Object.entries(prop.drops)) {
            spawnPickup(w, k as ResourceKey, amt ?? 1, prop.x, prop.y, false);
          }
        }
      }
    }
  }

  // 3) Repair damaged interior building / extinguish fire / repair loco
  if (!hitAnything) {
    if (w.locoHp < w.locoMaxHp && w.player.x >= -10 && w.player.x <= LOCO_W && Math.abs(w.player.y) <= HALF_H) {
      if (getItemCount(w, 'scrap') >= 1) {
        spendCost(w, { scrap: 1 });
        w.locoHp = Math.min(w.locoMaxHp, w.locoHp + 25);
        sfx.hitMetal();
        spawnParticles(w, hitX, hitY, '#74c0fc', 6, 90);
        addFloat(w, hitX, hitY - 12, '修理车头 +25', '#74c0fc');
        return;
      }
    }
    for (const car of w.flatbeds) {
      for (const b of car.buildings) {
        const c = getTileCenter(b.carIdx, b.col, b.row);
        if (Math.hypot(c.x - hitX, c.y - hitY) <= 36) {
          if (b.onFire) {
            b.onFire = false;
            sfx.hitMetal();
            spawnParticles(w, c.x, c.y, '#74c0fc', 10, 110);
            addFloat(w, c.x, c.y - 16, '🧯 已灭火！', '#74c0fc');
            return;
          }
          if (b.hp < b.maxHp && getItemCount(w, 'scrap') >= 1) {
            spendCost(w, { scrap: 1 });
            b.hp = Math.min(b.maxHp, b.hp + 30);
            sfx.hitMetal();
            spawnParticles(w, c.x, c.y, '#74c0fc', 6, 90);
            addFloat(w, c.x, c.y - 14, `修复 ${BUILDINGS[b.type].short} +30`, '#74c0fc');
            return;
          }
        }
      }
    }

    // Player never damages their own carriage hull; crowbar near damaged hull repairs it instead!
    for (const { carIdx, panel } of getAllHullPanels(w)) {
      if (panel.hp >= panel.maxHp || isHullPassage(w, carIdx, panel)) continue;
      const seg = getHullSegment(carIdx, panel);
      if (Math.hypot(seg.cx - hitX, seg.cy - hitY) < 34 && getItemCount(w, 'scrap') >= 1) {
        spendCost(w, { scrap: 1 });
        panel.hp = Math.min(panel.maxHp, panel.hp + 40);
        sfx.build();
        spawnParticles(w, seg.cx, seg.cy, '#74c0fc', 7, 95);
        addFloat(w, seg.cx, seg.cy - 16, '🔧 修补车体 +40', '#74c0fc');
        return;
      }
    }
  }
}

export function findBuildingByUid(w: WorldState, id: string): PlacedBuilding | null {
  for (const c of w.flatbeds) {
    const f = c.buildings.find((b) => b.uid === id);
    if (f) return f;
  }
  return null;
}

function damageMonster(w: WorldState, m: MonsterEntity, dmg: number, kbX: number, kbY: number): void {
  m.hp -= dmg;
  m.hitFlash = 0.14;
  m.vx += kbX;
  m.vy += kbY;
  w.shake = Math.max(w.shake, 3.2);
  sfx.hitFlesh();
  spawnParticles(w, m.x, m.y, '#e04f4f', 7, 130);
  addFloat(w, m.x, m.y - 16, `-${dmg}`, '#ff9c9c');
  if (m.hp <= 0) {
    w.stats.monstersKilled++;
    spawnParticles(w, m.x, m.y, m.kind === 'arcane_wraith' ? '#c77dff' : '#ff5252', 16, 170);
    if (m.kind === 'bandit') {
      spawnPickup(w, 'scrap', 2, m.x, m.y, m.onTrain);
      if (Math.random() < 0.65) spawnPickup(w, 'ammo', 2, m.x, m.y, m.onTrain);
      if (Math.random() < 0.4) spawnPickup(w, 'fuel', 1, m.x, m.y, m.onTrain);
    } else if (m.kind === 'arcane_wraith') {
      spawnPickup(w, 'magicShard', 1 + (m.tier >= 4 ? 1 : 0), m.x, m.y, m.onTrain);
      if (Math.random() < 0.35) spawnPickup(w, 'arcanePotion', 1, m.x, m.y, m.onTrain);
    } else if (m.kind === 'ruin_golem') {
      spawnPickup(w, 'parts', 2, m.x, m.y, m.onTrain);
      if (Math.random() < 0.5) spawnPickup(w, 'ancientRelic', 1, m.x, m.y, m.onTrain);
    } else {
      spawnPickup(w, m.kind === 'stalker' || m.kind === 'elite' ? 'bone' : 'carapace', m.kind === 'elite' ? 3 : 1, m.x, m.y, m.onTrain);
      if (Math.random() < 0.5) spawnPickup(w, 'rawFood', 1, m.x, m.y, m.onTrain);
    }
  }
}

export function collectProp(w: WorldState, prop: WorldProp): boolean {
  if (prop.interactOnly || prop.hp <= 0 || !prop.drops) return false;
  const gained: string[] = [];
  let anyLeft = false;
  for (const [k, amt] of Object.entries(prop.drops)) {
    const need = amt ?? 0;
    if (need <= 0) continue;
    const added = giveItem(w, k as ResourceKey, need, false);
    if (added > 0) {
      prop.drops[k as ResourceKey] = need - added;
      gained.push(`${ITEM_META[k as ResourceKey].short}×${added}`);
    }
    if ((prop.drops[k as ResourceKey] ?? 0) > 0) anyLeft = true;
  }
  if (gained.length === 0) {
    addFloat(w, w.player.x, w.player.y - 30, '🎒 背包已满！按 I 整理或存入箱子', '#ffd56b');
    return false;
  }
  sfx.pickup();
  spawnParticles(w, prop.x, prop.y, prop.mat === 'wood' ? '#c79258' : prop.mat === 'barrel' ? '#ff7b29' : '#ffe08a', 10, 125);
  addFloat(w, prop.x, prop.y - 20, `📦 拾取 ${gained.join(' ')}`, '#b2f2bb');
  if (!anyLeft) {
    prop.hp = 0;
    w.stats.propsHarvested++;
  }
  return true;
}

// Note: Infinite chunk prop spawning intentionally removed — all stations have finite resource nodes.

export function tryLayRailAtFront(w: WorldState): boolean {
  const broken = w.trackHazards.find(
    (h) => h.kind === 'broken' && !h.repaired && h.x >= LOCO_W - 30 && h.x <= LOCO_W + 200
  );
  if (!broken) return false;
  if (Math.hypot(w.player.x - LOCO_W, w.player.y) > 105) return false;
  if (w.trainSpeed > 40) {
    addFloat(w, LOCO_W, -30, '先拉刹车减速再铺轨！', '#ff8787');
    return true;
  }
  if (getItemCount(w, 'rails') <= 0) {
    addFloat(w, LOCO_W, -30, '铁轨段用完了！按 Tab 在工作台合成', '#ff8787');
    return true;
  }
  spendCost(w, { rails: 1 });
  broken.repaired = true;
  w.stats.railsLaid++;
  sfx.build();
  spawnParticles(w, broken.x + broken.width / 2, 0, '#9ef0a8', 18, 160);
  addFloat(w, broken.x + 20, -28, '🛤 铺轨完成！可以起步了！', '#9ef0a8');
  return true;
}

// --- Death Penalty: Random Carriage & Item Loss (#7) ---
export function handlePlayerDeath(w: WorldState): void {
  w.stats.deaths++;
  w.gear = 0;
  w.trainSpeed = 0;
  w.craftOpen = false;
  w.tradeOpen = false;
  w.bagOpen = false;
  w.openChestUid = null;

  let lostCarDesc = '未丢失车厢（仅剩 1 节保底，车体受损）';
  const lostBuildings: string[] = [];

  if (w.flatbeds.length > 1) {
    const dropIdx = Math.floor(Math.random() * w.flatbeds.length);
    const [dropped] = w.flatbeds.splice(dropIdx, 1);
    // Re-index remaining cars & buildings
    for (let i = 0; i < w.flatbeds.length; i++) {
      w.flatbeds[i].id = i;
      for (const b of w.flatbeds[i].buildings) b.carIdx = i;
    }
    lostCarDesc = `随机脱失了第 ${dropIdx + 1} 节车厢（含车上全部设施与箱内物资）！`;
    for (const b of dropped.buildings) lostBuildings.push(BUILDINGS[b.type].name);
  } else if (w.flatbeds.length === 1) {
    const car = w.flatbeds[0];
    // Breach 2 random non-passage hull panels
    const intact = car.hull.filter((p) => !isHullPassage(w, 0, p) && p.hp > 0);
    for (let k = 0; k < Math.min(2, intact.length); k++) {
      const idx = Math.floor(Math.random() * intact.length);
      intact[idx].hp = 0;
      intact.splice(idx, 1);
    }
    // Destroy 1 random interior building if any
    if (car.buildings.length > 0) {
      const bIdx = Math.floor(Math.random() * car.buildings.length);
      const [remB] = car.buildings.splice(bIdx, 1);
      lostBuildings.push(BUILDINGS[remB.type].name);
    }
  }

  const lostItems = stripRandomGridItems(w.backpack, 0.42);

  // Clear monsters on the train so player doesn't instantly die again
  w.monsters = w.monsters.filter((m) => !m.onTrain && Math.hypot(m.x - 75, m.y) > 220);

  // Revive inside locomotive
  w.player.x = 76;
  w.player.y = 18;
  w.player.hp = Math.round(w.player.maxHp * 0.7);
  w.player.stamina = w.player.maxStamina;
  w.player.hunger = Math.max(60, w.player.hunger);
  w.player.thirst = Math.max(60, w.player.thirst);
  w.player.bodyTemp = 85;
  w.player.invulnTimer = 3.0;
  w.player.alive = true;

  w.deathReport = {
    deathNum: w.stats.deaths,
    lostCarDesc,
    lostBuildings,
    lostItems,
  };
  sfx.crash();
  w.shake = 16;
}

// --- Contextual [E] Interaction Discovery ---
function updateActiveHint(w: WorldState): void {
  w.activeHint = null;
  if (w.gameOver || w.deathReport) return;
  const px = w.player.x;
  const py = w.player.y;

  // 1. Lay rail at front of locomotive
  const brokenAhead = w.trackHazards.find(
    (h) => h.kind === 'broken' && !h.repaired && h.x >= LOCO_W - 30 && h.x <= LOCO_W + 200
  );
  if (brokenAhead && Math.hypot(px - LOCO_W, py) < 105) {
    w.activeHint = {
      x: LOCO_W + 24,
      y: -36,
      label: `[E] 铺设铁轨段（余 ${getItemCount(w, 'rails')}）`,
      action: () => {
        tryLayRailAtFront(w);
      },
    };
    return;
  }

  // 2. Locomotive Throttle Lever & Route Console (x=136, y=0)
  if (Math.hypot(px - 136, py - 0) < 44) {
    if (w.mode === 'station' && !w.selectedRoute) {
      w.activeHint = {
        x: 136,
        y: -36,
        label: '[E] 🗺 选定下一座目标站点（查看预计燃料消耗后发车）',
        action: () => {
          w.routeOpen = true;
          w.craftOpen = false;
          w.bagOpen = false;
          w.tradeOpen = false;
          sfx.lever();
        },
      };
      return;
    }
    const nextGear = ((w.gear + 1) % (isOverloaded(w) ? 3 : 4)) as GearLevel;
    const estNote =
      w.mode === 'station' && w.selectedRoute
        ? ` · 目标:${w.selectedRoute.stationName}(需油~${estimateRouteFuel(w, w.selectedRoute.distance, 2)})`
        : '';
    w.activeHint = {
      x: 136,
      y: -36,
      label: `[E] 油门杆：当前${GEAR_LABELS[w.gear]} → 切${GEAR_LABELS[nextGear]}${estNote}`,
      action: () => {
        w.gear = nextGear;
        sfx.lever();
        addFloat(w, 136, -24, `油门：${GEAR_LABELS[w.gear]}${w.gear === 3 ? '（快速·高耗油）' : ''}`, '#ffd56b');
      },
    };
    return;
  }

  // 2.5 Train Lantern Hook (x=LANTERN_HOOK_X, y=LANTERN_HOOK_Y)
  if (Math.hypot(px - LANTERN_HOOK_X, py - LANTERN_HOOK_Y) < 40) {
    w.activeHint = {
      x: LANTERN_HOOK_X,
      y: LANTERN_HOOK_Y - 28,
      label: w.lanternHolder === 'train' ? '[E] 🏮 取下火车手提灯（夜行必备，防黑暗怪潮）' : '[E] 🏮 将手提灯挂回车头挂钩',
      action: () => {
        pickupOrPlaceLantern(w);
      },
    };
    return;
  }

  // 3. Boiler Furnace (x=54, y=-28) — scarce fuel adds +3 at a time!
  if (Math.hypot(px - 54, py + 28) < 46) {
    const fuelAvail = getItemCount(w, 'fuel');
    w.activeHint = {
      x: 54,
      y: -58,
      label: `[E] 往锅炉添燃料 +3（可用燃料 ${fuelAvail}）`,
      action: () => {
        const avail = getItemCount(w, 'fuel');
        if (avail <= 0) {
          addFloat(w, 54, -44, '没有燃料了！下车敲油桶/枯木压制木炭', '#ff8787');
          return;
        }
        const add = Math.min(3, avail, Math.ceil(w.boilerMax - w.boilerFuel));
        if (add <= 0) {
          addFloat(w, 54, -44, '锅炉已经加满了', '#ffd56b');
          return;
        }
        spendCost(w, { fuel: add });
        w.boilerFuel = Math.min(w.boilerMax, w.boilerFuel + add);
        w.totalFuelAdded += add;
        sfx.build();
        spawnParticles(w, 54, -28, '#ff7b29', 10, 90);
        addFloat(w, 54, -44, `🔥 添燃料 +${add}（够推进一小段！）`, '#ffae42');
      },
    };
    return;
  }

  // 4. Car Hull Doors & Damaged/Breached Hull Repair (#1)
  let bestHull: { carIdx: number; panel: HullPanel; cx: number; cy: number; d: number } | null = null;
  for (const { carIdx, panel } of getAllHullPanels(w)) {
    if (isHullPassage(w, carIdx, panel)) continue;
    const isInteractable = panel.isDoor || panel.hp < panel.maxHp;
    if (!isInteractable) continue;
    const seg = getHullSegment(carIdx, panel);
    const d = Math.hypot(px - seg.cx, py - seg.cy);
    if (d < 44 && (!bestHull || d < bestHull.d)) {
      bestHull = { carIdx, panel, cx: seg.cx, cy: seg.cy, d };
    }
  }
  if (bestHull) {
    const p = bestHull.panel;
    if (p.hp < p.maxHp && (!p.isDoor || p.hp <= 0)) {
      w.activeHint = {
        x: bestHull.cx,
        y: bestHull.cy - 26,
        label: `[E] ${p.hp <= 0 ? '焊封车体破口' : '修补车体装甲'}（耗 1 废料）`,
        action: () => {
          if (getItemCount(w, 'scrap') < 1) {
            addFloat(w, bestHull!.cx, bestHull!.cy - 18, '需要 1 废料修补车体', '#ff8787');
            return;
          }
          spendCost(w, { scrap: 1 });
          p.hp = Math.min(p.maxHp, p.hp + 50);
          sfx.build();
          spawnParticles(w, bestHull!.cx, bestHull!.cy, '#74c0fc', 9, 100);
          addFloat(w, bestHull!.cx, bestHull!.cy - 18, '🔧 车体已修补！', '#74c0fc');
        },
      };
      return;
    }
    if (p.isDoor) {
      w.activeHint = {
        x: bestHull.cx,
        y: bestHull.cy - 26,
        label: `[E] ${p.doorOpen ? '关闭' : '打开'}车厢门`,
        action: () => {
          p.doorOpen = !p.doorOpen;
          // Gently nudge player clear of doorway threshold when closing so they never snag
          if (!p.doorOpen && Math.abs(w.player.y - bestHull!.cy) < 16 && Math.abs(w.player.x - bestHull!.cx) < 26) {
            w.player.y = bestHull!.cy + (w.player.y >= bestHull!.cy ? 17 : -17);
          }
          sfx.door(p.doorOpen);
        },
      };
      return;
    }
  }

  // 5. Crude Coupler Repair / Upgrade between coupled cars (#4)
  for (let i = 0; i < w.flatbeds.length; i++) {
    const car = w.flatbeds[i];
    if (car.couplerKind !== 'crude') continue;
    const b = getCarBounds(i);
    const cx = b.right + COUPLER_GAP / 2;
    if (Math.hypot(px - cx, py) < 42) {
      const hasStd = getItemCount(w, 'coupler') > 0;
      if (hasStd) {
        w.activeHint = {
          x: cx,
          y: -36,
          label: '[E] 换装【正规车钩】（彻底消除脱钩隐患）',
          action: () => {
            spendCost(w, { coupler: 1 });
            car.couplerKind = 'standard';
            car.couplerHp = 100;
            sfx.build();
            addFloat(w, cx, -24, '🔗 已升级为正规车钩！', '#9ef0a8');
          },
        };
        return;
      }
      if (car.couplerHp < 95) {
        w.activeHint = {
          x: cx,
          y: -36,
          label: `[E] 检修土制车钩（耐久 ${Math.round(car.couplerHp)}%，耗 1 废料）`,
          action: () => {
            if (getItemCount(w, 'scrap') < 1) {
              addFloat(w, cx, -24, '需要 1 废料检修车钩', '#ff8787');
              return;
            }
            spendCost(w, { scrap: 1 });
            car.couplerHp = 100;
            sfx.hitMetal();
            spawnParticles(w, cx, 0, '#74c0fc', 8, 90);
            addFloat(w, cx, -24, '🔧 土制车钩已重新紧固！', '#9ef0a8');
          },
        };
        return;
      }
    }
  }

  // 6. DIY Carriage Assembly at Train Tail when Stopped (#4)
  if (w.trainSpeed < 8 && (getItemCount(w, 'coupler') > 0 || getItemCount(w, 'crudeCoupler') > 0)) {
    const tailX = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
    if (Math.hypot(px - (tailX - 18), py) < 46) {
      const kindName = getItemCount(w, 'coupler') > 0 ? '正规车钩' : '土制车钩';
      w.activeHint = {
        x: tailX - 24,
        y: -36,
        label: `[E] 用【${kindName}】自建新车厢（还需 8废料 + 6木）`,
        action: () => {
          const err = tryAttachCarriage(w, true);
          if (err) addFloat(w, tailX - 24, -24, err, '#ff8787');
        },
      };
      return;
    }
  }

  // 7. Placed Train Buildings
  for (const car of w.flatbeds) {
    for (const b of car.buildings) {
      const c = getTileCenter(b.carIdx, b.col, b.row);
      if (Math.hypot(px - c.x, py - c.y) > 46) continue;

      if (b.type === 'chest') {
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: '[E] 打开储物木箱（支持一键整理/存同类/直取合成）',
          action: () => {
            w.openChestUid = b.uid;
            w.bagOpen = true;
            w.craftOpen = false;
            w.tradeOpen = false;
            sfx.lever();
          },
        };
        return;
      }
      if (b.type === 'door') {
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: `[E] ${b.doorOpen ? '关闭' : '打开'}室内闸门`,
          action: () => {
            b.doorOpen = !b.doorOpen;
            sfx.door(b.doorOpen);
          },
        };
        return;
      }
      if (b.type === 'planter') {
        if (!b.planted) {
          w.activeHint = {
            x: c.x,
            y: c.y - 28,
            label: `[E] 播耐旱麦种子（余 ${getItemCount(w, 'seeds')}）`,
            action: () => {
              if (getItemCount(w, 'seeds') <= 0) {
                addFloat(w, c.x, c.y - 16, '没有种子！去温室搜刮', '#ff8787');
                return;
              }
              spendCost(w, { seeds: 1 });
              b.planted = true;
              b.growth = 0;
              b.watered = 25;
              sfx.build();
              addFloat(w, c.x, c.y - 16, '🌱 已播种！', '#9ef0a8');
            },
          };
        } else if ((b.growth ?? 0) >= 100) {
          w.activeHint = {
            x: c.x,
            y: c.y - 28,
            label: '[E] 收获耐旱麦（+3 生粮 & 自动留种）',
            action: () => {
              giveItem(w, 'rawFood', 3);
              giveItem(w, 'seeds', 1);
              b.planted = false;
              b.growth = 0;
              sfx.pickup();
              addFloat(w, c.x, c.y - 16, '🌾 收获 +3生粮 +1种子！', '#ffd56b');
            },
          };
        } else {
          w.activeHint = {
            x: c.x,
            y: c.y - 28,
            label: `[E] 浇水加速生长（当前 ${Math.round(b.growth ?? 0)}%）`,
            action: () => {
              if (getItemCount(w, 'water') <= 0) {
                addFloat(w, c.x, c.y - 16, '水不足！', '#ff8787');
                return;
              }
              spendCost(w, { water: 1 });
              b.watered = 45;
              sfx.pickup();
              spawnParticles(w, c.x, c.y, '#74c0fc', 8, 80);
              addFloat(w, c.x, c.y - 16, '💧 浇水加速生长！', '#74c0fc');
            },
          };
        }
        return;
      }
      if (b.type === 'campfire') {
        const q = b.smeltQueue ?? 0;
        const status = q > 0 ? `燃烧中(${b.smeltKind === 'food' ? '热麦饼' : '木炭'} ${Math.round(b.smeltProgress ?? 0)}% · 队列${q})` : '空闲';
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: `[E] 熔炉投料（优先烤热麦饼，否则烧木炭燃料 · ${status}）`,
          action: () => {
            if (canAffordCost(w, { rawFood: 2, wood: 1 })) {
              spendCost(w, { rawFood: 2, wood: 1 });
              b.smeltKind = 'food';
              b.smeltQueue = (b.smeltQueue ?? 0) + 1;
              sfx.build();
              addFloat(w, c.x, c.y - 16, '🔥 熔炉已投入：烤制热麦饼（行驶中照常燃烧）', '#ffae42');
            } else if (canAffordCost(w, { wood: 3 })) {
              spendCost(w, { wood: 3 });
              b.smeltKind = 'charcoal';
              b.smeltQueue = (b.smeltQueue ?? 0) + 1;
              sfx.build();
              addFloat(w, c.x, c.y - 16, '🔥 熔炉已投入：烧制木炭燃料（行驶中照常燃烧）', '#ffae42');
            } else {
              addFloat(w, c.x, c.y - 16, '需 2生粮+1木（烤饼）或 3木（烧炭）', '#ff8787');
            }
          },
        };
        return;
      }
      if (b.type === 'rain_collector') {
        const stored = Math.floor(b.storedWater ?? 0);
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: stored > 0 ? `[E] 收取雨水 +${stored}` : '接水斗（暴雨时自动蓄水）',
          action: () => {
            if (stored > 0) {
              giveItem(w, 'water', stored);
              b.storedWater = (b.storedWater ?? 0) - stored;
              sfx.pickup();
              addFloat(w, c.x, c.y - 16, `💧 收集清水 +${stored}`, '#74c0fc');
            }
          },
        };
        return;
      }
      if (b.type === 'bed') {
        const canSleep = w.lastSleepDay < w.dayCount;
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: canSleep
            ? `[E] 休息 ${BED_REST_HOURS} 小时（每日限 1 次：回血+45、满体回暖、时间推进 ${BED_REST_HOURS}h）`
            : '💤 今日已在床铺休息过（每日限 1 次，明日黎明刷新）',
          action: () => {
            restInBed(w, c.x, c.y);
          },
        };
        return;
      }
      if (b.type === 'workbench') {
        w.activeHint = {
          x: c.x,
          y: c.y - 28,
          label: '[E] 打开工程工作台合成（直取箱内材料）',
          action: () => {
            w.craftOpen = !w.craftOpen;
            w.bagOpen = false;
            w.tradeOpen = false;
          },
        };
        return;
      }
    }
  }

  // 7.4 Nearby Ground Loot Manual Pickup [E] (no auto-vacuum — open POE2 grid backpack to manually place!)
  const nearbyLoot = getNearbyPickups(w, 105);
  if (nearbyLoot.length > 0) {
    const first = nearbyLoot[0];
    const meta = ITEM_META[first.key];
    w.activeHint = {
      x: first.x,
      y: first.y - 26,
      label:
        nearbyLoot.length > 1
          ? `[E] 手动拾取 ${meta.icon}${meta.short}×${first.amount}（附近共${nearbyLoot.length}件 · 摆入行囊）`
          : `[E] 手动拾取 ${meta.icon}${meta.short}×${first.amount}（摆入行囊）`,
      action: () => {
        openGroundLootUI(w, first.uid);
      },
    };
    return;
  }

  // 7.5 Tool-Gated Station Barriers hint
  for (const bar of w.stationBarriers) {
    if (bar.opened) continue;
    const cx = bar.x + bar.w / 2;
    const cy = bar.y + bar.h / 2;
    if (Math.hypot(px - cx, py - cy) < 54) {
      const canBreak = w.player.toolLevel >= bar.reqTool;
      w.activeHint = {
        x: cx,
        y: cy - 22,
        label: canBreak
          ? `左键挥动【${TOOL_META[w.player.toolLevel].short}】破开 ${bar.label} (${Math.ceil(bar.hp)}/${bar.maxHp})`
          : `🔒 封锁门：需在工作台制作【${TOOL_META[bar.reqTool].name}】才能打开！`,
        action: () => {
          if (!canBreak) {
            sfx.alert();
            addFloat(w, cx, cy - 18, `🔒 需要【${TOOL_META[bar.reqTool].name}】！`, '#ff8787');
          } else {
            addFloat(w, cx, cy - 18, '请按鼠标左键挥动工具破门！', '#ffd56b');
          }
        },
      };
      return;
    }
  }

  // 8. World Props (Harvestable props require tool swings; interactive station facilities use [E])
  for (const prop of w.props) {
    if (prop.used || prop.hp <= 0) continue;
    if (!prop.interactOnly && prop.drops) {
      if (Math.hypot(px - prop.x, py - prop.y) <= prop.r + 36) {
        w.activeHint = {
          x: prop.x,
          y: prop.y - prop.r - 18,
          label: `左键挥工具拆解 ${prop.label} (${Math.ceil(prop.hp)}/${prop.maxHp})`,
          action: () => {
            addFloat(w, prop.x, prop.y - 24, '按鼠标左键使用工具拆解采集！', '#ffd56b');
          },
        };
        return;
      }
      continue;
    }
    if (!prop.interactOnly) continue;
    if (Math.hypot(px - prop.x, py - prop.y) > prop.r + 36) continue;

    if (prop.kind === 'flatbed_siding') {
      const hasAnyCoupler = getItemCount(w, 'coupler') > 0 || getItemCount(w, 'crudeCoupler') > 0;
      const cName = getItemCount(w, 'coupler') > 0 ? '正规车钩' : '土制车钩';
      w.activeHint = {
        x: prop.x,
        y: prop.y - 44,
        label: hasAnyCoupler
          ? `[E] 消耗 1 【${cName}】将此车厢挂接到列车尾部！`
          : '需先获得【正规车钩】或在工作台造【土制车钩】才能挂接！',
        action: () => {
          const err = tryAttachCarriage(w, false);
          if (err) {
            addFloat(w, prop.x, prop.y - 30, err, '#ff8787');
            sfx.alert();
            return;
          }
          prop.used = true;
        },
      };
      return;
    }
    if (prop.kind === 'water_tower') {
      w.activeHint = {
        x: prop.x,
        y: prop.y - 44,
        label: '[E] 在水塔打水（清水 +10）',
        action: () => {
          prop.used = true;
          giveItem(w, 'water', 10);
          w.player.thirst = 100;
          sfx.pickup();
          addFloat(w, prop.x, prop.y - 30, '💧 装满清水 +10！', '#74c0fc');
        },
      };
      return;
    }
    if (prop.kind === 'npc_keeper') {
      w.activeHint = {
        x: prop.x,
        y: prop.y - 34,
        label: '[E] 与守塔老人交易物资',
        action: () => {
          w.tradeOpen = !w.tradeOpen;
          w.craftOpen = false;
          w.bagOpen = false;
        },
      };
      return;
    }
    if (prop.kind === 'npc_gardener') {
      w.activeHint = {
        x: prop.x,
        y: prop.y - 34,
        label: hasBed(w) ? '[E] 邀请园丁上车帮忙（自动照料菜地与修墙）' : '园丁：先在火车上摆一张【简易床铺】我再上车！',
        action: () => {
          if (!hasBed(w)) {
            addFloat(w, prop.x, prop.y - 24, '需先按 B 在车上建一张【简易床铺】', '#ffd56b');
            return;
          }
          prop.used = true;
          w.companion = {
            id: 'gardener',
            name: '园丁',
            x: -110,
            y: 0,
            status: '巡视车厢',
            actionTimer: 0,
          };
          sfx.eat();
          addFloat(w, prop.x, prop.y - 24, '🤝 园丁已登上你的列车！', '#9ef0a8');
        },
      };
      return;
    }
    if (prop.kind === 'loco_crane') {
      w.activeHint = {
        x: prop.x,
        y: prop.y - 44,
        label: '[E] 升级车头至 II 级（牵引上限 8→12，需 30废料 + 6零件）',
        action: () => {
          if (!canAffordCost(w, { scrap: 30, parts: 6 })) {
            addFloat(w, prop.x, prop.y - 30, '需要 废料 30 + 零件 6', '#ff8787');
            return;
          }
          spendCost(w, { scrap: 30, parts: 6 });
          w.locoLevel = 2;
          w.locoMaxHp = 230;
          w.locoHp = 230;
          prop.used = true;
          sfx.build();
          w.shake = 8;
          addFloat(w, prop.x, prop.y - 30, '🚂 车头升至 II 级！牵引上限提升至 12！', '#ffd56b');
        },
      };
      return;
    }
  }
}

export function triggerInteract(w: WorldState): void {
  if (w.activeHint) {
    w.activeHint.action();
  }
}

// --- Smooth Push-Out Collision Solver (Impossible for player to get stuck!) ---
function resolvePlayerCollisions(w: WorldState): void {
  const p = w.player;
  const bRad = 10;
  const bHalf = TILE / 2 - 3; // 19px solid building half-size (leaves generous aisle clearance!)
  const hThresh = 12; // player radius (8.5) + hull half-thick (3.5)

  for (let iter = 0; iter < 3; iter++) {
    // 1) Push out of solid placed buildings (Circle vs AABB)
    for (const car of w.flatbeds) {
      for (const b of car.buildings) {
        if (!BUILDINGS[b.type].solid || (b.type === 'door' && b.doorOpen)) continue;
        const c = getTileCenter(b.carIdx, b.col, b.row);
        const qx = Math.max(c.x - bHalf, Math.min(p.x, c.x + bHalf));
        const qy = Math.max(c.y - bHalf, Math.min(p.y, c.y + bHalf));
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d = Math.hypot(dx, dy);
        if (d > 0.0001 && d < bRad) {
          const push = bRad - d;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        } else if (d <= 0.0001) {
          // Player center is inside AABB -> eject along shortest escape edge
          const penLeft = p.x - (c.x - bHalf);
          const penRight = c.x + bHalf - p.x;
          const penTop = p.y - (c.y - bHalf);
          const penBottom = c.y + bHalf - p.y;
          const m = Math.min(penLeft, penRight, penTop, penBottom);
          if (m === penLeft) p.x = c.x - bHalf - bRad;
          else if (m === penRight) p.x = c.x + bHalf + bRad;
          else if (m === penTop) p.y = c.y - bHalf - bRad;
          else p.y = c.y + bHalf + bRad;
        }
      }
    }

    // 2) Push out of blocking outer car hull panels (Circle vs Segment)
    for (const { carIdx, panel } of getAllHullPanels(w)) {
      if (panel.hp <= 0 || isHullPassage(w, carIdx, panel) || (panel.isDoor && panel.doorOpen)) continue;
      const seg = getHullSegment(carIdx, panel);
      const trimStart = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx - 1) ? 7 : 1;
      const trimEnd = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx + 1) ? 7 : 1;
      const horiz = panel.side === 'top' || panel.side === 'bottom';
      const x1 = horiz ? seg.x1 + trimStart : seg.x1;
      const x2 = horiz ? seg.x2 - trimEnd : seg.x2;
      const y1 = horiz ? seg.y1 : seg.y1 + trimStart;
      const y2 = horiz ? seg.y2 : seg.y2 - trimEnd;

      const sdx = x2 - x1;
      const sdy = y2 - y1;
      const lenSq = sdx * sdx + sdy * sdy;
      const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, ((p.x - x1) * sdx + (p.y - y1) * sdy) / lenSq)) : 0;
      const qx = x1 + t * sdx;
      const qy = y1 + t * sdy;
      const dx = p.x - qx;
      const dy = p.y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < hThresh) {
        const push = hThresh - d;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      } else if (d <= 0.0001) {
        if (panel.side === 'top') p.y = seg.y1 + hThresh;
        else if (panel.side === 'bottom') p.y = seg.y1 - hThresh;
        else if (panel.side === 'left') p.x = seg.x1 + hThresh;
        else p.x = seg.x1 - hThresh;
      }
    }

    // 2.5) Push out of station building walls & closed tool-gated barriers!
    const pushAABB = (rx: number, ry: number, rw: number, rh: number): void => {
      const qx = Math.max(rx, Math.min(p.x, rx + rw));
      const qy = Math.max(ry, Math.min(p.y, ry + rh));
      const dx = p.x - qx;
      const dy = p.y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < bRad) {
        const push = bRad - d;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      } else if (d <= 0.0001) {
        const penL = p.x - rx;
        const penR = rx + rw - p.x;
        const penT = p.y - ry;
        const penB = ry + rh - p.y;
        const m = Math.min(penL, penR, penT, penB);
        if (m === penL) p.x = rx - bRad;
        else if (m === penR) p.x = rx + rw + bRad;
        else if (m === penT) p.y = ry - bRad;
        else p.y = ry + rh + bRad;
      }
    };
    for (const wall of w.stationWalls) pushAABB(wall.x, wall.y, wall.w, wall.h);
    for (const bar of w.stationBarriers) {
      if (!bar.opened) pushAABB(bar.x, bar.y, bar.w, bar.h);
    }

    // 3) While train is moving, keep player softly clamped inside the train deck; when stopped, finite station bounds!
    if (w.trainSpeed >= 8) {
      const minLeft = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
      p.x = Math.max(minLeft + 10, Math.min(LOCO_W - 10, p.x));
      // Check if in a coupler gap between cars
      let inGap = false;
      for (let i = 0; i < w.flatbeds.length; i++) {
        const b = getCarBounds(i);
        if (p.x > b.right + 2 && p.x < b.right + COUPLER_GAP - 2) {
          inGap = true;
          break;
        }
      }
      const maxY = inGap ? 34 : HALF_H - 10;
      p.y = Math.max(-maxY, Math.min(maxY, p.y));
    }
    // No invisible air walls when stopped at a station — every station opens into an unbounded Lost World!
  }
}

export const FOG_CELL_SIZE = 180;
const OUTER_CHUNK_SIZE = 640;

function hashChunk(seed: number, cx: number, cy: number): number {
  let h = (seed * 374761393 + cx * 668265263 + cy * 2147483647) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return Math.abs((h ^ (h >> 16)) % 10000) / 10000;
}

function updateLostWorldExploration(w: WorldState, dt: number): void {
  if (w.lostWorldBanner) {
    w.lostWorldBanner.timer -= dt;
    if (w.lostWorldBanner.timer <= 0) w.lostWorldBanner = null;
  }
  if (w.mode !== 'station' || w.trainSpeed >= 8) return;

  const p = w.player;
  const ox = w.stationAnchorX;

  // 1. Disembarkation Ceremony: Stepping off the train into the new Lost World!
  if (!w.disembarkedAtStation && !isPointOnTrain(w, p.x, p.y, 14)) {
    w.disembarkedAtStation = true;
    w.lostWorldBanner = {
      worldTitle: w.stationWorldTitle,
      epigraph: w.stationEpigraph,
      zone: w.zoneKind,
      tier: w.zoneTier,
      rumors: w.stationRumors,
      timer: 6.5,
    };
    sfx.lostWorldReveal(w.zoneKind);
    spawnParticles(w, p.x, p.y, '#ffd875', 22, 130);
    spawnParticles(w, p.x, p.y, '#fff3bf', 10, 75);
  }

  // 2. Fog-of-War Discovery Grid (relative to stationAnchorX)
  const relX = p.x - ox;
  const relY = p.y;
  const radius = isNight(w) ? (playerHasActiveLantern(w) ? 310 : 180) : 440;
  const minFX = Math.floor((relX - radius) / FOG_CELL_SIZE);
  const maxFX = Math.floor((relX + radius) / FOG_CELL_SIZE);
  const minFY = Math.floor((relY - radius) / FOG_CELL_SIZE);
  const maxFY = Math.floor((relY + radius) / FOG_CELL_SIZE);
  for (let fy = minFY; fy <= maxFY; fy++) {
    for (let fx = minFX; fx <= maxFX; fx++) {
      const cx = (fx + 0.5) * FOG_CELL_SIZE;
      const cy = (fy + 0.5) * FOG_CELL_SIZE;
      if (Math.hypot(cx - relX, cy - relY) <= radius + FOG_CELL_SIZE * 0.5) {
        w.exploredFog.add(`${fx},${fy}`);
      }
    }
  }
  // Always keep immediate station platform revealed
  if (w.exploredFog.size < 16) {
    for (let fy = -2; fy <= 1; fy++) {
      for (let fx = -3; fx <= 3; fx++) {
        w.exploredFog.add(`${fx},${fy}`);
      }
    }
  }

  // 3. Unbounded Lost World Procedural Outer Chunk Streaming (no air walls!)
  const pChunkX = Math.floor(relX / OUTER_CHUNK_SIZE);
  const pChunkY = Math.floor(relY / OUTER_CHUNK_SIZE);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = pChunkX + dx;
      const cy = pChunkY + dy;
      const centerRelX = (cx + 0.5) * OUTER_CHUNK_SIZE;
      const centerRelY = (cy + 0.5) * OUTER_CHUNK_SIZE;

      // Skip inner city core (already richly handcrafted by buildStationMap)
      if (Math.abs(centerRelX) < STATION_BOUND_X + 120 && Math.abs(centerRelY) < STATION_BOUND_Y + 120) {
        continue;
      }
      // Keep immediate railway corridor east/west uncluttered
      if (Math.abs(centerRelY) < 220) continue;

      const chunkKey = `${cx},${cy}`;
      if (w.exploredChunks.has(chunkKey)) continue;
      w.exploredChunks.add(chunkKey);

      const h1 = hashChunk(w.stationIdx + 17, cx, cy);
      const h2 = hashChunk(w.stationIdx + 91, cx, cy);
      const worldX = ox + centerRelX + (h1 - 0.5) * 180;
      const worldY = centerRelY + (h2 - 0.5) * 180;
      const distRing = Math.hypot(centerRelX, centerRelY) / 1400; // >1.0 outer wilds, >2.0 deep lost wilds
      const outerTier = Math.min(5, Math.max(w.zoneTier, Math.round(w.zoneTier + distRing - 0.8))) as ZoneTier;

      if (h1 < 0.24) {
        // Rare Lost Reliquary / Ancient Ruin Vault!
        w.discoveredLandmarks++;
        w.stationWalls.push(
          { x: worldX - 110, y: worldY - 90, w: 220, h: 16 },
          { x: worldX - 110, y: worldY - 90, w: 16, h: 170 },
          { x: worldX + 94, y: worldY - 90, w: 16, h: 170 }
        );
        w.props.push({
          uid: uid('prop'),
          kind: 'ancient_vault',
          mat: 'metal',
          x: worldX,
          y: worldY - 12,
          r: 25,
          hp: 65,
          maxHp: 65,
          hitFlash: 0,
          label: '失落遗迹圣匣',
          drops: {
            ancientRelic: 1,
            parts: 2 + Math.floor(distRing),
            coupler: distRing >= 1.8 ? 1 : 0,
            scrap: 4,
          },
        });
        w.props.push({
          uid: uid('prop'),
          kind: 'parts_box',
          mat: 'metal',
          x: worldX - 58,
          y: worldY + 30,
          r: 18,
          hp: 34,
          maxHp: 34,
          hitFlash: 0,
          label: '古代零件箱',
          drops: { parts: 2, fuel: 2 },
        });
        const bossKind = w.zoneKind === 'fantasy' ? 'arcane_wraith' : w.zoneKind === 'old_city' ? 'ruin_golem' : 'elite';
        w.monsters.push(createMonster(bossKind, worldX + 46, worldY + 42, false, outerTier));
        addFloat(w, p.x, p.y - 42, '✨ 迷雾散开：前方发现【失落遗迹圣匣】！', '#ffd43b');
      } else if (h1 < 0.48) {
        // Arcane Crystal / Rare Mineral Outcrop
        w.discoveredLandmarks++;
        w.props.push(
          {
            uid: uid('prop'),
            kind: 'arcane_crystal',
            mat: 'metal',
            x: worldX,
            y: worldY,
            r: 22,
            hp: 46,
            maxHp: 46,
            hitFlash: 0,
            label: '荒野秘法晶脉',
            drops: { magicShard: 2 + Math.floor(distRing * 0.6), arcanePotion: h2 > 0.55 ? 1 : 0 },
          },
          {
            uid: uid('prop'),
            kind: 'scrap_pile',
            mat: 'metal',
            x: worldX + 75,
            y: worldY - 40,
            r: 20,
            hp: 34,
            maxHp: 34,
            hitFlash: 0,
            label: '废铁残骸',
            drops: { scrap: 4, parts: 1 },
          }
        );
        w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX - 65, worldY + 35, false, outerTier));
      } else if (h1 < 0.74) {
        // Abandoned Expedition Fuel Convoy
        w.props.push(
          {
            uid: uid('prop'),
            kind: 'scrap_car',
            mat: 'metal',
            x: worldX,
            y: worldY,
            r: 32,
            hp: 58,
            maxHp: 58,
            hitFlash: 0,
            label: '遗弃远征车',
            drops: { scrap: 5, parts: 2, fuel: 2 },
          },
          {
            uid: uid('prop'),
            kind: 'fuel_barrel',
            mat: 'barrel',
            x: worldX + 72,
            y: worldY + 24,
            r: 16,
            hp: 26,
            maxHp: 26,
            hitFlash: 0,
            label: '遗落油桶',
            drops: { fuel: 3 },
          },
          {
            uid: uid('prop'),
            kind: 'bandit_crate',
            mat: 'wood',
            x: worldX - 68,
            y: worldY - 22,
            r: 18,
            hp: 30,
            maxHp: 30,
            hitFlash: 0,
            label: '补给物资箱',
            drops: { ammo: 6, cookedFood: 1, water: 2 },
          }
        );
        w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX + 20, worldY - 78, false, outerTier));
      } else {
        // Frontier Wilds: Dead Trees, Crates, Seeds & Roaming Beast
        w.props.push(
          {
            uid: uid('prop'),
            kind: 'dry_tree',
            mat: 'wood',
            x: worldX - 50,
            y: worldY - 30,
            r: 18,
            hp: 26,
            maxHp: 26,
            hitFlash: 0,
            label: '荒原枯木',
            drops: { wood: 4 },
          },
          {
            uid: uid('prop'),
            kind: 'wood_crate',
            mat: 'wood',
            x: worldX + 45,
            y: worldY + 25,
            r: 18,
            hp: 24,
            maxHp: 24,
            hitFlash: 0,
            label: '遗落木箱',
            drops: { wood: 3, rawFood: 2, water: 1 },
          }
        );
        if (h2 > 0.5) {
          w.props.push({
            uid: uid('prop'),
            kind: 'seed_cache',
            mat: 'wood',
            x: worldX + 12,
            y: worldY - 68,
            r: 20,
            hp: 28,
            maxHp: 28,
            hitFlash: 0,
            label: '野生种子箱',
            drops: { seeds: 3, rawFood: 2 },
          });
        }
        w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX - 10, worldY + 75, false, outerTier));
      }
    }
  }
}

// --- Main Real-Time Simulation Tick ---
export function stepWorld(w: WorldState, input: InputState, rawDt: number): void {
  if (w.gameOver || w.deathReport) return;
  const dt = Math.min(rawDt, 0.05);
  w.shake = Math.max(0, w.shake - 24 * dt);

  // Brief impact hit-stop freeze for juicy harvest/combat feel (#9)!
  if (w.hitStop > 0) {
    w.hitStop = Math.max(0, w.hitStop - dt);
    return;
  }

  w.time += dt;
  w.lightningFlash = Math.max(0, w.lightningFlash - dt * 2.5);
  if (w.zoneBanner) {
    w.zoneBanner.timer -= dt;
    if (w.zoneBanner.timer <= 0) w.zoneBanner = null;
  }
  updateLostWorldExploration(w, dt);

  // Decay hull, barrier & prop hit flashes/bounces
  for (const { panel } of getAllHullPanels(w)) {
    panel.hitFlash = Math.max(0, panel.hitFlash - dt);
  }
  for (const bar of w.stationBarriers) {
    bar.hitFlash = Math.max(0, bar.hitFlash - dt);
  }
  for (const pr of w.props) {
    pr.hitFlash = Math.max(0, pr.hitFlash - dt);
    if ((pr.hitBounce ?? 0) > 0) {
      pr.hitBounce = Math.max(0, (pr.hitBounce ?? 0) - dt);
      pr.hitOffX = (pr.hitOffX ?? 0) * 0.8;
      pr.hitOffY = (pr.hitOffY ?? 0) * 0.8;
    }
  }

  // 0. Day / Night Cycle & Extreme Weather (#3)
  const prevNight = isNight(w);
  w.dayTime += dt / DAY_LENGTH;
  if (w.dayTime >= 1) {
    w.dayTime -= 1;
    w.dayCount++;
    addFloat(w, w.player.x, w.player.y - 44, `🌅 第 ${w.dayCount} 天黎明降临`, '#ffd56b');
  }
  const nowNight = isNight(w);
  if (!prevNight && nowNight) {
    w.nightWavesLeft = 2; // Finite 2 night waves per night, never endless!
    w.nightWaveTimer = 18;
    sfx.alert();
    addFloat(w, w.player.x, w.player.y - 44, '🌙 深夜降临！关好车门，远方荒原传来怪物嚎叫！', '#ff8787');
  } else if (prevNight && !nowNight) {
    w.nightWavesLeft = 0;
    w.survivedHarshEvent = true;
  }

  w.weatherTimer -= dt;
  if (w.weatherTimer <= 0) {
    const prevW = w.weather;
    if (prevW === 'clear') {
      w.weather = Math.random() < 0.52 ? 'rainstorm' : 'blizzard';
      w.weatherTimer = 75;
      sfx.alert();
      if (w.weather === 'rainstorm') {
        sfx.thunder();
        w.lightningFlash = 0.8;
        addFloat(w, w.player.x, w.player.y - 44, '⛈ 荒原暴雨袭来！接水斗狂蓄水，户外能见度骤降', '#74c0fc');
      } else {
        addFloat(w, w.player.x, w.player.y - 44, '❄ 暴风雪降临！立刻关紧车门并靠近锅炉/炉灶取暖！', '#a5d8ff');
      }
    } else {
      w.weather = 'clear';
      w.weatherTimer = 180;
      w.survivedHarshEvent = true;
      addFloat(w, w.player.x, w.player.y - 40, '🌤 极端天气渐渐平息', '#ffe8b6');
    }
  }
  if (w.weather === 'rainstorm' && Math.random() < dt * 0.14) {
    w.lightningFlash = 0.75;
    sfx.thunder();
  }

  const p = w.player;
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.swingTimer = Math.max(0, p.swingTimer - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);

  // 1. Survival Stats (Hunger, Thirst, Body Temperature during Blizzard)
  if (p.wellFedTimer > 0) {
    p.wellFedTimer = Math.max(0, p.wellFedTimer - dt);
    p.maxStamina = 150;
    p.hp = Math.min(p.maxHp, p.hp + 1.2 * dt);
  } else {
    p.maxStamina = 100;
  }
  p.hunger = Math.max(0, p.hunger - 0.25 * dt);
  p.thirst = Math.max(0, p.thirst - 0.3 * dt);

  // Temperature check: near lit boiler/campfire OR inside sealed car!
  let nearHeat = w.boilerFuel > 0 && Math.hypot(p.x - 54, p.y + 28) < 115;
  if (!nearHeat) {
    for (const car of w.flatbeds) {
      for (const b of car.buildings) {
        if (b.type === 'campfire') {
          const c = getTileCenter(b.carIdx, b.col, b.row);
          if (Math.hypot(p.x - c.x, p.y - c.y) < 115) {
            nearHeat = true;
            break;
          }
        }
      }
      if (nearHeat) break;
    }
  }
  const carUnderPlayer = getCarIndexAtPoint(w, p.x, p.y);
  const shelteredSealed = carUnderPlayer !== null && isCarSealed(w, carUnderPlayer);

  if (w.weather === 'blizzard') {
    if (nearHeat) p.bodyTemp = Math.min(100, p.bodyTemp + 14 * dt);
    else if (shelteredSealed) p.bodyTemp = Math.min(100, p.bodyTemp + 3.5 * dt);
    else if (carUnderPlayer !== null) p.bodyTemp = Math.max(0, p.bodyTemp - 2.4 * dt); // open door/breach!
    else p.bodyTemp = Math.max(0, p.bodyTemp - 5.5 * dt); // outside in blizzard!
  } else if (w.weather === 'rainstorm' && nowNight && carUnderPlayer === null) {
    p.bodyTemp = Math.max(0, p.bodyTemp - 1.6 * dt);
  } else {
    p.bodyTemp = Math.min(100, p.bodyTemp + (nearHeat ? 15 : 8) * dt);
  }

  if (p.hunger <= 0 || p.thirst <= 0) p.hp = Math.max(0, p.hp - 1.4 * dt);
  if (p.bodyTemp <= 0) p.hp = Math.max(0, p.hp - 2.6 * dt);

  // Low-vital audio + floating alerts so player never dies unnoticed!
  w.vitalWarnCd.hp = Math.max(0, w.vitalWarnCd.hp - dt);
  w.vitalWarnCd.hunger = Math.max(0, w.vitalWarnCd.hunger - dt);
  w.vitalWarnCd.thirst = Math.max(0, w.vitalWarnCd.thirst - dt);
  w.vitalWarnCd.temp = Math.max(0, w.vitalWarnCd.temp - dt);
  if (p.hp > 0 && p.hp <= 30 && w.vitalWarnCd.hp <= 0) {
    w.vitalWarnCd.hp = 8;
    sfx.alert();
    addFloat(w, p.x, p.y - 34, '🩸 警告：生命垂危！按 4 进食/喝魔药或休息！', '#ff5252');
  } else if (p.hunger <= 25 && w.vitalWarnCd.hunger <= 0) {
    w.vitalWarnCd.hunger = 10;
    sfx.alert();
    addFloat(w, p.x, p.y - 34, p.hunger <= 0 ? '🍖 警告：饥饿归零正在掉血！快按 4 吃东西！' : '🍖 提示：饱食度很低，请尽快按 4 进食', '#ff922b');
  } else if (p.thirst <= 25 && w.vitalWarnCd.thirst <= 0) {
    w.vitalWarnCd.thirst = 10;
    sfx.alert();
    addFloat(w, p.x, p.y - 34, p.thirst <= 0 ? '💧 警告：严重脱水正在掉血！快按 4 喝水！' : '💧 提示：水分很低，请尽快按 4 喝水', '#74c0fc');
  } else if (p.bodyTemp <= 35 && w.vitalWarnCd.temp <= 0) {
    w.vitalWarnCd.temp = 10;
    sfx.alert();
    addFloat(w, p.x, p.y - 34, p.bodyTemp <= 0 ? '🥶 警告：严重失温正在掉血！速回锅炉/熔炉旁！' : '🥶 提示：体温过低，请回封闭车厢取暖', '#a5d8ff');
  }

  // 2. Player Movement (Smooth velocity + push-out collision resolution so player NEVER gets stuck!)
  p.angle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);

  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(mx, my);
  if (mag > 0) {
    mx /= mag;
    my /= mag;
    const sprinting = input.sprint && p.stamina > 5;
    const coldMult = p.bodyTemp < 25 ? 0.72 : 1.0;
    const baseSpeed = (p.wellFedTimer > 0 ? 195 : 164) * (sprinting ? 1.4 : 1.0) * coldMult;
    if (sprinting) p.stamina = Math.max(0, p.stamina - 22 * dt);
    else p.stamina = Math.min(p.maxStamina, p.stamina + 14 * dt);

    p.x += mx * baseSpeed * dt;
    p.y += my * baseSpeed * dt;
  } else {
    p.stamina = Math.min(p.maxStamina, p.stamina + 26 * dt);
  }
  resolvePlayerCollisions(w);

  if (input.mouseDown && !w.buildMode && w.hotbar !== 3 && w.hotbar !== 4 && w.hotbar !== 5) {
    handlePrimaryAction(w, input.mouseWorldX, input.mouseWorldY);
  }

  // 3. Train Momentum, Speed-Scaled Boiler Burn, City Escape, Railway Routes & Wasteland Stop Siege
  const overloaded = isOverloaded(w);
  if (overloaded && w.gear === 3) w.gear = 2;
  if (w.boilerFuel <= 0 && w.gear > 0) {
    w.gear = 0;
    addFloat(w, 54, -40, '⛽ 锅炉燃尽熄火！快向锅炉添燃料或用熔炉烧木炭！', '#ff8787');
    sfx.alert();
  }

  if (w.mode === 'station' && w.gear > 0) {
    if (!w.selectedRoute) {
      w.gear = 0;
      w.routeOpen = true;
      addFloat(w, p.x, p.y - 24, '🗺 请先选定下一个目标站点再发车！', '#ffd56b');
    } else if (!isPointOnTrain(w, p.x, p.y, 18)) {
      w.gear = 0;
      addFloat(w, p.x, p.y - 24, '先回到车上再发车！', '#ffd56b');
    }
  }

  const targetSpeed = GEAR_SPEEDS[w.gear];
  const accel = targetSpeed > w.trainSpeed ? 65 : 130;
  if (w.trainSpeed < targetSpeed) w.trainSpeed = Math.min(targetSpeed, w.trainSpeed + accel * dt);
  else if (w.trainSpeed > targetSpeed) w.trainSpeed = Math.max(targetSpeed, w.trainSpeed - accel * dt);

  if (w.trainSpeed > 1) {
    const dx = w.trainSpeed * dt;
    const dm = dx / 18; // ~18 px = 1m
    w.worldScrollX += dx;
    w.totalDistance += dm;

    // Speed-scaled fuel burn: fast gear (3) burns 1.55x fuel to arrive quicker!
    const weightFactor = Math.max(0.75, 0.65 + getTrainWeight(w) / 14);
    const overloadMult = overloaded ? 1.3 : 1.0;
    const stormDrag = w.weather === 'blizzard' ? 1.12 : 1.0;
    const speedMult = GEAR_FUEL_MULT[w.gear] || 1.0;
    // During city escape opening, minimal burn so player never stalls before reaching Exile Lands
    const escapeDiscount = w.mode === 'city_escape' ? 0.5 : 1.0;
    const fuelUsed = (dm / 100) * weightFactor * overloadMult * stormDrag * speedMult * escapeDiscount;
    w.boilerFuel = Math.max(0, w.boilerFuel - fuelUsed);

    // Crude Coupler Wear while driving (#4)!
    for (let i = w.flatbeds.length - 1; i >= 0; i--) {
      const car = w.flatbeds[i];
      if (car.couplerKind !== 'crude') continue;
      const wearRate = w.gear === 3 ? 3.2 : w.gear === 2 ? 1.45 : 0.55;
      car.couplerHp = Math.max(0, car.couplerHp - wearRate * dt);
      car.couplerWarnCd = Math.max(0, car.couplerWarnCd - dt);
      const b = getCarBounds(i);
      const cx = b.right + COUPLER_GAP / 2;
      if (car.couplerHp < 42 && Math.random() < dt * 7) {
        spawnParticles(w, cx, 0, '#ffae42', 2, 110);
      }
      if (car.couplerHp < 35 && car.couplerWarnCd <= 0) {
        car.couplerWarnCd = 6;
        sfx.couplerWarn();
        addFloat(w, cx, -32, `⚠ 第${i + 1}节土制车钩松动(${Math.round(car.couplerHp)}%)！快检修！`, '#ff8787');
      }
      if (car.couplerHp <= 0) {
        // Coupler snaps! Detach this car & any behind it!
        const detachedCount = w.flatbeds.length - i;
        w.flatbeds.splice(i);
        if (p.x < b.right) {
          p.x = Math.max(b.right + 28, 30);
          p.y = 0;
        }
        w.gear = 0;
        w.trainSpeed *= 0.2;
        w.shake = 18;
        sfx.crash();
        spawnParticles(w, cx, 0, '#ff5252', 28, 220);
        addFloat(w, cx, -38, `💥 土制车钩断裂！后方 ${detachedCount} 节车厢脱钩遗失！`, '#ff5252');
        break;
      }
    }

    // Smokestack puffs & chug SFX
    w.chugTimer -= dt * (w.trainSpeed / 100);
    if (w.chugTimer <= 0) {
      w.chugTimer = 0.34;
      sfx.chug();
      w.particles.push({
        x: 115,
        y: -30,
        vx: -w.trainSpeed * 0.65,
        vy: -25 - Math.random() * 20,
        life: 0.7,
        maxLife: 0.7,
        size: 8 + Math.random() * 6,
        color: 'rgba(210, 200, 188, 0.45)',
      });
    }

    w.stationAnchorX -= dx;
    w.biomeSeamX -= dx;
    w.cityExitX -= dx;
    for (const pr of w.props) pr.x -= dx;
    for (const rd of w.stationRoads) rd.x -= dx;
    for (const rm of w.stationRooms) rm.x -= dx;
    for (const wl of w.stationWalls) wl.x -= dx;
    for (const br of w.stationBarriers) br.x -= dx;
    for (const h of w.trackHazards) h.x -= dx;
    for (const m of w.monsters) if (!m.onTrain) m.x -= dx;
    for (const pk of w.pickups) if (!pk.onTrain) pk.x -= dx;
    if (w.decoyPos) w.decoyPos.x -= dx;

    // Opening escape out of the burning metropolis -> seamlessly roll out of the city & into Exile Station 1!
    if (w.mode === 'city_escape') {
      w.legDistance += dm;
      const remPx = Math.max(0, (w.legTotal - w.legDistance) * 18);

      // Once clear of the burning city outskirts, stream Exile Lands biome & Station 1 physically ahead on the rails!
      if (!w.stationStreamed && remPx <= 2200) {
        w.stationStreamed = true;
        w.prevZoneKind = 'fallen_city';
        w.biomeSeamX = Math.max(920, remPx - STATION_BOUND_X + 120);
        enterZone(w, 'exile', 1);
        buildStationMap(w, 'exile', 1, '站1 · 流放之城（废墟边缘）', remPx, false);
        addFloat(w, p.x, p.y - 36, '🏚 已驶出燃烧大城，前方即将进入流放之城！', '#ffd56b');
      }

      // Smooth roll-in station braking over the final 220px so arrival feels physical, never an instant stop
      if (w.stationStreamed && w.stationAnchorX < 220 && w.stationAnchorX > 0) {
        const approachCap = Math.max(30, (w.stationAnchorX / 220) * GEAR_SPEEDS[1]);
        w.trainSpeed = Math.min(w.trainSpeed, approachCap);
      }

      if ((w.stationStreamed && w.stationAnchorX <= 4) || w.legDistance >= w.legTotal) {
        if (!w.stationStreamed) {
          w.prevZoneKind = 'fallen_city';
          w.biomeSeamX = -2000;
          enterZone(w, 'exile', 1);
          buildStationMap(w, 'exile', 1, '站1 · 流放之城（废墟边缘）', 0, false);
        }
        w.mode = 'station';
        w.stationIdx = 0;
        w.stats.stationsReached = 1;
        w.gear = 0;
        w.trainSpeed = 0;
        w.legDistance = 0;
        w.stationStreamed = false;
        sfx.questDone();
        addFloat(w, p.x, p.y - 36, '🏚 列车稳稳停靠流放之城站台！按 E 开门下车探索', '#ffd56b');
      }
    }

    // Leave station physically: cross-fade into the chosen route's biome as city suburbs scroll behind!
    if (w.mode === 'station' && w.selectedRoute) {
      if (w.stationAnchorX < -420 && (w.zoneKind !== w.selectedRoute.zone || w.zoneTier !== w.selectedRoute.tier)) {
        w.prevZoneKind = w.zoneKind;
        w.biomeSeamX = 1120;
        enterZone(w, w.selectedRoute.zone, w.selectedRoute.tier);
      }
      if (w.stationAnchorX < -1480) {
        const route = w.selectedRoute;
        w.mode = 'wasteland';
        w.props = [];
        w.stationRoads = [];
        w.stationRooms = [];
        w.stationWalls = [];
        w.stationBarriers = [];
        w.monsters = w.monsters.filter((m) => m.onTrain);
        w.legDistance = 0;
        w.legTotal = route.distance;
        w.stationStreamed = false;
        w.hazardSpawnTimer = 11;
        w.drivingRaidTimer = 15;
        w.wastelandStopTimer = 0;
        if (w.zoneKind !== route.zone || w.zoneTier !== route.tier) {
          w.prevZoneKind = w.zoneKind;
          w.biomeSeamX = 950;
          enterZone(w, route.zone, route.tier);
        }
      }
    }

    if (w.mode === 'wasteland') {
      w.legDistance += dm;
      w.wastelandStopTimer = 0;
      const remPx = Math.max(0, (w.legTotal - w.legDistance) * 18);

      // Driving boarding raids (stop spawning new raids once destination city is in sight)
      w.drivingRaidTimer -= dt;
      if (w.drivingRaidTimer <= 0 && w.monsters.length < 7 && !w.stationStreamed && w.legTotal - w.legDistance > 130) {
        w.drivingRaidTimer = Math.max(13, 22 - w.zoneTier * 1.8) + Math.random() * 6;
        const count = w.zoneKind === 'monster' ? 2 : 1;
        const fromNorth = Math.random() < 0.5;
        for (let i = 0; i < count; i++) {
          const k = pickZoneEnemyKind(w.zoneKind, w.zoneTier);
          w.monsters.push(createMonster(k, 420 + i * 55, fromNorth ? -360 : 360, false, w.zoneTier));
        }
        sfx.alert();
        addFloat(w, p.x, p.y - 44, '⚠ 荒原怪物正加速追赶列车，准备迎击跳帮！', '#ff8787');
      }

      // Seamlessly pre-spawn destination station physically ahead on the rails!
      if (!w.stationStreamed && w.selectedRoute && remPx <= 2200) {
        const dest = w.selectedRoute;
        w.stationStreamed = true;
        w.stationIdx++;
        w.trackHazards = w.trackHazards.filter((h) => h.x < remPx - STATION_BOUND_X - 180);
        buildStationMap(w, dest.zone, dest.tier, dest.stationName, remPx, true);
        addFloat(w, p.x, p.y - 40, `🏁 前方进入 ${dest.stationName} 外围城区，准备进站！`, '#9ef0a8');
      }

      // Gentle automatic station roll-in deceleration over the final 240px
      if (w.stationStreamed && w.stationAnchorX < 240 && w.stationAnchorX > 0) {
        const approachCap = Math.max(32, (w.stationAnchorX / 240) * Math.max(GEAR_SPEEDS[1], w.trainSpeed));
        w.trainSpeed = Math.min(w.trainSpeed, approachCap);
      }

      if (((w.stationStreamed && w.stationAnchorX <= 4) || w.legDistance >= w.legTotal) && w.selectedRoute) {
        const dest = w.selectedRoute;
        if (!w.stationStreamed) {
          w.stationIdx++;
          buildStationMap(w, dest.zone, dest.tier, dest.stationName, 0, true);
        }
        w.mode = 'station';
        w.stats.stationsReached++;
        w.gear = 0;
        w.trainSpeed = 0;
        w.trackHazards = [];
        w.wastelandStopTimer = 0;
        w.stationStreamed = false;
        w.availableRoutes = buildNextRoutes(w.stationIdx);
        w.selectedRoute = null;
        sfx.questDone();
        addFloat(w, p.x, p.y - 36, `🏁 列车平稳停靠 ${w.stationName}！`, '#9ef0a8');
      }
    }
  } else if (w.mode === 'wasteland') {
    // Stopping mid-wasteland before reaching destination summons strong, numerous wasteland siege monsters!
    w.wastelandStopTimer += dt;
    if (w.wastelandStopTimer > 3.5) {
      w.wastelandSiegeCd -= dt;
      if (w.wastelandSiegeCd <= 0 && w.monsters.length < 13) {
        w.wastelandSiegeCd = 7.0;
        const siegeTier = Math.min(5, w.zoneTier + 1) as ZoneTier;
        const count = 2 + (w.wastelandStopTimer > 14 ? 2 : 1);
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
          const sx = Math.cos(ang) * 520;
          const sy = Math.sin(ang) * 380;
          w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, siegeTier), sx, sy, false, siegeTier));
        }
        sfx.alert();
        addFloat(w, p.x, p.y - 46, '🚨 荒野停车极度危险！大批强化怪物正围攻列车！', '#ff5252');
      }
    }
  }

  // 4. Buildings Update
  const isRaining = w.weather === 'rainstorm';
  for (const car of w.flatbeds) {
    for (const b of car.buildings) {
      b.hitFlash = Math.max(0, (b.hitFlash ?? 0) - dt);
      const c = getTileCenter(b.carIdx, b.col, b.row);

      if (b.type === 'planter' && b.planted && (b.growth ?? 0) < 100) {
        if (isRaining) b.watered = Math.max(b.watered ?? 0, 5);
        const coldFactor = w.weather === 'blizzard' && !isCarSealed(w, b.carIdx) ? 0.35 : 1.0;
        const speed = ((b.watered ?? 0) > 0 ? 4.2 : 1.6) * coldFactor;
        b.watered = Math.max(0, (b.watered ?? 0) - dt);
        b.growth = Math.min(100, (b.growth ?? 0) + speed * dt);
      }

      if (b.type === 'rain_collector' && isRaining) {
        b.storedWater = Math.min(6, (b.storedWater ?? 0) + 0.55 * dt);
      }

      // Active Furnace Smelting (continues burning while train is driving!)
      if (b.type === 'campfire' && (b.smeltQueue ?? 0) > 0 && b.smeltKind) {
        b.smeltProgress = (b.smeltProgress ?? 0) + 16.5 * dt; // ~6s per batch
        if (Math.random() < dt * 4) spawnParticles(w, c.x, c.y - 6, '#ffae42', 1, 35);
        if (b.smeltProgress >= 100) {
          b.smeltProgress = 0;
          b.smeltQueue = Math.max(0, (b.smeltQueue ?? 1) - 1);
          if (b.smeltKind === 'food') {
            giveItem(w, 'cookedFood', 2);
            addFloat(w, c.x, c.y - 18, '🥖 熔炉出炉：热麦饼 ×2！', '#ffd56b');
          } else {
            giveItem(w, 'fuel', 2);
            addFloat(w, c.x, c.y - 18, '⛽ 熔炉烧成：木炭燃料 ×2！', '#ffae42');
          }
          sfx.pickup();
          if (b.smeltQueue <= 0) b.smeltKind = null;
        }
      }

      if (b.onFire) {
        b.hp -= 3.5 * dt;
        if (Math.random() < 0.2) spawnParticles(w, c.x, c.y, '#ff6b2b', 1, 50);
      }

      if (b.type === 'turret') {
        const cd = Number.isFinite(b.turretCooldown) ? (b.turretCooldown as number) : 0;
        b.turretCooldown = Math.max(0, cd - dt);
        let best: MonsterEntity | null = null;
        let bestD = 420;
        for (const m of w.monsters) {
          if (m.hp <= 0) continue;
          const d = Math.hypot(m.x - c.x, m.y - c.y);
          if (d < bestD) {
            bestD = d;
            best = m;
          }
        }
        if (best) {
          const ang = Math.atan2(best.y - c.y, best.x - c.x);
          b.turretAngle = ang;
          if (b.turretCooldown <= 0) {
            b.turretCooldown = 0.55;
            w.projectiles.push({
              x: c.x + Math.cos(ang) * 20,
              y: c.y + Math.sin(ang) * 20,
              vx: Math.cos(ang) * 620,
              vy: Math.sin(ang) * 620,
              dmg: 16,
              ttl: 0.85,
              fromTurret: true,
            });
            sfx.turret();
            spawnParticles(w, c.x + Math.cos(ang) * 20, c.y + Math.sin(ang) * 20, '#ffd56b', 3, 120, ang);
          }
        }
      }
    }
    car.buildings = car.buildings.filter((b) => {
      if (b.hp <= 0) {
        const c = getTileCenter(b.carIdx, b.col, b.row);
        if (w.openChestUid === b.uid) w.openChestUid = null;
        if (b.chestGrid) {
          for (const it of b.chestGrid.items) if (it.count > 0) spawnPickup(w, it.key, it.count, c.x, c.y, true);
        }
        spawnParticles(w, c.x, c.y, '#ff6b6b', 14, 140);
        addFloat(w, c.x, c.y - 14, `💥 ${BUILDINGS[b.type].short} 被摧毁！`, '#ff6b6b');
        sfx.crash();
        return false;
      }
      return true;
    });
  }

  // 5. Companion NPC
  if (w.companion) updateCompanion(w, w.companion, dt);

  // 6. Track Hazards & Finite Off-Screen Night Waves (no pop-in, no endless spawning!)
  if (w.mode === 'wasteland' && !w.stationStreamed && w.trainSpeed > 15) {
    w.hazardSpawnTimer -= dt;
    if (w.hazardSpawnTimer <= 0 && w.legTotal - w.legDistance > 135) {
      w.hazardSpawnTimer = 14 + Math.random() * 8;
      const isBroken = Math.random() < 0.5;
      w.trackHazards.push({
        uid: uid('hz'),
        kind: isBroken ? 'broken' : 'loose',
        x: 1120,
        width: isBroken ? 92 : 160,
        triggered: false,
        repaired: false,
        alerted: false,
      });
    }
  }

  // Finite night waves: spawn far off-screen beyond camera viewport, max 2 waves per night!
  if (nowNight && w.mode !== 'city_escape' && w.nightWavesLeft > 0) {
    w.nightWaveTimer -= dt;
    if (w.nightWaveTimer <= 0 && w.monsters.length < 7) {
      w.nightWavesLeft--;
      w.nightWaveTimer = 95;
      const count = 2 + (w.dayCount >= 2 ? 1 : 0) + (w.zoneKind === 'monster' ? 1 : 0);
      const fromNorth = Math.random() < 0.5;
      for (let i = 0; i < count; i++) {
        const kind = pickZoneEnemyKind(w.zoneKind, w.zoneTier);
        const offX = w.cameraX + (Math.random() < 0.5 ? -880 - i * 45 : 880 + i * 45);
        const offY = fromNorth ? -580 - Math.random() * 80 : 580 + Math.random() * 80;
        w.monsters.push(createMonster(kind, offX, offY, false, w.zoneTier));
      }
      addFloat(w, p.x, p.y - 42, '👾 远方夜幕中冲出一股夜袭怪物！快关好车门！', '#ff8787');
      sfx.alert();
    }
  }

  // Night No-Lantern Darkness Threat: wandering outside at night without carried lantern spawns more & stronger monsters with distance!
  const outsideInDarkNoLantern =
    nowNight && w.mode !== 'city_escape' && !isPointOnTrain(w, p.x, p.y, 18) && !playerHasActiveLantern(w);
  if (outsideInDarkNoLantern) {
    const dist = distToTrainDeck(w, p.x, p.y);
    w.darkThreatLevel = Math.min(1, dist / 340);
    w.darkThreatTimer -= dt;
    if (w.darkThreatTimer <= 0 && w.monsters.length < 15) {
      // Farther from train => much faster spawns, larger packs, and stronger dark-empowered monsters!
      w.darkThreatTimer = Math.max(2.4, 8.2 - dist / 65);
      const bonusCount = dist > 260 ? 3 : dist > 140 ? 2 : 1;
      const powerMult = 1 + Math.min(1.1, dist / 300);
      const spawnTier = Math.min(5, w.zoneTier + (dist > 220 ? 1 : 0)) as ZoneTier;
      for (let i = 0; i < bonusCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const m = createMonster(
          pickZoneEnemyKind(w.zoneKind === 'exile' ? 'monster' : w.zoneKind, spawnTier),
          p.x + Math.cos(a) * (270 + i * 35),
          p.y + Math.sin(a) * (270 + i * 35),
          false,
          spawnTier
        );
        m.maxHp = Math.round(m.maxHp * powerMult);
        m.hp = m.maxHp;
        m.dps = Math.round(m.dps * (1 + (powerMult - 1) * 0.65));
        m.speed += Math.round(20 * w.darkThreatLevel);
        w.monsters.push(m);
      }
      sfx.alert();
      addFloat(w, p.x, p.y - 46, '🌑 黑暗吞噬！未携提灯且远离列车，大批强敌蜂拥而至！', '#ff5252');
    }
  } else {
    w.darkThreatLevel = Math.max(0, w.darkThreatLevel - dt * 2);
    w.darkThreatTimer = Math.min(5, w.darkThreatTimer + dt * 0.5);
  }

  // Track Hazard Collisions
  for (const h of w.trackHazards) {
    if (!h.alerted && h.x < 880) {
      h.alerted = true;
      sfx.alert();
      addFloat(
        w,
        LOCO_W + 40,
        -48,
        h.kind === 'broken' ? '🚨 前方断裂地裂！立刻刹车并去车头铺轨！' : '⚠ 前方松动铁轨！减速至常速以下！',
        h.kind === 'broken' ? '#ff6b6b' : '#ffd56b'
      );
    }

    if (!h.triggered && !h.repaired && h.x <= LOCO_W && h.x + h.width >= 40) {
      if (h.kind === 'loose' && w.trainSpeed > GEAR_SPEEDS[2] + 15) {
        h.triggered = true;
        w.shake = 12;
        w.locoHp = Math.max(10, w.locoHp - 22);
        w.trainSpeed *= 0.4;
        w.gear = 1;
        // Loose tracks hit crude couplers hard!
        for (const car of w.flatbeds) {
          if (car.couplerKind === 'crude') car.couplerHp = Math.max(5, car.couplerHp - 26);
        }
        sfx.crash();
        spawnParticles(w, LOCO_W, 0, '#ffae42', 18, 180);
        addFloat(w, LOCO_W, -32, '💥 松动铁轨超速颠簸！车头 -22 耐久', '#ff6b6b');
      } else if (h.kind === 'broken' && w.trainSpeed > 35) {
        h.triggered = true;
        h.repaired = true;
        w.shake = 18;
        w.locoHp = Math.max(10, w.locoHp - 42);
        w.trainSpeed = 0;
        w.gear = 0;
        sfx.crash();
        spawnParticles(w, LOCO_W, 0, '#ff5252', 26, 220);
        addFloat(w, LOCO_W, -36, '💥 未铺轨撞入断轨！严重脱轨车头 -42 耐久！', '#ff5252');
      }
    }
  }
  w.trackHazards = w.trackHazards.filter((h) => h.x + h.width > -900);
  if (w.mode !== 'station') {
    w.props = w.props.filter((pr) => pr.hp > 0 && (pr.x > -2400 || Math.hypot(pr.x - p.x, pr.y - p.y) < 1600));
  } else {
    w.props = w.props.filter((pr) => pr.hp > 0);
  }

  // 7. Decoy Timer
  if (w.decoyPos) {
    w.decoyPos.ttl -= dt;
    if (w.decoyPos.ttl <= 0) w.decoyPos = null;
  }

  // 8. Monster AI (Must enter through open doors or chew through outer car hull panels!)
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.attackCd = Math.max(0, m.attackCd - dt);

    if (w.hasBumper && w.trainSpeed >= GEAR_SPEEDS[3] - 20 && Math.hypot(m.x - (LOCO_W + 18), m.y) < 42) {
      damageMonster(w, m, 999, 240, 0);
      w.shake = 9;
      addFloat(w, LOCO_W + 20, -24, '💥 撞角碾碎！', '#ffd56b');
      continue;
    }

    let tx = p.x;
    let ty = p.y;
    let targetBuilding: PlacedBuilding | null = null;

    if (w.decoyPos) {
      tx = w.decoyPos.x;
      ty = w.decoyPos.y;
    } else if (m.kind === 'burrower') {
      for (const car of w.flatbeds) {
        const pl = car.buildings.find((b) => b.type === 'planter');
        if (pl) {
          targetBuilding = pl;
          const c = getTileCenter(pl.carIdx, pl.col, pl.row);
          tx = c.x;
          ty = c.y;
          break;
        }
      }
    } else if (((!nowNight && w.mode === 'station') || w.stationStreamed) && !isPointOnTrain(w, m.x, m.y) && Math.hypot(p.x - m.x, p.y - m.y) > 290) {
      tx = m.x + Math.cos(w.time + m.r) * 20;
      ty = m.y + Math.sin(w.time + m.r) * 20;
    }

    // If monster is outside and target is inside train, prioritize steering through open doors (or breaches) first!
    let steeringToOpenEntry = false;
    if (!m.onTrain && getCarIndexAtPoint(w, tx, ty) !== null) {
      const wp = getMonsterOpenEntryWaypoint(w, m);
      if (wp) {
        tx = wp.x;
        ty = wp.y;
        steeringToOpenEntry = true;
      }
    }

    const dx = tx - m.x;
    const dy = ty - m.y;
    const dist = Math.hypot(dx, dy);

    m.vx *= 0.85;
    m.vy *= 0.85;

    let stepX = m.vx * dt;
    let stepY = m.vy * dt;
    if (dist > 6) {
      const nightSpeedMult = nowNight ? 1.18 : 1.0;
      const moveSp = (!m.onTrain && w.trainSpeed > 0 ? m.speed + 145 : m.speed) * nightSpeedMult;
      stepX += (dx / dist) * moveSp * dt;
      stepY += (dy / dist) * moveSp * dt;
    }

    const nx = m.x + stepX;
    const ny = m.y + stepY;

    // First check outer car hull panel collision!
    const hitHull = findBlockingHull(w, nx, ny, m.r - 2);
    if (hitHull) {
      // If steering toward an open door, slide along the hull toward the door instead of chewing the wall!
      if (steeringToOpenEntry) {
        if (!findBlockingHull(w, nx, m.y, m.r - 2)) m.x = nx;
        else if (!findBlockingHull(w, m.x, ny, m.r - 2)) m.y = ny;
      } else if (m.attackCd <= 0) {
        m.attackCd = 0.82;
        hitHull.panel.hp = Math.max(0, hitHull.panel.hp - m.dps);
        hitHull.panel.hitFlash = 0.16;
        sfx.hitMetal();
        spawnParticles(w, hitHull.cx, hitHull.cy, '#ff914d', 5, 95);
        if (hitHull.panel.hp <= 0) {
          sfx.breakMetal();
          w.shake = Math.max(w.shake, 7);
          spawnParticles(w, hitHull.cx, hitHull.cy, '#ff5252', 16, 155);
          addFloat(w, hitHull.cx, hitHull.cy - 20, '🚨 怪物撞破车体外壳！快修补！', '#ff5252');
        }
      }
    } else {
      // Then check interior solid buildings
      let hitWall: PlacedBuilding | null = null;
      for (const car of w.flatbeds) {
        for (const b of car.buildings) {
          if (!BUILDINGS[b.type].solid || (b.type === 'door' && b.doorOpen)) continue;
          const c = getTileCenter(b.carIdx, b.col, b.row);
          if (Math.hypot(nx - c.x, ny - c.y) < TILE * 0.54 + m.r) {
            hitWall = b;
            break;
          }
        }
        if (hitWall) break;
      }

      if (hitWall) {
        if (m.attackCd <= 0) {
          m.attackCd = 0.8;
          hitWall.hp -= m.dps;
          hitWall.hitFlash = 0.15;
          if (hitWall.hp < hitWall.maxHp * 0.3 && Math.random() < 0.2) hitWall.onFire = true;
          const c = getTileCenter(hitWall.carIdx, hitWall.col, hitWall.row);
          sfx.hitMetal();
          spawnParticles(w, c.x, c.y, '#ff914d', 4, 90);
        }
      } else {
        // Also respect station building walls & closed barriers so vault guards stay sealed inside until opened!
        const blockedByStation =
          w.stationWalls.some(
            (wl) => nx + m.r > wl.x && nx - m.r < wl.x + wl.w && ny + m.r > wl.y && ny - m.r < wl.y + wl.h
          ) ||
          w.stationBarriers.some(
            (br) => !br.opened && nx + m.r > br.x && nx - m.r < br.x + br.w && ny + m.r > br.y && ny - m.r < br.y + br.h
          );
        if (!blockedByStation) {
          m.x = nx;
          m.y = ny;
          if (isPointOnTrain(w, m.x, m.y, -4)) m.onTrain = true;
        }
      }
    }

    if (targetBuilding && dist < 28 && m.attackCd <= 0) {
      m.attackCd = 0.9;
      targetBuilding.hp -= m.dps;
      targetBuilding.hitFlash = 0.15;
      if (targetBuilding.planted) {
        targetBuilding.planted = false;
        targetBuilding.growth = 0;
        addFloat(w, tx, ty - 16, '🌾 钻入者啃光了作物！', '#ff8787');
      }
      sfx.hitFlesh();
    }

    if (!w.decoyPos && p.invulnTimer <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + 16 && m.attackCd <= 0) {
      m.attackCd = 0.85;
      p.hp = Math.max(0, p.hp - m.dps);
      p.hitFlash = 0.2;
      w.shake = Math.max(w.shake, 7);
      sfx.hitFlesh();
      addFloat(w, p.x, p.y - 20, `-${m.dps}`, '#ff5252');
    }
  }
  w.monsters = w.monsters.filter((m) => m.hp > 0 && (m.x > -2400 || Math.hypot(m.x - p.x, m.y - p.y) < 1600));

  // 9. Projectiles
  for (const pr of w.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.ttl -= dt;
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      if (Math.hypot(m.x - pr.x, m.y - pr.y) < m.r + 8) {
        damageMonster(w, m, pr.dmg, pr.vx * 0.12, pr.vy * 0.12);
        pr.ttl = 0;
        break;
      }
    }
  }
  w.projectiles = w.projectiles.filter((pr) => pr.ttl > 0);

  // 10. Ground Pickups Physics ONLY (NO auto-vacuum / NO auto-pickup! Player manually picks & places in POE2 grid!)
  for (const pk of w.pickups) {
    pk.age += dt;
    pk.vx *= 0.86;
    pk.vy *= 0.86;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
  }
  if (w.mode !== 'station') {
    w.pickups = w.pickups.filter((pk) => pk.amount > 0 && (pk.x > -2400 || Math.hypot(pk.x - p.x, pk.y - p.y) < 1600));
  } else {
    w.pickups = w.pickups.filter((pk) => pk.amount > 0);
  }

  // 11. Particles & Floating Texts
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.91;
    pt.vy *= 0.91;
    pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);

  for (const fl of w.floats) {
    fl.y -= 26 * dt;
    fl.life -= dt;
  }
  w.floats = w.floats.filter((fl) => fl.life > 0);

  // 12. Camera Follow, Hints & Quests
  const targetCamX = p.x + (w.trainSpeed > 50 ? 110 : 0);
  const targetCamY = p.y;
  w.cameraX += (targetCamX - w.cameraX) * Math.min(1, dt * 6);
  w.cameraY += (targetCamY - w.cameraY) * Math.min(1, dt * 6);

  updateActiveHint(w);
  updateQuests(w);

  // 13. Check Death (#7: random carriage & item loss) vs Loco Destruction
  if (w.locoHp <= 0) {
    p.alive = false;
    w.gameOver = true;
    sfx.crash();
  } else if (p.hp <= 0) {
    handlePlayerDeath(w);
  }
}

function getMonsterOpenEntryWaypoint(w: WorldState, m: MonsterEntity): { x: number; y: number } | null {
  const all = getAllHullPanels(w);
  // Prefer open doors first; fall back to breached hull panels
  let entries = all.filter(({ panel }) => panel.isDoor && panel.doorOpen && panel.hp > 0);
  if (entries.length === 0) {
    entries = all.filter(({ carIdx, panel }) => panel.hp <= 0 && !isHullPassage(w, carIdx, panel));
  }
  if (entries.length === 0) return null;

  let best = entries[0];
  let bestSeg = getHullSegment(best.carIdx, best.panel);
  let bestD = Math.hypot(m.x - bestSeg.cx, m.y - bestSeg.cy);
  for (let i = 1; i < entries.length; i++) {
    const seg = getHullSegment(entries[i].carIdx, entries[i].panel);
    const d = Math.hypot(m.x - seg.cx, m.y - seg.cy);
    if (d < bestD) {
      bestD = d;
      best = entries[i];
      bestSeg = seg;
    }
  }

  const side = best.panel.side;
  const trainLeft = (w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0) - 34;
  const trainRight = LOCO_W + 34;

  if (side === 'top' || side === 'bottom') {
    const dir = side === 'top' ? -1 : 1;
    const outY = bestSeg.cy + dir * 26;
    const inY = bestSeg.cy - dir * 28;
    const sameSide = side === 'top' ? m.y <= -HALF_H + 4 : m.y >= HALF_H - 4;
    if (sameSide) {
      if (Math.abs(m.x - bestSeg.cx) <= 16) return { x: bestSeg.cx, y: inY };
      return { x: bestSeg.cx, y: side === 'top' ? Math.min(m.y, outY) : Math.max(m.y, outY) };
    }
    // Opposite side of train: walk around nearest train end to reach the open door's side!
    const endX = Math.abs(m.x - trainLeft) < Math.abs(m.x - trainRight) ? trainLeft : trainRight;
    if (m.x > trainLeft + 10 && m.x < trainRight - 10) {
      return { x: endX, y: m.y >= 0 ? Math.max(m.y, HALF_H + 28) : Math.min(m.y, -HALF_H - 28) };
    }
    return { x: endX, y: outY };
  }

  const dirX = side === 'left' ? -1 : 1;
  const outX = bestSeg.cx + dirX * 26;
  const inX = bestSeg.cx - dirX * 28;
  if (Math.abs(m.y - bestSeg.cy) <= 16) return { x: inX, y: bestSeg.cy };
  return { x: outX, y: bestSeg.cy };
}

function updateCompanion(w: WorldState, npc: CompanionNPC, dt: number): void {
  npc.actionTimer -= dt;
  let goalX = -110;
  let goalY = 0;
  let chore: PlacedBuilding | null = null;
  let choreType: 'harvest' | 'water' | 'repair' | 'idle' = 'idle';

  for (const car of w.flatbeds) {
    for (const b of car.buildings) {
      if (b.type === 'planter' && b.planted && (b.growth ?? 0) >= 100) {
        chore = b;
        choreType = 'harvest';
        break;
      }
      if (b.type === 'planter' && b.planted && (b.watered ?? 0) <= 1 && !chore) {
        chore = b;
        choreType = 'water';
      }
      if (b.hp < b.maxHp && !chore) {
        chore = b;
        choreType = 'repair';
      }
    }
    if (choreType === 'harvest') break;
  }

  if (chore) {
    const c = getTileCenter(chore.carIdx, chore.col, chore.row);
    goalX = c.x;
    goalY = c.y;
    npc.status = choreType === 'harvest' ? '收菜' : choreType === 'water' ? '浇水' : '修墙';
  } else {
    npc.status = '待命';
  }

  const dx = goalX - npc.x;
  const dy = goalY - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 14) {
    npc.x += (dx / dist) * 105 * dt;
    npc.y += (dy / dist) * 105 * dt;
  } else if (chore && npc.actionTimer <= 0) {
    npc.actionTimer = 1.5;
    if (choreType === 'harvest') {
      giveItem(w, 'rawFood', 3);
      giveItem(w, 'seeds', 1);
      chore.planted = true;
      chore.growth = 0;
      chore.watered = 30;
      addFloat(w, npc.x, npc.y - 18, '园丁收菜并补种！+3生粮', '#9ef0a8');
    } else if (choreType === 'water') {
      chore.watered = 45;
      addFloat(w, npc.x, npc.y - 18, '园丁浇水', '#74c0fc');
    } else if (choreType === 'repair') {
      chore.hp = Math.min(chore.maxHp, chore.hp + 15);
      addFloat(w, npc.x, npc.y - 18, '园丁修补 +15', '#74c0fc');
    }
  }
}
