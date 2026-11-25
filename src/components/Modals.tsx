import React, { useEffect, useState } from 'react';
import {
  X,
  Map as MapIcon,
  Backpack,
  Wrench,
  Coins,
  Skull,
  HelpCircle,
  Check,
  Layers,
  Archive,
  AlertTriangle,
  Flame,
  RotateCw,
  Trash2,
  ArrowUpCircle,
} from 'lucide-react';
import { CRAFT_RECIPES } from '../recipes_v2';
import {
  BACKPACK_TIERS,
  ITEM_META,
  ZONE_META,
  canAffordCost,
  estimateRouteFuel,
  findBuildingByUid,
  getAllChestGrids,
  getGridUsedCells,
  getItemCount,
  getItemSize,
  getNearbyPickups,
  getZoneTierRoman,
  hasWorkbench,
  type GridInventory,
  type HeldGridItem,
  type ResourceKey,
  type WorldState,
} from '../world';
import { getOverlappingItems, type ItemRarity } from '../inventory';

export interface ModalActions {
  onClose: () => void;
  onSelectRoute: (routeId: string) => void;
  onQuickStack: () => void;
  onDepositAll: () => void;
  onPickGridItem: (src: 'backpack' | 'chest', uid: string) => void;
  onPlaceGridItem: (src: 'backpack' | 'chest', x: number, y: number) => void;
  onQuickTransferItem: (src: 'backpack' | 'chest', uid: string) => void;
  onPickGroundLoot: (pickupUid: string) => void;
  onRotateHeld: () => void;
  onDropHeld: () => void;
  onUpgradeBackpack: () => void;
  onCraft: (recipeId: string) => void;
  onTrade: (tradeId: string) => void;
  onDismissDeath: () => void;
  onRestart: () => void;
}

interface ModalsProps {
  world: WorldState;
  helpOpen: boolean;
  onCloseHelp: () => void;
  actions: ModalActions;
}

const RARITY_STYLES: Record<ItemRarity, { border: string; bg: string; glow: string; label: string }> = {
  common: {
    border: 'border-stone-500/55',
    bg: 'from-stone-800/95 to-stone-900/95',
    glow: '',
    label: 'text-stone-300',
  },
  magic: {
    border: 'border-sky-400/65',
    bg: 'from-slate-800/95 to-sky-950/90',
    glow: 'shadow-[inset_0_0_12px_rgba(56,189,248,0.16)]',
    label: 'text-sky-200',
  },
  rare: {
    border: 'border-amber-400/80',
    bg: 'from-amber-950/90 to-stone-900/95',
    glow: 'shadow-[inset_0_0_14px_rgba(251,191,36,0.22)]',
    label: 'text-amber-200',
  },
  unique: {
    border: 'border-fuchsia-400/85',
    bg: 'from-purple-950/92 to-amber-950/85',
    glow: 'shadow-[0_0_14px_rgba(192,132,252,0.28),inset_0_0_14px_rgba(245,158,11,0.25)]',
    label: 'text-fuchsia-200',
  },
};

interface SpatialGridPanelProps {
  grid: GridInventory;
  source: 'backpack' | 'chest';
  heldItem: HeldGridItem | null;
  hasOtherGrid: boolean;
  cellPx: number;
  onPick: (src: 'backpack' | 'chest', uid: string) => void;
  onPlace: (src: 'backpack' | 'chest', x: number, y: number) => void;
  onQuickTransfer: (src: 'backpack' | 'chest', uid: string) => void;
  onRotate: () => void;
}

