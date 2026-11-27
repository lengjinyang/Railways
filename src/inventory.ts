export type ResourceKey =
  | 'wood'
  | 'scrap'
  | 'cloth'
  | 'hide'
  | 'bone'
  | 'fat'
  | 'copper'
  | 'herbs'
  | 'parts'
  | 'dirtyWater'
  | 'water'
  | 'rawFood'
  | 'cookedFood'
  | 'bandage'
  | 'bolts'
  | 'ammo'
  | 'rails'
  | 'decoys'
  | 'seeds'
  | 'carapace'
  | 'coupler'
  | 'crudeCoupler'
  | 'magicShard'
  | 'arcanePotion'
  | 'ancientRelic'
  | 'gearCrossbow'
  | 'gearShotgun'
  | 'gearRifle'
  | 'gearAxe'
  | 'gearLeather'
  | 'gearIronVest'
  | 'gearFurCoat'
  | 'gearFurCap'
  | 'gearWeldMask';

export type ItemCategory = 'material' | 'supply' | 'ammo' | 'train' | 'relic' | 'gear';

export interface ItemMeta {
  key: ResourceKey;
  name: string;
  short: string;
  glyph: string; // Short CJK/symbol glyph rendered cleanly without cartoon emoji clutter
  color: string;
  maxStack: number;
  order: number;
  category: ItemCategory;
  sourceHint: string;
  desc: string;
}

