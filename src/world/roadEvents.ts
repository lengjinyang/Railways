/**
 * Road events (design §4.2): what fills the quiet between stations. Each one happens in the world —
 * beside the track, on the horizon, on the train itself — with no popup, and most of them ask
 * something of you (brake for it or not, spend food or not, guard the crops or the hull).
 * A leg gets a handful at random points; one-off and chained events are remembered across the run.
 * Light boarding raids are just one kind of event among the others.
 */
import { addToInventory, createInventory } from '../inventory';
import { sfx } from '../sfx';
import { liveBoarders, spawnBoarders } from './boarding';
import { createMonster } from './station';
import { getTileCenter, recordCodex, trainDecks } from './train';
import { ZONE_WEATHER, uid, type RoadEventKind, type RoadEventSlot, type WorldState, type ZoneKind } from './types';

/** How far ahead (px) roadside things appear: a few seconds' warning at cruise speed. */
const AHEAD_X = 1180;
const BOARDERS_OMEN_SECONDS = 8;
const STORM_OMEN_SECONDS = 120;

interface EventDef {
  weight: number;
  /** Can it happen on this leg at all? */
  ok?: (w: WorldState, zone: ZoneKind) => boolean;
  /** Happens at most once per run. */
  once?: boolean;
}

const EVENTS: Record<RoadEventKind, EventDef> = {
  boarders: { weight: 0 }, // placed separately (1–2 per leg)
  wreck: { weight: 2 },
  merchant: { weight: 1.1, ok: (w) => w.stationIdx >= 1 },
  waver: { weight: 1.1, ok: (w) => !w.eventFlags?.waverHelped },
  waver_return: { weight: 4, once: true, ok: (w) => !!w.eventFlags?.waverHelped },
  storm: { weight: 1.2, ok: (w, zone) => !!ZONE_WEATHER[zone].kind && w.weather === 'clear' },
  boiler: { weight: 0.9 },
  pests: { weight: 1, ok: (w) => trainDecks(w).some((c) => c.buildings.some((b) => b.type === 'planter' && b.planted)) },
  coupler: { weight: 0.8, ok: (w) => w.flatbeds.some((c) => c.couplerKind === 'crude') },
  ghost_train: { weight: 1, once: true, ok: (w) => w.stationIdx >= 1 },
  graves: { weight: 0.9, once: true },
  stranger: { weight: 0.8, once: true, ok: (w) => w.stationIdx >= 2 && w.flatbeds.length >= 1 },
};

function flags(w: WorldState): Record<string, boolean> {
  if (!w.eventFlags) w.eventFlags = {};
  return w.eventFlags;
}

/**
 * Lay out this leg's events: ~one per 950 m (3–5), spread between 14% and 86% of the way,
 * one or two of them light boarding raids, no repeats within the leg, one-offs once per run.
 */
export function planRoadEvents(w: WorldState, legMeters: number, zone: ZoneKind, rng: () => number = Math.random): RoadEventSlot[] {
  const n = Math.max(3, Math.min(5, Math.round(legMeters / 950)));
  const kinds: RoadEventKind[] = ['boarders'];
  if (w.stationIdx >= 1 && rng() < 0.45) kinds.push('boarders');

  const pool = (Object.keys(EVENTS) as RoadEventKind[]).filter((k) => {
    const d = EVENTS[k];
    if (d.weight <= 0) return false;
    if (d.once && flags(w)[`seen_${k}`]) return false;
    return !d.ok || d.ok(w, zone);
  });
  while (kinds.length < n && pool.length > 0) {
    const total = pool.reduce((s, k) => s + EVENTS[k].weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= EVENTS[pool[idx]].weight;
      if (r <= 0) break;
    }
    kinds.push(pool.splice(idx, 1)[0]);
  }

  // shuffle, then spread over the leg
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const span = 0.72 / kinds.length;
  return kinds.map((kind, i) => ({ kind, at: 0.14 + span * (i + 0.5) + (rng() - 0.5) * span * 0.5, fired: false }));
}

function omenLine(kind: RoadEventKind, zone: ZoneKind): string {
  if (kind === 'storm') {
    return zone === 'monster_wastes' || zone === 'ivy_city'
      ? '地平线那头黑下来了，雷声滚过来——大概两分钟后就到'
      : '地平线那头黑下来了，风里卷着沙——大概两分钟后就到';
  }
  if (zone === 'sinking_belt') return '雾里有东西贴着路基在跑，越来越近';
  if (zone === 'ivy_city') return '高架阴影里有东西跟上了列车';
  return '车尾后面的荒草里，有什么在追着列车跑';
}

