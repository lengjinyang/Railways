/**
 * Boarding monsters (design §4.3): they run the train down, crouch, leap and cling to the hull.
 * Once on, each kind does its own thing:
 *  - 撕壳者 (ripper)  claws at its plate until it tears open, then moves to the next one;
 *  - 攀附者 (creeper) crawls along the outside to a facility (crops first) and wrecks it through the wall;
 *  - 钻入者 (borer)   looks for an open door or a hole and climbs in — a shut door keeps it out.
 * You only get at them from inside: stand at that plate and hit or shoot through the gaps.
 * Where they are comes from sound, sparks on the inside of the plate and the carriage shaking — no radar.
 * Boarders move in the train's frame, so the world scroll never applies to them.
 */
import { sfx } from '../sfx';
import { createMonster } from './station';
import {
  findBuildingByUid,
  getCarBounds,
  getAllHullPanels,
  getHullSegment,
  getTileCenter,
  isHullPassage,
  spawnParticles,
  trainDecks,
} from './train';
import {
  HALF_H,
  type BoarderRole,
  type HullPanel,
  type MonsterEntity,
  type MonsterKind,
  type PlacedBuilding,
  type WorldState,
  type ZoneTier,
} from './types';

const ROLE_KIND: Record<BoarderRole, MonsterKind> = { ripper: 'stalker', creeper: 'clinger', borer: 'burrower' };
export const BOARDER_NAMES: Record<BoarderRole, string> = { ripper: '撕壳者', creeper: '攀附者', borer: '钻入者' };

const CROUCH_TIME = 0.7;
const LEAP_TIME = 0.28;
const RIP_INTERVAL = 1.1;
const CREEP_SPEED = 38;
const CREEPER_INTERVAL = 1.0;
const BORER_GIVE_UP = 30;

type PanelRef = { carIdx: number; panel: HullPanel };

/** Outer plates a boarder can hold: the long sides of every carriage and the cab, not the passages. */
function outerPanels(w: WorldState, side?: 'top' | 'bottom'): PanelRef[] {
  return getAllHullPanels(w).filter(
    ({ carIdx, panel }) =>
      (panel.side === 'top' || panel.side === 'bottom') && (!side || panel.side === side) && !isHullPassage(w, carIdx, panel)
  );
}

function findPanel(w: WorldState, uid: string): PanelRef | null {
  return getAllHullPanels(w).find((r) => r.panel.uid === uid) ?? null;
}

/** Where a boarder clings on the outside of a plate. */
function exteriorPoint(ref: PanelRef, r: number): { x: number; y: number } {
  const seg = getHullSegment(ref.carIdx, ref.panel);
  const out = ref.panel.side === 'top' ? -1 : 1;
  return { x: seg.cx, y: seg.cy + out * (r + 2) };
}

/** Just inside the same plate — where the sparks show and where it drops loot. */
function interiorPoint(ref: PanelRef): { x: number; y: number } {
  const seg = getHullSegment(ref.carIdx, ref.panel);
  return { x: seg.cx, y: seg.cy + (ref.panel.side === 'top' ? 16 : -16) };
}

function panPos(w: WorldState, x: number): number {
  return Math.max(-1, Math.min(1, (x - w.player.x) / 420));
}

/** Knocks and scrapes heard from inside, panned to where it happens. */
function knock(w: WorldState, x: number, loud: number): void {
  const d = Math.hypot(x - w.player.x, w.player.y);
  const vol = Math.max(0.15, 1 - d / 900) * loud;
  sfx.unseenStep(panPos(w, x), vol);
  if (loud > 0.6) sfx.hitMetal();
}

/**
 * Bring `count` boarders up from behind / beside the train. `roles` defaults to a mix.
 * They spawn outside on one side, already running at train speed.
 */
export function spawnBoarders(w: WorldState, count: number, tier: ZoneTier, roles?: BoarderRole[]): MonsterEntity[] {
  const out: MonsterEntity[] = [];
  const side: 'top' | 'bottom' = Math.random() < 0.5 ? 'top' : 'bottom';
  const panels = outerPanels(w, side);
  if (panels.length === 0) return out;
  const trainLeft = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
  for (let i = 0; i < count; i++) {
    const role: BoarderRole =
      roles?.[i] ?? (() => {
        const r = Math.random();
        return r < 0.4 ? 'ripper' : r < 0.75 ? 'creeper' : 'borer';
      })();
    const target = panels[Math.floor(Math.random() * panels.length)];
    const sy = side === 'top' ? -1 : 1;
    const m = createMonster(ROLE_KIND[role], trainLeft - 180 - i * 70, sy * (HALF_H + 230 + Math.random() * 80), false, tier);
    m.aiState = 'chase';
    m.board = {
      role,
      phase: 'chase',
      timer: 0,
      side,
      panelUid: target.panel.uid,
      fromX: m.x,
      fromY: m.y,
      crawlToX: null,
      targetUid: null,
      idle: 0,
    };
    w.monsters.push(m);
    out.push(m);
  }
  return out;
}

