import {
  BACKPACK_TIERS,
  ITEM_META,
  getUsedSlots,
  type BackpackTierDef,
  type ResourceKey,
  type SlotInventory,
  type SlotItem,
} from '../inventory';
import type { BuildingType } from '../recipes_v2';

export {
  BACKPACK_TIERS,
  ITEM_META,
  getUsedSlots,
  type BackpackTierDef,
  type ResourceKey,
  type SlotInventory,
  type SlotItem,
};

export const TILE = 44;
export const CAR_COLS = 6;
export const CAR_ROWS = 4;
export const CAR_W = CAR_COLS * TILE; // 264
export const CAR_H = CAR_ROWS * TILE; // 176
export const COUPLER_GAP = 26;
export const LOCO_COLS = 4;
export const LOCO_W = LOCO_COLS * TILE; // 176
export const LOCO_H = CAR_H; // 176
export const HALF_H = CAR_H / 2; // 88
export const DAY_LENGTH = 1200; // 20 min full day-night cycle
export const CITY_ESCAPE_METERS = 900; // ~3.7 min at 缓行, ~2 min at 常速
export const STATION_BOUND_X = 1280;
export const STATION_BOUND_Y = 980;
export const LANTERN_HOOK_X = 22;
export const LANTERN_HOOK_Y = 52;
/** Radius (world px) a set-down lantern lights; standing inside it counts as being lit. */
export const PLACED_LANTERN_RADIUS = 165;
export const BED_REST_HOURS = 4;
/**
 * Locomotive tiles that may hold a building: [col, row] on the 4×4 cab deck.
 * The boiler (cols 0-1 rows 0-1), the throttle (col 3 rows 1-2), the walkway from the
 * coupler and the tiles in front of both cab doors (col 1) stay clear.
 */
export const LOCO_BUILD_TILES: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [3, 0],
  [0, 3],
  [2, 3],
  [3, 3],
];

// Survival & Pacing Constants (Aligned with pending_fixes.md)
export const HUNGER_DRAIN_PER_SEC = 0.13; // ~12.8 min full drain (1.5-2 meals per 8-12 min leg)
export const THIRST_DRAIN_PER_SEC = 0.15; // ~11.1 min full drain (2-3 waters per 8-12 min leg)
export const PLANTER_GROWTH_WATERED = 100 / 330; // ~5.5 min to mature when watered
export const PLANTER_SEED_RETURN_CHANCE = 0.6; // 60% chance to retain seed on harvest
export const TURRET_RANGE = 260; // Reduced from 420 to 260 (pending_fixes #4)
export const OUTER_MAX_RING = 2; // Finite outer exploration capped at ring 2 (#3)
export const RAIL_LAY_DURATION = 2.0;
export const CONTAINER_SEARCH_DURATION = 1.25;
export const QUICKSTACK_HOLD_DURATION = 0.75;
export const EAT_HOLD_DURATION = 1.0;
export const UPGRADE_HOLD_DURATION = 0.9;
export const FINAL_STATION_IDX = 5;
export const SAVE_VERSION = 3;

export type GearLevel = 0 | 1 | 2 | 3; // 0=停车, 1=缓行, 2=常速, 3=全速
export const GEAR_LABELS = ['停车', '缓行', '常速', '全速'] as const;
export const GEAR_SPEEDS = [0, 72, 130, 205] as const; // px/sec (18 px = 1m => cruise 7.22 m/s)
export const GEAR_FUEL_MULT = [0, 0.85, 1.0, 1.55] as const;

export type HotbarSlot = 0 | 1 | 2 | 3 | 4 | 5;
/** What a hotbar slot holds. `null` = empty slot (left-click falls back to bare tool swing). */
export type HotbarBinding =
  | { kind: 'tool' }
  | { kind: 'ranged'; weapon: Exclude<RangedWeaponId, 'none'> }
  | { kind: 'item'; key: ResourceKey }
  | null;