/** Something on the road beside the track, a few seconds ahead. */
function pushRoadside(w: WorldState, prop: Omit<WorldState['props'][number], 'uid' | 'hitFlash' | 'x'> & { x?: number }): void {
  w.props.push({ uid: uid('ev'), hitFlash: 0, x: AHEAD_X, ...prop } as WorldState['props'][number]);
}

function fire(w: WorldState, kind: RoadEventKind): boolean {
  const zone = w.zoneKind;
  switch (kind) {
    case 'boarders': {
      if (w.pendingOmen) return false; // one raid warning at a time — try again a little later
      w.pendingOmen = { kind, timer: BOARDERS_OMEN_SECONDS };
      w.wavePhase = 'omen';
      w.omenLabel = omenLine(kind, zone);
      w.omenTimer = w.pendingOmen.timer;
      sfx.omenHowl();
      return true;
    }
    case 'storm': {
      if (!ZONE_WEATHER[zone].kind || w.weather !== 'clear' || (w.stormEta ?? null) !== null) return true;
      w.stormEta = STORM_OMEN_SECONDS;
      if (w.wavePhase === 'calm') w.wavePhase = 'omen';
      w.omenLabel = omenLine(kind, zone);
      return true;
    }
    case 'wreck': {
      const inv = createInventory(6);
      addToInventory(inv, 'scrap', 4 + w.zoneTier);
      addToInventory(inv, 'parts', 1 + Math.floor(w.zoneTier / 2));
      addToInventory(inv, Math.random() < 0.5 ? 'cookedFood' : 'water', 1);
      if (Math.random() < 0.35) addToInventory(inv, 'magicShard', 2);
      pushRoadside(w, {
        kind: 'roadside_wreck',
        mat: 'metal',
        y: -175,
        r: 30,
        hp: 55,
        maxHp: 55,
        label: '路边翻倒的货车',
        isContainer: true,
        searched: false,
        containerInv: inv,
      });
      return true;
    }
    case 'merchant':
      pushRoadside(w, { kind: 'npc_keeper', y: -170, r: 18, hp: 999, maxHp: 999, label: '路边摆摊的变异行商', interactOnly: true });
      return true;
    case 'waver':
      pushRoadside(w, { kind: 'roadside_waver', y: 175, r: 20, hp: 999, maxHp: 999, label: '路边挥手的变异者', interactOnly: true });
      return true;
    case 'waver_return': {
      const inv = createInventory(6);
      addToInventory(inv, 'parts', 3);
      addToInventory(inv, 'water', 2);
      addToInventory(inv, 'cookedFood', 2);
      addToInventory(inv, 'magicShard', 2);
      pushRoadside(w, {
        kind: 'roadside_wreck',
        mat: 'wood',
        y: 170,
        r: 24,
        hp: 40,
        maxHp: 40,
        label: '铁轨边绑着布条的包裹',
        isContainer: true,
        searched: false,
        containerInv: inv,
        loreId: 'waver_return',
        loreTitle: '布条上的记号',
        loreText: '包裹上缠着一截和那天那个变异者衣服一样的布条。里面的东西码得很整齐，像是专门留给经过的列车。',
      });
      return true;
    }
    case 'boiler':
      w.boilerPressure = Math.max(w.boilerPressure, 88);
      sfx.steamVent();
      return true;
    case 'pests': {
      for (const car of trainDecks(w)) {
        const pl = car.buildings.find((b) => b.type === 'planter' && b.planted && !b.pestInfested);
        if (pl) {
          pl.pestInfested = true;
          break;
        }
      }
      return true;
    }
    case 'coupler': {
      const car = w.flatbeds.find((c) => c.couplerKind === 'crude');
      if (car) {
        car.couplerHp = Math.max(8, car.couplerHp - 35);
        sfx.couplerWarn();
      }
      return true;
    }
    case 'ghost_train':
      w.parallelTrainX = -1100;
      return true;
    case 'graves':
      pushRoadside(w, {
        kind: 'nameless_graves',
        y: -185,
        r: 32,
        hp: 999,
        maxHp: 999,
        label: '无字墓群',
        interactOnly: true,
        loreId: 'graves_road',
        loreTitle: '沿轨排列的无字墓碑',
        loreText: '数十座低矮石碑顺着铁道排开。碑面干净得反常，连风化的刻痕都没有。',
      });
      return true;
    case 'stranger': {
      const carIdx = Math.floor(Math.random() * w.flatbeds.length);
      const c = getTileCenter(carIdx, 4, Math.random() < 0.5 ? 0 : 3);
      w.stranger = { x: c.x, y: c.y, timer: 45 };
      return true;
    }
  }
  return true;
}

