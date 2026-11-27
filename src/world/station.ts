import { addToInventory, createInventory, type ResourceKey } from '../inventory';
import { sfx } from '../sfx';
import {
  LOCO_W,
  OUTER_MAX_RING,
  STATION_BOUND_X,
  STATION_BOUND_Y,
  ZONE_META,
  uid,
  type MonsterEntity,
  type MonsterKind,
  type RouteOption,
  type StationTemplate,
  type ToolLevel,
  type WorldProp,
  type WorldState,
  type ZoneKind,
  type ZoneTier,
} from './types';
import {
  getZoneTierRoman,
  isNight,
  isPointOnTrain,
  playerHasActiveLantern,
  spawnParticles,
} from './train';

export const FOG_CELL_SIZE = 180;

/** ~40% of outer abandoned vehicles hold a piece of gear; better gear deeper in. */
function rollGearLoot(roll: number, tier: ZoneTier): Partial<Record<ResourceKey, number>> {
  if (roll > 0.4) return {};
  const pool: Array<Partial<Record<ResourceKey, number>>> = [
    { gearCrossbow: 1, bolts: 8 },
    { gearFurCap: 1 },
    { gearLeather: 1 },
    { gearShotgun: 1, ammo: 6 },
    { gearFurCoat: 1 },
  ];
  if (tier >= 2) pool.push({ gearIronVest: 1 }, { gearWeldMask: 1 }, { gearAxe: 1 });
  if (tier >= 3) pool.push({ gearRifle: 1, ammo: 6 });
  return pool[Math.floor((roll / 0.4) * pool.length) % pool.length];
}
const OUTER_CHUNK_SIZE = 620;

function makeContainer(
  props: Omit<WorldProp, 'uid' | 'hitFlash' | 'isContainer' | 'searched' | 'containerInv'>,
  loot: Partial<Record<ResourceKey, number>>
): WorldProp {
  const inv = createInventory(8);
  for (const [k, v] of Object.entries(loot)) {
    if ((v ?? 0) > 0) addToInventory(inv, k as ResourceKey, v!);
  }
  return {
    ...props,
    uid: uid('p'),
    hitFlash: 0,
    isContainer: true,
    searched: false,
    containerInv: inv,
    drops: { ...loot },
  };
}

/**
 * Structured route options (3–4 per station) with 8–11 minute legs (~3400m–4600m at cruise 7.22 m/s),
 * distinct regional specialties (G2/W5), and sinking_belt rail hazards (H5).
 */
