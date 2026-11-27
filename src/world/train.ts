import {
  BACKPACK_TIERS,
  CHEST_T1_SLOTS,
  CHEST_T2_SLOTS,
  ITEM_META,
  addToInventory,
  canFitAnyInInventory,
  countAcrossInventories,
  countInInventory,
  createInventory,
  expandInventory,
  quickStackInventories,
  removeAcrossInventories,
  sortInventory,
  transferAllInventories,
  transferSlot,
  type ResourceKey,
  type SlotInventory,
} from '../inventory';
import { BUILDINGS, CRAFT_RECIPES, DEMO_DISABLED_BUILDINGS, type BuildingType } from '../recipes_v2';
import { sfx } from '../sfx';
import {
  BED_REST_HOURS,
  BODY_ARMOR_META,
  CAR_UPKEEP_SCRAP,
  CAR_UPKEEP_WEAR,
  DAY_LENGTH,
  HUNGER_DRAIN_PER_SEC,
  IDLE_FUEL_PER_CAR_PER_SEC,
  IDLE_FUEL_PER_SEC,
  THIRST_DRAIN_PER_SEC,
  CAR_COLS,
  CAR_ROWS,
  CAR_W,
  COUPLER_GAP,
  GEAR_FUEL_MULT,
  HALF_H,
  HEAD_ARMOR_META,
  PLACED_LANTERN_RADIUS,
  RANGED_META,
  LOCO_BUILD_TILES,
  ZONE_WEATHER,
  LOCO_W,
  ROMAN_TIERS,
  TILE,
  ZONE_META,
  HOTBAR_SIZE,
  uid,
  type BodyArmorId,
  type HotbarBinding,
  type CarriageRole,
  type CouplerKind,
  type FlatbedCar,
  type GearLevel,
  type HeadArmorId,
  type HullPanel,
  type HullSide,
  type PickupItem,
  type PlacedBuilding,
  type RangedWeaponId,
  type WorldProp,
  type WorldState,
  type ZoneKind,
  type ZoneTier,
} from './types';

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

/** Every deck that can hold buildings: the locomotive cab first, then the flatbeds. */
export function trainDecks(w: WorldState): FlatbedCar[] {
  return [w.locoDeck, ...w.flatbeds];
}

export function getDeck(w: WorldState, carIdx: number): FlatbedCar | undefined {
  return carIdx === -1 ? w.locoDeck : w.flatbeds[carIdx];
}

export function isLocoBuildTile(col: number, row: number): boolean {
  return LOCO_BUILD_TILES.some(([c, r]) => c === col && r === row);
}