/** The facility a creeper goes for: growing crops first, then the stove, chests, then anything. */
function pickCreeperTarget(w: WorldState): PlacedBuilding | null {
  const all = trainDecks(w).flatMap((c) => c.buildings);
  const rank = (b: PlacedBuilding) =>
    b.type === 'planter' && b.planted ? 0 : b.type === 'campfire' ? 1 : b.type === 'chest' ? 2 : b.type === 'planter' ? 3 : 4;
  const sorted = all.filter((b) => b.type !== 'wood_wall' && b.type !== 'door').sort((a, b) => rank(a) - rank(b));
  return sorted[0] ?? null;
}

/** An open door or a hole in the hull on this side, nearest to x. */
function findOpening(w: WorldState, side: 'top' | 'bottom', x: number): PanelRef | null {
  let best: PanelRef | null = null;
  let bestD = Infinity;
  for (const ref of outerPanels(w, side)) {
    const open = (ref.panel.isDoor && ref.panel.doorOpen && ref.panel.hp > 0) || ref.panel.hp <= 0;
    if (!open) continue;
    const d = Math.abs(getHullSegment(ref.carIdx, ref.panel).cx - x);
    if (d < bestD) {
      bestD = d;
      best = ref;
    }
  }
  return best;
}

/** Nearest plate on this side to x (to re-anchor after crawling). */
function nearestPanel(w: WorldState, side: 'top' | 'bottom', x: number, intactOnly = false): PanelRef | null {
  let best: PanelRef | null = null;
  let bestD = Infinity;
  for (const ref of outerPanels(w, side)) {
    if (intactOnly && ref.panel.hp <= 0) continue;
    const d = Math.abs(getHullSegment(ref.carIdx, ref.panel).cx - x);
    if (d < bestD) {
      bestD = d;
      best = ref;
    }
  }
  return best;
}

function crawl(m: MonsterEntity, dt: number): boolean {
  const b = m.board!;
  if (b.crawlToX === null) return true;
  const dx = b.crawlToX - m.x;
  if (Math.abs(dx) <= 2) {
    m.x = b.crawlToX;
    b.crawlToX = null;
    return true;
  }
  m.x += Math.sign(dx) * Math.min(Math.abs(dx), CREEP_SPEED * dt);
  return false;
}

function latch(w: WorldState, m: MonsterEntity, ref: PanelRef): void {
  const b = m.board!;
  const ext = exteriorPoint(ref, m.r);
  m.x = ext.x;
  m.y = ext.y;
  b.phase = 'latched';
  b.timer = 0.6;
  b.panelUid = ref.panel.uid;
  ref.panel.hitFlash = 0.35;
  const inside = interiorPoint(ref);
  spawnParticles(w, inside.x, inside.y, '#e6a04c', 6, 90);
  w.shake = Math.max(w.shake, 3.5);
  knock(w, m.x, 1);
}