export const HOTBAR_SIZE = 6;
export type WeatherKind = 'clear' | 'rainstorm' | 'blizzard' | 'sandstorm' | 'fog';
export type CouplerKind = 'standard' | 'crude';
export type HullSide = 'top' | 'bottom' | 'left' | 'right';
export type ZoneKind = 'fallen_city' | 'rust_plains' | 'monster_wastes' | 'ivy_city' | 'sinking_belt' | 'old_city';
export type ZoneTier = 1 | 2 | 3 | 4 | 5;
export type StationTemplate = 'abandoned_halt' | 'watertower_town' | 'predecessor_wreck';
export type WavePhase = 'calm' | 'omen' | 'danger';
export type ToolLevel = 1 | 2 | 3;
export type MeleeWeaponId = 'club' | 'axe';
export type RangedWeaponId = 'none' | 'crossbow' | 'shotgun' | 'rifle';
export type BodyArmorId = 'rags' | 'leather_coat' | 'iron_vest' | 'fur_coat';
export type HeadArmorId = 'bandana' | 'fur_cap' | 'weld_mask';
export type CarriageRole = 'none' | 'fortress' | 'crystal' | 'greenhouse' | 'workshop' | 'quarters';

export const ROMAN_TIERS = ['I', 'II', 'III', 'IV', 'V'] as const;

export const TOOL_META: Record<ToolLevel, { name: string; short: string; dmg: number; harvestDmg: number }> = {
  1: { name: '撬棍', short: '撬棍', dmg: 10, harvestDmg: 15 },
  2: { name: '重型铁镐', short: '铁镐', dmg: 16, harvestDmg: 25 },
  3: { name: '蒸汽切割锯', short: '切割锯', dmg: 24, harvestDmg: 38 },
};

export const MELEE_META: Record<
  MeleeWeaponId,
  { name: string; short: string; dmg: number; cd: number; knockback: number; stamina: number; desc: string }
> = {
  club: { name: '钉板木棒', short: '木棒', dmg: 12, cd: 0.4, knockback: 180, stamina: 13, desc: '轻便廉价的防身木棒' },
  axe: { name: '消防斧', short: '消防斧', dmg: 21, cd: 0.56, knockback: 290, stamina: 20, desc: '势大力沉，击退强，能快速斩断青藤缠绕；挥舞很耗体力' },
};

export const RANGED_META: Record<
  RangedWeaponId,
  { name: string; short: string; dmg: number; cd: number; ammoKey: 'bolts' | 'ammo' | null; noiseRadius: number; desc: string }
> = {
  none: { name: '无远程武器', short: '空手', dmg: 0, cd: 0.4, ammoKey: null, noiseRadius: 0, desc: '在工作台组装手弩或土制霰弹枪' },
  crossbow: { name: '手弩', short: '手弩', dmg: 20, cd: 0.55, ammoKey: 'bolts', noiseRadius: 120, desc: '射击安静不易引怪，命中后有概率回收弩箭' },
  shotgun: { name: '土制霰弹枪', short: '霰弹枪', dmg: 8, cd: 0.46, ammoKey: 'ammo', noiseRadius: 560, desc: '5 发扇形近距爆发，但枪声响亮会吸引周围怪物' },
  rifle: { name: '栓动步枪', short: '步枪', dmg: 34, cd: 0.62, ammoKey: 'ammo', noiseRadius: 640, desc: '远距穿甲单发，可穿透 2 名敌人' },
};

export const BODY_ARMOR_META: Record<
  BodyArmorId,
  { name: string; short: string; dr: number; maxHp: number; coldResist: number; speedMult: number; desc: string }