export const ITEM_META: Record<ResourceKey, ItemMeta> = {
  magicShard: {
    key: 'magicShard',
    name: '秘法晶石',
    short: '晶石',
    glyph: '晶',
    color: '#7cc4ff',
    maxStack: 15,
    order: 1,
    category: 'train',
    sourceHint: '站台矿脉、沉陷带、深层房间',
    desc: '在炉膛中燃出冷蓝火焰的晶体，驱动列车前行，亦可用于铭文与高阶造物。',
  },
  wood: {
    key: 'wood',
    name: '枯木与枕木',
    short: '木材',
    glyph: '木',
    color: '#b88454',
    maxStack: 25,
    order: 2,
    category: 'material',
    sourceHint: '锈原、青藤都市、拆解木箱',
    desc: '最基础的搭建与引火材料。',
  },
  scrap: {
    key: 'scrap',
    name: '废铁板',
    short: '废料',
    glyph: '铁',
    color: '#9aa5b1',
    maxStack: 25,
    order: 3,
    category: 'material',
    sourceHint: '锈原废铁堆、报废车辆、交易',
    desc: '修补车壳、升级设施与交易通货。',
  },
  cloth: {
    key: 'cloth',
    name: '粗布与纤维',
    short: '布料',
    glyph: '布',
    color: '#d4c3a3',
    maxStack: 20,
    order: 4,
    category: 'material',
    sourceHint: '废弃站行李箱、青藤都市藤蔓',
    desc: '缝制衣物、绷带与过滤层。',
  },
  hide: {
    key: 'hide',
    name: '荒兽皮',
    short: '兽皮',
    glyph: '皮',
    color: '#a66a46',
    maxStack: 15,
    order: 5,
    category: 'material',
    sourceHint: '荒犬、追猎者、冲撞兽',
    desc: '鞣制后可做皮革外套与毛皮大衣。',
  },
  bone: {
    key: 'bone',
    name: '兽骨',
    short: '兽骨',
    glyph: '骨',
    color: '#e3ddd3',
    maxStack: 15,
    order: 6,
    category: 'material',
    sourceHint: '荒原与怪物区猎物',
    desc: '可做工具加固或与变异行商交易。',
  },
  fat: {
    key: 'fat',
    name: '油脂',
    short: '油脂',
    glyph: '油',
    color: '#d9b566',
    maxStack: 15,
    order: 7,
    category: 'material',
    sourceHint: '钻入者、掘地虫、怪物区',
    desc: '提炼灯油或简易燃烧物的原料。',
  },
  copper: {
    key: 'copper',
    name: '铜线与管件',
    short: '铜线',
    glyph: '铜',
    color: '#d98348',
    maxStack: 15,
    order: 8,
    category: 'material',
    sourceHint: '旧城街区、前代列车残骸',
    desc: '精密设施、过滤器与高阶武器的关键材料。',
  },
  herbs: {
    key: 'herbs',
    name: '苦叶草药',
    short: '草药',
    glyph: '药',
    color: '#6fb876',
    maxStack: 15,
    order: 9,
    category: 'material',
    sourceHint: '青藤都市、温室遗址',
    desc: '配制草药膏，能压下喝脏水或吸孢子引起的病症。',
  },
  parts: {
    key: 'parts',
    name: '机械零件',
    short: '零件',
    glyph: '件',
    color: '#d9a441',
    maxStack: 12,
    order: 10,
    category: 'material',
    sourceHint: '货运箱、旧城、前代列车',
    desc: '制造铁轨、炮塔与升级工具的核心组件。',
  },
  carapace: {
    key: 'carapace',
    name: '硬甲壳',
    short: '甲壳',
    glyph: '甲',
    color: '#9c789e',
    maxStack: 10,
    order: 11,
    category: 'material',
    sourceHint: '攀附者、掘地虫、冲撞兽',
    desc: '致密的生物甲片，用于护甲与扩容行囊。',
  },
  coupler: {
    key: 'coupler',
    name: '正规车钩',
    short: '车钩',
    glyph: '钩',
    color: '#6ec4d4',
    maxStack: 2,
    order: 12,
    category: 'train',
    sourceHint: '检修厂、变异行商、深层房间',
    desc: '稳固挂接新车厢，高速行驶无磨损。',
  },
  crudeCoupler: {
    key: 'crudeCoupler',
    name: '土制车钩',
    short: '土钩',
    glyph: '焊',
    color: '#d48d48',
    maxStack: 2,
    order: 13,
    category: 'train',
    sourceHint: '工作台焊接',
    desc: '应急挂接车厢，行驶颠簸时会磨损，需要检修。',
  },
  rails: {
    key: 'rails',
    name: '铁轨段',
    short: '铁轨',
    glyph: '轨',
    color: '#b8c2cc',
    maxStack: 2,
    order: 14,
    category: 'train',
    sourceHint: '工作台锻造、路口工具箱',
    desc: '沉陷带断轨时在车头前方铺设通过。占用空间大，每格最多叠 2 段。',
  },
  bolts: {
    key: 'bolts',
    name: '木铁弩箭',
    short: '弩箭',
    glyph: '箭',
    color: '#c49b6c',
    maxStack: 30,
    order: 15,
    category: 'ammo',
    sourceHint: '工作台制作、命中后有概率回收',
    desc: '供手弩与弩台使用，发射安静，不易惊动远处的怪物。',
  },
  ammo: {
    key: 'ammo',
    name: '霰弹',
    short: '霰弹',
    glyph: '弹',
    color: '#d96c5b',
    maxStack: 30,
    order: 16,
    category: 'ammo',
    sourceHint: '工作台装填、军械箱、变异掠夺者',
    desc: '供土制霰弹枪、步枪与自动机枪塔消耗。枪声响亮，会吸引附近怪物。',
  },
  dirtyWater: {
    key: 'dirtyWater',
    name: '浑浊雨水',
    short: '脏水',
    glyph: '浊',
    color: '#6d8278',
    maxStack: 10,
    order: 17,
    category: 'supply',
    sourceHint: '接水斗（下雨时）',
    desc: '未经沉淀过滤的水。可直接浇地；饮用容易生病，需在过滤桶或火盆净化。',
  },
  water: {
    key: 'water',
    name: '净水',
    short: '净水',
    glyph: '水',
    color: '#5fa8e6',
    maxStack: 10,
    order: 18,
    category: 'supply',
    sourceHint: '水塔、过滤桶、火盆煮沸',
    desc: '干净的饮用水，也能浇灌种植箱。',
  },
  rawFood: {
    key: 'rawFood',
    name: '生粮与生肉',
    short: '生食',
    glyph: '生',
    color: '#a3b86c',
    maxStack: 15,
    order: 19,
    category: 'supply',
    sourceHint: '种植箱收获、荒犬掉落、货箱',
    desc: '生吃回复很少且可能生病，应在火盆烤熟或炉灶炖煮。',
  },
  cookedFood: {
    key: 'cookedFood',
    name: '热口粮',
    short: '熟食',
    glyph: '食',
    color: '#e0a94c',
    maxStack: 10,
    order: 20,
    category: 'supply',
    sourceHint: '火盆烤制、铁炉灶炖煮',
    desc: '温热饱腹的食物，恢复饱食与少量生命，带来持续精力与暖意。',
  },
  bandage: {
    key: 'bandage',
    name: '草药绷带',
    short: '绷带',
    glyph: '愈',
    color: '#79c993',
    maxStack: 8,
    order: 21,
    category: 'supply',
    sourceHint: '布料与草药制作',
    desc: '止血回血，并消除喝脏水、生食或孢子引起的病症。',
  },
  seeds: {
    key: 'seeds',
    name: '耐旱麦种',
    short: '种子',
    glyph: '种',
    color: '#73b865',
    maxStack: 20,
    order: 22,
    category: 'supply',
    sourceHint: '杂货柜、温室遗址、青藤都市',
    desc: '播入种植箱并持续浇水，约 5–6 分钟成熟。',
  },
  decoys: {
    key: 'decoys',
    name: '诱饵肉块',
    short: '诱饵',
    glyph: '饵',
    color: '#c9624b',
    maxStack: 6,
    order: 23,
    category: 'supply',
    sourceHint: '随身制作',
    desc: '掷向地面吸引周围怪物 10 秒。',
  },
  arcanePotion: {
    key: 'arcanePotion',
    name: '蓝火药剂',
    short: '药剂',
    glyph: '剂',
    color: '#6ec4ff',
    maxStack: 5,
    order: 24,
    category: 'supply',
    sourceHint: '工作台/深层房间',
    desc: '以晶石与草药调制的烈性药剂，迅速回暖、治病并大幅回复体力与生命。',
  },
  ancientRelic: {
    key: 'ancientRelic',
    name: '遗迹封匣',
    short: '封匣',
    glyph: '匣',
    color: '#d9b15f',
    maxStack: 1,
    order: 25,
    category: 'relic',
    sourceHint: '仅藏于各站深层封锁房间',
    desc: '刻满被磨去铭文的密封金属匣。可拆出车钩与精密零件，或交予变异行商换取大量废料。',
  },
  gearCrossbow: {
    key: 'gearCrossbow',
    name: '手弩',
    short: '手弩',
    glyph: '弩',
    color: '#c49b6c',
    maxStack: 1,
    order: 40,
    category: 'gear',
    sourceHint: '站务物资柜、遗弃车辆',
    desc: '武器装备 · 安静的单发手弩，需要弩箭。在行囊中使用即可装备。',
  },
  gearShotgun: {
    key: 'gearShotgun',
    name: '土制霰弹枪',
    short: '霰弹枪',
    glyph: '霰',
    color: '#d96c5b',
    maxStack: 1,
    order: 41,
    category: 'gear',
    sourceHint: '前代补给箱、遗弃车辆',
    desc: '武器装备 · 近距 5 发扇形爆发，枪声响亮会引来怪物。需要霰弹。在行囊中使用即可装备。',
  },
  gearRifle: {
    key: 'gearRifle',
    name: '栓动步枪',
    short: '步枪',
    glyph: '枪',
    color: '#ffd43b',
    maxStack: 1,
    order: 42,
    category: 'gear',
    sourceHint: '高阶区域的遗弃车辆',
    desc: '武器装备 · 远距穿甲单发，可穿透 2 名敌人。需要霰弹。在行囊中使用即可装备。',
  },
  gearAxe: {
    key: 'gearAxe',
    name: '消防斧',
    short: '消防斧',
    glyph: '斧',
    color: '#e07a5f',
    maxStack: 1,
    order: 43,
    category: 'gear',
    sourceHint: '铜件工具柜、遗弃车辆',
    desc: '近战装备 · 势大力沉、击退强，能快速斩断青藤缠绕。在行囊中使用即可装备。',
  },
  gearLeather: {
    key: 'gearLeather',
    name: '皮革外套',
    short: '皮外套',
    glyph: '革',
    color: '#a66a46',
    maxStack: 1,
    order: 44,
    category: 'gear',
    sourceHint: '商铺货箱、遗弃车辆',
    desc: '护甲装备 · 均衡的护甲与保暖。在行囊中使用即可装备。',
  },
  gearIronVest: {
    key: 'gearIronVest',
    name: '铁片背心',
    short: '铁背心',
    glyph: '铠',
    color: '#98a7b5',
    maxStack: 1,
    order: 45,
    category: 'gear',
    sourceHint: '遗弃车辆',
    desc: '护甲装备 · 高护甲但较沉重（移速 -10%）。在行囊中使用即可装备。',
  },
  gearFurCoat: {
    key: 'gearFurCoat',
    name: '毛皮大衣',
    short: '毛皮衣',
    glyph: '裘',
    color: '#d4b48c',
    maxStack: 1,
    order: 46,
    category: 'gear',
    sourceHint: '遗弃车辆',
    desc: '护甲装备 · 极强抗寒，暴风雪与夜行首选。在行囊中使用即可装备。',
  },
  gearFurCap: {
    key: 'gearFurCap',
    name: '皮帽',
    short: '皮帽',
    glyph: '帽',
    color: '#b88454',
    maxStack: 1,
    order: 47,
    category: 'gear',
    sourceHint: '遗弃车辆',
    desc: '头部装备 · 轻便保暖的头部护具。在行囊中使用即可装备。',
  },
  gearWeldMask: {
    key: 'gearWeldMask',
    name: '焊接面罩',
    short: '面罩',
    glyph: '罩',
    color: '#8fa3b0',
    maxStack: 1,
    order: 48,
    category: 'gear',
    sourceHint: '前代备件柜、遗弃车辆',
    desc: '头部装备 · 额外护甲，并完全隔离青藤都市孢子。在行囊中使用即可装备。',
  },
};