/** Per-frame boarding AI. Call before the regular monster AI, which skips boarders. */
export function updateBoarders(w: WorldState, dt: number): void {
  for (const m of w.monsters) {
    const b = m.board;
    if (!b || m.hp <= 0) continue;
    m.vx = 0;
    m.vy = 0;

    let ref = findPanel(w, b.panelUid);
    if (!ref) {
      // its carriage is gone (uncoupled): pick another plate, or let go if there's nothing left
      ref = nearestPanel(w, b.side, m.x);
      if (!ref) {
        m.hp = 0;
        continue;
      }
      b.panelUid = ref.panel.uid;
      if (b.phase === 'latched') b.phase = 'chase';
    }

    if (b.phase === 'chase') {
      const ext = exteriorPoint(ref, m.r);
      const dx = ext.x - m.x;
      const dy = ext.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 70) {
        b.phase = 'crouch';
        b.timer = CROUCH_TIME;
        m.windupTimer = CROUCH_TIME;
        m.windupMax = CROUCH_TIME;
        m.windupAngle = Math.atan2(dy, dx);
        m.windupRange = 70;
        sfx.unseenGrowl(panPos(w, m.x), 0.7);
      } else {
        const sp = m.speed * 1.25 * dt;
        m.x += (dx / d) * sp;
        m.y += (dy / d) * sp;
      }
      continue;
    }

    if (b.phase === 'crouch') {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.phase = 'leap';
        b.timer = LEAP_TIME;
        b.fromX = m.x;
        b.fromY = m.y;
      }
      continue;
    }

    if (b.phase === 'leap') {
      b.timer -= dt;
      const ext = exteriorPoint(ref, m.r);
      const t = Math.min(1, 1 - b.timer / LEAP_TIME);
      m.x = b.fromX + (ext.x - b.fromX) * t;
      m.y = b.fromY + (ext.y - b.fromY) * t;
      if (b.timer <= 0) latch(w, m, ref);
      continue;
    }

    // --- latched: rides the hull ---
    m.y = b.side === 'top' ? -HALF_H - m.r - 2 : HALF_H + m.r + 2;
    if (!crawl(m, dt)) {
      if (Math.random() < dt * 2.2) knock(w, m.x, 0.35); // scraping along the plates
      continue;
    }
    b.timer -= dt;
    if (b.timer > 0) continue;

    if (b.role === 'ripper' || (b.role === 'creeper' && !pickCreeperTarget(w))) {
      b.timer = RIP_INTERVAL;
      if (ref.panel.hp > 0) {
        ref.panel.hp = Math.max(0, ref.panel.hp - m.dps * 0.8);
        ref.panel.hitFlash = 0.22;
        const inside = interiorPoint(ref);
        spawnParticles(w, inside.x, inside.y, '#f0b25a', 5, 110);
        knock(w, m.x, 0.8);
        if (Math.abs(w.player.x - m.x) < 200) w.shake = Math.max(w.shake, 2.2);
        if (ref.panel.hp <= 0) {
          sfx.breakMetal();
          w.shake = Math.max(w.shake, 6);
          spawnParticles(w, inside.x, inside.y, '#cc554c', 14, 150);
        }
      } else {
        // torn open — move on to the next plate
        const next = nearestPanel(w, b.side, m.x + (Math.random() < 0.5 ? -44 : 44), true);
        if (next) {
          b.panelUid = next.panel.uid;
          b.crawlToX = getHullSegment(next.carIdx, next.panel).cx;
        }
      }
      continue;
    }

    if (b.role === 'creeper') {
      b.timer = CREEPER_INTERVAL;
      let target = b.targetUid ? findBuildingByUid(w, b.targetUid) : null;
      if (!target || target.hp <= 0) {
        target = pickCreeperTarget(w);
        b.targetUid = target?.uid ?? null;
      }
      if (!target) continue;
      const c = getTileCenter(target.carIdx, target.col, target.row);
      if (Math.abs(c.x - m.x) > 6) {
        b.crawlToX = c.x;
        const near = nearestPanel(w, b.side, c.x);
        if (near) b.panelUid = near.panel.uid;
        continue;
      }
      target.hp -= m.dps;
      target.hitFlash = 0.18;
      if (target.type === 'planter' && target.planted) {
        target.planted = false;
        target.growth = 0;
        spawnParticles(w, c.x, c.y, '#6fb87e', 10, 110);
      } else {
        spawnParticles(w, c.x, c.y, '#e68c4c', 5, 90);
      }
      knock(w, m.x, 0.7);
      sfx.hitWood();
      continue;
    }

    // borer: find a way in; a shut train keeps it out
    b.timer = 0.4;
    const opening = findOpening(w, b.side, m.x);
    if (!opening) {
      b.idle += 0.4;
      if (Math.random() < 0.25) knock(w, m.x, 0.45);
      if (b.idle >= BORER_GIVE_UP) {
        // lets go and tumbles off behind the train (no loot — it was never beaten)
        m.hp = 0;
        spawnParticles(w, m.x, m.y, '#8a7a66', 8, 80);
      }
      continue;
    }
    const seg = getHullSegment(opening.carIdx, opening.panel);
    if (Math.abs(seg.cx - m.x) > 4) {
      b.crawlToX = seg.cx;
      b.panelUid = opening.panel.uid;
      continue;
    }
    const inside = interiorPoint(opening);
    m.board = undefined;
    m.onTrain = true;
    m.x = inside.x;
    m.y = inside.y + (opening.panel.side === 'top' ? 6 : -6);
    m.aiState = 'chase';
    sfx.unseenGrowl(panPos(w, m.x), 1);
    w.shake = Math.max(w.shake, 4);
  }
}

/** A boarder killed on the hull drops its loot just inside the plate, so it doesn't fall off the train. */
export function moveBoarderInsideForLoot(w: WorldState, m: MonsterEntity): void {
  const b = m.board;
  if (!b || b.phase !== 'latched') return;
  const ref = findPanel(w, b.panelUid);
  if (!ref) return;
  const inside = interiorPoint(ref);
  m.x = inside.x;
  m.y = inside.y;
  m.onTrain = true;
}

/** Boarders still trying to get at the train (for the leg's danger state). */
export function liveBoarders(w: WorldState): number {
  return w.monsters.filter((m) => m.board && m.hp > 0).length;
}