> = {
  rags: { name: '破布衣', short: '破布衣', dr: 0, maxHp: 100, coldResist: 0, speedMult: 1.0, desc: '几乎没有防护与保暖' },
  leather_coat: { name: '皮革外套', short: '皮外套', dr: 0.18, maxHp: 115, coldResist: 0.35, speedMult: 1.0, desc: '均衡的护甲与保暖，适合多数路段' },
  iron_vest: { name: '铁片背心', short: '铁背心', dr: 0.36, maxHp: 135, coldResist: 0.1, speedMult: 0.9, desc: '高护甲但较沉重（移速 -10%），适合怪物区' },
  fur_coat: { name: '毛皮大衣', short: '毛皮衣', dr: 0.1, maxHp: 110, coldResist: 0.85, speedMult: 1.0, desc: '极强抗寒，暴风雪与夜行首选' },
};

export const HEAD_ARMOR_META: Record<
  HeadArmorId,
  { name: string; short: string; dr: number; coldResist: number; sporeProof: boolean; desc: string }
> = {
  bandana: { name: '布头巾', short: '头巾', dr: 0, coldResist: 0.05, sporeProof: false, desc: '聊胜于无的遮尘布' },
  fur_cap: { name: '皮帽', short: '皮帽', dr: 0.04, coldResist: 0.25, sporeProof: false, desc: '轻便保暖' },
  weld_mask: { name: '焊接面罩', short: '面罩', dr: 0.1, coldResist: 0.1, sporeProof: true, desc: '额外护甲，并完全隔离青藤都市孢子' },
};

export const CARRIAGE_ROLE_META: Record<
  CarriageRole,
  { label: string; color: string; bonusText: string }
> = {
  none: { label: '通用车厢', color: '#a8a29e', bonusText: '自由规划设施' },
  crystal: { label: '铭文车厢', color: '#7cc4ff', bonusText: '行驶晶石耗量降低，炉压更稳' },
  fortress: { label: '防御车厢', color: '#e07a7a', bonusText: '车壳耐久 +40，炮台装填略快' },
  greenhouse: { label: '温室车厢', color: '#7bc985', bonusText: '作物抗寒且生长 +30%' },
  workshop: { label: '工坊车厢', color: '#e0b85c', bonusText: '熔炉/灶台加工提速 +30%' },
  quarters: { label: '生活车厢', color: '#7cb5e0', bonusText: '车内体力恢复更快，回暖快' },
};

/**
 * Each region has one signature weather (or none). It only ever happens there, and only now and
 * then: `chance` is rolled each time a calm spell runs out while you are in that region.
 */
export const ZONE_WEATHER: Record<ZoneKind, { kind: WeatherKind | null; chance: number; label: string }> = {
  fallen_city: { kind: null, chance: 0, label: '无' },
  rust_plains: { kind: 'sandstorm', chance: 0.35, label: '偶有沙暴' },
  monster_wastes: { kind: 'rainstorm', chance: 0.4, label: '雷雨' },
  ivy_city: { kind: 'rainstorm', chance: 0.5, label: '多暴雨' },
  sinking_belt: { kind: 'fog', chance: 0.7, label: '常年浓雾' },
  old_city: { kind: 'blizzard', chance: 0.45, label: '暴风雪' },
};

export const ZONE_META: Record<
  ZoneKind,
  { name: string; color: string; bg: string; desc: string; specialty: string }
> = {
  fallen_city: {
    name: '灰烬教区',
    color: '#d99152',
    bg: '#1f1c1d',
    desc: '钟楼在烟雾后沉默，铁轨向无人的荒野延伸。',
    specialty: '起步补给',
  },
  rust_plains: {
    name: '锈原',
    color: '#c99b63',
    bg: '#2b231c',
    desc: '红褐草原上半埋着巨大的旧齿轮，上面的符文被人逐段凿去。',
    specialty: '废料、木材、布料',
  },
  monster_wastes: {
    name: '骸骨猎场',
    color: '#cc665c',
    bg: '#2a1c1a',
    desc: '低沉的嚎叫从岩脊间回荡，荒犬与冲撞兽以此为巢。',
    specialty: '兽皮、兽骨、油脂',
  },
  ivy_city: {
    name: '青藤都市',
    color: '#6fb87e',
    bg: '#19261f',
    desc: '被发光青藤吞没的旧高架城。空气漂浮孢子，藤蔓会悄然攀上停靠的列车。',
    specialty: '草药、种子、木材、布料',
  },
  sinking_belt: {
    name: '沉陷带',
    color: '#8899ad',
    bg: '#1c2026',
    desc: '大地一层层向下坍裂，浓雾笼罩路基，铁轨频繁松动与断裂。',
    specialty: '秘法晶石、铁轨残片、甲壳',
  },
  old_city: {
    name: '旧城街区',
    color: '#7da5c9',
    bg: '#1f252b',
    desc: '指针倒走的钟楼与静默的街巷，变异掠夺者在掩体间游荡。',
    specialty: '铜线、零件、封匣',
  },
};