export interface BackpackTierDef {
  level: 1 | 2 | 3 | 4;
  name: string;
  capacity: number; // Number of regular slots (U3)
  cols: number;
  rows: number;
  desc: string;
  cost?: Partial<Record<ResourceKey, number>>;
}

export const BACKPACK_TIERS: Record<1 | 2 | 3 | 4, BackpackTierDef> = {
  1: {
    level: 1,
    name: '旧帆布包',
    capacity: 16,
    cols: 4,
    rows: 4,
    desc: '16 格随身行囊',
  },
  2: {
    level: 2,
    name: '鞣皮背囊',
    capacity: 24,
    cols: 6,
    rows: 4,
    desc: '24 格扩容行囊',
    cost: { cloth: 4, hide: 3, scrap: 4 },
  },
  3: {
    level: 3,
    name: '远行工装包',
    capacity: 32,
    cols: 8,
    rows: 4,
    desc: '32 格铁架背囊',
    cost: { hide: 4, scrap: 8, parts: 3 },
  },
  4: {
    level: 4,
    name: '重型行军包',
    capacity: 40,
    cols: 8,
    rows: 5,
    desc: '40 格加固大背包',
    cost: { carapace: 4, copper: 4, parts: 5, cloth: 6 },
  },
};

export const CHEST_T1_SLOTS = 16;
export const CHEST_T2_SLOTS = 32;

