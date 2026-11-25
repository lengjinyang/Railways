export type ResourceKey =
  | 'wood'
  | 'scrap'
  | 'parts'
  | 'fuel'
  | 'water'
  | 'rawFood'
  | 'cookedFood'
  | 'ammo'
  | 'rails'
  | 'decoys'
  | 'seeds'
  | 'bone'
  | 'carapace'
  | 'coupler'
  | 'crudeCoupler'
  | 'arcanePotion'
  | 'ancientRelic';

export type ItemRarity = 'common' | 'magic' | 'rare' | 'unique';

export interface ItemMeta {
  key: ResourceKey;
  name: string;
  short: string;
  icon: string;
  maxStack: number;
  order: number;
  w: number; // Grid width (cells)
  h: number; // Grid height (cells)
  rarity: ItemRarity;
  desc: string;
}

export const ITEM_META: Record<ResourceKey, ItemMeta> = {
  fuel: {
    key: 'fuel',
    name: '魔晶',
    short: '魔晶',
    icon: '🔮',
    maxStack: 10,
    order: 1,
    w: 1,
    h: 2,
    rarity: 'magic',
    desc: '列车魔核的能量结晶。投入车头锅炉驱动行驶，也可炼制魔药或铸造空间行囊。魔核空了列车就停，每站都要再找。',
  },
  wood: {
    key: 'wood',
    name: '荒原木材',
    short: '木材',
    icon: '🪵',
    maxStack: 15,
    order: 2,
    w: 2,
    h: 1,
    rarity: 'common',
    desc: '建造设施、木墙与粗炼魔晶的基础建材',
  },
  scrap: {
    key: 'scrap',
    name: '铆接废钢板',
    short: '废料',
    icon: '⚙',
    maxStack: 15,
    order: 3,
    w: 2,
    h: 1,
    rarity: 'common',
    desc: '修补车壳、锻造铁墙与交易的通用金属',
  },
  parts: {
    key: 'parts',
    name: '精密零件盒',
    short: '零件',
    icon: '🔩',
    maxStack: 12,
    order: 4,
    w: 1,
    h: 1,
    rarity: 'magic',
    desc: '制造炮塔、铁轨与升级重型工具的关键组件',
  },
  coupler: {
    key: 'coupler',
    name: '军用正规车钩',
    short: '车钩',
    icon: '🔗',
    maxStack: 2,
    order: 5,
    w: 2,
    h: 1,
    rarity: 'rare',
    desc: '稳固挂接新车厢，高速行驶无磨损',
  },
  crudeCoupler: {
    key: 'crudeCoupler',
    name: '土制焊接车钩',
    short: '土钩',
    icon: '⛓',
    maxStack: 2,
    order: 6,
    w: 2,
    h: 1,
    rarity: 'magic',
    desc: '应急挂接车厢，高速颠簸时需及时检修',
  },
  rails: {
    key: 'rails',
    name: '重型铁轨段',
    short: '铁轨',
    icon: '🛤',
    maxStack: 3,
    order: 7,
    w: 3,
    h: 1,
    rarity: 'magic',
    desc: '遇到断裂地裂时在车头前方铺设通关',
  },
  ammo: {
    key: 'ammo',
    name: '土制霰弹盒',
    short: '霰弹',
    icon: '💥',
    maxStack: 24,
    order: 8,
    w: 1,
    h: 1,
    rarity: 'magic',
    desc: '双管霰弹枪弹药',
  },
  water: {
    key: 'water',
    name: '净水壶',
    short: '清水',
    icon: '💧',
    maxStack: 10,
    order: 9,
    w: 1,
    h: 1,
    rarity: 'common',
    desc: '补充水分或浇灌种植箱',
  },
  cookedFood: {
    key: 'cookedFood',
    name: '热麦饼',
    short: '麦饼',
    icon: '🥖',
    maxStack: 10,
    order: 10,
    w: 1,
    h: 1,
    rarity: 'magic',
    desc: '回饱食与生命并触发 90 秒【饱食精力】增益',
  },
  rawFood: {
    key: 'rawFood',
    name: '生口粮',
    short: '生粮',
    icon: '🌾',
    maxStack: 15,
    order: 11,
    w: 1,
    h: 1,
    rarity: 'common',
    desc: '可生吃或于熔炉烤制成热麦饼',
  },
  seeds: {
    key: 'seeds',
    name: '耐旱麦种子',
    short: '种子',
    icon: '🌱',
    maxStack: 20,
    order: 12,
    w: 1,
    h: 1,
    rarity: 'common',
    desc: '播撒在车厢种植箱内循环产粮',
  },
  decoys: {
    key: 'decoys',
    name: '诱饵肉块',
    short: '诱饵',
    icon: '🍖',
    maxStack: 5,
    order: 13,
    w: 1,
    h: 1,
    rarity: 'common',
    desc: '投出后吸引附近怪物 10 秒',
  },
  bone: {
    key: 'bone',
    name: '荒原兽骨',
    short: '兽骨',
    icon: '🦴',
    maxStack: 12,
    order: 14,
    w: 1,
    h: 2,
    rarity: 'common',
    desc: '荒原战利品，可向守塔老人换取废料',
  },
  carapace: {
    key: 'carapace',
    name: '巨兽硬甲壳',
    short: '甲壳',
    icon: '🛡',
    maxStack: 8,
    order: 15,
    w: 2,
    h: 2,
    rarity: 'rare',
    desc: '坚韧甲片，可用于强化升级背包或换取高额废料',
  },
  arcanePotion: {
    key: 'arcanePotion',
    name: '秘法魔药',
    short: '魔药',
    icon: '🧪',
    maxStack: 6,
    order: 16,
    w: 1,
    h: 2,
    rarity: 'rare',
    desc: '强效恢复生命、体力与体温并赋予秘法强化',
  },
  ancientRelic: {
    key: 'ancientRelic',
    name: '远古造物圣匣',
    short: '远古造物',
    icon: '🏺',
    maxStack: 3,
    order: 17,
    w: 2,
    h: 2,
    rarity: 'unique',
    desc: '失落世界中最珍贵的古代遗物，可拆解顶级零件或铸造空间背包',
  },
};