export function buildNextRoutes(stationIdx: number, endlessMode = false): RouteOption[] {
  if (stationIdx === 0) {
    return [
      {
        id: 'st1_watertower_rust',
        stationName: '水塔镇',
        template: 'watertower_town',
        zone: 'rust_plains',
        tier: 1,
        distance: 3500,
        desc: '锈原上的围墙据点，住着仍保有理智的变异行商与守塔老者。铁轨完好，适合补水、交易与升级车头。',
      },
      {
        id: 'st1_ivy_city',
        stationName: '青藤高架站',
        template: 'watertower_town',
        zone: 'ivy_city',
        tier: 2,
        distance: 3900,
        warningTag: '孢子 · 藤蔓缠车',
        desc: '被青藤吞没的高架都市。木材、草药与种子丰饶，但空气漂浮孢子（需焊接面罩），停车过久藤蔓会爬上车轮。',
      },
      {
        id: 'st1_bone_outpost',
        stationName: '荒犬前哨',
        template: 'abandoned_halt',
        zone: 'monster_wastes',
        tier: 1,
        distance: 3700,
        warningTag: '荒犬 · 雷雨',
        desc: '野兽荒原边缘的旧信号站。兽皮、油脂与骨料唾手可得，但夜里狗群会沿着铁轨追车。',
      },
    ];
  }
  if (stationIdx === 1) {
    return [
      {
        id: 'st2_predecessor_sinking',
        stationName: '前代列车残骸',
        template: 'predecessor_wreck',
        zone: 'sinking_belt',
        tier: 2,
        distance: 3800,
        warningTag: '沉陷带 · 断轨频发',
        desc: '穿过浓雾弥漫的沉陷带（务必带足铁轨段）。一列与你一模一样的旧列车侧翻在轨道旁，藏有铜线、零件与前代日记。',
      },
      {
        id: 'st2_monster_wastes',
        stationName: '骸骨货场',
        template: 'abandoned_halt',
        zone: 'monster_wastes',
        tier: 2,
        distance: 4100,
        warningTag: '荒犬 · 冲撞兽',
        desc: '绕开沉陷带，驶入野兽盘踞的荒野货场。铁轨完好，可猎取大量兽皮、油脂与硬甲壳。',
      },
      {
        id: 'st2_iron_bridge',
        stationName: '铁桥镇',
        template: 'watertower_town',
        zone: 'rust_plains',
        tier: 2,
        distance: 3600,
        warningTag: '沙暴',
        desc: '架在干涸河床上的锈铁桥镇，行商聚集。路途平稳，适合补给、交易与修整车厢。',
      },
      {
        id: 'st2_hot_spring',
        stationName: '废弃温泉站',
        template: 'abandoned_halt',
        zone: 'ivy_city',
        tier: 2,
        distance: 4000,
        warningTag: '孢子 · 暴雨',
        desc: '藤蔓覆盖的疗养小站，泉眼仍冒着热气。可以采到草药与干净的水，停车太久藤会缠上车轮。',
      },
    ];
  }
  if (stationIdx === 2) {
    return [
      {
        id: 'st3_old_city',
        stationName: '静默钟楼街',
        template: 'watertower_town',
        zone: 'old_city',
        tier: 3,
        distance: 4300,
        warningTag: '变异掠夺者',
        desc: '指针倒走的旧城街区。建筑中藏有铜线、零件与遗迹封匣，但变异掠夺者会躲在暗处开火。',
      },
      {
        id: 'st3_ivy_deep',
        stationName: '青藤温室区',
        template: 'predecessor_wreck',
        zone: 'ivy_city',
        tier: 3,
        distance: 4000,
        warningTag: '孢子 · 藤蔓',
        desc: '半塌的玻璃温室与倾覆车厢，草药、稀有种子与前代残迹并存。',
      },
      {
        id: 'st3_broken_horn',
        stationName: '断角站',
        template: 'abandoned_halt',
        zone: 'monster_wastes',
        tier: 3,
        distance: 4200,
        warningTag: '冲撞兽 · 兽群',
        desc: '冲撞兽群迁徙必经的货运站。硬甲壳与兽骨堆成小山，适合造厚甲车厢——前提是撑得过兽潮。',
      },
      {
        id: 'st3_signal_tower',
        stationName: '雾沼信号塔',
        template: 'predecessor_wreck',
        zone: 'sinking_belt',
        tier: 3,
        distance: 3900,
        warningTag: '浓雾 · 断轨',
        desc: '浓雾里仍在闪烁的信号塔下，半截前代列车埋在泥里。晶石与零件丰富，务必多带铁轨。',
      },
    ];
  }
  if (stationIdx === 3 && !endlessMode) {
    // Design §5.2: every route of the act converges on one fixed BOSS station, known in advance.
    return [
      {
        id: 'act1_boss',
        stationName: '第一幕终点 · 熔铁闸口',
        template: 'abandoned_halt',
        zone: 'rust_plains',
        tier: 4,
        distance: 4200,
        warningTag: 'BOSS · 必经之站',
        desc: '所有铁轨都汇到这座闸口。出站的轨道上蜷着一头巨大的冲撞兽，铁轨被它啃得发亮——不打倒它，列车出不去。',
        boss: true,
      },
    ];
  }
  if (stationIdx === 4 && !endlessMode) {
    return [
      {
        id: 'st4_sinking_deep',
        stationName: '深陷裂谷站',
        template: 'predecessor_wreck',
        zone: 'sinking_belt',
        tier: 4,
        distance: 4500,
        warningTag: '强沉陷 · 掘地虫',
        desc: '通往尽头前的最后一段沉陷带。地基不断下塌，掘地虫频繁顶断铁轨，备足铁轨与晶石再启程。',
      },
      {
        id: 'st4_old_city_north',
        stationName: '北境钟楼站',
        template: 'watertower_town',
        zone: 'old_city',
        tier: 4,
        distance: 4600,
        warningTag: '暴风雪 · 掠夺者',
        desc: '寒冷的北方旧城补给站，有理智变异行商与深层封锁库房。',
      },
      {
        id: 'st4_rust_viaduct',
        stationName: '锈蚀高架桥站',
        template: 'watertower_town',
        zone: 'rust_plains',
        tier: 4,
        distance: 4300,
        warningTag: '沙暴 · 掠夺者',
        desc: '横跨锈原的巨型高架桥尽头，最后一座还在交易的行商据点。较安全，但风沙会磨损未封闭的车厢。',
      },
      {
        id: 'st4_bone_field',
        stationName: '兽骨荒原',
        template: 'abandoned_halt',
        zone: 'monster_wastes',
        tier: 4,
        distance: 4400,
        warningTag: '兽潮 · 雷雨',
        desc: '整片荒原铺满兽骨。物资最丰厚，夜里的兽潮也最凶。',
      },
    ];
  }

  const num = stationIdx + 2;
  const templates: StationTemplate[] = ['watertower_town', 'predecessor_wreck', 'abandoned_halt'];
  const tier = Math.min(5, Math.max(3, stationIdx)) as ZoneTier;
  return [
    {
      id: `st${num}_ivy`,
      stationName: `青藤外站 · ${num}`,
      template: templates[num % templates.length],
      zone: 'ivy_city',
      tier,
      distance: 4100,
      warningTag: '孢子 · 藤蔓',
      desc: '青藤蔓延的高架遗迹，盛产木材、草药与种子。',
    },
    {
      id: `st${num}_sinking`,
      stationName: `沉陷段 · ${num}`,
      template: 'predecessor_wreck',
      zone: 'sinking_belt',
      tier,
      distance: 3900,
      warningTag: '断轨 · 掘地虫',
      desc: '路基坍裂的危险铁道，盛产秘法晶石与机械零件。',
    },
    {
      id: `st${num}_rust`,
      stationName: `锈原镇 · ${num}`,
      template: 'watertower_town',
      zone: 'rust_plains',
      tier,
      distance: 3800,
      warningTag: '沙暴',
      desc: '锈原上又一座围墙小镇，可补给与交易。',
    },
    {
      id: `st${num}_wastes`,
      stationName: `兽骨货场 · ${num}`,
      template: 'abandoned_halt',
      zone: 'monster_wastes',
      tier,
      distance: 4200,
      warningTag: '兽群 · 雷雨',
      desc: '野兽盘踞的货场，兽皮、油脂与甲壳丰厚。',
    },
  ];
}

export function selectRoute(w: WorldState, routeId: string): boolean {
  const found = w.availableRoutes.find((r) => r.id === routeId);
  if (!found) return false;
  w.selectedRoute = found;
  w.routeOpen = false;
  sfx.lever();
  return true;
}

