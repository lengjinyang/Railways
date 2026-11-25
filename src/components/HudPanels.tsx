import React from 'react';
import {
  Heart,
  Zap,
  Utensils,
  Droplets,
  Thermometer,
  Flame,
  Compass,
  Map as MapIcon,
  Flashlight,
  Hammer,
  Backpack,
  Wrench,
  Volume2,
  VolumeX,
  RotateCcw,
  ZoomIn,
  HelpCircle,
  AlertTriangle,
  TrainFront,
  Scale,
} from 'lucide-react';
import { BUILD_ORDER, BUILDINGS, type BuildingType } from '../recipes_v2';
import {
  GEAR_LABELS,
  ITEM_META,
  TOOL_META,
  ZONE_META,
  canAffordCost,
  estimateRouteFuel,
  getActiveQuest,
  getAllChestGrids,
  getClockLabel,
  getDayPhaseLabel,
  getGridUsedCells,
  getItemCount,
  getTractionLimit,
  getTrainWeight,
  getWeatherLabel,
  getZoneTierRoman,
  hasWorkbench,
  isOverloaded,
  playerHasActiveLantern,
  type GearLevel,
  type HotbarSlot,
  type ResourceKey,
  type WorldState,
} from '../world';

export interface HudActions {
  onShiftGearTo: (gear: GearLevel) => void;
  onToggleRoute: () => void;
  onToggleLight: () => void;
  onToggleBuild: () => void;
  onToggleBag: () => void;
  onToggleCraft: () => void;
  onResetZoom: () => void;
  onToggleHelp: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onSelectHotbar: (slot: HotbarSlot) => void;
  onSelectBuild: (bId: BuildingType) => void;
}

interface HudProps {
  world: WorldState;
  muted: boolean;
  zoomPct: number;
  actions: HudActions;
}