export interface SlotItem {
  uid: string;
  key: ResourceKey;
  count: number;
  /** Optional freshness 0..100 for perishable foods (rawFood / cookedFood) */
  freshness?: number;
}

export interface SlotInventory {
  capacity: number;
  slots: Array<SlotItem | null>;
}

// Backwards-compatible aliases during migration
export type GridItem = SlotItem;
export type GridInventory = SlotInventory;

let slotUidSeq = 1;
function nextSlotUid(): string {
  return `si_${slotUidSeq++}`;
}

export function isPerishable(key: ResourceKey): boolean {
  return key === 'rawFood' || key === 'cookedFood';
}

export function createInventory(capacity: number): SlotInventory {
  return {
    capacity,
    slots: Array.from({ length: capacity }, () => null),
  };
}

export function expandInventory(inv: SlotInventory, newCapacity: number): void {
  if (newCapacity <= inv.capacity) return;
  while (inv.slots.length < newCapacity) {
    inv.slots.push(null);
  }
  inv.capacity = newCapacity;
}

export function getUsedSlots(inv: SlotInventory): number {
  let used = 0;
  for (const s of inv.slots) {
    if (s && s.count > 0) used++;
  }
  return used;
}

export function countInInventory(inv: SlotInventory, key: ResourceKey): number {
  let total = 0;
  for (const s of inv.slots) {
    if (s && s.key === key) total += s.count;
  }
  return total;
}