export function pickZoneEnemyKind(zone: ZoneKind, tier: ZoneTier, driving = false): MonsterKind {
  const r = Math.random();
  if (driving) {
    if (zone === 'sinking_belt' && r < 0.4) return 'sandworm';
    if (r < 0.55) return 'stalker';
    if (r < 0.85) return 'clinger';
    return 'burrower';
  }
  if (zone === 'rust_plains' || zone === 'fallen_city') {
    return r < 0.72 ? 'hound' : 'stalker';
  }
  if (zone === 'monster_wastes') {
    if (r < 0.35 && tier >= 2) return 'charger';
    if (r < 0.7) return 'hound';
    return 'clinger';
  }
  if (zone === 'ivy_city') {
    if (r < 0.45) return 'burrower';
    if (r < 0.8) return 'clinger';
    return 'hound';
  }
  if (zone === 'sinking_belt') {
    if (r < 0.52) return 'sandworm';
    return r < 0.8 ? 'clinger' : 'burrower';
  }
  // old_city
  if (r < 0.58) return 'mutant_raider';
  return r < 0.82 ? 'stalker' : 'charger';
}

export function createMonster(
  kind: MonsterKind,
  x: number,
  y: number,
  onTrain: boolean,
  tier: ZoneTier = 1,
  nestUid?: string,
  elite = false
): MonsterEntity {
  const cfg: Record<MonsterKind, { hp: number; speed: number; dps: number; r: number }> = {
    hound: { hp: 30, speed: 108, dps: 9, r: 12 },
    stalker: { hp: 38, speed: 102, dps: 12, r: 14 },
    clinger: { hp: 32, speed: 112, dps: 11, r: 13 },
    burrower: { hp: 28, speed: 98, dps: 10, r: 12 },
    sandworm: { hp: 62, speed: 78, dps: 16, r: 16 },
    charger: { hp: 88, speed: 84, dps: 20, r: 19 },
    nightwalker: { hp: 58, speed: 118, dps: 16, r: 15 },
    mutant_raider: { hp: 46, speed: 86, dps: 12, r: 14 },
  };
  const base = cfg[kind];
  const hpMult = [1, 1.2, 1.45, 1.7, 2.0][tier - 1] ?? 1;
  const dpsMult = [1, 1.12, 1.25, 1.38, 1.5][tier - 1] ?? 1;
  const maxHp = Math.round(base.hp * hpMult * (elite ? 2.8 : 1));
  return {
    uid: uid('m'),
    kind,
    tier,
    x,
    y,
    vx: 0,
    vy: 0,
    r: elite ? Math.round(base.r * 1.32) : base.r,
    hp: maxHp,
    maxHp,
    speed: base.speed + (tier - 1) * 4 - (elite ? 8 : 0),
    dps: Math.round(base.dps * dpsMult * (elite ? 1.5 : 1)),
    elite: elite || undefined,
    onTrain,
    hitFlash: 0,
    attackCd: 0,
    windupTimer: 0,
    windupMax: 0,
    windupAngle: 0,
    windupRange: 0,
    aiState: kind === 'sandworm' ? 'emerge' : 'wander',
    stateTimer: kind === 'sandworm' ? 1.1 : 0,
    nestUid,
  };
}