export interface RouteOption {
  id: string;
  stationName: string;
  template: StationTemplate;
  zone: Exclude<ZoneKind, 'fallen_city'>;
  tier: ZoneTier;
  distance: number; // meters (cruise ~7.22 m/s => 3500m ≈ 8.1 min)
  desc: string;
  warningTag?: string;
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

export interface HullPanel {
  uid: string;
  side: HullSide;
  idx: number;
  isDoor: boolean;
  doorOpen: boolean;
  armorTier?: 1 | 2;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface PlacedBuilding {
  uid: string;
  type: BuildingType;
  tier: 1 | 2;
  carIdx: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  doorOpen?: boolean;
  planted?: boolean;
  growth?: number; // 0..100
  watered?: number; // seconds remaining of water moisture
  pestInfested?: boolean;
  storedWater?: number;
  turretAngle?: number;
  turretCooldown?: number;
  turretOutOfAmmo?: boolean;
  chestGrid?: SlotInventory;
  processRecipeId?: string | null;
  processProgress?: number; // 0..100
  processDuration?: number;
  processQueue?: string[];
  onFire?: boolean;
  hitFlash?: number;
}

export interface FlatbedCar {
  id: number;
  baseWeight: number;
  couplerKind: CouplerKind;
  couplerHp: number; // 0..100
  couplerWarnCd: number;
  hull: HullPanel[];
  buildings: PlacedBuilding[];
}

export type PropKind =
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
  | 'npc_elder'
  | 'loco_crane'
  | 'oracle_altar'
  | 'monster_nest'
  | 'ivy_cluster'
  | 'bone_pile'
  | 'predecessor_loco'
  | 'special_diary'
  | 'roadside_wreck'
  | 'roadside_waver'
  | 'nameless_graves';

export interface WorldProp {
  uid: string;
  kind: PropKind;
  mat?: 'wood' | 'metal' | 'barrel' | 'crystal' | 'organic';
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
  /** Container support (U1, U6): hold-E quietly searches & opens non-pausing loot panel */
  isContainer?: boolean;
  searched?: boolean;
  containerInv?: SlotInventory;
  /** Special narrative item / diary / stele */
  loreId?: string;
  loreTitle?: string;
  loreText?: string;
  drops?: Partial<Record<ResourceKey, number>>;
  /** Monster nest: seconds until it breeds the next monster. */
  nestTimer?: number;
  /** Monster nest: its elite guardian has already appeared. */
  guardianWoken?: boolean;
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

export interface FlyingPickup {
  uid: string;
  key: ResourceKey;
  color: string;
  startX: number;
  startY: number;
  progress: number; // 0..1
}

export interface LootFeedEntry {
  key: ResourceKey;
  count: number;
  timer: number; // fades out after 4s
}

export interface HoldActionState {
  kind: 'loot' | 'rail' | 'quickstack' | 'eat' | 'upgrade' | 'vine';
  targetUid?: string;
  /** For 'eat': the exact consumable bound to the active hotbar slot. */
  itemKey?: ResourceKey;
  x: number;
  y: number;
  label: string;
  progress: number; // 0..1
  duration: number;
}

export type MonsterKind =
  | 'hound'
  | 'stalker'
  | 'clinger'
  | 'burrower'
  | 'sandworm'
  | 'charger'
  | 'nightwalker'
  | 'mutant_raider';

export interface MonsterEntity {
  uid: string;
  kind: MonsterKind;
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
  windupTimer: number;
  windupMax: number;
  windupAngle: number;
  windupRange: number;
  aiState: 'wander' | 'alert' | 'chase' | 'charge' | 'stunned' | 'flee' | 'emerge';
  stateTimer: number;
  nestUid?: string;
  /** Nest guardian: bigger, tougher, hits harder, better loot. */
  elite?: boolean;
  chargeDirX?: number;
  chargeDirY?: number;
  alertedByNoise?: number;
}

export interface NestEruption {
  x: number;
  y: number;
  /** Seconds until the wave bursts out. */
  timer: number;
  maxTimer: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  ttl: number;
  fromTurret: boolean;
  fromEnemy?: boolean;
  kind?: 'bolt' | 'pellet' | 'rifle' | 'turret' | 'enemy_shot';
  pierceLeft?: number;
  hitUids?: string[];
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

export interface CodexEntry {
  id: string;
  title: string;
  body: string;
  foundAt: string;
}

export interface ActiveCardPopup {
  title: string;
  body: string;
  subtitle?: string;
  timer: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  holdE: boolean;
  mouseWorldX: number;
  mouseWorldY: number;
  mouseDown: boolean;
}

export interface InteractHint {
  x: number;
  y: number;
  /** Where the object itself is (for scoring + the highlight); defaults to just below the label. */
  tx?: number;
  ty?: number;
  label: string;
  holdAction?: Omit<HoldActionState, 'progress'>;
  action: () => void;
}

export interface DeathReport {
  deathNum: number;
  rollbackStationName: string;
  cause: string;
}

export interface WorldState {
  mode: 'city_escape' | 'station' | 'wasteland';
  stationIdx: number;
  stationTemplate: StationTemplate;
  stationName: string;
  legDistance: number;
  legTotal: number;
  totalDistance: number;
  worldScrollX: number;
  stationAnchorX: number;
  time: number;
  hitStop: number;

