import React, { useState } from 'react';
import {
  Heart,
  Utensils,
  Droplets,
  Thermometer,
  Activity,
  Map as MapIcon,
  Wrench,
  Crosshair,
  Hammer,
  Lamp,
  Package,
  BrickWall,
  Lock,
  TrainFront,
} from 'lucide-react';
import { BUILDINGS, type BuildingType } from '../recipes_v2';
import {
  GEAR_LABELS,
  HALF_H,
  ITEM_META,
  LOCO_W,
  MELEE_META,
  RANGED_META,
  TOOL_META,
  ZONE_META,
  canAffordCost,
  describeSupplyForecast,
  getCarBounds,
  getClockLabel,
  getHotbarBindings,
  getHullIntegrity,
  getItemCount,
  getTractionLimit,
  getTrainWeight,
  getWeatherLabel,
  hasWorkbench,
  isOverloaded,
  type GearLevel,
  type HotbarBinding,
  type HotbarSlot,
  type ResourceKey,
  type WorldState,
} from '../world';
import { ItemGlyph } from './ItemGlyph';
import { acceptsDrag, readDrag, startDrag } from './dnd';

export interface HudActions {
  onSetThrottleGear: (gear: GearLevel) => void;
  onToggleRoute: () => void;
  onSelectHotbar: (slot: HotbarSlot) => void;
  onSelectBuild: (bId: BuildingType) => void;
  onToggleBuild: () => void;
  onToggleLantern: () => void;
  onBindItem: (slot: number, key: ResourceKey) => void;
  onSwapHotbar: (a: number, b: number) => void;
  onClearHotbar: (slot: number) => void;
}