/** The raid warning ran out: here they come. */
function resolveOmen(w: WorldState): void {
  if (!w.pendingOmen) return;
  w.pendingOmen = null;
  w.omenLabel = '';
  const count = w.zoneKind === 'monster_wastes' || w.zoneTier >= 3 ? 3 : w.stationIdx === 0 ? 1 : 2;
  spawnBoarders(w, count, w.zoneTier);
  w.wavePhase = 'danger';
}

/** The storm seen on the horizon breaks. */
function breakStorm(w: WorldState): void {
  w.stormEta = null;
  if (!w.pendingOmen) {
    w.omenLabel = '';
    if (w.wavePhase === 'omen') w.wavePhase = 'calm';
  }
  const zw = ZONE_WEATHER[w.zoneKind];
  if (zw.kind && w.weather === 'clear') {
    w.weather = zw.kind;
    w.weatherTimer = 110 + Math.random() * 90;
    if (w.weather === 'rainstorm') {
      sfx.thunder();
      w.lightningFlash = 0.7;
    }
  }
}

/** Per-frame, while driving a wasteland leg. `progress` is 0..1 along the leg. */
export function updateRoadEvents(w: WorldState, dt: number, progress: number): void {
  if ((w.stormEta ?? null) !== null) {
    w.stormEta = (w.stormEta as number) - dt;
    if (w.stormEta <= 0) breakStorm(w);
  }
  if (w.pendingOmen) {
    w.pendingOmen.timer -= dt;
    w.omenTimer = w.pendingOmen.timer;
    if (w.pendingOmen.timer <= 0) resolveOmen(w);
  } else if (w.wavePhase === 'danger' && liveBoarders(w) === 0) {
    w.wavePhase = 'calm';
  }

  if (w.stationStreamed) return; // the station is in sight: the road is done with you
  for (const slot of w.roadEvents ?? []) {
    if (slot.fired || progress < slot.at) continue;
    if (fire(w, slot.kind)) {
      slot.fired = true;
      if (EVENTS[slot.kind].once) flags(w)[`seen_${slot.kind}`] = true;
      if (slot.kind === 'waver_return') flags(w).waverReturned = true;
    } else {
      slot.at = Math.min(0.95, slot.at + 0.03);
    }
    break; // at most one per frame
  }
}

/** The figure on the carriage: gone when you get close (or after a while), leaving only a codex line. */
export function updateStranger(w: WorldState, dt: number): void {
  const s = w.stranger;
  if (!s) return;
  s.timer -= dt;
  const close = Math.hypot(w.player.x - s.x, w.player.y - s.y) < 110;
  if (close || s.timer <= 0) {
    w.stranger = null;
    if (close) {
      recordCodex(
        w,
        'stranger_on_train',
        '车上多出来的人',
        '车厢尽头站着一个人，背对着我，衣服和我身上这件一模一样。我走过去的时候，那里只剩一圈还没散的白霜。'
      );
      sfx.lostWorldReveal(w.zoneKind);
    }
  }
}

/** The waver's choice: hand over a cooked meal. Mostly kindness (remembered later), sometimes a trap. */
export function meetWaver(w: WorldState, x: number, y: number, rng: () => number = Math.random): 'helped' | 'trap' {
  if (rng() < 0.7) {
    flags(w).waverHelped = true;
    recordCodex(
      w,
      'waver_helped',
      '路边的变异者',
      '它接过那份熟食，喉咙里发出含糊的音节，把两个零件塞进我手里，又指了指铁轨的前方。'
    );
    return 'helped';
  }
  w.monsters.push(
    createMonster('mutant_raider', x + 25, y - 40, false, w.zoneTier),
    createMonster('hound', x - 30, y + 45, false, w.zoneTier)
  );
  sfx.omenHowl();
  return 'trap';
}