export function countAcrossInventories(invs: SlotInventory[], key: ResourceKey): number {
  let total = 0;
  for (const inv of invs) total += countInInventory(inv, key);
  return total;
}

/** Add items: fills existing partial stacks first, then empty slots. Returns leftover. */
export function addToInventory(inv: SlotInventory, key: ResourceKey, amount: number): number {
  let rem = Math.floor(amount);
  if (rem <= 0) return 0;
  const max = ITEM_META[key].maxStack;

  // 1. Top up existing stacks
  for (const s of inv.slots) {
    if (s && s.key === key && s.count < max) {
      const add = Math.min(max - s.count, rem);
      s.count += add;
      if (isPerishable(key)) {
        s.freshness = Math.min(100, Math.round(((s.freshness ?? 100) * (s.count - add) + 100 * add) / s.count));
      }
      rem -= add;
      if (rem <= 0) return 0;
    }
  }

  // 2. Fill empty slots
  for (let i = 0; i < inv.capacity && rem > 0; i++) {
    if (!inv.slots[i]) {
      const put = Math.min(max, rem);
      inv.slots[i] = {
        uid: nextSlotUid(),
        key,
        count: put,
        freshness: isPerishable(key) ? 100 : undefined,
      };
      rem -= put;
    }
  }
  return rem;
}

export function removeFromInventory(inv: SlotInventory, key: ResourceKey, amount: number): number {
  let need = Math.floor(amount);
  if (need <= 0) return 0;
  for (let i = inv.slots.length - 1; i >= 0; i--) {
    const s = inv.slots[i];
    if (s && s.key === key) {
      const take = Math.min(s.count, need);
      s.count -= take;
      need -= take;
      if (s.count <= 0) inv.slots[i] = null;
      if (need <= 0) return 0;
    }
  }
  return need;
}

export function removeAcrossInventories(invs: SlotInventory[], key: ResourceKey, amount: number): boolean {
  if (countAcrossInventories(invs, key) < amount) return false;
  let need = Math.floor(amount);
  for (const inv of invs) {
    need = removeFromInventory(inv, key, need);
    if (need <= 0) break;
  }
  return true;
}

export function canFitAnyInInventory(inv: SlotInventory, key: ResourceKey): boolean {
  const max = ITEM_META[key].maxStack;
  for (const s of inv.slots) {
    if (!s) return true;
    if (s.key === key && s.count < max) return true;
  }
  return false;
}