  // Route, Zones & Wave Pacing (C + H5 + W3)
  zoneKind: ZoneKind;
  zoneTier: ZoneTier;
  prevZoneKind: ZoneKind | null;
  biomeSeamX: number;
  cityExitX: number;
  stationStreamed: boolean;
  disembarkedAtStation: boolean;
  stationWorldTitle: string;
  stationEpigraph: string;
  exploredFog: Set<string>;
  discoveredLandmarks: number;
  zoneBanner: { title: string; subtitle: string; color: string; timer: number } | null;
  availableRoutes: RouteOption[];
  selectedRoute: RouteOption | null;
  routeOpen: boolean;

  // Driving wave rhythm (calm -> omen -> danger -> calm)
  wavePhase: WavePhase;
  waveIndex: number;
  omenTimer: number;
  omenLabel: string;
  dangerSpawnedInWave: boolean;
  roadsideEventSpawned: number;
  parallelTrainX: number | null; // Epic/uncanny parallel ghost train silhouette
  boilerPressure: number; // 0..100; > 88 hisses & needs venting
  vineSnare: number; // 0..100 in Ivy City when parked; slows train until chopped!
  chainElderMet: boolean; // Chain event: met tower elder -> leads to predecessor train
  chainPredecessorFound: boolean;

  // Save timestamps & Campaign
  lastSavedAt: number;
  victory: boolean;
  endlessMode: boolean;

  // Station Architecture
  stationRoads: StationRoad[];
  stationRooms: StationRoom[];
  stationWalls: StationWall[];
  stationBarriers: StationBarrier[];

  // Daily Bed Rest Limit & Diegetic Audio Timers
  lastSleepDay: number;
  stomachGrowlCd: number;
  heartbeatCd: number;
  lastVitalChangeAt: number; // For HUD auto-fade when vitals are stable