function formatCostShort(cost: Partial<Record<ResourceKey, number>>): string {
  return Object.entries(cost)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${ITEM_META[k as ResourceKey]?.short ?? k}${v}`)
    .join(' ');
}

const VitalBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  pct: number;
  valueText: string;
  barClass: string;
  danger?: boolean;
}> = ({ icon, label, pct, valueText, barClass, danger }) => (
  <div className={`flex items-center gap-2 text-xs ${danger ? 'text-red-300 font-semibold' : 'text-stone-300'}`}>
    <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${danger ? 'text-red-400 animate-pulse' : 'text-stone-400'}`}>
      {icon}
    </span>
    <span className="w-9 shrink-0 truncate">{label}</span>
    <div className="gauge-track flex-1 h-2 rounded-full overflow-hidden border border-white/10">
      <div
        className={`h-full transition-all duration-100 rounded-full ${barClass}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
    <span className="w-12 text-right font-mono tabular-nums text-[11px]">{valueText}</span>
  </div>
);

export const HudPanels: React.FC<HudProps> = ({ world, muted, zoomPct, actions }) => {
  const p = world.player;
  const weight = getTrainWeight(world);
  const traction = getTractionLimit(world);
  const overloaded = isOverloaded(world);
  const quest = getActiveQuest(world);
  const zm = ZONE_META[world.zoneKind];
  const wb = hasWorkbench(world);

  const cFuel = getItemCount(world, 'fuel');
  const cWood = getItemCount(world, 'wood');
  const cScrap = getItemCount(world, 'scrap');
  const cParts = getItemCount(world, 'parts');
  const cWater = getItemCount(world, 'water');
  const cFood = getItemCount(world, 'cookedFood') + getItemCount(world, 'rawFood') + getItemCount(world, 'arcanePotion');
  const cAmmo = getItemCount(world, 'ammo');
  const cRails = getItemCount(world, 'rails');
  const cCoupler = getItemCount(world, 'coupler') + getItemCount(world, 'crudeCoupler');
  const cRelic = getItemCount(world, 'ancientRelic');
  const chestCount = getAllChestGrids(world).length;
  const bagUsed = getGridUsedCells(world.backpack);
  const bagCap = world.backpack.cols * world.backpack.rows;
  const lanternActive = playerHasActiveLantern(world);

  const tMeta = TOOL_META[p.toolLevel];
  const hotbarItems: Array<{ icon: string; name: string; cnt?: number; sub?: string }> = [
    { icon: tMeta.icon, name: tMeta.short, sub: `Lv.${p.toolLevel}` },
    { icon: '🔫', name: '霰弹枪', cnt: cAmmo },
    { icon: '🛤', name: '铁轨段', cnt: cRails },
    { icon: '🥖', name: '吃喝', cnt: cFood },
    { icon: '🍖', name: '诱饵', cnt: getItemCount(world, 'decoys') },
    { icon: '🔨', name: '建造锤' },
  ];

  const zoneTitle =
    world.zoneKind === 'fallen_city'
      ? `${zm.icon} ${zm.name} · 逃离中`
      : `${zm.icon} ${zm.name} · 等级 ${getZoneTierRoman(world.zoneTier)}`;

  const selRoute = world.selectedRoute;
  const estCruise = selRoute ? estimateRouteFuel(world, selRoute.distance, 2) : 0;
  const totalFuelNow = +(world.boilerFuel + cFuel).toFixed(1);

  const showBuildBar = world.buildMode || world.hotbar === 5;
  const selBuildDef = BUILDINGS[world.selectedBuild];
  const nextWeightIfPlaced = +(weight + selBuildDef.weight).toFixed(1);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3">
      {/* TOP BAR ROW */}
      <div className="flex items-start justify-between gap-3">
        {/* TOP-LEFT: Vitals + Locomotive Telemetry + Quest */}
        <div className="pointer-events-auto flex flex-col gap-2 w-[268px] shrink-0">
          {/* Survival Vitals */}
          <div className={`brass-panel rounded-xl p-3 space-y-1.5 ${p.hp <= 30 ? 'animate-danger-glow border-red-500/70' : ''}`}>
            <VitalBar
              icon={<Heart className="w-3.5 h-3.5" />}
              label="生命"
              pct={(p.hp / p.maxHp) * 100}
              valueText={`${Math.ceil(p.hp)}/${p.maxHp}`}
              barClass="bg-gradient-to-r from-red-600 to-rose-400"
              danger={p.hp <= 30}
            />
            <VitalBar
              icon={<Zap className="w-3.5 h-3.5" />}
              label={p.wellFedTimer > 0 ? '精力' : '体力'}
              pct={(p.stamina / p.maxStamina) * 100}
              valueText={`${Math.ceil(p.stamina)}`}
              barClass={
                p.wellFedTimer > 0
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                  : 'bg-gradient-to-r from-sky-600 to-cyan-400'
              }
            />
            <VitalBar
              icon={<Utensils className="w-3.5 h-3.5" />}
              label="饱食"
              pct={p.hunger}
              valueText={p.wellFedTimer > 0 ? `${Math.ceil(p.wellFedTimer)}s` : `${Math.ceil(p.hunger)}%`}
              barClass={p.hunger <= 25 ? 'bg-red-500' : 'bg-gradient-to-r from-lime-600 to-emerald-400'}
              danger={p.hunger <= 25}
            />
            <VitalBar
              icon={<Droplets className="w-3.5 h-3.5" />}
              label="水分"
              pct={p.thirst}
              valueText={`${Math.ceil(p.thirst)}%`}
              barClass={p.thirst <= 25 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-sky-400'}
              danger={p.thirst <= 25}
            />
            <VitalBar
              icon={<Thermometer className="w-3.5 h-3.5" />}
              label="体温"
              pct={p.bodyTemp}
              valueText={`${Math.ceil(p.bodyTemp)}%`}
              barClass={p.bodyTemp <= 35 ? 'bg-sky-400' : 'bg-gradient-to-r from-orange-600 to-amber-400'}
              danger={p.bodyTemp <= 35}
            />
          </div>

          {/* Locomotive Boiler & Interactive Brass Throttle */}
          <div className="brass-panel rounded-xl p-3 space-y-2">
            <VitalBar
              icon={<Flame className="w-3.5 h-3.5 text-orange-400" />}
              label="魔核"
              pct={(world.boilerFuel / world.boilerMax) * 100}
              valueText={`${world.boilerFuel.toFixed(1)}/${world.boilerMax}`}
              barClass="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-300"
              danger={world.boilerFuel <= 3}
            />

            {/* 4-Gear Interactive Brass Throttle Quadrant */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {([0, 1, 2, 3] as GearLevel[]).map((g) => {
                const active = world.gear === g;
                const lockedOverload = overloaded && g === 3;
                return (
                  <button
                    key={g}
                    onClick={() => actions.onShiftGearTo(g)}
                    disabled={lockedOverload}
                    title={lockedOverload ? '超载锁定全速' : `切换至 ${GEAR_LABELS[g]} (Q/F)`}
                    className={`py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                      active
                        ? g === 3
                          ? 'bg-red-500/30 border-red-400 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                          : g > 0
                            ? 'bg-amber-500/30 border-amber-300 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                            : 'bg-stone-700/90 border-stone-400 text-white'
                        : 'bg-black/40 border-white/10 text-stone-400 hover:border-amber-400/50 hover:text-stone-200'
                    } ${lockedOverload ? 'opacity-35 cursor-not-allowed' : ''}`}
                  >
                    {GEAR_LABELS[g]}
                  </button>
                );
              })}
            </div>

            {/* Traction & Carriages Footer */}
            <div className="flex items-center justify-between text-[11px] pt-0.5 text-stone-300">
              <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${overloaded ? 'text-red-400 font-bold' : 'text-emerald-300'}`}>
                <Scale className="w-3 h-3" />
                {weight}/{traction}t {overloaded && '超载'}
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-stone-300">
                <TrainFront className="w-3 h-3 text-amber-400" />
                {world.flatbeds.length}节 · {Math.round(world.trainSpeed)}速
              </span>
            </div>
          </div>

          {/* Active Guided Quest Card */}
          {quest && (
            <div className="brass-panel animate-quest-glow rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Compass className="w-3.5 h-3.5" />
                  {quest.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                  {quest.idx}/{quest.total}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-300/90 mb-1.5">{quest.desc}</p>
              <div className="text-[11px] text-emerald-300 font-medium">
                进度：<span className="font-mono">{quest.progress}</span>
              </div>
            </div>
          )}
        </div>

        {/* TOP-CENTER: Danger Zone Telemetry + Journey Progress */}
        <div className="pointer-events-auto flex flex-col items-center max-w-[365px] w-full">
          <div className="brass-panel rounded-xl px-4 py-2.5 w-full text-center">
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-bold border"
                style={{ borderColor: zm.color, color: zm.color, backgroundColor: `${zm.color}18` }}
              >
                {zoneTitle}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-black/45 border border-white/10 text-stone-200 font-mono tabular-nums">
                第{world.dayCount}天 {getClockLabel(world)} · {getDayPhaseLabel(world)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] border ${
                  world.weather !== 'clear'
                    ? 'bg-red-500/20 border-red-400/60 text-red-200'
                    : 'bg-black/45 border-white/10 text-stone-300'
                }`}
              >
                {getWeatherLabel(world)}
              </span>
            </div>

            {world.mode === 'city_escape' ? (
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-orange-300">
                  <span>{world.stationStreamed ? '🏁 正在驶入流放之城站台' : '🔥 沿铁道驶离陷落大城'}</span>
                  <span className="font-mono tabular-nums text-amber-200/90">
                    距站台 {Math.max(0, Math.round(world.stationStreamed ? world.stationAnchorX / 18 : world.legTotal - world.legDistance))}m
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  {world.stationStreamed
                    ? '已驶出城区大门 · 站台与流放之城正进入视野，即将平稳停靠'
                    : '暂未遭遇怪物 · 熟悉车厢并可取下车头提灯，穿过城门即无缝驶入流放之地'}
                </div>
              </div>
            ) : world.mode === 'station' ? (
              <div>
                <div className="text-sm font-bold text-amber-200 tracking-wide">
                  📍 {world.stationName}
                </div>
                <div className="text-[11px] text-stone-300/90 mt-0.5">
                  {selRoute ? (
                    <>
                      已选下站：<b className="text-amber-200">{selRoute.stationName}</b> ({selRoute.distance}m · 常速约耗晶{' '}
                      <b className={totalFuelNow < estCruise ? 'text-red-400' : 'text-emerald-300'}>~{estCruise}</b>，现存总晶{' '}
                      <span className="font-mono">{totalFuelNow}</span>)
                    </>
                  ) : (
                    <span className="text-amber-300/90">尚未选定下一站 · 点击右侧【选站】或在车头控制台按 E</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-stone-100">
                  <span>{world.stationStreamed ? `🏁 驶入 ${selRoute?.stationName ?? '目标站'} 外围城区` : `🚂 铁道里程 · 开往 ${selRoute?.stationName ?? '下一站'}`}</span>
                  <span className="font-mono tabular-nums" style={{ color: zm.color }}>
                    距站台 {Math.max(0, Math.round(world.stationStreamed ? world.stationAnchorX / 18 : world.legTotal - world.legDistance))}m
                  </span>
                </div>
                <div className={`text-[11px] mt-1 ${world.trainSpeed < 10 ? 'text-red-300 font-semibold' : 'text-stone-400'}`}>
                  {world.trainSpeed < 10
                    ? '⚠ 荒野停车极危！请速修断轨并拉杆发车'
                    : world.stationStreamed
                      ? '前方站台已进入视野 · 列车将平稳减速进站停靠'
                      : '行驶中：作物照长 · 熔炉照炼 · 全速更快但魔晶消耗大增'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP-RIGHT: Resources + Action Toolbar */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 max-w-[490px]">
          <div
            className="brass-panel rounded-xl px-2 py-1.5 flex flex-wrap justify-end gap-1"
            title="已自动合并统计背包与车上所有储物箱物资"
          >
            {[
              { icon: '🔮', label: '晶', val: cFuel, warn: cFuel <= 2 },
              { icon: '🪵', label: '木', val: cWood },
              { icon: '⚙', label: '废', val: cScrap },
              { icon: '🔩', label: '零', val: cParts },
              { icon: '🔗', label: '钩', val: cCoupler },
              { icon: '💧', label: '水', val: cWater, warn: cWater <= 2 },
              { icon: '🥖', label: '粮', val: cFood },
              { icon: '💥', label: '弹', val: cAmmo },
              { icon: '🛤', label: '轨', val: cRails, warn: cRails <= 0 },
            ].map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono tabular-nums border ${
                  item.warn
                    ? 'bg-red-950/70 border-red-500/70 text-red-200'
                    : 'bg-black/45 border-white/10 text-stone-200'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.val}</span>
              </span>
            ))}
            {cRelic > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-950/70 border border-amber-400/70 text-amber-200">
                🏺 {cRelic}
              </span>
            )}
            {world.darkThreatLevel > 0.05 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-600/80 border border-red-300 text-white animate-pulse">
                <AlertTriangle className="w-3 h-3" /> 无灯暗袭!
              </span>
            )}
          </div>

          <div className="flex flex-nowrap justify-end gap-1">
            {world.mode === 'station' && (
              <button
                onClick={actions.onToggleRoute}
                className={`${
                  !selRoute ? 'brass-btn-primary animate-pulse font-bold' : 'brass-btn text-amber-200'
                } inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap cursor-pointer`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                选站
              </button>
            )}
            <button
              onClick={actions.onToggleLight}
              className={`brass-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap cursor-pointer ${
                lanternActive ? 'border-amber-300 text-amber-200' : 'text-stone-300'
              }`}
              title="切换手提灯 (L)"
            >
              <Flashlight className="w-3.5 h-3.5" />
              {world.lanternHolder === 'train' ? '在车头' : lanternActive ? '亮' : '灭'}
            </button>
            <button
              onClick={actions.onToggleBuild}
              className={`brass-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap cursor-pointer ${
                world.buildMode ? 'border-amber-300 bg-amber-500/25 text-amber-100' : 'text-stone-200'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              建造(B)
            </button>
            <button
              onClick={actions.onToggleBag}
              className="brass-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap text-stone-200 cursor-pointer"
              title={`网格行囊 Lv.${world.backpackLevel} (${bagUsed}/${bagCap}格) · 点击或按 I 打开`}
            >
              <Backpack className="w-3.5 h-3.5" />
              行囊({bagUsed}/{bagCap}){chestCount > 0 ? `+${chestCount}` : ''}
            </button>
            <button
              onClick={actions.onToggleCraft}
              className="brass-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap text-stone-200 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              合成(Tab)
            </button>
            <button
              onClick={actions.onResetZoom}
              className="brass-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap text-stone-300 cursor-pointer"
              title="鼠标滚轮缩放视野 · 点击或按 V 重置 100%"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              {zoomPct}%
            </button>
            <button
              onClick={actions.onToggleHelp}
              className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer"
              title="操作指南 (H)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={actions.onToggleMute}
              className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer"
              title={muted ? '开启音效' : '静音'}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={actions.onRestart}
              className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer"
              title="重新开始"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Build Drawer + 6-Slot Hotbar */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {showBuildBar && (
          <div className="brass-panel-strong rounded-2xl p-2.5 max-w-[94vw] w-fit">
            <div className="flex flex-wrap justify-center gap-1.5">
              {BUILD_ORDER.map((bId) => {
                const def = BUILDINGS[bId];
                const unlocked = !def.requiresWorkbench || wb;
                const afford = canAffordCost(world, def.cost);
                const ok = unlocked && afford;
                const active = world.selectedBuild === bId;
                return (
                  <button
                    key={bId}
                    onClick={() => actions.onSelectBuild(bId)}
                    title={def.desc}
                    className={`px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                      active
                        ? 'bg-amber-500/25 border-amber-300 shadow-[0_0_12px_rgba(255,214,112,0.28)]'
                        : 'bg-black/45 border-white/10 hover:border-amber-400/45'
                    } ${ok ? '' : 'opacity-45'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-100">
                      <span>{def.short}</span>
                      <span className="text-[10px] font-mono text-stone-400">{def.weight}t</span>
                    </div>
                    <div className="text-[10px] text-amber-200/80 mt-0.5">
                      {!unlocked ? '需工作台' : formatCostShort(def.cost)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-stone-300">
              <span>
                当前蓝图：<b className="text-amber-300">{selBuildDef.name}</b> — {selBuildDef.desc}
              </span>
              <span className={`font-mono ${nextWeightIfPlaced > traction ? 'text-red-400 font-bold' : 'text-emerald-300'}`}>
                放置后载重 {nextWeightIfPlaced}/{traction}t{nextWeightIfPlaced > traction ? ' (超载!)' : ''}
              </span>
              <span className="text-stone-400">车厢 5×4 · 车头 4×4（锅炉/驾驶台/提灯不可盖）· 左键建造 · 右键拆除</span>
            </div>
          </div>
        )}

        {/* 6-Slot Tactile Hotbar */}
        <div className="brass-panel rounded-2xl p-1.5 flex items-center gap-1.5">
          {hotbarItems.map((item, idx) => {
            const active = (world.hotbar === idx && !world.buildMode) || (idx === 5 && world.buildMode);
            return (
              <button
                key={idx}
                onClick={() => actions.onSelectHotbar(idx as HotbarSlot)}
                className={`relative w-[78px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                  active
                    ? 'bg-gradient-to-b from-amber-500/30 to-amber-700/20 border-amber-300 -translate-y-0.5 shadow-[0_6px_18px_rgba(217,147,60,0.35)]'
                    : 'bg-black/45 border-white/10 hover:border-amber-400/40'
                }`}
              >
                <span className="absolute top-1 left-1.5 text-[10px] font-mono text-stone-400">
                  {idx + 1}
                </span>
                {item.sub && (
                  <span className="absolute top-1 right-1.5 text-[9px] font-mono text-amber-300">
                    {item.sub}
                  </span>
                )}
                <span className="text-xl leading-none mb-0.5">{item.icon}</span>
                <span className="text-[11px] font-medium text-stone-200">{item.name}</span>
                {item.cnt !== undefined && (
                  <span className="absolute bottom-1 right-1.5 text-[11px] font-mono font-bold text-amber-300">
                    {item.cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