const SpatialGridPanel: React.FC<SpatialGridPanelProps> = ({
  grid,
  source,
  heldItem,
  hasOtherGrid,
  cellPx,
  onPick,
  onPlace,
  onQuickTransfer,
  onRotate,
}) => {
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  const widthPx = grid.cols * cellPx;
  const heightPx = grid.rows * cellPx;

  // Compute footprint preview while holding an item
  let preview: { x: number; y: number; w: number; h: number; state: 'ok' | 'swap' | 'bad' } | null = null;
  if (heldItem && hoverCell) {
    const sz = getItemSize(heldItem.key, heldItem.rotated);
    // Center footprint around cursor nicely for multi-cell items
    const px = Math.max(0, Math.min(grid.cols - sz.w, hoverCell.x - Math.floor((sz.w - 1) / 2)));
    const py = Math.max(0, Math.min(grid.rows - sz.h, hoverCell.y - Math.floor((sz.h - 1) / 2)));
    const inBounds = px >= 0 && py >= 0 && px + sz.w <= grid.cols && py + sz.h <= grid.rows;
    if (!inBounds) {
      preview = { x: px, y: py, w: sz.w, h: sz.h, state: 'bad' };
    } else {
      const hits = getOverlappingItems(grid, px, py, sz.w, sz.h);
      preview = {
        x: px,
        y: py,
        w: sz.w,
        h: sz.h,
        state: hits.length === 0 ? 'ok' : hits.length === 1 ? 'swap' : 'bad',
      };
    }
  }

  return (
    <div
      className="relative rounded-xl bg-[#0e0c0a] border border-amber-500/30 shadow-[inset_0_2px_14px_rgba(0,0,0,0.85)] select-none overflow-hidden mx-auto"
      style={{ width: widthPx, height: heightPx }}
      onMouseLeave={() => setHoverCell(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (heldItem) onRotate();
      }}
    >
      {/* Underlying spatial cell grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, ${cellPx}px)`,
          gridTemplateRows: `repeat(${grid.rows}, ${cellPx}px)`,
        }}
      >
        {Array.from({ length: grid.cols * grid.rows }).map((_, i) => {
          const cx = i % grid.cols;
          const cy = Math.floor(i / grid.cols);
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverCell({ x: cx, y: cy })}
              onClick={() => {
                if (heldItem && preview) {
                  onPlace(source, preview.x, preview.y);
                }
              }}
              className="border border-white/[0.06] hover:bg-white/[0.03] transition-colors"
              style={{ width: cellPx, height: cellPx }}
            />
          );
        })}
      </div>

      {/* Placed Items */}
      {grid.items.map((it) => {
        const meta = ITEM_META[it.key];
        const sz = getItemSize(it.key, it.rotated);
        const st = RARITY_STYLES[meta.rarity];
        return (
          <div
            key={it.uid}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.parentElement!.getBoundingClientRect();
              const cx = Math.floor((e.clientX - rect.left) / cellPx);
              const cy = Math.floor((e.clientY - rect.top) / cellPx);
              setHoverCell({ x: Math.max(0, Math.min(grid.cols - 1, cx)), y: Math.max(0, Math.min(grid.rows - 1, cy)) });
            }}
            onMouseMove={(e) => {
              if (!heldItem) return;
              const rect = e.currentTarget.parentElement!.getBoundingClientRect();
              const cx = Math.floor((e.clientX - rect.left) / cellPx);
              const cy = Math.floor((e.clientY - rect.top) / cellPx);
              setHoverCell({ x: Math.max(0, Math.min(grid.cols - 1, cx)), y: Math.max(0, Math.min(grid.rows - 1, cy)) });
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (heldItem) {
                if (preview) onPlace(source, preview.x, preview.y);
              } else if (e.shiftKey && hasOtherGrid) {
                onQuickTransfer(source, it.uid);
              } else {
                onPick(source, it.uid);
              }
            }}
            title={`${meta.name} (${sz.w}×${sz.h}) · ${it.count}/${meta.maxStack}\n${meta.desc}\n左键拿取摆放 · 拿取后按R/右键旋转${hasOtherGrid ? ' · Shift+左键快速转移' : ''}`}
            style={{
              left: it.x * cellPx + 2,
              top: it.y * cellPx + 2,
              width: sz.w * cellPx - 4,
              height: sz.h * cellPx - 4,
            }}
            className={`absolute rounded-lg border bg-gradient-to-br ${st.bg} ${st.border} ${st.glow} flex flex-col items-center justify-center cursor-pointer transition-transform hover:brightness-115 overflow-hidden`}
          >
            <span className="absolute top-0.5 left-1 text-[9px] font-mono text-stone-400/80">
              {sz.w}×{sz.h}
            </span>
            <span className="absolute top-0.5 right-1 text-[10px] font-mono font-bold text-amber-300 drop-shadow">
              {it.count}
            </span>
            <span className={`${sz.w >= 2 && sz.h >= 2 ? 'text-2xl' : 'text-lg'} leading-none`}>
              {meta.icon}
            </span>
            <span className={`text-[10px] font-medium truncate max-w-[92%] mt-0.5 ${st.label}`}>
              {meta.short}
            </span>
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/60">
              <div
                className="h-full bg-amber-400/75"
                style={{ width: `${Math.min(100, Math.round((it.count / meta.maxStack) * 100))}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Live POE2 Spatial Footprint Preview Overlay */}
      {preview && (
        <div
          className={`pointer-events-none absolute rounded-lg border-2 transition-all duration-75 ${
            preview.state === 'ok'
              ? 'bg-emerald-500/25 border-emerald-400'
              : preview.state === 'swap'
                ? 'bg-amber-400/25 border-amber-300'
                : 'bg-red-500/30 border-red-400'
          }`}
          style={{
            left: preview.x * cellPx + 1,
            top: preview.y * cellPx + 1,
            width: preview.w * cellPx - 2,
            height: preview.h * cellPx - 2,
          }}
        />
      )}
    </div>
  );
};

export const Modals: React.FC<ModalsProps> = ({ world, helpOpen, onCloseHelp, actions }) => {
  const [craftTab, setCraftTab] = useState<'all' | 'survival' | 'train' | 'gear'>('all');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!world.bagOpen) return;
    const onMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [world.bagOpen]);

  // 1. Death Report Modal
  if (world.deathReport) {
    const r = world.deathReport;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-lg rounded-2xl p-6 border-red-500/70">
          <div className="flex items-center gap-2.5 text-red-400 mb-2">
            <Skull className="w-6 h-6" />
            <h2 className="text-xl font-bold">你倒在了荒原中（第 {r.deathNum} 次死亡）</h2>
          </div>
          <p className="text-sm text-stone-300 mb-4">
            列车紧急停靠，你在车头艰难苏醒，但付出了惨重代价：
          </p>
          <div className="space-y-2.5 mb-5">
            <div className="p-3 rounded-xl bg-black/45 border border-white/10">
              <div className="text-xs font-bold text-amber-300 mb-0.5">车厢损失</div>
              <div className="text-xs text-stone-300">{r.lostCarDesc}</div>
            </div>
            {r.lostBuildings.length > 0 && (
              <div className="p-3 rounded-xl bg-black/45 border border-white/10">
                <div className="text-xs font-bold text-amber-300 mb-0.5">损毁设施</div>
                <div className="text-xs text-stone-300">{r.lostBuildings.join('、')}</div>
              </div>
            )}
            <div className="p-3 rounded-xl bg-black/45 border border-white/10">
              <div className="text-xs font-bold text-amber-300 mb-0.5">随机遗失物品</div>
              <div className="text-xs text-stone-300">
                {r.lostItems.length > 0
                  ? r.lostItems.map((it) => `${ITEM_META[it.key].icon}${ITEM_META[it.key].name}×${it.count}`).join('、')
                  : '无物品损失'}
              </div>
            </div>
          </div>
          <button
            onClick={actions.onDismissDeath}
            className="brass-btn-primary w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer"
          >
            咬牙爬起，继续求生
          </button>
        </div>
      </div>
    );
  }

  // 2. Game Over Modal
  if (world.gameOver) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-md rounded-2xl p-6 text-center border-red-500/70">
          <Skull className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-red-300 mb-2">列车彻底倾覆</h2>
          <p className="text-sm text-stone-300 mb-4">蒸汽机车车头完全损毁，无法再前行。</p>
          <div className="grid grid-cols-2 gap-2 text-xs mb-5">
            <div className="p-2.5 rounded-xl bg-black/45 border border-white/10">
              <div className="text-stone-400">抵达站点</div>
              <div className="text-base font-mono font-bold text-amber-300">{world.stats.stationsReached}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/45 border border-white/10">
              <div className="text-stone-400">推进里程</div>
              <div className="text-base font-mono font-bold text-amber-300">{Math.round(world.totalDistance)}m</div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/45 border border-white/10">
              <div className="text-stone-400">击杀威胁</div>
              <div className="text-base font-mono font-bold text-red-300">{world.stats.monstersKilled}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/45 border border-white/10">
              <div className="text-stone-400">死亡次数</div>
              <div className="text-base font-mono font-bold text-stone-200">{world.stats.deaths}</div>
            </div>
          </div>
          <button
            onClick={actions.onRestart}
            className="brass-btn-primary w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer"
          >
            重新启程
          </button>
        </div>
      </div>
    );
  }

  // 3. Railway Route Selection Map Modal
  if (world.routeOpen) {
    const totalFuel = +(world.boilerFuel + getItemCount(world, 'fuel')).toFixed(1);
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <MapIcon className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-amber-200">铁道航线图 · 选定下一座失落世界</h2>
            </div>
            <button onClick={actions.onClose} className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-black/45 border border-amber-500/20 text-xs text-stone-300 mb-4">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              总可用燃料：
              <b className="text-amber-300 font-mono text-sm">{totalFuel}</b>
              <span className="text-stone-400">
                (锅炉 {world.boilerFuel.toFixed(1)} + 库存 {getItemCount(world, 'fuel')})
              </span>
            </span>
            <span className="text-red-300/90">· 到达前切忌在荒野停车，否则怪物将大举围攻！</span>
          </div>

          <div className="space-y-3">
            {world.availableRoutes.map((r) => {
              const rzm = ZONE_META[r.zone];
              const estSlow = estimateRouteFuel(world, r.distance, 1);
              const estNorm = estimateRouteFuel(world, r.distance, 2);
              const estFast = estimateRouteFuel(world, r.distance, 3);
              const lowFuel = totalFuel < estNorm;
              const isSel = world.selectedRoute?.id === r.id;

              return (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl bg-black/45 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSel ? 'ring-1 ring-amber-300/60' : ''
                  }`}
                  style={{ borderColor: isSel ? rzm.color : 'rgba(255,255,255,0.12)' }}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base" style={{ color: rzm.color }}>
                        {rzm.icon} {r.stationName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold border"
                        style={{ borderColor: rzm.color, color: rzm.color, backgroundColor: `${rzm.color}18` }}
                      >
                        {rzm.name} · 等级 {getZoneTierRoman(r.tier)}
                      </span>
                      <span className="text-xs font-mono text-stone-400">{r.distance}m</span>
                    </div>
                    <p className="text-xs text-stone-300/90">{r.desc}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono pt-1">
                      <span className="text-stone-400">
                        缓行 <b className="text-stone-200">{estSlow}</b>油
                      </span>
                      <span className="text-stone-400">
                        常速 <b className={lowFuel ? 'text-red-400' : 'text-emerald-300'}>{estNorm}</b>油
                      </span>
                      <span className="text-stone-400">
                        全速 <b className="text-amber-300">{estFast}</b>油
                      </span>
                      {lowFuel && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-sans font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> 燃料可能不足，建议先探索搜刮或熔炉烧炭
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => actions.onSelectRoute(r.id)}
                    className={`${
                      isSel ? 'brass-btn text-emerald-300 border-emerald-400/60' : 'brass-btn-primary'
                    } px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer`}
                  >
                    {isSel ? (
                      <>
                        <Check className="w-4 h-4" /> 已选定
                      </>
                    ) : (
                      '选定航线'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 4. POE2 Spatial Grid Inventory, Chest & Backpack Upgrade Modal
  if (world.bagOpen) {
    const openChest = world.openChestUid ? findBuildingByUid(world, world.openChestUid) : null;
    const nearbyGround = getNearbyPickups(world, 165);
    const showGroundTray = !openChest?.chestGrid && (nearbyGround.length > 0 || world.heldItem !== null);
    const hasAnyChest = getAllChestGrids(world).length > 0;
    const currTier = BACKPACK_TIERS[world.backpackLevel];
    const nextTier = world.backpackLevel < 4 ? BACKPACK_TIERS[(world.backpackLevel + 1) as 2 | 3 | 4] : null;
    const canUpgradeBag = nextTier?.cost ? canAffordCost(world, nextTier.cost) : false;
    const usedCells = getGridUsedCells(world.backpack);
    const totalCells = world.backpack.cols * world.backpack.rows;
    const bagCellPx = world.backpack.cols >= 10 ? 40 : 48;

    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/78 backdrop-blur-sm"
        onContextMenu={(e) => {
          e.preventDefault();
          if (world.heldItem) actions.onRotateHeld();
        }}
      >
        <div className="brass-panel-strong w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <Backpack className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-amber-200">
                  {currTier.name} · 网格行囊 ({world.backpack.cols}×{world.backpack.rows})
                </h2>
                <div className="text-[11px] text-stone-400">
                  点击物品手动拿取摆放 · 拿取后按 <b className="text-amber-300">R / 右键</b> 旋转 · 点击目标格可放置或单件互换 · 建造与合成仍自动连通车上储物箱
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {world.heldItem && (
                <>
                  <button
                    onClick={actions.onRotateHeld}
                    className="brass-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-200 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> 旋转 (R)
                  </button>
                  <button
                    onClick={actions.onDropHeld}
                    className="brass-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-300 border-red-500/50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 丢弃到地面
                  </button>
                </>
              )}
              <button onClick={actions.onClose} className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Spatial Grids */}
          <div className={`grid gap-5 mt-4 ${openChest?.chestGrid || showGroundTray ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Ground Loot Manual Pickup Tray (POE2 Manual Placement!) */}
            {showGroundTray && (
              <div
                onClick={() => {
                  if (world.heldItem) actions.onDropHeld();
                }}
                className={`p-4 rounded-xl bg-black/45 border flex flex-col ${
                  world.heldItem
                    ? 'border-amber-400/65 hover:bg-amber-950/20 cursor-pointer'
                    : 'border-amber-500/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm font-bold text-amber-200">
                    ✨ 地面掉落物资（{nearbyGround.length} 件）
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {world.heldItem ? '点击此区域可放回地面' : '点击物品拿取 → 手动摆入右侧行囊'}
                  </span>
                </div>
                {nearbyGround.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {nearbyGround.map((pk) => {
                      const meta = ITEM_META[pk.key];
                      const st = RARITY_STYLES[meta.rarity];
                      return (
                        <button
                          key={pk.uid}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!world.heldItem) actions.onPickGroundLoot(pk.uid);
                            else actions.onDropHeld();
                          }}
                          title={`${meta.name} (${meta.w}×${meta.h}) · ${meta.desc}`}
                          className={`relative p-2.5 rounded-xl border bg-gradient-to-br ${st.bg} ${st.border} ${st.glow} flex items-center gap-2.5 text-left hover:brightness-115 transition-all cursor-pointer`}
                        >
                          <span className="text-xl leading-none shrink-0">{meta.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-bold truncate ${st.label}`}>{meta.short}</div>
                            <div className="text-[10px] font-mono text-stone-300">
                              ×{pk.amount} · {meta.w}×{meta.h}格
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 min-h-[140px] flex items-center justify-center rounded-xl border border-dashed border-amber-500/25 text-xs text-stone-400">
                    {world.heldItem ? '点击此处将手中物品丢回地面' : '附近地面暂无掉落物品'}
                  </div>
                )}
              </div>
            )}

            {/* Player POE2 Backpack Grid */}
            <div className="p-4 rounded-xl bg-black/45 border border-white/10 flex flex-col items-center">
              <div className="w-full flex items-center justify-between gap-2 mb-3">
                <div className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  <span>🎒 随身行囊</span>
                  <span className="text-xs font-mono text-amber-300/90">
                    已占 {usedCells}/{totalCells} 格
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasAnyChest && (
                    <button
                      onClick={actions.onQuickStack}
                      className="brass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-amber-200 cursor-pointer"
                    >
                      <Layers className="w-3 h-3" /> 存同类到箱
                    </button>
                  )}
                </div>
              </div>
              <SpatialGridPanel
                grid={world.backpack}
                source="backpack"
                heldItem={world.heldItem}
                hasOtherGrid={!!openChest?.chestGrid}
                cellPx={bagCellPx}
                onPick={actions.onPickGridItem}
                onPlace={actions.onPlaceGridItem}
                onQuickTransfer={actions.onQuickTransferItem}
                onRotate={actions.onRotateHeld}
              />
            </div>

            {/* Open Chest Spatial Grid */}
            {openChest?.chestGrid && (
              <div className="p-4 rounded-xl bg-black/45 border border-amber-500/25 flex flex-col items-center">
                <div className="w-full flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-bold text-amber-200 flex items-center gap-2">
                    <span>📦 储物木箱</span>
                    <span className="text-xs font-mono text-stone-300">
                      {getGridUsedCells(openChest.chestGrid)}/{openChest.chestGrid.cols * openChest.chestGrid.rows} 格
                    </span>
                  </div>
                  <button
                    onClick={actions.onDepositAll}
                    className="brass-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-amber-200 cursor-pointer"
                  >
                    <Archive className="w-3 h-3" /> 全存进箱
                  </button>
                </div>
                <SpatialGridPanel
                  grid={openChest.chestGrid}
                  source="chest"
                  heldItem={world.heldItem}
                  hasOtherGrid={true}
                  cellPx={44}
                  onPick={actions.onPickGridItem}
                  onPlace={actions.onPlaceGridItem}
                  onQuickTransfer={actions.onQuickTransferItem}
                  onRotate={actions.onRotateHeld}
                />
                <div className="text-[11px] text-stone-400 mt-2.5">
                  可直接拿取跨格放入箱子，或按住 <b>Shift+左键</b> 快速转移
                </div>
              </div>
            )}
          </div>

          {/* Backpack Tier Upgrade Bar */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/35 via-black/50 to-amber-950/25 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {nextTier ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
                    <ArrowUpCircle className="w-4 h-4 text-amber-400" />
                    <span>
                      升级背包：{currTier.cols}×{currTier.rows} →{' '}
                      <b className="text-emerald-300">
                        {nextTier.name} ({nextTier.cols}×{nextTier.rows} · {nextTier.cols * nextTier.rows}格)
                      </b>
                    </span>
                  </div>
                  <p className="text-xs text-stone-300">{nextTier.desc}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(nextTier.cost ?? {}).map(([k, v]) => {
                      const have = getItemCount(world, k as ResourceKey);
                      const ok = have >= (v ?? 0);
                      const m = ITEM_META[k as ResourceKey];
                      return (
                        <span
                          key={k}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                            ok
                              ? 'bg-emerald-950/55 border-emerald-500/45 text-emerald-200'
                              : 'bg-red-950/55 border-red-500/45 text-red-300'
                          }`}
                        >
                          {m.icon} {m.short} {have}/{v}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={actions.onUpgradeBackpack}
                  disabled={!canUpgradeBag}
                  className={`${
                    canUpgradeBag ? 'brass-btn-primary' : 'brass-btn text-stone-400'
                  } px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer`}
                >
                  升级扩容背包
                </button>
              </>
            ) : (
              <div className="text-xs text-amber-200 font-semibold">
                ✦ 已升级至顶级【{currTier.name}】({currTier.cols}×{currTier.rows} · 72格满级空间)
              </div>
            )}
          </div>
        </div>

        {/* Floating Cursor-Attached Held Item (POE2 feel!) */}
        {world.heldItem && (cursorPos.x > 0 || cursorPos.y > 0) && (() => {
          const meta = ITEM_META[world.heldItem.key];
          const sz = getItemSize(world.heldItem.key, world.heldItem.rotated);
          const st = RARITY_STYLES[meta.rarity];
          const wPx = sz.w * bagCellPx - 4;
          const hPx = sz.h * bagCellPx - 4;
          return (
            <div
              className={`pointer-events-none fixed z-50 rounded-lg border-2 bg-gradient-to-br ${st.bg} ${st.border} ${st.glow} flex flex-col items-center justify-center shadow-2xl`}
              style={{
                left: cursorPos.x - wPx / 2,
                top: cursorPos.y - hPx / 2,
                width: wPx,
                height: hPx,
              }}
            >
              <span className="text-xl leading-none">{meta.icon}</span>
              <span className="text-[10px] font-bold text-amber-200">
                {meta.short} ×{world.heldItem.count}
              </span>
              <span className="text-[9px] text-stone-300 font-mono">
                {sz.w}×{sz.h} [R旋转]
              </span>
            </div>
          );
        })()}
      </div>
    );
  }

  // 5. Workbench & Crafting Modal
  if (world.craftOpen) {
    const wb = hasWorkbench(world);
    const chests = getAllChestGrids(world).length;
    const filtered = CRAFT_RECIPES.filter((rec) => {
      if (craftTab === 'all') return true;
      if (craftTab === 'survival') return ['cooked_food', 'ammo', 'decoy', 'biofuel'].includes(rec.id);
      if (craftTab === 'train') return ['rail_segment', 'crude_coupler', 'biofuel', 'arcane_fuel'].includes(rec.id);
      return ['upgrade_pickaxe', 'upgrade_saw', 'arcane_potion', 'relic_salvage'].includes(rec.id);
    });

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-amber-200">随身 & 工程工作台合成</h2>
            </div>
            <button onClick={actions.onClose} className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-md border ${
                  wb
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                }`}
              >
                {wb ? '✓ 工作台已就绪' : '⚠ 未建工作台（仅基础配方）'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-black/45 border border-white/10 text-stone-300">
                箱子直取：{chests > 0 ? `已连通 ${chests} 箱` : '建箱后自动连通'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  ['all', '全部'],
                  ['survival', '生存补给'],
                  ['train', '铁道燃料'],
                  ['gear', '工具秘法'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCraftTab(id)}
                  className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all ${
                    craftTab === id
                      ? 'bg-amber-500/25 border border-amber-300 text-amber-200 font-semibold'
                      : 'bg-black/40 border border-white/10 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filtered.map((rec) => {
              const owned =
                (rec.id === 'upgrade_pickaxe' && world.player.toolLevel >= 2) ||
                (rec.id === 'upgrade_saw' && world.player.toolLevel >= 3);
              const needPrev = rec.id === 'upgrade_saw' && world.player.toolLevel < 2;
              const unlocked = !rec.requiresWorkbench || wb;
              const afford = canAffordCost(world, rec.cost);
              const ok = !owned && !needPrev && unlocked && afford;

              return (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-black/45 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-stone-100">{rec.name}</span>
                      {rec.requiresWorkbench && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          需工作台
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400">{rec.desc}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(rec.cost)
                        .filter(([, v]) => (v ?? 0) > 0)
                        .map(([k, v]) => {
                          const have = getItemCount(world, k as ResourceKey);
                          const enough = have >= (v ?? 0);
                          const meta = ITEM_META[k as ResourceKey];
                          return (
                            <span
                              key={k}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                                enough
                                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                                  : 'bg-red-950/50 border-red-500/40 text-red-300'
                              }`}
                            >
                              {meta.icon} {meta.short} {have}/{v}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                  <button
                    onClick={() => actions.onCraft(rec.id)}
                    disabled={!ok}
                    className={`${
                      ok ? 'brass-btn-primary' : 'brass-btn text-stone-400'
                    } px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer`}
                  >
                    {owned ? '已拥有' : needPrev ? '需先造铁镐' : '合成'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 6. Keeper Trading Post Modal
  if (world.tradeOpen) {
    const scrap = getItemCount(world, 'scrap');
    const bone = getItemCount(world, 'bone');
    const carapace = getItemCount(world, 'carapace');
    const magic = getItemCount(world, 'magicShard');
    const relic = getItemCount(world, 'ancientRelic');
    const trophyGain = bone * 4 + carapace * 5 + magic * 8 + relic * 18;

    const offers = [
      { id: 'buy-fuel', name: '⛽ 锅炉燃料 ×3', desc: '稀缺动力补给', cost: 6 },
      { id: 'buy-coupler', name: '🔗 正规车钩 ×1', desc: '稳固挂接新车厢，高速无磨损', cost: 14 },
      { id: 'buy-parts', name: '🔩 精密零件 ×2', desc: '炮塔、铁轨与工具升级核心件', cost: 8 },
      { id: 'buy-rail', name: '🛤 铁轨段 ×1', desc: '应急修复断裂地裂', cost: 6 },
      { id: 'buy-seed', name: '🌱 耐旱麦种子 ×2', desc: '车厢菜地循环种植', cost: 4 },
    ];

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-amber-200">守塔老人 · 物资交易站</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-black/50 border border-amber-400/40 text-xs font-mono text-amber-300">
                ⚙ 可用废料：{scrap}
              </span>
              <button onClick={actions.onClose} className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {trophyGain > 0 && (
            <div className="p-3.5 mb-3 rounded-xl bg-amber-950/35 border border-amber-400/50 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-amber-200">卖出全部战利品与珍宝</div>
                <div className="text-xs text-stone-300 mt-0.5">
                  骨×{bone} · 甲壳×{carapace} · 魔晶×{magic} · 远古造物×{relic}
                </div>
              </div>
              <button
                onClick={() => actions.onTrade('sell-trophy')}
                className="brass-btn-primary px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
              >
                换取 +{trophyGain} 废料
              </button>
            </div>
          )}

          <div className="space-y-2">
            {offers.map((of) => {
              const afford = scrap >= of.cost;
              return (
                <div
                  key={of.id}
                  className="p-3.5 rounded-xl bg-black/45 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-stone-100">{of.name}</div>
                    <div className="text-xs text-stone-400">{of.desc}</div>
                  </div>
                  <button
                    onClick={() => actions.onTrade(of.id)}
                    disabled={!afford}
                    className={`${afford ? 'brass-btn-primary' : 'brass-btn text-stone-400'} px-4 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer`}
                  >
                    ⚙ {of.cost} 废料
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 7. Field Manual / Controls Help Modal (H)
  if (helpOpen) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="brass-panel-strong w-full max-w-lg rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-amber-200">铁道生存手册 · 快捷键</h2>
            </div>
            <button onClick={onCloseHelp} className="brass-btn p-1.5 rounded-lg text-stone-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-stone-200 mb-4">
            {[
              ['WASD + Shift', '无空气墙自由探索 / 冲刺'],
              ['鼠标左键', '挥舞工具 / 射击 / 建造'],
              ['鼠标右键', '拆除建筑 / 背包内旋转物品'],
              ['E', '开关门 / 添煤 / 交互 / 取提灯'],
              ['I / R', '网格背包(手动摆放) / 旋转物品'],
              ['Q / F', '降档刹车 / 升档加速'],
              ['B / Tab', '车厢建造 / 工作台合成'],
              ['1 ~ 6', '快捷栏 (4直接吃喝)'],
              ['L', '开关手提锥形提灯'],
              ['滚轮 / V', '视野缩放 / 重置100%'],
            ].map(([k, desc]) => (
              <div key={k} className="p-2.5 rounded-lg bg-black/45 border border-white/10 flex flex-col gap-0.5">
                <span className="font-mono font-bold text-amber-300">{k}</span>
                <span className="text-stone-300">{desc}</span>
              </div>
            ))}
          </div>
          <button onClick={onCloseHelp} className="brass-btn-primary w-full py-2 rounded-xl text-xs font-bold cursor-pointer">
            返回失落世界
          </button>
        </div>
      </div>
    );
  }

  return null;
};