  // Lantern & Night Darkness
  /** The hand lantern: carried by the player, or set down somewhere (on the deck or the ground). */
  lanternHolder: 'player' | 'placed';
  /** Buildings placed on the locomotive's free tiles (carIdx -1; hull lives in locoHull). */
  locoDeck: FlatbedCar;
  /** Where a placed lantern stands; onTrain lanterns ride along, ground lanterns stay behind. */
  lanternPos: { x: number; y: number; onTrain: boolean } | null;
  darkThreatLevel: number;
  darkThreatTimer: number;
  wastelandStopTimer: number;
  wastelandSiegeCd: number;

  // Day/Night & Regional Weather
  dayTime: number; // 0..1
  dayCount: number;
  weather: WeatherKind;
  weatherTimer: number;
  lightningFlash: number;

  cameraX: number;
  cameraY: number;
  shake: number;

  // Train state (No passive parked decay!)
  locoLevel: 1 | 2;
  locoHp: number;
  locoMaxHp: number;
  locoHull: HullPanel[];
  hasBumper: boolean;
  bumperTier: 1 | 2;
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
    /** Seconds before stamina starts refilling after a swing/sprint (longer when emptied). */
    staminaDelay?: number;
    hunger: number;
    thirst: number;
    bodyTemp: number; // 0..100
    sickTimer: number; // >0 = sick from dirty water / raw food / ivy spores
    sporeExposure: number; // 0..100 in Ivy City without welding mask
    wellFedTimer: number;
    swingTimer: number;
    swingAngle: number;
    attackCd: number;
    hitFlash: number;
    invulnTimer: number;
    flashlightOn: boolean;
    toolLevel: ToolLevel;
    toolDurability: number;
    meleeWeapon: MeleeWeaponId;
    rangedWeapon: RangedWeaponId;
    weaponDurability: number;
    bodyArmor: BodyArmorId;
    headArmor: HeadArmorId;
    armorDurability: number;
    ownedBodyArmors: BodyArmorId[];
    ownedHeadArmors: HeadArmorId[];
    ownedRangedWeapons: RangedWeaponId[];
    alive: boolean;
  };

  hotbar: HotbarSlot;
  hotbarBindings: HotbarBinding[];
  buildMode: boolean;
  selectedBuild: BuildingType;
  backpackLevel: 1 | 2 | 3 | 4;
  backpack: SlotInventory;

  // Entities
  props: WorldProp[];
  trackHazards: TrackHazard[];
  monsters: MonsterEntity[];
  pickups: PickupItem[];
  flyingPickups: FlyingPickup[];
  lootFeed: LootFeedEntry[];
  projectiles: Projectile[];
  particles: Particle[];
  floats: FloatingText[];
  decoyPos: { x: number; y: number; ttl: number } | null;
  /** Destroyed nests: after a short rumble, a strong wave bursts out of the ruin. */
  nestEruptions: NestEruption[];

  // Hold action, Codex & Non-pausing Sidebars
  holdAction: HoldActionState | null;
  codex: CodexEntry[];
  activeCard: ActiveCardPopup | null;
  exploredChunks: Set<string>;
  hazardSpawnTimer: number;
  nightWavesLeft: number;
  nightWaveTimer: number;
  activeHint: InteractHint | null;

  // Non-pausing UI Panels (world keeps running!)
  bagOpen: boolean;
  notebookTab: 'bag' | 'notes' | 'codex';
  openChestUid: string | null;
  openContainerUid: string | null;
  openFacilityUid: string | null;
  tradeOpen: boolean;
  throttleOpen: boolean;

  // Blocking states
  deathReport: DeathReport | null;
  gameOver: boolean;
  stats: {
    monstersKilled: number;
    nestsCleared: number;
    elitesKilled?: number;
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

export function bumpUidSeq(minVal: number): void {
  if (minVal >= uidSeq) uidSeq = minVal + 1;
}