interface HudProps {
  world: WorldState;
  actions: HudActions;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const BUILD_CATEGORIES: Array<{ id: string; label: string; icon: React.ReactNode; items: BuildingType[] }> = [
  { id: 'craft', label: '工坊', icon: <Hammer className="w-4 h-4" />, items: ['workbench', 'campfire', 'rain_collector', 'planter'] },
  { id: 'living', label: '起居', icon: <Package className="w-4 h-4" />, items: ['chest', 'bed', 'lantern'] },
  { id: 'structure', label: '构造', icon: <BrickWall className="w-4 h-4" />, items: ['wood_wall', 'door', 'crystal_pylon'] },
];

/* ──────────────────────────────────────────────────────────────────────────
   Vitals — compact gauges centred above the hotbar
   ────────────────────────────────────────────────────────────────────────── */
const Vital: React.FC<{ icon: React.ReactNode; label: string; pct: number; color: string; danger?: boolean }> = ({
  icon,
  label,
  pct,
  color,
  danger,
}) => (
  <div className="flex items-center gap-1.5" title={`${label} ${Math.round(pct)}%`}>
    <span className={`w-3.5 h-3.5 flex items-center justify-center shrink-0 ${danger ? 'text-rust anim-heartbeat' : 'text-ash'}`}>
      {icon}
    </span>
    <div className="meter meter-ticks w-[84px] h-[5px]">
      <div className="meter-fill" style={{ width: `${clampPct(pct)}%`, backgroundColor: danger ? '#dc5f4f' : color }} />
    </div>
    <span className={`w-[22px] text-right font-mono text-[10px] ${danger ? 'text-rust' : 'text-ash-dim'}`}>
      {Math.round(clampPct(pct))}
    </span>
  </div>
);

const Readout: React.FC<{ label: string; value: React.ReactNode; tone?: string; children?: React.ReactNode }> = ({
  label,
  value,
  tone = 'text-parchment',
  children,
}) => (
  <div className="flex flex-col gap-1 min-w-[64px]">
    <span className="text-[9.5px] tracking-[0.18em] text-ash-dim">{label}</span>
    <span className={`font-mono text-[12px] leading-none ${tone}`}>{value}</span>
    {children}
  </div>
);

/* ──────────────────────────────────────────────────────────────────────────
   Hotbar slot
   ────────────────────────────────────────────────────────────────────────── */
interface SlotView {
  icon: React.ReactNode;
  name: string;
  count?: number;
  sub?: string;
  empty?: boolean;
  title: string;
}

function describeBinding(w: WorldState, b: HotbarBinding): SlotView {
  const p = w.player;
  if (!b) return { icon: null, name: '', empty: true, title: '空槽 · 从行囊拖入物品' };
  if (b.kind === 'tool') {
    const melee = MELEE_META[p.meleeWeapon];
    return {
      icon: <Wrench className="w-[18px] h-[18px]" />,
      name: TOOL_META[p.toolLevel].short,
      sub: p.meleeWeapon === 'axe' ? '斧' : `Lv${p.toolLevel}`,
      title: `${TOOL_META[p.toolLevel].name} / ${melee.name}\n左键挥击 · 采集 · 修理`,
    };
  }
  if (b.kind === 'ranged') {
    const meta = RANGED_META[b.weapon];
    const owned = p.ownedRangedWeapons.includes(b.weapon);
    return {
      icon: <Crosshair className="w-[18px] h-[18px]" />,
      name: meta.short,
      count: meta.ammoKey ? getItemCount(w, meta.ammoKey) : undefined,
      sub: owned ? undefined : '未持有',
      title: `${meta.name}\n${meta.desc}`,
    };
  }
  const meta = ITEM_META[b.key];
  const cnt = getItemCount(w, b.key);
  const hold = b.key !== 'decoys' && b.key !== 'rails';
  return {
    icon: <ItemGlyph itemKey={b.key} size={22} dim={cnt === 0} />,
    name: meta.short,
    count: cnt,
    sub: hold ? '长按' : undefined,
    title: `${meta.name}\n${meta.desc}`,
  };
}

/** Wave marks along a wasteland leg (must match the simulation's wave pacing). */

function formatEta(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `约 ${m}:${String(s).padStart(2, '0')}` : `约 ${s}s`;
}

/** Top-centre journey strip while driving: where you're headed, how far, how long. (No danger markers — design §12.1.) */
const LegProgress: React.FC<{ world: WorldState }> = ({ world }) => {
  const total = Math.max(1, world.legTotal);
  const done = Math.min(total, Math.max(0, world.legDistance));
  const pct = (done / total) * 100;
  const left = Math.max(0, Math.round(total - done));
  const dest = world.mode === 'city_escape' ? '锈原 · 废弃小站' : world.selectedRoute ? (world.selectedRoute.boss ? world.selectedRoute.stationName : `${ZONE_META[world.selectedRoute.zone].name}的某座站`) : '下一站';
  const mps = world.trainSpeed / 18;
  const eta = mps > 0.5 ? formatEta((total - done) / mps) : '';
  return (
    <div className="fixed top-3.5 left-1/2 -translate-x-1/2 w-[min(440px,46vw)] text-engraved anim-fade-in">
      <div className="flex items-baseline justify-between gap-3 mb-1.5 px-0.5">
        <span className="text-[11px] text-parchment-dim truncate">
          <span className="text-ash mr-1.5">前往</span>
          <span className="text-parchment font-semibold">{dest}</span>
        </span>
        <span className="font-mono text-[11px] whitespace-nowrap">
          <span className="text-brass-hi font-semibold">{left}m</span>
          <span className="text-ash ml-2">{eta || (world.trainSpeed < 1 ? '停车中' : '')}</span>
        </span>
      </div>
      <div className="relative h-[6px] rounded-full bg-black/55 ring-1 ring-brass/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brass/70 to-brass-hi"
          style={{ width: `${pct}%`, transition: 'width 300ms linear' }}
        />
        {/* the train */}
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-parchment ring-2 ring-brass shadow-[0_0_8px_rgb(237_196_124/0.6)]"
          style={{ left: `${pct}%`, transition: 'left 300ms linear' }}
        />
        {/* destination */}
        <span className="absolute top-1/2 -translate-y-1/2 right-[-3px] w-[9px] h-[9px] rounded-[2px] bg-black ring-1 ring-brass-hi" />
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   HUD
   ────────────────────────────────────────────────────────────────────────── */
export const HudPanels: React.FC<HudProps> = ({ world, actions }) => {
  const p = world.player;
  const weight = getTrainWeight(world);
  const traction = getTractionLimit(world);
  const overloaded = isOverloaded(world);
  const wb = hasWorkbench(world);
  const bindings = getHotbarBindings(world);

  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const initialCat = BUILD_CATEGORIES.find((c) => c.items.includes(world.selectedBuild))?.id ?? 'craft';
  const [buildCat, setBuildCat] = useState(initialCat);

  // Auto-hide vitals when healthy and unchanged for 5s
  const vitalsHealthy =
    p.hp >= p.maxHp * 0.92 &&
    p.hunger >= 75 &&
    p.thirst >= 75 &&
    p.bodyTemp >= 85 &&
    p.sickTimer <= 0 &&
    p.stamina >= p.maxStamina * 0.9;
  const showVitals = !vitalsHealthy || world.time - world.lastVitalChangeAt < 5.0 || world.bagOpen;

  const sidebarDocked =
    world.bagOpen || world.routeOpen || world.tradeOpen || world.openContainerUid !== null || world.openFacilityUid !== null;

  const fuelPct = (world.boilerFuel / Math.max(1, world.boilerMax)) * 100;
  const pressureHot = world.boilerPressure > 80;
  const fuelLow = world.boilerFuel <= 2.5;

  // Hull integrity: only when it matters (damaged AND under threat / building / driving / badly hurt)
  const hull = getHullIntegrity(world);
  const trainLeft = getCarBounds(Math.max(0, world.flatbeds.length - 1)).left;
  const attackersNear = world.monsters.some(
    (m) => m.hp > 0 && m.x > trainLeft - 180 && m.x < LOCO_W + 180 && Math.abs(m.y) < HALF_H + 200
  );
  const damaged = hull.pct < 99.5 || hull.locoPct < 99.5;
  const showHull =
    damaged &&
    (attackersNear ||
      world.wavePhase === 'danger' ||
      world.buildMode ||
      world.throttleOpen ||
      hull.pct < 60 ||
      hull.brokenPanels > 0);

  const selBuildDef = BUILDINGS[world.selectedBuild];
  const nextWeight = +(weight + selBuildDef.weight).toFixed(1);
  const cat = BUILD_CATEGORIES.find((c) => c.id === buildCat) ?? BUILD_CATEGORIES[0];

  const onSlotDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTarget(null);
    const d = readDrag(e);
    if (!d) return;
    if (d.src === 'hotbar') actions.onSwapHotbar(d.idx, idx);
    else if (d.key) actions.onBindItem(idx, d.key);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {(world.mode === 'wasteland' || world.mode === 'city_escape') && world.legTotal > 0 && <LegProgress world={world} />}

      {/* Clock — quiet engraved text, top-right */}
      <div className="fixed top-4 right-5 text-right text-engraved">
        <div className="font-mono text-[12px] text-parchment-dim">
          第{world.dayCount}天 <span className="text-parchment">{getClockLabel(world)}</span>
        </div>
        <div className="text-[10.5px] text-ash tracking-wider mt-0.5">{getWeatherLabel(world)}</div>
      </div>

      {/* Hull integrity — appears only when the train is hurt and it matters */}
      {showHull && (
        <div className="fixed top-4 left-5 plate riveted anim-pop-in px-3.5 py-2.5 w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-ash">
              <TrainFront className="w-3.5 h-3.5" /> 车壳
            </span>
            <span className={`font-mono text-[12px] ${hull.pct < 40 ? 'text-rust' : 'text-parchment'}`}>
              {Math.round(hull.pct)}%
            </span>
          </div>
          <div className="meter meter-ticks h-[6px]">
            <div
              className="meter-fill"
              style={{
                width: `${clampPct(hull.pct)}%`,
                backgroundColor: hull.pct < 40 ? '#dc5f4f' : hull.pct < 70 ? '#d9a14f' : '#98a7b5',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
            <span className="text-ash-dim">
              车头 <span className={hull.locoPct < 40 ? 'text-rust' : 'text-parchment-dim'}>{Math.round(hull.locoPct)}%</span>
            </span>
            {hull.brokenPanels > 0 ? (
              <span className="text-rust anim-heartbeat">破口 {hull.brokenPanels}</span>
            ) : (
              <span className="text-ash-dim">最薄 {Math.round(hull.worstPct)}%</span>
            )}
          </div>
        </div>
      )}

      {/* Driving Strip — ONLY while standing at the locomotive lever */}
      {world.throttleOpen && (
        <div className="pointer-events-auto fixed top-5 left-1/2 -translate-x-1/2 plate-strong riveted anim-pop-in px-5 py-3 flex items-center gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] tracking-[0.18em] text-ash-dim">拉杆档位</span>
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-black/40 border border-white/5">
              {([0, 1, 2, 3] as GearLevel[]).map((g) => {
                const active = world.gear === g;
                const locked = overloaded && g === 3;
                return (
                  <button
                    key={g}
                    disabled={locked}
                    onClick={() => actions.onSetThrottleGear(g)}
                    data-active={active}
                    className={`seg px-3 py-1 text-[11.5px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${
                      active && g === 3 ? '!text-[#ffb4a8] !border-rust/80 !bg-rust/15' : ''
                    }`}
                  >
                    {GEAR_LABELS[g]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-px self-stretch bg-gradient-to-b from-transparent via-brass/25 to-transparent" />
          <Readout
            label="蓝火"
            tone={fuelLow ? 'text-rust' : 'text-rune'}
            value={
              <>
                {world.boilerFuel.toFixed(1)}
                <span className="text-ash-dim">/{world.boilerMax}</span>
              </>
            }
          >
            <div className="meter h-[3px] w-full">
              <div className="meter-fill" style={{ width: `${clampPct(fuelPct)}%`, backgroundColor: fuelLow ? '#dc5f4f' : '#84c8ff' }} />
            </div>
          </Readout>
          <Readout label="炉压" tone={pressureHot ? 'text-rust font-bold' : 'text-parchment'} value={`${Math.round(world.boilerPressure)}%`}>
            <div className="meter h-[3px] w-full">
              <div
                className="meter-fill"
                style={{ width: `${clampPct(world.boilerPressure)}%`, backgroundColor: pressureHot ? '#dc5f4f' : '#c9954d' }}
              />
            </div>
          </Readout>
          <Readout
            label="载重"
            tone={overloaded ? 'text-rust font-bold' : 'text-parchment'}
            value={
              <>
                {weight}
                <span className="text-ash-dim">/{traction}t</span>
              </>
            }
          />
          {world.mode === 'wasteland' && (
            <Readout label="距下站" tone="text-brass-hi" value={`${Math.max(0, Math.round(world.legTotal - world.legDistance))}m`} />
          )}
          {world.mode === 'station' && (
            <button onClick={actions.onToggleRoute} title={describeSupplyForecast(world)} className="btn-primary px-3 py-1.5 text-[11.5px]">
              <MapIcon className="w-3.5 h-3.5" />
              {world.selectedRoute ? `驶往${ZONE_META[world.selectedRoute.zone].name}` : '选定下一站'}
            </button>
          )}
        </div>
      )}

      {/* Loot feed — bottom-left */}
      {world.lootFeed.length > 0 && (
        <div className="fixed left-5 bottom-5 flex flex-col gap-1 items-start">
          {world.lootFeed.map((lf) => {
            const meta = ITEM_META[lf.key];
            const opacity = Math.min(1, lf.timer * 0.9);
            return (
              <div
                key={lf.key}
                style={{ opacity, borderLeftColor: meta.color }}
                className="anim-panel-in pl-2 pr-2.5 py-[3px] rounded-[5px] bg-[linear-gradient(90deg,rgb(10_9_8/0.85),rgb(10_9_8/0.5))] border-l-2 text-[11.5px] text-parchment flex items-center gap-2 backdrop-blur-sm"
              >
                <span>{meta.short}</span>
                <span className="font-mono text-brass-hi font-semibold">+{lf.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom-centre stack: build palette · vitals · hotbar */}
      <div
        className="fixed bottom-4 -translate-x-1/2 flex flex-col items-center gap-2 transition-[left] duration-300 ease-out"
        style={{ left: sidebarDocked ? `calc((100vw - ${world.openFacilityUid ? 650 : 540}px) / 2)` : '50%' }}
      >
        {world.buildMode && (
          <div className="pointer-events-auto plate-strong anim-pop-in w-[640px] max-w-[calc(100vw-40px)] overflow-hidden">
            {/* Header: category tabs + weight preview */}
            <div className="plate-head flex items-center gap-1 pl-2 pr-4 py-1.5">
              {BUILD_CATEGORIES.map((c) => {
                const active = c.id === cat.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setBuildCat(c.id)}
                    className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer transition-colors ${
                      active ? 'text-brass-hi' : 'text-ash hover:text-parchment'
                    }`}
                  >
                    {c.icon}
                    {c.label}
                    {active && (
                      <span className="absolute left-2 right-2 -bottom-[7px] h-[2px] rounded-full bg-brass-hi shadow-[0_0_8px_rgb(237_196_124/0.7)]" />
                    )}
                  </button>
                );
              })}
              <span className={`ml-auto font-mono text-[11px] ${nextWeight > traction ? 'text-rust' : 'text-ash'}`}>
                载重 {weight} → <span className={nextWeight > traction ? 'text-rust' : 'text-parchment'}>{nextWeight}</span> / {traction}t
              </span>
            </div>
            {/* One row of uniform cards — never wraps unevenly */}
            <div className="grid grid-cols-4 gap-2 p-2.5">
              {cat.items.map((bId) => {
                const def = BUILDINGS[bId];
                const unlocked = !def.requiresWorkbench || wb;
                const afford = canAffordCost(world, def.cost);
                const active = world.selectedBuild === bId;
                return (
                  <button
                    key={bId}
                    onClick={() => actions.onSelectBuild(bId)}
                    data-active={active}
                    title={`${def.name}\n${def.desc}`}
                    className={`seg h-[56px] px-2.5 py-1.5 text-left flex flex-col justify-between ${unlocked && afford ? '' : 'opacity-50'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-4 h-4 rounded-[3px] shrink-0"
                        style={{ background: `linear-gradient(135deg, ${def.color}, ${def.color}88)`, boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.25)' }}
                      />
                      <span className="text-[12px] font-semibold text-parchment truncate">{def.short}</span>
                      <span className="ml-auto text-[9.5px] font-mono text-ash-dim">{def.weight}t</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-[10px] font-mono leading-tight">
                      {!unlocked ? (
                        <span className="flex items-center gap-1 text-rust/85">
                          <Lock className="w-3 h-3" /> 需工作台
                        </span>
                      ) : (
                        Object.entries(def.cost).map(([k, v]) => {
                          const enough = getItemCount(world, k as ResourceKey) >= (v ?? 0);
                          return (
                            <span key={k} className={enough ? 'text-brass/90' : 'text-rust/80'}>
                              {ITEM_META[k as ResourceKey].short}
                              {v}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </button>
                );
              })}
              {Array.from({ length: Math.max(0, 4 - cat.items.length) }).map((_, i) => (
                <div key={`pad${i}`} className="h-[56px] rounded-[5px] border border-dashed border-white/[0.05]" />
              ))}
            </div>
            <div className="border-t border-white/5 px-4 py-1.5 bg-black/20 flex items-center justify-between gap-4">
              <span className="text-[11px] text-parchment-dim truncate">
                <b className="text-brass-hi font-semibold">{selBuildDef.name}</b>
                <span className="text-ash mx-1.5">—</span>
                {selBuildDef.desc}
              </span>
              <span className="text-[10px] text-ash-dim shrink-0">左键放置 · 右键拆除 · B 退出</span>
            </div>
          </div>
        )}

        {/* Vitals — centred (folds away while building unless something needs attention) */}
        {!(world.buildMode && vitalsHealthy) && (
        <div
          className={`plate px-3.5 py-1.5 flex items-center gap-4 transition-opacity duration-700 ${
            showVitals ? 'opacity-100' : 'opacity-[0.22]'
          }`}
        >
          <Vital icon={<Heart className="w-3.5 h-3.5" />} label="生命" pct={(p.hp / p.maxHp) * 100} color="#d2584d" danger={p.hp <= p.maxHp * 0.3} />
          <Vital icon={<Utensils className="w-3.5 h-3.5" />} label="饱食" pct={p.hunger} color="#d9a14f" danger={p.hunger <= 25} />
          <Vital icon={<Droplets className="w-3.5 h-3.5" />} label="水分" pct={p.thirst} color="#6fb2e0" danger={p.thirst <= 25} />
          <Vital
            icon={<Thermometer className="w-3.5 h-3.5" />}
            label="体温"
            pct={p.bodyTemp}
            color={p.bodyTemp <= 35 ? '#9fd6ff' : '#e08a4a'}
            danger={p.bodyTemp <= 35}
          />
          {p.sickTimer > 0 && (
            <span className="chip chip-ok !text-[10px]" title="绷带或药剂治疗">
              <Activity className="w-3 h-3" /> 病症
            </span>
          )}
        </div>
        )}

        {/* Hotbar: 6 bindable sockets + separate build toggle */}
        <div className="pointer-events-auto plate riveted px-2 py-1.5 flex items-center gap-1.5">
          {bindings.map((b, idx) => {
            const v = describeBinding(world, b);
            const active = world.hotbar === idx && !world.buildMode;
            const isDrop = dropTarget === idx;
            return (
              <button
                key={idx}
                draggable={!!b}
                onDragStart={(e) => startDrag(e, { src: 'hotbar', idx })}
                onDragOver={(e) => {
                  if (!acceptsDrag(e)) return;
                  e.preventDefault();
                  if (dropTarget !== idx) setDropTarget(idx);
                }}
                onDragLeave={() => setDropTarget((t) => (t === idx ? null : t))}
                onDrop={(e) => onSlotDrop(e, idx)}
                onClick={() => actions.onSelectHotbar(idx as HotbarSlot)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (b && b.kind !== 'tool') actions.onClearHotbar(idx);
                }}
                title={`${v.title}${b && b.kind !== 'tool' ? '\n右键清空 · 拖动换位' : ''}`}
                className={`group relative w-[58px] h-[56px] rounded-[7px] flex flex-col items-center justify-center gap-[3px] cursor-pointer border transition-all duration-150 ${
                  isDrop
                    ? 'border-rune/80 bg-rune/10 shadow-[0_0_14px_-3px_rgb(132_200_255/0.7)]'
                    : active
                      ? 'border-brass-hi/80 text-brass-hi bg-[radial-gradient(ellipse_at_50%_30%,rgb(237_196_124/0.22),rgb(201_149_77/0.05)_70%)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.5),0_0_16px_-4px_rgb(237_196_124/0.5)] -translate-y-0.5'
                      : v.empty
                        ? 'border-dashed border-white/[0.08] text-ash-dim bg-black/25 hover:border-brass/30'
                        : 'border-white/[0.06] text-parchment-dim bg-black/35 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] hover:border-brass/40 hover:text-parchment'
                } ${world.buildMode ? 'opacity-45' : ''}`}
              >
                <span className={`absolute top-[3px] left-[5px] text-[9px] font-mono ${active ? 'text-brass-hi/80' : 'text-ash-dim'}`}>
                  {idx + 1}
                </span>
                {v.sub && <span className="absolute top-[3px] right-[5px] text-[8.5px] text-brass/70">{v.sub}</span>}
                {v.empty ? (
                  <span className="w-[18px] h-[18px] rounded-full border border-dashed border-white/10" />
                ) : (
                  <>
                    <span className="mt-1.5 flex items-center justify-center h-[22px]">{v.icon}</span>
                    <span className="text-[10px] leading-none tracking-wide max-w-[52px] truncate">{v.name}</span>
                  </>
                )}
                {v.count !== undefined && (
                  <span
                    className={`absolute bottom-[3px] right-[5px] text-[10px] font-mono font-semibold ${
                      v.count === 0 ? 'text-rust/70' : 'text-brass-hi'
                    }`}
                  >
                    {v.count}
                  </span>
                )}
                {active && (
                  <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-brass-hi shadow-[0_0_8px_rgb(237_196_124/0.9)]" />
                )}
              </button>
            );
          })}

          <span className="w-px self-stretch my-1 mx-0.5 bg-gradient-to-b from-transparent via-brass/30 to-transparent" />

          <button
            onClick={actions.onToggleLantern}
            data-active={world.lanternHolder === 'player'}
            title={world.lanternHolder === 'player' ? '放下手提灯 (F)' : '拾起手提灯 (F，需走到灯旁)'}
            className="seg relative w-[50px] h-[56px] flex flex-col items-center justify-center gap-[3px]"
          >
            <span className="absolute top-[3px] left-[5px] text-[9px] font-mono text-ash-dim">F</span>
            <Lamp
              className={`w-[18px] h-[18px] mt-1.5 ${
                world.lanternHolder === 'player' ? 'text-[#ffd98a] drop-shadow-[0_0_6px_rgb(255_200_110/0.7)]' : 'text-ash-dim'
              }`}
            />
            <span className="text-[10px] leading-none">{world.lanternHolder === 'player' ? '提灯' : '已放下'}</span>
          </button>

          <button
            onClick={actions.onToggleBuild}
            data-active={world.buildMode}
            title="建造模式 (B)"
            className="seg relative w-[50px] h-[56px] flex flex-col items-center justify-center gap-[3px]"
          >
            <span className="absolute top-[3px] left-[5px] text-[9px] font-mono text-ash-dim">B</span>
            <Hammer className="w-[18px] h-[18px] mt-1.5" />
            <span className="text-[10px] leading-none">建造</span>
          </button>
        </div>
      </div>
    </div>
  );
};