export interface BackpackTierDef {
  level: 1 | 2 | 3 | 4;
  name: string;
  cols: number;
  rows: number;
  desc: string;
  cost?: Partial<Record<ResourceKey, number>>;
}

export const BACKPACK_TIERS: Record<1 | 2 | 3 | 4, BackpackTierDef> = {
  1: {
    level: 1,
    name: 'Lv.1 破旧帆布行囊',
    cols: 6,
    rows: 4,
    desc: '24 格基础网格空间，需巧妙排布大型物资',
  },
  2: {
    level: 2,
    name: 'Lv.2 荒原皮质背囊',
    cols: 8,
    rows: 5,
    desc: '40 格扩容行囊，轻松携带铁轨与大型战利品',
    cost: { wood: 4, scrap: 6, parts: 1 },
  },
  3: {
    level: 3,
    name: 'Lv.3 远征军工战术包',
    cols: 10,
    rows: 5,
    desc: '50 格军工分区背包，深入失落世界远征必备',
    cost: { scrap: 10, parts: 3, carapace: 2 },
  },
  4: {
    level: 4,
    name: 'Lv.4 秘法空间行囊',
    cols: 12,
    rows: 6,
    desc: '72 格顶级秘法扩容背包，以魔晶为媒满载失落世界全部珍宝',
    cost: { parts: 5, fuel: 3, ancientRelic: 1 },
  },
};

export const CHEST_COLS = 8;
export const CHEST_ROWS = 5;

export interface GridItem {
  uid: string;
  key: ResourceKey;
  count: number;
  x: number;
  y: number;
  rotated: boolean;
}

export interface GridInventory {
  cols: number;
  rows: number;
  items: GridItem[];
}

export interface HeldGridItem {
  key: ResourceKey;
  count: number;
  rotated: boolean;
  fromSource: 'backpack' | 'chest' | 'ground';
  fromChestUid?: string | null;
  origX: number;
  origY: number;
  origRotated: boolean;
  origWorldX?: number;
  origWorldY?: number;
  origOnTrain?: boolean;
}

let gridUidSeq = 1;
function nextGridUid(): string {
  return `gi_${gridUidSeq++}`;
}