/** Move a single slot's contents from one inventory to another. */
export function transferSlot(from: SlotInventory, slotIdx: number, to: SlotInventory): number {
  const item = from.slots[slotIdx];
  if (!item || item.count <= 0) return 0;
  const orig = item.count;
  const leftover = addToInventory(to, item.key, item.count);
  const moved = orig - leftover;
  if (leftover <= 0) from.slots[slotIdx] = null;
  else item.count = leftover;
  return moved;
}

/** Quick-stack matching item types from `from` into `to`. */
export function quickStackInventories(from: SlotInventory, to: SlotInventory): number {
  const present = new Set<ResourceKey>();
  for (const s of to.slots) {
    if (s && s.count > 0) present.add(s.key);
  }
  let moved = 0;
  for (let i = 0; i < from.slots.length; i++) {
    const s = from.slots[i];
    if (!s || !present.has(s.key)) continue;
    moved += transferSlot(from, i, to);
  }
  return moved;
}

export function transferAllInventories(from: SlotInventory, to: SlotInventory): number {
  let moved = 0;
  for (let i = 0; i < from.slots.length; i++) {
    if (!from.slots[i]) continue;
    moved += transferSlot(from, i, to);
  }
  return moved;
}

/** Merge duplicate stacks and sort neatly by ITEM_META.order. */
export function sortInventory(inv: SlotInventory): boolean {
  const totals = new Map<ResourceKey, { count: number; freshnessSum: number }>();
  for (const s of inv.slots) {
    if (!s || s.count <= 0) continue;
    const prev = totals.get(s.key) ?? { count: 0, freshnessSum: 0 };
    prev.count += s.count;
    prev.freshnessSum += (s.freshness ?? 100) * s.count;
    totals.set(s.key, prev);
  }
  if (totals.size === 0) return false;

  const keys = Array.from(totals.keys()).sort((a, b) => ITEM_META[a].order - ITEM_META[b].order);
  inv.slots = Array.from({ length: inv.capacity }, () => null);
  let idx = 0;
  for (const key of keys) {
    const info = totals.get(key)!;
    const avgFresh = isPerishable(key) ? Math.max(5, Math.round(info.freshnessSum / info.count)) : undefined;
    const max = ITEM_META[key].maxStack;
    let rem = info.count;
    while (rem > 0 && idx < inv.capacity) {
      const put = Math.min(max, rem);
      inv.slots[idx++] = {
        uid: nextSlotUid(),
        key,
        count: put,
        freshness: avgFresh,
      };
      rem -= put;
    }
  }
  return true;
}

/** Slowly decay perishable foods (rawFood / cookedFood). Returns count of spoiled items removed. */
export function tickPerishables(inv: SlotInventory, dt: number, decayMult = 1.0): number {
  let spoiled = 0;
  for (let i = 0; i < inv.slots.length; i++) {
    const s = inv.slots[i];
    if (!s || !isPerishable(s.key)) continue;
    // Raw food lasts ~18 min, cooked food lasts ~28 min
    const baseRate = s.key === 'rawFood' ? 100 / 1080 : 100 / 1680;
    s.freshness = Math.max(0, (s.freshness ?? 100) - baseRate * decayMult * dt);
    if (s.freshness <= 0) {
      spoiled += s.count;
      inv.slots[i] = null;
    }
  }
  return spoiled;
}

// Legacy compatibility aliases for minimal churn across modules
export const createGrid = createInventory;
export const expandGrid = expandInventory;
export const countInGrid = countInInventory;
export const countAcrossGrids = countAcrossInventories;
export const addToGrid = addToInventory;
export const removeFromGrid = removeFromInventory;
export const removeAcrossGrids = removeAcrossInventories;
export const canFitAnyInGrid = canFitAnyInInventory;
export const quickStackGrids = quickStackInventories;
export const transferAllGrids = transferAllInventories;
export const getGridUsedCells = getUsedSlots;
export const autoSortGrid = sortInventory;