function addRoomWithDoor(
  w: WorldState,
  x: number,
  y: number,
  rw: number,
  rh: number,
  doorSide: 'top' | 'bottom' | 'left' | 'right',
  reqTool: ToolLevel,
  label: string,
  floorColor: string
): void {
  const t = 14;
  const dw = 56;
  w.stationRooms.push({ x, y, w: rw, h: rh, label, floorColor, reqTool });

  const makeBarrier = (bx: number, by: number, bw: number, bh: number): void => {
    const hp = reqTool === 1 ? 30 : reqTool === 2 ? 75 : 130;
    const doorName = reqTool === 1 ? '木板封门' : reqTool === 2 ? '钢筋铁门 · 需铁镐' : '合金防爆门 · 需切割锯';
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

  if (doorSide === 'top') {
    const seg = (rw - dw) / 2;
    w.stationWalls.push({ x, y, w: seg, h: t }, { x: x + seg + dw, y, w: seg, h: t });
    makeBarrier(x + seg, y, dw, t);
  } else {
    w.stationWalls.push({ x, y, w: rw, h: t });
  }
  if (doorSide === 'bottom') {
    const seg = (rw - dw) / 2;
    w.stationWalls.push({ x, y: y + rh - t, w: seg, h: t }, { x: x + seg + dw, y: y + rh - t, w: seg, h: t });
    makeBarrier(x + seg, y + rh - t, dw, t);
  } else {
    w.stationWalls.push({ x, y: y + rh - t, w: rw, h: t });
  }
  if (doorSide === 'left') {
    const seg = (rh - dw) / 2;
    w.stationWalls.push({ x, y, w: t, h: seg }, { x, y: y + seg + dw, w: t, h: seg });
    makeBarrier(x, y + seg, t, dw);
  } else {
    w.stationWalls.push({ x, y, w: t, h: rh });
  }
  if (doorSide === 'right') {
    const seg = (rh - dw) / 2;
    w.stationWalls.push({ x: x + rw - t, y, w: t, h: seg }, { x: x + rw - t, y: y + seg + dw, w: t, h: seg });
    makeBarrier(x + rw - t, y + seg, t, dw);
  } else {
    w.stationWalls.push({ x: x + rw - t, y, w: t, h: rh });
  }
}

function getStationLore(template: StationTemplate, zone: Exclude<ZoneKind, 'fallen_city'>): { title: string; epigraph: string } {
  if (template === 'abandoned_halt') {
    return {
      title: `${ZONE_META[zone].name} · 废弃小站`,
      epigraph: '站牌上的字迹已被刮平。轨道边还留着能拆的木箱与废铁。',
    };
  }
  if (template === 'predecessor_wreck') {
    return {
      title: `${ZONE_META[zone].name} · 前代列车残骸`,
      epigraph: '另一列与你一模一样的黑铁火车侧翻在碎石边，铭牌被人仔细磨去。',
    };
  }
  return {
    title: `${ZONE_META[zone].name} · 水塔镇`,
    epigraph: '锈蚀的铁皮围墙里仍亮着微弱油灯。里面的变异者还记得如何交易。',
  };
}

/**
 * Build one of 3 distinct station templates (H4 + H8):
 * - abandoned_halt: compact guided starter stop (Z6)
 * - watertower_town: walled mutant settlement + outer ruins
 * - predecessor_wreck: derailed twin locomotive + predecessor diary + deep vault
 * Relics (ancient_vault) ONLY appear in handcrafted locked deep rooms (1-2 per station, #3).
 */
export function buildStationMap(
  w: WorldState,
  zone: Exclude<ZoneKind, 'fallen_city'>,
  tier: ZoneTier,
  stationName: string,
  template: StationTemplate,
  anchorOffsetX = 0,
  preserveRoute = false
): void {
  const prevOnTrainMonsters = w.monsters.filter((m) => m.onTrain);
  const lore = getStationLore(template, zone);
  w.stationTemplate = template;
  w.stationName = stationName;
  w.stationWorldTitle = lore.title;
  w.stationEpigraph = lore.epigraph;
  w.disembarkedAtStation = false;
  w.exploredChunks.clear();
  w.exploredFog.clear();
  w.discoveredLandmarks = 0;
  w.stationAnchorX = anchorOffsetX;
  w.stationRoads = [];
  w.stationRooms = [];
  w.stationWalls = [];
  w.stationBarriers = [];
  w.vineSnare = 0;
  w.nestEruptions = [];
  if (!preserveRoute) {
    w.availableRoutes = buildNextRoutes(w.stationIdx, w.endlessMode);
    w.selectedRoute = null;
  }

  const deepTier = Math.min(5, tier + 1) as ZoneTier;
  const roadCol =
    zone === 'ivy_city'
      ? '#263329'
      : zone === 'sinking_belt'
        ? '#2a2e33'
        : zone === 'old_city'
          ? '#32383f'
          : '#38322c';

  w.props = [];
  w.monsters = [];

  // Arrival gift: small silent altar on the north platform (H7 #18: 神的馈赠)
  w.props.push({
    uid: uid('p'),
    kind: 'oracle_altar',
    x: -240,
    y: -215,
    r: 22,
    hp: 999,
    maxHp: 999,
    hitFlash: 0,
    label: '站台小祭坛',
    interactOnly: true,
    drops:
      w.stationIdx === 0
        ? { magicShard: 2, cloth: 2 }
        : { magicShard: 2, herbs: 2, parts: 1 },
  });

  if (template === 'abandoned_halt') {
    // Compact, immediately readable starter layout (Z6)
    w.stationRoads = [
      { x: -920, y: -255, w: 1840, h: 105, color: roadCol },
      { x: -920, y: 155, w: 1840, h: 95, color: roadCol },
      { x: -55, y: -760, w: 110, h: 1500, color: roadCol },
    ];

    addRoomWithDoor(w, -480, -490, 260, 200, 'bottom', 1, '候车棚', '#2e332c');
    addRoomWithDoor(w, 220, -490, 260, 200, 'bottom', 1, '杂货棚', '#34302a');
    addRoomWithDoor(w, -460, 285, 280, 210, 'top', 2, '检修铁室 · 需铁镐', '#2f2c36');
    addRoomWithDoor(w, 220, 285, 300, 220, 'top', 3, '深层密室 · 需切割锯', '#242e38');

    // Immediate visible platform resource nodes (direct harvest to backpack!)
    w.props.push(
      { uid: uid('p'), kind: 'dry_tree', mat: 'wood', x: -130, y: -180, r: 22, hp: 30, maxHp: 30, hitFlash: 0, label: '干枯枕木', drops: { wood: 6 } },
      { uid: uid('p'), kind: 'scrap_pile', mat: 'metal', x: 55, y: -182, r: 22, hp: 36, maxHp: 36, hitFlash: 0, label: '废铁堆', drops: { scrap: 6 } },
      { uid: uid('p'), kind: 'arcane_crystal', mat: 'crystal', x: 165, y: -185, r: 20, hp: 36, maxHp: 36, hitFlash: 0, label: '蓝火晶簇', drops: { magicShard: 3, scrap: 1 } },
      makeContainer({ kind: 'wood_crate', mat: 'wood', x: -395, y: -405, r: 20, hp: 32, maxHp: 32, label: '候车行李箱' }, { gearFurCap: 1, wood: 3, cloth: 3, water: 2, rawFood: 2 }),
      makeContainer({ kind: 'bandit_crate', mat: 'wood', x: -290, y: -390, r: 20, hp: 36, maxHp: 36, label: '站务物资柜' }, { gearCrossbow: 1, bolts: 10, scrap: 3, parts: 1, bandage: 1 }),
      makeContainer({ kind: 'seed_cache', mat: 'wood', x: 310, y: -400, r: 22, hp: 34, maxHp: 34, label: '杂货粮柜' }, { seeds: 3, rawFood: 3, water: 3, herbs: 2 }),
      makeContainer({ kind: 'parts_box', mat: 'metal', x: 420, y: -380, r: 20, hp: 40, maxHp: 40, label: '工具箱' }, { parts: 2, rails: 1, fat: 2 }),
      // Freight siding carriage
      { uid: uid('p'), kind: 'flatbed_siding', x: 740, y: -205, r: 42, hp: 999, maxHp: 999, hitFlash: 0, label: '闲置平板车厢', interactOnly: true },
      // Locked Lv.2 room
      makeContainer({ kind: 'scrap_car', mat: 'metal', x: -330, y: 390, r: 28, hp: 62, maxHp: 62, label: '检修工车' }, { scrap: 8, parts: 3, coupler: 1, copper: 2 }),
      // Locked Lv.3 room (Handcrafted relic!)
      makeContainer({ kind: 'ancient_vault', mat: 'metal', x: 360, y: 395, r: 25, hp: 68, maxHp: 68, label: '密室封匣' }, { ancientRelic: 1, magicShard: 4, parts: 3 }),
      // Environmental lore stele
      {
        uid: uid('p'),
        kind: 'special_diary',
        x: -35,
        y: -430,
        r: 18,
        hp: 999,
        maxHp: 999,
        hitFlash: 0,
        label: '无字石碑与半页日历',
        interactOnly: true,
        loreId: 'halt_calendar',
        loreTitle: '停在同日的墙历',
        loreText: '候车室的纸历被人撕去了后半本，剩下的那一页没有年份。墙角立着一块石碑，所有刻字都被利器反复凿平。',
      }
    );

    // Monster nest on south-west edge (clearing it stops night raids!)
    const nestUid = uid('nest');
    w.props.push({
      uid: nestUid,
      kind: 'monster_nest',
      mat: 'organic',
      x: -740,
      y: 420,
      r: 30,
      hp: 85,
      maxHp: 85,
      hitFlash: 0,
      label: '荒犬巢穴',
      drops: { bone: 3, hide: 3, fat: 2 },
    });
    w.monsters.push(
      createMonster('hound', -660, 410, false, tier, nestUid),
      createMonster('hound', -780, 480, false, tier, nestUid),
      createMonster(pickZoneEnemyKind(zone, tier), 350, -340, false, tier),
      createMonster(pickZoneEnemyKind(zone, deepTier), -320, 415, false, deepTier)
    );
  } else if (template === 'watertower_town') {
    // Walled mutant settlement on north + outer ruins & deep locked vaults
    w.stationRoads = [
      { x: -1160, y: -255, w: 2320, h: 105, color: roadCol },
      { x: -1160, y: 155, w: 2320, h: 100, color: roadCol },
      { x: -60, y: -920, w: 120, h: 1840, color: roadCol },
      { x: -240, y: -560, w: 480, h: 260, color: '#3b352f' },
    ];

    // Safe walled yard north of tracks
    w.stationWalls.push(
      { x: -260, y: -580, w: 520, h: 14 },
      { x: -260, y: -580, w: 14, h: 290 },
      { x: 246, y: -580, w: 14, h: 290 }
    );

    addRoomWithDoor(w, -840, -520, 280, 220, 'bottom', 1, '废墟商铺', '#34302a');
    addRoomWithDoor(w, 540, -520, 280, 220, 'bottom', 2, '旧城工坊 · 需铁镐', '#2f2c36');
    addRoomWithDoor(w, -820, 290, 300, 230, 'top', 2, '温室遗址 · 需铁镐', '#26342a');
    addRoomWithDoor(w, 460, 290, 340, 240, 'top', 3, '深层封锁库 · 需切割锯', '#242e38');

    // Mutant settlement NPCs (P2/P3: rational mutants, NO gardener!)
    w.props.push(
      { uid: uid('p'), kind: 'water_tower', x: -155, y: -420, r: 34, hp: 999, maxHp: 999, hitFlash: 0, label: '铁皮蓄水塔', interactOnly: true },
      { uid: uid('p'), kind: 'npc_keeper', x: 0, y: -390, r: 18, hp: 999, maxHp: 999, hitFlash: 0, label: '变异行商', interactOnly: true },
      {
        uid: uid('p'),
        kind: 'npc_elder',
        x: 130,
        y: -405,
        r: 18,
        hp: 999,
        maxHp: 999,
        hitFlash: 0,
        label: '守塔变异老者',
        interactOnly: true,
        loreId: 'chain_elder_predecessor',
        loreTitle: '守塔老者的低语',
        loreText: '“你这列黑铁火车……我见过另一列一模一样的。它往沉陷带去了，再没回来。车头的铭牌上本来刻着字，后来全被刮掉了。”',
      }
    );
    if (w.locoLevel === 1) {
      w.props.push({ uid: uid('p'), kind: 'loco_crane', x: 165, y: -510, r: 32, hp: 999, maxHp: 999, hitFlash: 0, label: '重型龙门吊', interactOnly: true });
    }

    w.props.push(
      { uid: uid('p'), kind: 'scrap_pile', mat: 'metal', x: -410, y: -185, r: 22, hp: 38, maxHp: 38, hitFlash: 0, label: '废铁堆', drops: { scrap: 6, copper: zone === 'old_city' ? 2 : 0 } },
      { uid: uid('p'), kind: zone === 'ivy_city' ? 'ivy_cluster' : 'dry_tree', mat: 'wood', x: 380, y: -185, r: 22, hp: 32, maxHp: 32, hitFlash: 0, label: zone === 'ivy_city' ? '发光青藤丛' : '枯木堆', drops: zone === 'ivy_city' ? { wood: 5, cloth: 3, herbs: 3, seeds: 2 } : { wood: 6 } },
      { uid: uid('p'), kind: 'arcane_crystal', mat: 'crystal', x: 520, y: -185, r: 20, hp: 38, maxHp: 38, hitFlash: 0, label: '蓝火晶簇', drops: { magicShard: 3 } },
      { uid: uid('p'), kind: 'flatbed_siding', x: 960, y: -210, r: 42, hp: 999, maxHp: 999, hitFlash: 0, label: '废弃备用车厢', interactOnly: true },
      makeContainer({ kind: 'wood_crate', mat: 'wood', x: -720, y: -420, r: 20, hp: 34, maxHp: 34, label: '商铺货箱' }, { gearLeather: 1, cloth: 4, rawFood: 3, water: 2, wood: 4 }),
      makeContainer({ kind: 'parts_box', mat: 'metal', x: 675, y: -410, r: 22, hp: 46, maxHp: 46, label: '铜件工具柜' }, { gearAxe: 1, copper: 4, parts: 3, scrap: 5, rails: 1 }),
      makeContainer({ kind: 'seed_cache', mat: 'wood', x: -670, y: 400, r: 22, hp: 38, maxHp: 38, label: '温室种子柜' }, { seeds: 4, herbs: 4, water: 3, rawFood: 3 }),
      makeContainer({ kind: 'ancient_vault', mat: 'metal', x: 630, y: 405, r: 26, hp: 70, maxHp: 70, label: '深层封匣' }, { ancientRelic: 1, coupler: 1, magicShard: 4, copper: 3 })
    );

    const nest1 = uid('nest');
    const nest2 = uid('nest');
    w.props.push(
      { uid: nest1, kind: 'monster_nest', mat: 'organic', x: -960, y: 450, r: 30, hp: 95, maxHp: 95, hitFlash: 0, label: '怪物巢穴', drops: { bone: 3, hide: 3, fat: 3 } },
      { uid: nest2, kind: 'monster_nest', mat: 'organic', x: 920, y: 460, r: 30, hp: 95, maxHp: 95, hitFlash: 0, label: '怪物巢穴', drops: { carapace: 2, fat: 3, bone: 2 } }
    );
    w.monsters.push(
      createMonster(pickZoneEnemyKind(zone, tier), -890, 420, false, tier, nest1),
      createMonster(pickZoneEnemyKind(zone, tier), -980, 510, false, tier, nest1),
      createMonster(pickZoneEnemyKind(zone, deepTier), 860, 440, false, deepTier, nest2),
      createMonster(pickZoneEnemyKind(zone, deepTier), 640, -390, false, deepTier),
      createMonster(pickZoneEnemyKind(zone, deepTier), 620, 420, false, deepTier)
    );
  } else {
    // predecessor_wreck: A derailed twin steam train beside the tracks! (H4 + Chain event)
    w.stationRoads = [
      { x: -1100, y: -250, w: 2200, h: 100, color: roadCol },
      { x: -1100, y: 155, w: 2200, h: 100, color: roadCol },
      { x: -80, y: -860, w: 160, h: 1720, color: roadCol },
    ];

    addRoomWithDoor(w, -620, -540, 320, 220, 'bottom', 1, '前代货车残骸', '#302b28');
    addRoomWithDoor(w, 240, -540, 320, 220, 'bottom', 2, '前代机务室 · 需铁镐', '#2d3138');
    addRoomWithDoor(w, -180, 300, 360, 240, 'top', 3, '前代封锁车厢 · 需切割锯', '#232a34');

    w.props.push(
      { uid: uid('p'), kind: 'predecessor_loco', x: -60, y: -380, r: 58, hp: 999, maxHp: 999, hitFlash: 0, label: '侧翻的前代黑铁机车', interactOnly: true },
      {
        uid: uid('p'),
        kind: 'special_diary',
        x: 35,
        y: -315,
        r: 18,
        hp: 999,
        maxHp: 999,
        hitFlash: 0,
        label: '焦黑的前代航行日志',
        interactOnly: true,
        loreId: 'predecessor_diary_1',
        loreTitle: '前代航行日志（残页）',
        loreText: '“蓝火熄灭前，我听见平行铁道上有另一列汽笛。炉压表上的刻痕和我的车一模一样……主教选中的从来不是第一个人。如果后来者读到这页，拿走车钩，别回头。”',
      },
      { uid: uid('p'), kind: 'arcane_crystal', mat: 'crystal', x: -175, y: -185, r: 22, hp: 38, maxHp: 38, hitFlash: 0, label: '泄漏晶簇', drops: { magicShard: 4 } },
      { uid: uid('p'), kind: 'scrap_pile', mat: 'metal', x: 185, y: -185, r: 24, hp: 42, maxHp: 42, hitFlash: 0, label: '车体碎铁', drops: { scrap: 7, copper: 2 } },
      { uid: uid('p'), kind: 'flatbed_siding', x: 860, y: -205, r: 42, hp: 999, maxHp: 999, hitFlash: 0, label: '前代备用车厢', interactOnly: true },
      makeContainer({ kind: 'bandit_crate', mat: 'wood', x: -460, y: -430, r: 22, hp: 38, maxHp: 38, label: '前代补给箱' }, { gearShotgun: 1, ammo: 8, cookedFood: 2, water: 3, cloth: 2, bandage: 1 }),
      makeContainer({ kind: 'parts_box', mat: 'metal', x: 400, y: -430, r: 22, hp: 48, maxHp: 48, label: '前代备件柜' }, { gearWeldMask: 1, parts: 4, copper: 4, rails: 2, coupler: 1 }),
      makeContainer({ kind: 'ancient_vault', mat: 'metal', x: 0, y: 420, r: 26, hp: 72, maxHp: 72, label: '前代封印圣匣' }, { ancientRelic: 2, magicShard: 5, parts: 3 })
    );

    const nestUid = uid('nest');
    w.props.push({
      uid: nestUid,
      kind: 'monster_nest',
      mat: 'organic',
      x: 740,
      y: 430,
      r: 32,
      hp: 100,
      maxHp: 100,
      hitFlash: 0,
      label: '残骸巢穴',
      drops: { carapace: 3, fat: 3, bone: 3 },
    });
    w.monsters.push(
      createMonster(pickZoneEnemyKind(zone, tier), -440, -390, false, tier),
      createMonster(pickZoneEnemyKind(zone, deepTier), 380, -380, false, deepTier),
      createMonster(pickZoneEnemyKind(zone, deepTier), 0, 410, false, deepTier),
      createMonster(pickZoneEnemyKind(zone, tier), 680, 410, false, tier, nestUid),
      createMonster(pickZoneEnemyKind(zone, deepTier), 790, 460, false, deepTier, nestUid)
    );
  }

  // Design §5.3: past the first stop, an elite (or the act's BOSS) sleeps on the exit track.
  if (w.stationIdx >= 1) w.monsters.push(createExitGuard(zone, tier, !!w.selectedRoute?.boss));

  if (anchorOffsetX !== 0) {
    for (const rd of w.stationRoads) rd.x += anchorOffsetX;
    for (const rm of w.stationRooms) rm.x += anchorOffsetX;
    for (const wl of w.stationWalls) wl.x += anchorOffsetX;
    for (const br of w.stationBarriers) br.x += anchorOffsetX;
    for (const pr of w.props) pr.x += anchorOffsetX;
    for (const m of w.monsters) m.x += anchorOffsetX;
  }
  // Nests keep breeding (simulation updateNests). Past the first stop each is also guarded by
  // an elite from the start; at the first stop the guardian only wakes once the nest is hurt.
  for (const pr of w.props) {
    if (pr.kind !== 'monster_nest') continue;
    pr.nestTimer = 10 + Math.random() * 8;
    pr.guardianWoken = false;
    if (w.stationIdx >= 1) {
      pr.guardianWoken = true;
      w.monsters.push(createNestGuardian(w, pr.x, pr.y, pr.uid));
    }
  }
  if (prevOnTrainMonsters.length > 0) {
    w.monsters.push(...prevOnTrainMonsters);
  }
}

/** Where the exit guardian sleeps: on the rails, a short way ahead of where the locomotive stops. */
export const EXIT_GUARD_DX = LOCO_W + 340;

/**
 * The exit-track guardian (station-local coordinates; the anchor offset is applied with everything else).
 * A BOSS is a much bigger charger that fights in phases.
 */
export function createExitGuard(zone: Exclude<ZoneKind, 'fallen_city'>, tier: ZoneTier, boss: boolean): MonsterEntity {
  const gTier = Math.min(5, tier + 1) as ZoneTier;
  let kind: MonsterKind = boss ? 'charger' : pickZoneEnemyKind(zone, gTier);
  if (kind === 'burrower' || kind === 'sandworm' || kind === 'nightwalker') kind = 'stalker';
  const m = createMonster(kind, EXIT_GUARD_DX, 0, false, gTier, undefined, true);
  m.guard = { homeDX: EXIT_GUARD_DX, homeY: 0, asleep: true, pressure: 0, returning: false };
  m.aiState = 'wander';
  m.title = boss ? '铁闸之主' : '守关者';
  if (boss) {
    m.maxHp = Math.round(m.maxHp * 2.6);
    m.hp = m.maxHp;
    m.r = Math.round(m.r * 1.3);
    m.dps = +(m.dps * 1.15).toFixed(1);
    m.boss = { phase: 0 };
  }
  return m;
}

/** The exit guardian of this station, while it lives. */
export function getExitGuard(w: WorldState): MonsterEntity | null {
  return w.monsters.find((m) => m.guard && m.hp > 0) ?? null;
}

/** An elite guarding (or bursting out of) a nest. Deeper zones field nastier breeds. */
export function createNestGuardian(w: WorldState, x: number, y: number, nestUid: string): MonsterEntity {
  const tier = Math.min(5, w.zoneTier + (w.stationIdx >= 3 ? 1 : 0)) as ZoneTier;
  const kind: MonsterKind =
    w.stationIdx === 0 ? 'hound' : tier >= 3 && Math.random() < 0.5 ? 'charger' : pickZoneEnemyKind(w.zoneKind, tier);
  const a = Math.random() * Math.PI * 2;
  return createMonster(kind, x + Math.cos(a) * 46, y + Math.sin(a) * 30, false, tier, nestUid, true);
}

function hashChunk(seed: number, cx: number, cy: number): number {
  let h = (seed * 374761393 + cx * 668265263 + cy * 2147483647) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return Math.abs((h ^ (h >> 16)) % 10000) / 10000;
}

/**
 * Finite Outer Exploration (#3):
 * - Outer chunks ONLY generate up to ring 2 (max |cx|,|cy| <= OUTER_MAX_RING + 1, radius <= 2600px).
 * - Beyond ring 2 is empty wasteland — finite resources naturally motivate moving to the next station.
 * - NO ancient_vault / ancientRelic spawns in random outer chunks!
 */
export function updateLostWorldExploration(w: WorldState, _dt: number): void {
  if (w.mode !== 'station' || w.trainSpeed >= 8) return;

  const p = w.player;
  const ox = w.stationAnchorX;

  if (!w.disembarkedAtStation && !isPointOnTrain(w, p.x, p.y, 14)) {
    w.disembarkedAtStation = true;
    w.zoneBanner = {
      title: w.stationWorldTitle,
      subtitle: w.stationEpigraph,
      color: ZONE_META[w.zoneKind].color,
      timer: 5.5,
    };
    sfx.lostWorldReveal(w.zoneKind);
    spawnParticles(w, p.x, p.y, '#d9b15f', 14, 110);
  }

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
  if (w.exploredFog.size < 16) {
    for (let fy = -2; fy <= 1; fy++) {
      for (let fx = -3; fx <= 3; fx++) {
        w.exploredFog.add(`${fx},${fy}`);
      }
    }
  }

  const pChunkX = Math.floor(relX / OUTER_CHUNK_SIZE);
  const pChunkY = Math.floor(relY / OUTER_CHUNK_SIZE);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = pChunkX + dx;
      const cy = pChunkY + dy;
      const centerRelX = (cx + 0.5) * OUTER_CHUNK_SIZE;
      const centerRelY = (cy + 0.5) * OUTER_CHUNK_SIZE;

      // Skip inner station core & track corridor
      if (Math.abs(centerRelX) < STATION_BOUND_X && Math.abs(centerRelY) < STATION_BOUND_Y) continue;
      if (Math.abs(centerRelY) < 220) continue;

      // HARD CAP AT RING 2 (#3): beyond ring 2 is empty barren wasteland!
      const ringDist = Math.hypot(centerRelX, centerRelY);
      if (ringDist > STATION_BOUND_X + OUTER_MAX_RING * OUTER_CHUNK_SIZE) continue;

      const chunkKey = `${cx},${cy}`;
      if (w.exploredChunks.has(chunkKey)) continue;
      w.exploredChunks.add(chunkKey);

      const h1 = hashChunk(w.stationIdx + 17, cx, cy);
      const h2 = hashChunk(w.stationIdx + 91, cx, cy);
      const worldX = ox + centerRelX + (h1 - 0.5) * 160;
      const worldY = centerRelY + (h2 - 0.5) * 160;
      const outerTier = Math.min(5, w.zoneTier + (ringDist > 2100 ? 1 : 0)) as ZoneTier;

      if (h1 < 0.34) {
        w.discoveredLandmarks++;
        w.props.push(
          {
            uid: uid('prop'),
            kind: 'arcane_crystal',
            mat: 'crystal',
            x: worldX,
            y: worldY,
            r: 21,
            hp: 42,
            maxHp: 42,
            hitFlash: 0,
            label: '荒野蓝火晶簇',
            drops: { magicShard: 2 + (w.zoneKind === 'sinking_belt' ? 1 : 0) },
          },
          {
            uid: uid('prop'),
            kind: 'scrap_pile',
            mat: 'metal',
            x: worldX + 70,
            y: worldY - 36,
            r: 20,
            hp: 34,
            maxHp: 34,
            hitFlash: 0,
            label: '废铁残骸',
            drops: { scrap: 4, copper: w.zoneKind === 'old_city' ? 2 : 0 },
          }
        );
        w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX - 60, worldY + 35, false, outerTier));
      } else if (h1 < 0.68) {
        w.props.push(
          makeContainer(
            { kind: 'scrap_car', mat: 'metal', x: worldX, y: worldY, r: 30, hp: 54, maxHp: 54, label: '遗弃车辆' },
            { scrap: 4, parts: 1, cloth: 2, ammo: 3, ...rollGearLoot(h2, outerTier) }
          ),
          {
            uid: uid('prop'),
            kind: w.zoneKind === 'ivy_city' ? 'ivy_cluster' : 'bone_pile',
            mat: 'organic',
            x: worldX - 68,
            y: worldY + 28,
            r: 18,
            hp: 26,
            maxHp: 26,
            hitFlash: 0,
            label: w.zoneKind === 'ivy_city' ? '青藤草丛' : '荒原骨堆',
            drops: w.zoneKind === 'ivy_city' ? { herbs: 3, cloth: 2, seeds: 2 } : { bone: 3, hide: 2 },
          }
        );
        w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX + 25, worldY - 72, false, outerTier));
      } else {
        w.props.push(
          {
            uid: uid('prop'),
            kind: 'dry_tree',
            mat: 'wood',
            x: worldX - 42,
            y: worldY - 26,
            r: 18,
            hp: 26,
            maxHp: 26,
            hitFlash: 0,
            label: '荒原枯木',
            drops: { wood: 4 },
          },
          makeContainer(
            { kind: 'wood_crate', mat: 'wood', x: worldX + 44, y: worldY + 24, r: 18, hp: 24, maxHp: 24, label: '遗落木箱' },
            { wood: 3, rawFood: 1, dirtyWater: 2 }
          )
        );
        if (h2 > 0.6) {
          w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, outerTier), worldX, worldY + 70, false, outerTier));
        }
      }
    }
  }
}

export function getStationBoundRadius(): number {
  return STATION_BOUND_X + OUTER_MAX_RING * OUTER_CHUNK_SIZE;
}

export function getZoneDisplayTag(zone: ZoneKind, tier: ZoneTier): string {
  return `${ZONE_META[zone].name} · ${getZoneTierRoman(tier)}`;
}