export function getItemSize(key: ResourceKey, rotated: boolean): { w: number; h: number } {
  const m = ITEM_META[key];
  return rotated ? { w: m.h, h: m.w } : { w: m.w, h: m.h };
}

export function createGrid(cols: number, rows: number): GridInventory {
  return { cols, rows, items: [] };
}

export function expandGrid(grid: GridInventory, cols: number, rows: number): void {
  grid.cols = Math.max(grid.cols, cols);
  grid.rows = Math.max(grid.rows, rows);
}

export function countInGrid(grid: GridInventory, key: ResourceKey): number {
  let total = 0;
  for (const it of grid.items) {
    if (it.key === key) total += it.count;
  }
  return total;
}

export function countAcrossGrids(grids: GridInventory[], key: ResourceKey): number {
  let total = 0;
  for (const g of grids) total += countInGrid(g, key);
  return total;
}

export function getOverlappingItems(
  grid: GridInventory,
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreUid?: string
): GridItem[] {
  const hits: GridItem[] = [];
  for (const it of grid.items) {
    if (ignoreUid && it.uid === ignoreUid) continue;
    const sz = getItemSize(it.key, it.rotated);
    const overlap = x < it.x + sz.w && x + w > it.x && y < it.y + sz.h && y + h > it.y;
    if (overlap) hits.push(it);
  }
  return hits;
}

export function canFitAt(
  grid: GridInventory,
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreUid?: string
): boolean {
  if (x < 0 || y < 0 || x + w > grid.cols || y + h > grid.rows) return false;
  return getOverlappingItems(grid, x, y, w, h, ignoreUid).length === 0;
}

export function findFreePlacement(
  grid: GridInventory,
  key: ResourceKey
): { x: number; y: number; rotated: boolean } | null {
  const m = ITEM_META[key];
  const orientations = m.w === m.h ? [false] : [false, true];
  for (const rotated of orientations) {
    const { w, h } = getItemSize(key, rotated);
    for (let y = 0; y <= grid.rows - h; y++) {
      for (let x = 0; x <= grid.cols - w; x++) {
        if (canFitAt(grid, x, y, w, h)) {
          return { x, y, rotated };
        }
      }
    }
  }
  return null;
}

/** Direct pickup / add into spatial grid: tops up matching stacks first, then places in first open footprint. Returns leftover. */
export function addToGrid(grid: GridInventory, key: ResourceKey, amount: number): number {
  let rem = Math.floor(amount);
  if (rem <= 0) return 0;
  const max = ITEM_META[key].maxStack;

  // 1. Top up existing stacks of same item
  for (const it of grid.items) {
    if (it.key === key && it.count < max) {
      const add = Math.min(max - it.count, rem);
      it.count += add;
      rem -= add;
      if (rem <= 0) return 0;
    }
  }

  // 2. Fit new grid stacks into available spatial cells
  while (rem > 0) {
    const spot = findFreePlacement(grid, key);
    if (!spot) return rem;
    const put = Math.min(max, rem);
    grid.items.push({
      uid: nextGridUid(),
      key,
      count: put,
      x: spot.x,
      y: spot.y,
      rotated: spot.rotated,
    });
    rem -= put;
  }
  return 0;
}

/**
 * POE2 Manual Placement:
 * - If cells are empty -> places held item, returns null.
 * - If overlapping 1 identical stack with room -> merges stack (returns remaining held item or null).
 * - If overlapping 1 different item -> swaps it cleanly into cursor hand!
 * - If out of bounds or overlapping 2+ items -> rejected, returns `{ ok: false }`.
 */