export function worldToTrainTile(
  w: WorldState,
  wx: number,
  wy: number
): { carIdx: number; col: number; row: number } | null {
  if (wy < -HALF_H || wy > HALF_H) return null;
  if (wx >= 0 && wx < LOCO_W) {
    const col = Math.floor(wx / TILE);
    const row = Math.floor((wy + HALF_H) / TILE);
    return isLocoBuildTile(col, row) ? { carIdx: -1, col, row } : null;
  }
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

// --- Car Hull & Edge-Mounted Armor ---
export function createCarHull(cols: number, doorCol: number): HullPanel[] {
  const panels: HullPanel[] = [];
  for (let c = 0; c < cols; c++) {
    const isDoor = c === doorCol;
    panels.push({ uid: uid('hp'), side: 'top', idx: c, isDoor, doorOpen: false, armorTier: 1, hp: isDoor ? 90 : 95, maxHp: isDoor ? 90 : 95, hitFlash: 0 });
    panels.push({ uid: uid('hp'), side: 'bottom', idx: c, isDoor, doorOpen: false, armorTier: 1, hp: isDoor ? 90 : 95, maxHp: isDoor ? 90 : 95, hitFlash: 0 });
  }
  for (let r = 0; r < CAR_ROWS; r++) {
    panels.push({ uid: uid('hp'), side: 'left', idx: r, isDoor: false, doorOpen: false, armorTier: 1, hp: 95, maxHp: 95, hitFlash: 0 });
    panels.push({ uid: uid('hp'), side: 'right', idx: r, isDoor: false, doorOpen: false, armorTier: 1, hp: 95, maxHp: 95, hitFlash: 0 });
  }
  return panels;
}

export function isHullPassage(w: WorldState, carIdx: number, panel: HullPanel): boolean {
  if (panel.idx !== 1 && panel.idx !== 2) return false;
  if (carIdx === -1) return panel.side === 'left' && w.flatbeds.length > 0;
  if (panel.side === 'right') return true;
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

export function isPanelOpenOrBreached(w: WorldState, carIdx: number, side: HullSide, idx: number): boolean {
  const hull = carIdx === -1 ? w.locoHull : w.flatbeds[carIdx]?.hull;
  if (!hull) return false;
  const adj = hull.find((p) => p.side === side && p.idx === idx);
  if (!adj) return false;
  return adj.hp <= 0 || isHullPassage(w, carIdx, adj) || (adj.isDoor && adj.doorOpen);
}

export function findBlockingHull(
  w: WorldState,
  nx: number,
  ny: number,
  radius: number
): { carIdx: number; panel: HullPanel; cx: number; cy: number } | null {
  const thresh = radius + 3.5;
  for (const { carIdx, panel } of getAllHullPanels(w)) {
    if (panel.hp <= 0) continue;
    if (isHullPassage(w, carIdx, panel)) continue;
    if (panel.isDoor && panel.doorOpen) continue;
    const seg = getHullSegment(carIdx, panel);
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

export function reinforceHullPanel(w: WorldState, panel: HullPanel, cx: number, cy: number): boolean {
  if ((panel.armorTier ?? 1) >= 2) return false;
  if (!canAffordCost(w, { scrap: 3 })) {
    sfx.gridDeny();
    return false;
  }
  spendCost(w, { scrap: 3 });
  panel.armorTier = 2;
  panel.maxHp += 85;
  panel.hp = panel.maxHp;
  sfx.build();
  spawnParticles(w, cx, cy, '#d9a441', 10, 110);
  addFloat(w, cx, cy - 16, '装甲 +85', '#d9a441');
  return true;
}

// --- Carriage Role Synergies ---
export function getCarriageRole(car: FlatbedCar): CarriageRole {
  let turrets = 0;
  let pylons = 0;
  let planters = 0;
  let rain = 0;
  let wb = 0;
  let fire = 0;
  let bed = 0;
  let light = 0;
  for (const b of car.buildings) {
    if (b.type === 'turret') turrets++;
    else if (b.type === 'crystal_pylon') pylons++;
    else if (b.type === 'planter') planters++;
    else if (b.type === 'rain_collector') rain++;
    else if (b.type === 'workbench') wb++;
    else if (b.type === 'campfire') fire++;
    else if (b.type === 'bed') bed++;
    else if (b.type === 'lantern') light++;
  }
  if (pylons >= 1) return 'crystal';
  if (turrets >= 1) return 'fortress';
  if (planters >= 2 || (planters >= 1 && rain >= 1)) return 'greenhouse';
  if (wb >= 1 && fire >= 1) return 'workshop';
  if (bed >= 1 && (light >= 1 || fire >= 1)) return 'quarters';
  return 'none';
}

export function getCrystalPylonBonus(w: WorldState): { fuelMult: number; capBonus: number } {
  let mult = 1.0;
  let cap = 0;
  for (const car of trainDecks(w)) {
    for (const b of car.buildings) {
      if (b.type === 'crystal_pylon') {
        mult *= b.tier >= 2 ? 0.78 : 0.86;
        cap += b.tier >= 2 ? 8 : 5;
      }
    }
  }
  return { fuelMult: Math.max(0.55, mult), capBonus: cap };
}

export function getCoreMaxCapacity(w: WorldState): number {
  return 20 + getCrystalPylonBonus(w).capBonus + (w.locoLevel === 2 ? 6 : 0);
}

export function syncFortressHullBonus(car: FlatbedCar): void {
  const isFort = getCarriageRole(car) === 'fortress';
  for (const p of car.hull) {
    const base = (p.isDoor ? 90 : 95) + ((p.armorTier ?? 1) >= 2 ? 85 : 0);
    const targetMax = base + (isFort ? 40 : 0);
    if (targetMax > p.maxHp) p.hp += targetMax - p.maxHp;
    p.maxHp = targetMax;
    p.hp = Math.min(p.hp, p.maxHp);
  }
}

// --- Slot-Based Inventory, Chests & Loot Feed (U2-U6) ---
export function getAllChestGrids(w: WorldState): SlotInventory[] {
  const lists: SlotInventory[] = [];
  for (const car of trainDecks(w)) {
    for (const b of car.buildings) {
      if (b.type === 'chest' && b.chestGrid) lists.push(b.chestGrid);
    }
  }
  return lists;
}

export function getAllStorageGrids(w: WorldState): SlotInventory[] {
  return [w.backpack, ...getAllChestGrids(w)];
}

export function getItemCount(w: WorldState, key: ResourceKey, includeChests = true): number {
  return includeChests ? countAcrossInventories(getAllStorageGrids(w), key) : countInInventory(w.backpack, key);
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
    const need = v ?? 0;
    if (need <= 0) continue;
    removeAcrossInventories(lists, k as ResourceKey, need);
  }
  return true;
}

/** Merge into bottom-left pickup feed (U4) instead of spamming floating world text. */
export function pushLootFeed(w: WorldState, key: ResourceKey, count: number): void {
  if (count <= 0) return;
  const existing = w.lootFeed.find((e) => e.key === key && e.timer > 0.2);
  if (existing) {
    existing.count += count;
    existing.timer = 4.2;
  } else {
    w.lootFeed.push({ key, count, timer: 4.2 });
    if (w.lootFeed.length > 6) w.lootFeed.shift();
  }
}

export function spawnFlyingPickup(w: WorldState, fromX: number, fromY: number, key: ResourceKey): void {
  w.flyingPickups.push({
    uid: uid('fp'),
    key,
    color: ITEM_META[key].color,
    startX: fromX,
    startY: fromY,
    progress: 0,
  });
}

export function giveItem(
  w: WorldState,
  key: ResourceKey,
  amount: number,
  dropOverflow = true,
  fromPos?: { x: number; y: number }
): number {
  let rem = addToInventory(w.backpack, key, amount);
  if (rem > 0 && isPointOnTrain(w, w.player.x, w.player.y, 40)) {
    for (const chest of getAllChestGrids(w)) {
      rem = addToInventory(chest, key, rem);
      if (rem <= 0) break;
    }
  }
  const added = amount - rem;
  if (added > 0) {
    pushLootFeed(w, key, added);
    if (fromPos) spawnFlyingPickup(w, fromPos.x, fromPos.y, key);
  }
  if (rem > 0 && dropOverflow) {
    spawnPickup(w, key, rem, w.player.x, w.player.y + 16, isPointOnTrain(w, w.player.x, w.player.y));
  }
  return added;
}

export function upgradeBackpack(w: WorldState): string | null {
  if (w.backpackLevel >= 4) return '背包已达最高规格';
  const nextLv = (w.backpackLevel + 1) as 2 | 3 | 4;
  const def = BACKPACK_TIERS[nextLv];
  if (!def.cost || !canAffordCost(w, def.cost)) return '材料不足';
  spendCost(w, def.cost);
  w.backpackLevel = nextLv;
  expandInventory(w.backpack, def.capacity);
  sfx.build();
  addFloat(w, w.player.x, w.player.y - 30, `行囊 ${def.capacity}格`, '#d9b15f');
  return null;
}

export function findBuildingByUid(w: WorldState, id: string): PlacedBuilding | null {
  for (const c of trainDecks(w)) {
    const f = c.buildings.find((b) => b.uid === id);
    if (f) return f;
  }
  return null;
}

export function findPropByUid(w: WorldState, id: string): WorldProp | null {
  return w.props.find((p) => p.uid === id) ?? null;
}

export function getOpenContainerProp(w: WorldState): WorldProp | null {
  if (!w.openContainerUid) return null;
  const p = findPropByUid(w, w.openContainerUid);
  if (!p || !p.containerInv || p.hp <= 0) return null;
  return p;
}

export function transferSlotBetween(
  w: WorldState,
  from: 'backpack' | 'chest' | 'container',
  slotIdx: number
): boolean {
  const openChest = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  const openCont = getOpenContainerProp(w);

  if (from === 'container' && openCont?.containerInv) {
    const item = openCont.containerInv.slots[slotIdx];
    if (!item) return false;
    const moved = transferSlot(openCont.containerInv, slotIdx, w.backpack);
    if (moved > 0) {
      sfx.pickup();
      pushLootFeed(w, item.key, moved);
      return true;
    }
    sfx.gridDeny();
    return false;
  }

  if (from === 'chest' && openChest?.chestGrid) {
    const moved = transferSlot(openChest.chestGrid, slotIdx, w.backpack);
    if (moved > 0) {
      sfx.pickup();
      return true;
    }
    sfx.gridDeny();
    return false;
  }

  if (from === 'backpack' && openChest?.chestGrid) {
    const moved = transferSlot(w.backpack, slotIdx, openChest.chestGrid);
    if (moved > 0) {
      sfx.pickup();
      return true;
    }
    sfx.gridDeny();
    return false;
  }
  return false;
}

export function takeAllFromOpenContainer(w: WorldState): number {
  const openCont = getOpenContainerProp(w);
  if (!openCont?.containerInv) return 0;
  let moved = 0;
  for (let i = 0; i < openCont.containerInv.slots.length; i++) {
    const it = openCont.containerInv.slots[i];
    if (!it) continue;
    const n = transferSlot(openCont.containerInv, i, w.backpack);
    if (n > 0) {
      moved += n;
      pushLootFeed(w, it.key, n);
    }
  }
  if (moved > 0) {
    sfx.pickup();
    const empty = openCont.containerInv.slots.every((s) => !s);
    if (empty) {
      openCont.used = true;
      w.openContainerUid = null;
    }
  } else {
    sfx.gridDeny();
  }
  return moved;
}

export function dropBackpackSlot(w: WorldState, slotIdx: number): boolean {
  const it = w.backpack.slots[slotIdx];
  if (!it) return false;
  w.backpack.slots[slotIdx] = null;
  spawnPickup(w, it.key, it.count, w.player.x + 18, w.player.y + 18, isPointOnTrain(w, w.player.x, w.player.y));
  sfx.swing();
  return true;
}

export function quickStackToChests(w: WorldState): number {
  let moved = 0;
  const open = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  if (open?.chestGrid) {
    moved += quickStackInventories(w.backpack, open.chestGrid);
  } else {
    for (const chest of getAllChestGrids(w)) {
      moved += quickStackInventories(w.backpack, chest);
    }
  }
  if (moved > 0) {
    sfx.sort();
    addFloat(w, w.player.x, w.player.y - 24, `存入 ×${moved}`, '#9ef0a8');
  }
  return moved;
}

export function depositAllToOpenChest(w: WorldState): void {
  const open = w.openChestUid ? findBuildingByUid(w, w.openChestUid) : null;
  if (!open?.chestGrid) return;
  const moved = transferAllInventories(w.backpack, open.chestGrid);
  if (moved > 0) {
    sfx.sort();
    addFloat(w, w.player.x, w.player.y - 24, `存入 ×${moved}`, '#9ef0a8');
  }
}

export function canAcceptItem(w: WorldState, key: ResourceKey): boolean {
  if (canFitAnyInInventory(w.backpack, key)) return true;
  if (isPointOnTrain(w, w.player.x, w.player.y, 40)) {
    for (const chest of getAllChestGrids(w)) {
      if (canFitAnyInInventory(chest, key)) return true;
    }
  }
  return false;
}

export function getNearbyPickups(w: WorldState, radius = 155): PickupItem[] {
  const px = w.player.x;
  const py = w.player.y;
  return w.pickups
    .filter((pk) => pk.amount > 0 && Math.hypot(pk.x - px, pk.y - py) <= radius)
    .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
}

export function quickCollectPickup(w: WorldState, pickupUid: string): number {
  const idx = w.pickups.findIndex((pk) => pk.uid === pickupUid && pk.amount > 0);
  if (idx < 0) return 0;
  const pk = w.pickups[idx];
  const added = giveItem(w, pk.key, pk.amount, false, { x: pk.x, y: pk.y });
  if (added <= 0) return 0;
  pk.amount -= added;
  if (pk.amount <= 0) w.pickups.splice(idx, 1);
  sfx.pickup();
  return added;
}

export function sortInventoryGrid(w: WorldState, source: 'backpack' | 'chest'): boolean {
  const inv =
    source === 'backpack'
      ? w.backpack
      : w.openChestUid
        ? findBuildingByUid(w, w.openChestUid)?.chestGrid ?? null
        : null;
  if (!inv) return false;
  const ok = sortInventory(inv);
  if (ok) sfx.sort();
  return ok;
}

// --- Train Stats, Weight & Helpers ---
export function getBuildingWeight(b: PlacedBuilding): number {
  const def = BUILDINGS[b.type];
  return b.tier >= 2 && def.tier2Weight ? def.tier2Weight : def.weight;
}

export function getBuildingDisplayName(b: PlacedBuilding): string {
  const def = BUILDINGS[b.type];
  return b.tier >= 2 && def.tier2Name ? def.tier2Name : def.name;
}

export function getTrainWeight(w: WorldState): number {
  let total = w.hasBumper ? (w.bumperTier >= 2 ? (BUILDINGS.bumper.tier2Weight ?? 2.0) : BUILDINGS.bumper.weight) : 0;
  for (const car of w.flatbeds) {
    total += car.baseWeight;
    for (const b of car.buildings) {
      total += getBuildingWeight(b);
    }
  }
  for (const b of w.locoDeck.buildings) total += getBuildingWeight(b);
  return +total.toFixed(1);
}

export function getTractionLimit(w: WorldState): number {
  return w.locoLevel === 2 ? 14 : 9;
}

export function isOverloaded(w: WorldState): boolean {
  return getTrainWeight(w) > getTractionLimit(w);
}

export function hasWorkbench(w: WorldState): boolean {
  return trainDecks(w).some((c) => c.buildings.some((b) => b.type === 'workbench'));
}

export function hasChest(w: WorldState): boolean {
  return trainDecks(w).some((c) => c.buildings.some((b) => b.type === 'chest'));
}

export function hasBed(w: WorldState): boolean {
  return trainDecks(w).some((c) => c.buildings.some((b) => b.type === 'bed'));
}

export function isNight(w: WorldState): boolean {
  return w.dayTime >= 0.625 && w.dayTime <= 0.925;
}

export function getClockLabel(w: WorldState): string {
  const totalMins = Math.floor(((w.dayTime * 24 + 6) % 24) * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getDayPhaseLabel(w: WorldState): string {
  const t = w.dayTime;
  if (t < 0.05 || t > 0.925) return '黎明';
  if (t < 0.55) return '白昼';
  if (t < 0.625) return '黄昏';
  return '深夜';
}

export function getWeatherLabel(w: WorldState): string {
  if (w.weather === 'rainstorm') return '暴雨';
  if (w.weather === 'blizzard') return '暴风雪';
  if (w.weather === 'sandstorm') return '沙暴';
  if (w.weather === 'fog') return '浓雾';
  return '晴朗';
}

export function getZoneTierRoman(tier: ZoneTier): string {
  return ROMAN_TIERS[Math.max(0, Math.min(4, tier - 1))];
}

export function getArmorStats(w: WorldState): { dr: number; maxHp: number; coldResist: number; speedMult: number; sporeProof: boolean } {
  const body = BODY_ARMOR_META[w.player.bodyArmor];
  const head = HEAD_ARMOR_META[w.player.headArmor];
  const broken = w.player.armorDurability <= 0;
  return {
    dr: broken ? 0 : Math.min(0.65, body.dr + head.dr),
    maxHp: body.maxHp,
    coldResist: Math.min(0.95, body.coldResist + head.coldResist),
    speedMult: body.speedMult,
    sporeProof: head.sporeProof && !broken,
  };
}

export function distToTrainDeck(w: WorldState, x: number, y: number): number {
  const minLeft = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
  const cx = Math.max(minLeft, Math.min(LOCO_W, x));
  const cy = Math.max(-HALF_H, Math.min(HALF_H, y));
  return Math.hypot(x - cx, y - cy);
}

export interface LightSource {
  x: number;
  y: number;
  r: number;
  /** Flame-like flicker (fires/lamps) vs steady glow (crystals). */
  fire: boolean;
}

/** Everything that throws light around it: a set-down lantern, braziers, lamps, pylons, the firebox, glowing relics. */
export function getLightSources(w: WorldState): LightSource[] {
  const out: LightSource[] = [];
  if (w.lanternHolder === 'placed' && w.lanternPos) {
    out.push({ x: w.lanternPos.x, y: w.lanternPos.y, r: PLACED_LANTERN_RADIUS, fire: true });
  }
  if (w.boilerFuel > 0) {
    const bScale = 0.4 + 0.6 * (w.boilerFuel / Math.max(1, w.boilerMax));
    out.push({ x: 54, y: -22, r: 118 * bScale, fire: true });
  }
  for (const car of trainDecks(w)) {
    for (const b of car.buildings) {
      if (b.type === 'campfire' || b.type === 'lantern' || b.type === 'crystal_pylon') {
        const c = getTileCenter(b.carIdx, b.col, b.row);
        const r = b.type === 'campfire' ? (b.tier >= 2 ? 180 : 150) : b.tier >= 2 ? 165 : 125;
        out.push({ x: c.x, y: c.y, r, fire: b.type !== 'crystal_pylon' });
      }
    }
  }
  for (const pr of w.props) {
    if (!pr.used && (pr.kind === 'arcane_crystal' || pr.kind === 'oracle_altar')) {
      out.push({ x: pr.x, y: pr.y, r: 90, fire: false });
    }
  }
  return out;
}

export function isPointLit(w: WorldState, x: number, y: number): boolean {
  return getLightSources(w).some((l) => Math.hypot(x - l.x, y - l.y) < l.r * 0.9);
}

/** Holding a lit lantern in hand (the only thing that widens night vision itself). */
export function playerHasHandLight(w: WorldState): boolean {
  return w.lanternHolder === 'player' && w.player.flashlightOn;
}

/** Lit if carrying the lantern, or standing in any light pool (set-down lantern, brazier, lamp, firebox…). */
export function playerHasActiveLantern(w: WorldState): boolean {
  return playerHasHandLight(w) || isPointLit(w, w.player.x, w.player.y);
}

export function isCarryingLantern(w: WorldState): boolean {
  return w.lanternHolder === 'player';
}

/** Set the carried lantern down just in front of the player — anywhere, deck or ground. */
export function placeLantern(w: WorldState): boolean {
  if (w.lanternHolder !== 'player') return false;
  const p = w.player;
  const x = p.x + Math.cos(p.angle) * 16;
  const y = p.y + Math.sin(p.angle) * 16;
  w.lanternHolder = 'placed';
  w.lanternPos = { x, y, onTrain: isPointOnTrain(w, x, y) };
  w.player.flashlightOn = true;
  sfx.flashlight(false);
  addFloat(w, x, y - 18, '放下手提灯', '#ffd98a');
  return true;
}

export function pickUpLantern(w: WorldState, silent = false): boolean {
  if (w.lanternHolder === 'player') return false;
  w.lanternHolder = 'player';
  w.lanternPos = null;
  w.player.flashlightOn = true;
  if (!silent) {
    sfx.flashlight(true);
    addFloat(w, w.player.x, w.player.y - 26, '拾起手提灯', '#ffd98a');
  }
  return true;
}

/** F key: set the lantern down, or pick it back up when standing next to it. */
export function toggleLantern(w: WorldState): void {
  if (w.lanternHolder === 'player') {
    placeLantern(w);
    return;
  }
  const lp = w.lanternPos;
  if (lp && Math.hypot(w.player.x - lp.x, w.player.y - lp.y) < 64) {
    pickUpLantern(w);
  } else {
    sfx.gridDeny();
    addFloat(w, w.player.x, w.player.y - 26, '手提灯不在身边', '#e0a07a');
  }
}

/** Driving crystal fuel estimate calibrated for 3500-4600m (8-11 min) legs. */
export function estimateRouteFuel(w: WorldState, distanceMeters: number, gear: 1 | 2 | 3 = 2): number {
  const weightFactor = Math.max(0.75, 0.65 + getTrainWeight(w) / 15);
  const overloadMult = isOverloaded(w) ? 1.3 : 1.0;
  const speedMult = GEAR_FUEL_MULT[gear];
  const pylonMult = getCrystalPylonBonus(w).fuelMult;
  return +((distanceMeters / 460) * weightFactor * overloadMult * speedMult * pylonMult).toFixed(1);
}

/** Crystal per second the firebox burns while the train stands still (warmth, cooking, light). */
export function getIdleFuelPerSec(w: WorldState): number {
  return (IDLE_FUEL_PER_SEC + IDLE_FUEL_PER_CAR_PER_SEC * w.flatbeds.length) * getCrystalPylonBonus(w).fuelMult;
}

export function getDailyUpkeepScrap(w: WorldState): number {
  return CAR_UPKEEP_SCRAP * w.flatbeds.length;
}

export type SupplyKind = '燃料' | '食物' | '净水' | '废料';

export interface SupplyForecast {
  /** In-game days the current stock lasts standing still, whichever supply runs out first. */
  days: number;
  limiting: SupplyKind;
  /** Crystal held back for the next leg (selected route, else the cheapest one on offer). */
  fuelReserve: number;
}

/**
 * "At this rate, how long can I stay?" (design §7.5). Fuel counts only what is left after
 * setting aside enough for the next leg, so 0 days on fuel means: leave now or you won't make it.
 */
export function getSupplyForecast(w: WorldState): SupplyForecast {
  const p = w.player;
  const routes = w.selectedRoute ? [w.selectedRoute] : w.availableRoutes;
  const fuelReserve = routes.length > 0 ? Math.min(...routes.map((r) => estimateRouteFuel(w, r.distance, 2))) : 0;

  const perDay: Record<SupplyKind, number> = {
    燃料: getIdleFuelPerSec(w) * DAY_LENGTH,
    食物: HUNGER_DRAIN_PER_SEC * DAY_LENGTH,
    净水: THIRST_DRAIN_PER_SEC * DAY_LENGTH,
    废料: getDailyUpkeepScrap(w),
  };
  const stock: Record<SupplyKind, number> = {
    燃料: w.boilerFuel + getItemCount(w, 'magicShard') - fuelReserve,
    食物: getItemCount(w, 'cookedFood') * 46 + getItemCount(w, 'rawFood') * 20 + p.hunger,
    净水: getItemCount(w, 'water') * 40 + p.thirst,
    废料: getItemCount(w, 'scrap'),
  };

  let limiting: SupplyKind = '燃料';
  let days = Infinity;
  for (const k of Object.keys(perDay) as SupplyKind[]) {
    if (perDay[k] <= 0) continue;
    const d = Math.max(0, stock[k]) / perDay[k];
    if (d < days) {
      days = d;
      limiting = k;
    }
  }
  return { days: Number.isFinite(days) ? days : 99, limiting, fuelReserve };
}

/** One line for the route map / throttle: how long the stock lasts standing here, and what runs out first. */
export function describeSupplyForecast(w: WorldState): string {
  const f = getSupplyForecast(w);
  if (f.limiting === '燃料' && w.boilerFuel + getItemCount(w, 'magicShard') < f.fuelReserve) {
    return `晶石已不够下一段路（约需 ${f.fuelReserve}）`;
  }
  const span = f.days >= 99 ? '很久' : f.days < 1 ? '不到 1 天' : `约 ${f.days < 10 ? f.days.toFixed(1) : Math.round(f.days)} 天`;
  const note = f.limiting === '燃料' ? '（已留出下一段路的晶石）' : '';
  return `照现在的开销，补给还能撑${span}，先耗尽的是${f.limiting}${note}`;
}

/**
 * Dawn upkeep: each carriage, front to back, takes its scrap. A carriage the stock can't cover
 * wears every hull plate (down to 1 hp, never a breach on its own). Returns how many went unpaid.
 */
export function payCarriageUpkeep(w: WorldState): { paid: number; unpaid: number } {
  let paid = 0;
  let unpaid = 0;
  for (const car of w.flatbeds) {
    if (getItemCount(w, 'scrap') >= CAR_UPKEEP_SCRAP) {
      spendCost(w, { scrap: CAR_UPKEEP_SCRAP });
      paid += CAR_UPKEEP_SCRAP;
    } else {
      unpaid++;
      for (const panel of car.hull) {
        panel.hp = Math.max(Math.min(panel.hp, 1), panel.hp - CAR_UPKEEP_WEAR);
        panel.hitFlash = 0.4;
      }
    }
  }
  return { paid, unpaid };
}

export function enterZone(w: WorldState, kind: ZoneKind, tier: ZoneTier): void {
  w.zoneKind = kind;
  w.zoneTier = tier;
  const zm = ZONE_META[kind];
  w.zoneBanner = {
    title: kind === 'fallen_city' ? zm.name : `${zm.name} · ${getZoneTierRoman(tier)}`,
    subtitle: zm.desc,
    color: zm.color,
    timer: 5.0,
  };
  sfx.enterZone(kind, tier);
  // Weather belongs to the region: leaving a storm behind clears it; this region's own weather
  // may roll in after a while (never straight away, and not on the opening run out of the city).
  const zw = ZONE_WEATHER[kind];
  if (w.weather !== 'clear' && w.weather !== zw.kind) w.weather = 'clear';
  if (w.weather === 'clear') {
    w.weatherTimer = w.mode === 'city_escape' ? 9999 : 90 + Math.random() * 150;
  }
}

export function restInBed(w: WorldState, bedTier: 1 | 2, cx = w.player.x, cy = w.player.y): string | null {
  if (w.lastSleepDay >= w.dayCount) {
    sfx.gridDeny();
    return '今日已休息过';
  }
  w.dayTime += BED_REST_HOURS / 24;
  // The firebox keeps burning through the night if the train is standing still.
  if (w.trainSpeed <= 1 && w.mode !== 'city_escape') {
    w.boilerFuel = Math.max(0, w.boilerFuel - getIdleFuelPerSec(w) * (BED_REST_HOURS / 24) * DAY_LENGTH);
  }
  if (w.dayTime >= 1) {
    w.dayTime -= 1;
    w.dayCount++;
  }
  w.lastSleepDay = w.dayCount;
  const heal = bedTier >= 2 ? 55 : 28;
  w.player.hp = Math.min(w.player.maxHp, w.player.hp + heal);
  w.player.stamina = w.player.maxStamina;
  if (bedTier >= 2) {
    w.player.bodyTemp = 100;
  } else if (w.weather === 'blizzard' || isNight(w)) {
    w.player.bodyTemp = Math.max(25, w.player.bodyTemp - 12);
  } else {
    w.player.bodyTemp = Math.min(100, w.player.bodyTemp + 20);
  }
  w.player.hunger = Math.max(10, w.player.hunger - 14);
  w.player.thirst = Math.max(10, w.player.thirst - 16);
  w.lastVitalChangeAt = w.time;
  // Advance watered crops modestly (never free growth without water!)
  for (const car of trainDecks(w)) {
    for (const b of car.buildings) {
      if (b.type === 'planter' && b.planted && (b.watered ?? 0) > 0 && (b.growth ?? 0) < 100) {
        const gain = Math.min(b.watered ?? 0, 45) * (100 / 330);
        b.growth = Math.min(100, (b.growth ?? 0) + gain);
        b.watered = Math.max(0, (b.watered ?? 0) - 45);
      }
    }
  }
  sfx.eat();
  addFloat(w, cx, cy - 20, `+${heal} 生命`, '#8de09e');
  return null;
}

export function addFloat(w: WorldState, x: number, y: number, text: string, color = '#f2eadc', life = 1.15): void {
  if (w.floats.length > 18) w.floats.shift();
  w.floats.push({ x, y, text, color, life });
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
      size: 2 + Math.random() * 3.0,
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
  const sp = 45 + Math.random() * 65;
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

export function makeBuilding(type: BuildingType, carIdx: number, col: number, row: number): PlacedBuilding {
  const def = BUILDINGS[type];
  return {
    uid: uid('bld'),
    type,
    tier: 1,
    carIdx,
    col,
    row,
    hp: def.maxHp,
    maxHp: def.maxHp,
    doorOpen: false,
    planted: false,
    growth: 0,
    watered: 0,
    pestInfested: false,
    storedWater: 0,
    turretAngle: Math.PI,
    turretCooldown: 0,
    turretOutOfAmmo: false,
    chestGrid: type === 'chest' ? createInventory(CHEST_T1_SLOTS) : undefined,
    processRecipeId: null,
    processProgress: 0,
    processDuration: 0,
    processQueue: [],
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

/**
 * Take one carriage out of the train, with everything on it. Carriages behind it close up the gap:
 * their index, buildings and anything riding on them shift one slot forward.
 * Used by death losses and by uncoupling (which drops a carriage and all behind it).
 */
export function removeCarriageAt(w: WorldState, idx: number): FlatbedCar | null {
  if (idx < 0 || idx >= w.flatbeds.length) return null;
  const b = getCarBounds(idx);
  const shift = CAR_W + COUPLER_GAP;
  const slotLeft = b.left - COUPLER_GAP / 2;
  const slotRight = b.right + COUPLER_GAP / 2;
  const inSlot = (x: number, y: number) => x >= slotLeft && x <= slotRight && Math.abs(y) <= HALF_H + 12;
  const behind = (x: number) => x < slotLeft;

  w.monsters = w.monsters.filter((m) => !(m.onTrain && inSlot(m.x, m.y)));
  for (const m of w.monsters) if (m.onTrain && behind(m.x)) m.x += shift;
  w.pickups = w.pickups.filter((pk) => !(pk.onTrain && inSlot(pk.x, pk.y)));
  for (const pk of w.pickups) if (pk.onTrain && behind(pk.x)) pk.x += shift;
  if (w.lanternPos?.onTrain) {
    if (inSlot(w.lanternPos.x, w.lanternPos.y)) pickUpLantern(w, true);
    else if (behind(w.lanternPos.x)) w.lanternPos.x += shift;
  }
  const p = w.player;
  if (inSlot(p.x, p.y)) {
    p.x = b.right + COUPLER_GAP + 26; // step forward onto the carriage (or cab) in front
    p.y = 0;
  } else if (behind(p.x) && Math.abs(p.y) <= HALF_H + 12) {
    p.x += shift;
  }

  const [removed] = w.flatbeds.splice(idx, 1);
  for (let i = idx; i < w.flatbeds.length; i++) {
    w.flatbeds[i].id = i;
    for (const bd of w.flatbeds[i].buildings) bd.carIdx = i;
  }
  const gone = new Set(removed.buildings.map((bd) => bd.uid));
  if (w.openChestUid && gone.has(w.openChestUid)) w.openChestUid = null;
  if (w.openFacilityUid && gone.has(w.openFacilityUid)) w.openFacilityUid = null;
  w.boilerMax = getCoreMaxCapacity(w);
  w.boilerFuel = Math.min(w.boilerFuel, w.boilerMax);
  return removed;
}

/**
 * Uncouple (design §2.5): cut loose the carriage at `idx` and everything behind it — with all that's on board.
 * The first carriage is the core and stays. Returns how many carriages went.
 */
export function uncoupleFrom(w: WorldState, idx: number): number {
  if (idx < 1 || idx >= w.flatbeds.length) return 0;
  let n = 0;
  for (let i = w.flatbeds.length - 1; i >= idx; i--) {
    removeCarriageAt(w, i);
    n++;
  }
  sfx.crash();
  w.shake = Math.max(w.shake, 10);
  return n;
}

/** Hull integrity (0..1) of one carriage, ignoring the open passages between cars. */
export function getCarriageIntegrity(w: WorldState, carIdx: number): number {
  const car = w.flatbeds[carIdx];
  if (!car) return 1;
  let hp = 0;
  let max = 0;
  for (const panel of car.hull) {
    if (isHullPassage(w, carIdx, panel)) continue;
    hp += Math.max(0, panel.hp);
    max += panel.maxHp;
  }
  return max > 0 ? hp / max : 1;
}

// --- Building, In-Place Upgrade (G3) & Facility-Scoped Crafting (D) ---
export function tryPlaceBuilding(w: WorldState, wx: number, wy: number): string | null {
  const def = BUILDINGS[w.selectedBuild];
  if (DEMO_DISABLED_BUILDINGS.has(w.selectedBuild)) return '列车不配备防御设施';
  if (def.requiresWorkbench && !hasWorkbench(w)) return '需先建造工作台';
  if (!canAffordCost(w, def.cost)) return '材料不足';

  if (def.locoFrontOnly) {
    if (w.hasBumper) return '车头已有撞角';
    if (wx < LOCO_W - 20 || wx > LOCO_W + 70 || Math.abs(wy) > HALF_H) {
      return '需装于车头前方';
    }
    spendCost(w, def.cost);
    w.hasBumper = true;
    w.bumperTier = 1;
    w.stats.buildingsPlaced++;
    sfx.build();
    spawnParticles(w, LOCO_W + 15, 0, '#c98438', 12, 130);
    return null;
  }

  const tile = worldToTrainTile(w, wx, wy);
  if (!tile) return '请放于车厢内格';
  const car = getDeck(w, tile.carIdx)!;
  if (car.buildings.some((b) => b.col === tile.col && b.row === tile.row)) {
    return '该格已占用';
  }

  const center = getTileCenter(tile.carIdx, tile.col, tile.row);
  if (def.solid && Math.abs(w.player.x - center.x) < TILE / 2 + 11 && Math.abs(w.player.y - center.y) < TILE / 2 + 11) {
    return '无法盖在脚下';
  }

  spendCost(w, def.cost);
  car.buildings.push(makeBuilding(w.selectedBuild, tile.carIdx, tile.col, tile.row));
  w.stats.buildingsPlaced++;
  w.boilerMax = getCoreMaxCapacity(w);
  syncFortressHullBonus(car);
  sfx.build();
  spawnParticles(w, center.x, center.y, def.color, 10, 95);

  if (isOverloaded(w) && w.gear === 3) {
    w.gear = 2;
  }
  return null;
}

/** Upgrade an existing T1 facility in-place to T2 (preserves position, chest contents, crops). */
/** The building occupying the train tile under a world point, if any. */
export function getBuildingAtPoint(w: WorldState, wx: number, wy: number): PlacedBuilding | null {
  const tile = worldToTrainTile(w, wx, wy);
  if (!tile) return null;
  return getDeck(w, tile.carIdx)?.buildings.find((b) => b.col === tile.col && b.row === tile.row) ?? null;
}

export function upgradeBuildingInPlace(w: WorldState, b: PlacedBuilding): string | null {
  if (b.tier >= 2) return '已为当前最高级';
  const def = BUILDINGS[b.type];
  if (!def.tier2Cost) return '此设施不可升级';
  if (!canAffordCost(w, def.tier2Cost)) return '升级材料不足';
  spendCost(w, def.tier2Cost);
  b.tier = 2;
  if (def.tier2MaxHp) {
    b.maxHp = def.tier2MaxHp;
    b.hp = def.tier2MaxHp;
  }
  if (b.type === 'chest' && b.chestGrid) {
    expandInventory(b.chestGrid, CHEST_T2_SLOTS);
  }
  w.boilerMax = getCoreMaxCapacity(w);
  const c = getTileCenter(b.carIdx, b.col, b.row);
  sfx.build();
  spawnParticles(w, c.x, c.y, '#d9b15f', 16, 130);
  addFloat(w, c.x, c.y - 18, def.tier2Short ?? '已升级', '#d9b15f');
  if (isOverloaded(w) && w.gear === 3) w.gear = 2;
  return null;
}

export function tryRemoveBuilding(w: WorldState, wx: number, wy: number): boolean {
  const tile = worldToTrainTile(w, wx, wy);
  if (!tile) return false;
  const car = getDeck(w, tile.carIdx)!;
  const idx = car.buildings.findIndex((b) => b.col === tile.col && b.row === tile.row);
  if (idx < 0) return false;
  const [removed] = car.buildings.splice(idx, 1);
  if (w.openChestUid === removed.uid) w.openChestUid = null;
  if (w.openFacilityUid === removed.uid) w.openFacilityUid = null;
  w.boilerMax = getCoreMaxCapacity(w);
  w.boilerFuel = Math.min(w.boilerFuel, w.boilerMax);
  syncFortressHullBonus(car);

  const c = getTileCenter(tile.carIdx, tile.col, tile.row);
  if (removed.chestGrid) {
    for (const s of removed.chestGrid.slots) {
      if (s && s.count > 0) spawnPickup(w, s.key, s.count, c.x, c.y, true);
    }
  }

  const def = BUILDINGS[removed.type];
  for (const [k, v] of Object.entries(def.cost)) {
    const refund = Math.max(1, Math.floor((v ?? 0) * 0.75));
    giveItem(w, k as ResourceKey, refund, true, c);
  }
  sfx.hitMetal();
  spawnParticles(w, c.x, c.y, '#bbb', 8, 90);
  return true;
}

/** Facility-scoped crafting: only allowed when standing next to that facility (or passing its UID). */
export function craftAtFacility(w: WorldState, facilityUid: string, recipeId: string): string | null {
  const b = findBuildingByUid(w, facilityUid);
  if (!b) return '请先走到设施旁';
  const rec = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!rec) return '未知配方';

  const expectedFac = b.type === 'workbench' ? 'workbench' : b.type === 'campfire' ? 'campfire' : b.type === 'rain_collector' ? 'filter' : null;
  if (rec.facility !== expectedFac) return '需在对应设施处制作';
  if ((rec.minFacilityTier ?? 1) > b.tier) return `需先升级设施至 T${rec.minFacilityTier}`;

  // Duplicate/prereq checks
  const p = w.player;
  // Only the one-way tool tier upgrades are limited; weapons and armour can be made as often as you like.
  if (rec.id === 'upgrade_pickaxe' && p.toolLevel >= 2) return '已升级';
  if (rec.id === 'upgrade_saw' && p.toolLevel >= 3) return '已升级';
  if (rec.id === 'upgrade_saw' && p.toolLevel < 2) return '需先锻造铁镐';

  if (!canAffordCost(w, rec.cost)) return '材料不足';
  spendCost(w, rec.cost);

  // Timed processing facilities (campfire / filter) queue work so players can walk away!
  if ((rec.processTime ?? 0) > 0) {
    if (!b.processRecipeId) {
      b.processRecipeId = rec.id;
      b.processProgress = 0;
      b.processDuration = rec.processTime!;
    } else {
      b.processQueue = b.processQueue ?? [];
      b.processQueue.push(rec.id);
    }
    sfx.build();
    return null;
  }

  // Instant workbench results
  if (rec.id === 'repair_gear') {
    p.toolDurability = 100;
    p.weaponDurability = 100;
    p.armorDurability = 100;
    sfx.build();
    addFloat(w, p.x, p.y - 24, '已修复', '#9ef0a8');
    return null;
  }
  if (rec.id === 'upgrade_pickaxe') {
    p.toolLevel = 2;
    p.toolDurability = 100;
    sfx.questDone();
    return null;
  }
  if (rec.id === 'upgrade_saw') {
    p.toolLevel = 3;
    p.toolDurability = 100;
    sfx.questDone();
    return null;
  }
  // Weapons & armour: crafting makes a real item. If you don't have that piece on you yet it is
  // equipped straight away; otherwise the new one goes into the backpack as a spare (equip it later
  // for a fresh, full-durability copy, store it, or trade it).
  const gearKey = CRAFT_GEAR_ITEM[rec.id];
  if (gearKey) {
    const g = GEAR_ITEMS[gearKey]!;
    const wearing =
      g.slot === 'ranged'
        ? p.ownedRangedWeapons.includes(g.id)
        : g.slot === 'melee'
          ? p.meleeWeapon === g.id
          : g.slot === 'body'
            ? p.bodyArmor === g.id
            : p.headArmor === g.id;
    if (!wearing) {
      grantGear(w, g);
      if (g.slot !== 'ranged') addFloat(w, p.x, p.y - 26, `已装备 ${ITEM_META[gearKey].short}`, '#edc47c');
    } else {
      giveItem(w, gearKey, 1, true, { x: p.x, y: p.y });
      addFloat(w, p.x, p.y - 26, `${ITEM_META[gearKey].short} +1 · 已放入背包`, '#edc47c', 2.2);
    }
    sfx.questDone();
    return null;
  }

  for (const [k, v] of Object.entries(rec.output)) {
    giveItem(w, k as ResourceKey, v ?? 0);
  }
  sfx.build();
  return null;
}

export function equipBodyArmor(w: WorldState, aid: BodyArmorId): void {
  if (!w.player.ownedBodyArmors.includes(aid)) return;
  const prevMax = w.player.maxHp;
  w.player.bodyArmor = aid;
  w.player.maxHp = BODY_ARMOR_META[aid].maxHp;
  w.player.hp = Math.min(w.player.maxHp, w.player.hp + Math.max(0, w.player.maxHp - prevMax));
  w.player.armorDurability = Math.max(w.player.armorDurability, 100);
}

export function equipHeadArmor(w: WorldState, hid: HeadArmorId): void {
  if (!w.player.ownedHeadArmors.includes(hid)) return;
  w.player.headArmor = hid;
}

export function equipRangedWeapon(w: WorldState, wid: RangedWeaponId): void {
  if (!w.player.ownedRangedWeapons.includes(wid)) return;
  w.player.rangedWeapon = wid;
}

export function tryAttachCarriage(w: WorldState, diyBuild: boolean): string | null {
  const hasStd = getItemCount(w, 'coupler') > 0;
  const hasCrude = getItemCount(w, 'crudeCoupler') > 0;
  if (!hasStd && !hasCrude) return '需要车钩';
  const kind: CouplerKind = hasStd ? 'standard' : 'crude';
  const extraCost: Partial<Record<ResourceKey, number>> = diyBuild ? { scrap: 8, wood: 6 } : {};
  if (diyBuild && !canAffordCost(w, extraCost)) return '需 8 废料 + 6 木材';

  spendCost(w, { [kind === 'standard' ? 'coupler' : 'crudeCoupler']: 1, ...extraCost });
  w.flatbeds.push(createFlatbed(w.flatbeds.length, kind, diyBuild ? 2.8 : 3.0));
  sfx.build();
  w.shake = 7;
  return null;
}

/** Gear control ONLY via locomotive throttle lever (no Q/F remote shifting, per D/U7). */
export function setThrottleGear(w: WorldState, target: GearLevel): string | null {
  if (Math.hypot(w.player.x - 136, w.player.y) > 78) {
    return '需站在车头拉杆旁';
  }
  if (w.mode === 'station' && target > 0 && !w.selectedRoute) {
    w.routeOpen = true;
    sfx.lever();
    return '请先在航线图选定下一站';
  }
  if (w.mode === 'station' && target > 0 && w.monsters.some((m) => m.guard && m.hp > 0)) {
    sfx.gridDeny();
    return '出站的铁轨上还盘踞着守关者';
  }
  if (w.mode === 'station' && target > 0 && w.vineSnare > 20) {
    sfx.gridDeny();
    return '青藤缠住了车轮，需先用工具/斧头斩断';
  }
  const maxGear: GearLevel = isOverloaded(w) ? 2 : 3;
  const clamped = Math.max(0, Math.min(maxGear, target)) as GearLevel;
  w.gear = clamped;
  sfx.lever();
  return null;
}

export const CONSUMABLE_KEYS: ReadonlySet<ResourceKey> = new Set<ResourceKey>([
  'cookedFood',
  'rawFood',
  'water',
  'dirtyWater',
  'bandage',
  'arcanePotion',
]);

/** Apply one consumable's effect (spends 1 from storage). Returns false if none owned. */
function applyConsumable(w: WorldState, key: ResourceKey): boolean {
  const p = w.player;
  if (getItemCount(w, key) <= 0) return false;
  spendCost(w, { [key]: 1 });
  switch (key) {
    case 'bandage':
      p.hp = Math.min(p.maxHp, p.hp + 38);
      p.sickTimer = 0;
      addFloat(w, p.x, p.y - 22, '+38 生命', '#79c993');
      break;
    case 'arcanePotion':
      p.hp = Math.min(p.maxHp, p.hp + 60);
      p.stamina = p.maxStamina;
      p.bodyTemp = 100;
      p.sickTimer = 0;
      p.wellFedTimer = Math.max(p.wellFedTimer, 110);
      addFloat(w, p.x, p.y - 22, '+60 生命', '#6ec4ff');
      break;
    case 'cookedFood':
      p.hunger = Math.min(100, p.hunger + 46);
      p.hp = Math.min(p.maxHp, p.hp + 12);
      p.bodyTemp = Math.min(100, p.bodyTemp + 16);
      p.wellFedTimer = 95;
      addFloat(w, p.x, p.y - 22, '+46 饱食', '#e0a94c');
      break;
    case 'rawFood':
      p.hunger = Math.min(100, p.hunger + 20);
      if (Math.random() < 0.35) {
        p.sickTimer = Math.max(p.sickTimer, 65);
        addFloat(w, p.x, p.y - 36, '腹痛生病', '#d96c5b');
      } else {
        addFloat(w, p.x, p.y - 22, '+20 饱食', '#a3b86c');
      }
      break;
    case 'water':
      p.thirst = Math.min(100, p.thirst + 40);
      addFloat(w, p.x, p.y - 36, '+40 水分', '#5fa8e6');
      break;
    case 'dirtyWater':
      p.thirst = Math.min(100, p.thirst + 26);
      if (Math.random() < 0.55) {
        p.sickTimer = Math.max(p.sickTimer, 75);
        addFloat(w, p.x, p.y - 48, '饮浊致病', '#d96c5b');
      } else {
        addFloat(w, p.x, p.y - 36, '+26 水分', '#6d8278');
      }
      break;
    default:
      return false;
  }
  return true;
}

/** Why a consumable would be wasted right now (null = fine to use). */
function consumableBlocker(w: WorldState, key: ResourceKey): string | null {
  const p = w.player;
  if ((key === 'cookedFood' || key === 'rawFood') && p.hunger >= 98) return '还不饿';
  if ((key === 'water' || key === 'dirtyWater') && p.thirst >= 98) return '还不渴';
  if (key === 'bandage' && p.hp >= p.maxHp && p.sickTimer <= 0) return '没有伤病';
  return null;
}

/** Consume one specific consumable (hotbar hold or backpack "使用"). */
export function consumeItem(w: WorldState, key: ResourceKey): boolean {
  if (!CONSUMABLE_KEYS.has(key)) return false;
  const p = w.player;
  if (getItemCount(w, key) <= 0) {
    addFloat(w, p.x, p.y - 22, `没有${ITEM_META[key].short}`, '#e07a7a');
    sfx.gridDeny();
    return false;
  }
  const block = consumableBlocker(w, key);
  if (block) {
    addFloat(w, p.x, p.y - 22, block, '#bdb2a0');
    sfx.gridDeny();
    return false;
  }
  applyConsumable(w, key);
  w.lastVitalChangeAt = w.time;
  sfx.eat();
  return true;
}

/** Auto-pick the most sensible food / drink / medicine (legacy "eat" with no item chosen). */
export function eatOrDrink(w: WorldState): boolean {
  let did = false;
  const p = w.player;

  if ((p.sickTimer > 0 || p.hp < p.maxHp * 0.65) && getItemCount(w, 'bandage') > 0) {
    did = applyConsumable(w, 'bandage') || did;
  } else if (p.hp < p.maxHp * 0.5 && getItemCount(w, 'arcanePotion') > 0) {
    did = applyConsumable(w, 'arcanePotion') || did;
  } else if (p.hunger < 92 && getItemCount(w, 'cookedFood') > 0) {
    did = applyConsumable(w, 'cookedFood') || did;
  } else if (p.hunger < 85 && getItemCount(w, 'rawFood') > 0) {
    did = applyConsumable(w, 'rawFood') || did;
  }

  if (p.thirst < 84) {
    if (getItemCount(w, 'water') > 0) did = applyConsumable(w, 'water') || did;
    else if (getItemCount(w, 'dirtyWater') > 0) did = applyConsumable(w, 'dirtyWater') || did;
  }

  if (did) {
    w.lastVitalChangeAt = w.time;
    sfx.eat();
  } else {
    sfx.gridDeny();
  }
  return did;
}

// --- Lootable gear items ---------------------------------------------------
/** Workbench recipe → the gear item it produces. */
export const CRAFT_GEAR_ITEM: Partial<Record<string, ResourceKey>> = {
  craft_axe: 'gearAxe',
  craft_crossbow: 'gearCrossbow',
  craft_shotgun: 'gearShotgun',
  craft_rifle: 'gearRifle',
  armor_leather: 'gearLeather',
  armor_iron_vest: 'gearIronVest',
  armor_fur_coat: 'gearFurCoat',
  head_fur_cap: 'gearFurCap',
  head_weld_mask: 'gearWeldMask',
};

export type GearTarget =
  | { slot: 'ranged'; id: Exclude<RangedWeaponId, 'none'> }
  | { slot: 'melee'; id: 'axe' }
  | { slot: 'body'; id: BodyArmorId }
  | { slot: 'head'; id: HeadArmorId };

export const GEAR_ITEMS: Partial<Record<ResourceKey, GearTarget>> = {
  gearCrossbow: { slot: 'ranged', id: 'crossbow' },
  gearShotgun: { slot: 'ranged', id: 'shotgun' },
  gearRifle: { slot: 'ranged', id: 'rifle' },
  gearAxe: { slot: 'melee', id: 'axe' },
  gearLeather: { slot: 'body', id: 'leather_coat' },
  gearIronVest: { slot: 'body', id: 'iron_vest' },
  gearFurCoat: { slot: 'body', id: 'fur_coat' },
  gearFurCap: { slot: 'head', id: 'fur_cap' },
  gearWeldMask: { slot: 'head', id: 'weld_mask' },
};

/** Grant + equip a weapon / armour (from crafting or a looted gear item). */
export function grantGear(w: WorldState, g: GearTarget): void {
  const p = w.player;
  if (g.slot === 'ranged') {
    const isNew = !p.ownedRangedWeapons.includes(g.id);
    if (isNew) p.ownedRangedWeapons.push(g.id);
    p.rangedWeapon = g.id;
    p.weaponDurability = 100;
    autoBindHotbar(w, { kind: 'ranged', weapon: g.id });
    // Tell the player exactly how to reach it: which number key, and what it shoots.
    const slot = getHotbarBindings(w).findIndex((b) => b?.kind === 'ranged' && b.weapon === g.id);
    const meta = RANGED_META[g.id];
    const ammo = meta.ammoKey ? ITEM_META[meta.ammoKey].short : '';
    addFloat(w, p.x, p.y - 30, `获得${meta.short} · 按 ${slot + 1} 切换，左键射击`, '#edc47c', 4.5);
    if (meta.ammoKey && getItemCount(w, meta.ammoKey) <= 0) {
      addFloat(w, p.x, p.y - 48, `还需要${ammo}（工作台制作或搜刮）`, '#e0c078', 4.5);
    }
    if (isNew) sfx.questDone();
  } else if (g.slot === 'melee') {
    p.meleeWeapon = g.id;
    p.weaponDurability = 100;
  } else if (g.slot === 'body') {
    if (!p.ownedBodyArmors.includes(g.id)) p.ownedBodyArmors.push(g.id);
    equipBodyArmor(w, g.id);
  } else {
    if (!p.ownedHeadArmors.includes(g.id)) p.ownedHeadArmors.push(g.id);
    equipHeadArmor(w, g.id);
  }
}

// --- Hotbar ------------------------------------------------------------------
export function defaultHotbarBindings(): HotbarBinding[] {
  return [{ kind: 'tool' }, null, { kind: 'item', key: 'cookedFood' }, { kind: 'item', key: 'water' }, null, null];
}

export function getHotbarBindings(w: WorldState): HotbarBinding[] {
  if (!Array.isArray(w.hotbarBindings) || w.hotbarBindings.length !== HOTBAR_SIZE) {
    w.hotbarBindings = defaultHotbarBindings();
  }
  return w.hotbarBindings;
}

export function getActiveBinding(w: WorldState): HotbarBinding {
  return getHotbarBindings(w)[w.hotbar] ?? null;
}

function sameBinding(a: HotbarBinding, b: HotbarBinding): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'ranged' && b.kind === 'ranged') return a.weapon === b.weapon;
  if (a.kind === 'item' && b.kind === 'item') return a.key === b.key;
  return true;
}

/** Items that make sense to hold in a hotbar slot. */
export function isHotbarItem(key: ResourceKey): boolean {
  return CONSUMABLE_KEYS.has(key) || key === 'rails' || key === 'decoys' || GEAR_ITEMS[key]?.slot === 'ranged';
}

/** Put a binding in a slot; if it already lives in another slot the two swap. */
export function bindHotbarSlot(w: WorldState, slot: number, binding: HotbarBinding): void {
  const bars = getHotbarBindings(w);
  if (slot < 0 || slot >= HOTBAR_SIZE) return;
  for (let i = 0; i < bars.length; i++) {
    if (i !== slot && sameBinding(bars[i], binding)) bars[i] = bars[slot];
  }
  bars[slot] = binding;
}

/** Swap two hotbar slots (drag between slots). */
export function swapHotbarSlots(w: WorldState, a: number, b: number): void {
  const bars = getHotbarBindings(w);
  if (a < 0 || b < 0 || a >= HOTBAR_SIZE || b >= HOTBAR_SIZE || a === b) return;
  [bars[a], bars[b]] = [bars[b], bars[a]];
}

/** Bind a dragged backpack item: ranged gear is equipped first and bound as a weapon. */
export function bindItemToHotbar(w: WorldState, slot: number, key: ResourceKey): boolean {
  const gear = GEAR_ITEMS[key];
  if (gear?.slot === 'ranged') {
    if (getItemCount(w, key) > 0) {
      spendCost(w, { [key]: 1 });
      grantGear(w, gear);
    }
    bindHotbarSlot(w, slot, { kind: 'ranged', weapon: gear.id });
    sfx.uiClick();
    return true;
  }
  if (!isHotbarItem(key)) {
    addFloat(w, w.player.x, w.player.y - 22, '无法放入快捷栏', '#e07a7a');
    sfx.gridDeny();
    return false;
  }
  bindHotbarSlot(w, slot, { kind: 'item', key });
  sfx.uiClick();
  return true;
}

function autoBindHotbar(w: WorldState, binding: HotbarBinding): void {
  const bars = getHotbarBindings(w);
  if (bars.some((b) => sameBinding(b, binding))) return;
  const empty = bars.findIndex((b) => b === null);
  if (empty >= 0) {
    bars[empty] = binding;
    return;
  }
  // Bar full: a new weapon must still be reachable — take the first slot holding a plain item.
  const itemSlot = bars.findIndex((b) => b?.kind === 'item');
  if (itemSlot >= 0) bars[itemSlot] = binding;
}

/**
 * A ranged weapon you don't own yet equips itself the moment it lands in your backpack
 * (looted, picked up, dragged in) — it used to sit there until you found "装备" in the bag.
 */
export function autoEquipNewRangedWeapons(w: WorldState): void {
  for (const [key, g] of Object.entries(GEAR_ITEMS) as Array<[ResourceKey, GearTarget]>) {
    if (g.slot !== 'ranged' || w.player.ownedRangedWeapons.includes(g.id)) continue;
    if (countInInventory(w.backpack, key) <= 0) continue;
    spendCost(w, { [key]: 1 });
    grantGear(w, g);
  }
}

// --- Backpack "使用" ---------------------------------------------------------
/** Verb for the item's main action, or null when it can't be used directly from the bag. */
export function getItemUseVerb(key: ResourceKey): string | null {
  if (key === 'water' || key === 'dirtyWater') return '饮用';
  if (key === 'cookedFood' || key === 'rawFood') return '食用';
  if (key === 'bandage' || key === 'arcanePotion') return '使用';
  if (GEAR_ITEMS[key]) return '装备';
  if (key === 'magicShard') return '投入炉膛';
  if (key === 'decoys') return '投掷';
  return null;
}

/** Hint for items that are used somewhere specific instead of from the bag. */
export function getItemUseHint(key: ResourceKey): string {
  switch (key) {
    case 'rails':
      return '放入快捷栏，在断轨前按住 E 铺设';
    case 'seeds':
      return '站在种植箱旁按 E 播种';
    case 'ancientRelic':
      return '在工作台拆解，或卖给变异行商';
    case 'coupler':
    case 'crudeCoupler':
      return '在车尾按 E 挂接新车厢';
    case 'bolts':
    case 'ammo':
      return '装备对应远程武器后自动消耗';
    default:
      return ITEM_META[key].category === 'material' ? '建造与制造材料（自动调用）' : '';
  }
}

export function useItem(w: WorldState, key: ResourceKey): boolean {
  const p = w.player;
  if (getItemCount(w, key) <= 0) return false;
  if (CONSUMABLE_KEYS.has(key)) return consumeItem(w, key);

  const gear = GEAR_ITEMS[key];
  if (gear) {
    spendCost(w, { [key]: 1 });
    grantGear(w, gear);
    sfx.questDone();
    if (gear.slot !== 'ranged') addFloat(w, p.x, p.y - 26, `已装备 ${ITEM_META[key].short}`, '#edc47c');
    w.lastVitalChangeAt = w.time;
    return true;
  }

  if (key === 'magicShard') {
    if (!isPointOnTrain(w, p.x, p.y, 10)) {
      addFloat(w, p.x, p.y - 22, '需在列车上投入', '#e07a7a');
      sfx.gridDeny();
      return false;
    }
    if (w.boilerFuel >= w.boilerMax - 0.5) {
      addFloat(w, p.x, p.y - 22, '炉膛已满', '#bdb2a0');
      sfx.gridDeny();
      return false;
    }
    spendCost(w, { magicShard: 1 });
    w.boilerFuel = Math.min(w.boilerMax, w.boilerFuel + 1);
    w.totalFuelAdded += 1;
    sfx.crystalCharge();
    addFloat(w, p.x, p.y - 26, '+1 燃料', '#7cc4ff');
    return true;
  }

  if (key === 'decoys') {
    throwDecoy(w, p.x + Math.cos(p.angle) * 130, p.y + Math.sin(p.angle) * 130);
    return true;
  }

  const hint = getItemUseHint(key);
  if (hint) addFloat(w, p.x, p.y - 22, hint, '#bdb2a0');
  sfx.gridDeny();
  return false;
}

export function useBackpackSlot(w: WorldState, slotIdx: number): boolean {
  const it = w.backpack.slots[slotIdx];
  if (!it) return false;
  return useItem(w, it.key);
}

/** Hull integrity summary for the HUD (all outer panels + locomotive). */
export function getHullIntegrity(w: WorldState): { pct: number; worstPct: number; brokenPanels: number; locoPct: number } {
  let hp = 0;
  let max = 0;
  let worst = 1;
  let broken = 0;
  for (const { carIdx, panel } of getAllHullPanels(w)) {
    if (isHullPassage(w, carIdx, panel)) continue;
    hp += Math.max(0, panel.hp);
    max += panel.maxHp;
    const r = panel.hp / panel.maxHp;
    if (r < worst) worst = r;
    if (panel.hp <= 0) broken++;
  }
  return {
    pct: max > 0 ? (hp / max) * 100 : 100,
    worstPct: worst * 100,
    brokenPanels: broken,
    locoPct: (w.locoHp / Math.max(1, w.locoMaxHp)) * 100,
  };
}

export function throwDecoy(w: WorldState, tx: number, ty: number): void {
  if (getItemCount(w, 'decoys') <= 0) {
    sfx.gridDeny();
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
}

export function recordCodex(w: WorldState, id: string, title: string, body: string): void {
  if (w.codex.some((c) => c.id === id)) return;
  w.codex.push({ id, title, body, foundAt: w.stationName });
  w.activeCard = { title, body, subtitle: '已记入笔记', timer: 7.5 };
}