export function placeOrSwapInGrid(
  grid: GridInventory,
  held: HeldGridItem,
  x: number,
  y: number
): { ok: boolean; nextHeld: HeldGridItem | null } {
  const { w, h } = getItemSize(held.key, held.rotated);
  if (x < 0 || y < 0 || x + w > grid.cols || y + h > grid.rows) {
    return { ok: false, nextHeld: held };
  }

  const hits = getOverlappingItems(grid, x, y, w, h);
  if (hits.length === 0) {
    grid.items.push({
      uid: nextGridUid(),
      key: held.key,
      count: held.count,
      x,
      y,
      rotated: held.rotated,
    });
    return { ok: true, nextHeld: null };
  }

  if (hits.length === 1) {
    const target = hits[0];
    const max = ITEM_META[held.key].maxStack;
    // Merge into same item stack if space exists
    if (target.key === held.key && target.count < max) {
      const add = Math.min(max - target.count, held.count);
      target.count += add;
      const rem = held.count - add;
      if (rem <= 0) return { ok: true, nextHeld: null };
      return { ok: true, nextHeld: { ...held, count: rem } };
    }
    // Classic POE2 1-item Swap!
    const idx = grid.items.indexOf(target);
    if (idx >= 0) grid.items.splice(idx, 1);
    grid.items.push({
      uid: nextGridUid(),
      key: held.key,
      count: held.count,
      x,
      y,
      rotated: held.rotated,
    });
    return {
      ok: true,
      nextHeld: {
        key: target.key,
        count: target.count,
        rotated: target.rotated,
        fromSource: held.fromSource,
        fromChestUid: held.fromChestUid,
        origX: target.x,
        origY: target.y,
        origRotated: target.rotated,
      },
    };
  }

  return { ok: false, nextHeld: held };
}

export function pickupItemFromGrid(grid: GridInventory, uid: string): GridItem | null {
  const idx = grid.items.findIndex((it) => it.uid === uid);
  if (idx < 0) return null;
  const [removed] = grid.items.splice(idx, 1);
  return removed;
}

export function removeFromGrid(grid: GridInventory, key: ResourceKey, amount: number): number {
  let need = Math.floor(amount);
  if (need <= 0) return 0;
  for (let i = grid.items.length - 1; i >= 0; i--) {
    const it = grid.items[i];
    if (it.key === key) {
      const take = Math.min(it.count, need);
      it.count -= take;
      need -= take;
      if (it.count <= 0) grid.items.splice(i, 1);
      if (need <= 0) return 0;
    }
  }
  return need;
}

export function removeAcrossGrids(grids: GridInventory[], key: ResourceKey, amount: number): boolean {
  if (countAcrossGrids(grids, key) < amount) return false;
  let need = Math.floor(amount);
  for (const g of grids) {
    need = removeFromGrid(g, key, need);
    if (need <= 0) break;
  }
  return true;
}

export function quickStackGrids(from: GridInventory, to: GridInventory): number {
  const present = new Set<ResourceKey>(to.items.map((it) => it.key));
  let moved = 0;
  for (let i = from.items.length - 1; i >= 0; i--) {
    const it = from.items[i];
    if (!present.has(it.key)) continue;
    const orig = it.count;
    const leftover = addToGrid(to, it.key, it.count);
    const delta = orig - leftover;
    moved += delta;
    if (leftover <= 0) from.items.splice(i, 1);
    else it.count = leftover;
  }
  return moved;
}

export function transferAllGrids(from: GridInventory, to: GridInventory): number {
  let moved = 0;
  for (let i = from.items.length - 1; i >= 0; i--) {
    const it = from.items[i];
    const orig = it.count;
    const leftover = addToGrid(to, it.key, it.count);
    moved += orig - leftover;
    if (leftover <= 0) from.items.splice(i, 1);
    else it.count = leftover;
  }
  return moved;
}

export function getGridUsedCells(grid: GridInventory): number {
  let used = 0;
  for (const it of grid.items) {
    const m = ITEM_META[it.key];
    used += m.w * m.h;
  }
  return used;
}

export function stripRandomGridItems(
  grid: GridInventory,
  ratio = 0.42
): Array<{ key: ResourceKey; count: number }> {
  const lostMap = new Map<ResourceKey, number>();
  for (let i = grid.items.length - 1; i >= 0; i--) {
    const it = grid.items[i];
    if (it.count <= 0) continue;
    const drop = Math.max(1, Math.round(it.count * (ratio * (0.7 + Math.random() * 0.6))));
    const actual = Math.min(it.count, drop);
    if (actual > 0) {
      it.count -= actual;
      lostMap.set(it.key, (lostMap.get(it.key) ?? 0) + actual);
      if (it.count <= 0) grid.items.splice(i, 1);
    }
  }
  return Array.from(lostMap.entries()).map(([key, count]) => ({ key, count }));
}
