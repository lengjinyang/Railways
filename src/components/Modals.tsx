import React, { useState } from 'react';
import {
  X,
  Backpack,
  BookOpen,
  ScrollText,
  Map as MapIcon,
  Wrench,
  Coins,
  Skull,
  Layers,
  Archive,
  ArrowDownWideNarrow,
  ArrowUpCircle,
  Check,
  Volume2,
  VolumeX,
  Save,
  RotateCcw,
  PackageOpen,
  Play,
  ScanSearch,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import { BUILDINGS, CRAFT_RECIPES, type CraftRecipe } from '../recipes_v2';
import {
  BACKPACK_TIERS,
  BODY_ARMOR_META,
  HEAD_ARMOR_META,
  ITEM_META,
  MELEE_META,
  RANGED_META,
  TOOL_META,
  ZONE_META,
  ZONE_WEATHER,
  canAffordCost,
  estimateRouteFuel,
  findBuildingByUid,
  getAllChestGrids,
  getBuildingDisplayName,
  getItemCount,
  getNotebookThoughts,
  getOpenContainerProp,
  getUsedSlots,
  getZoneTierRoman,
  getItemUseHint,
  getItemUseVerb,
  getHotbarBindings,
  isHotbarItem,
  type BodyArmorId,
  type HeadArmorId,
  type RangedWeaponId,
  type ResourceKey,
  type SlotInventory,
  type WorldState,
} from '../world';
import { ItemGlyph } from './ItemGlyph';
import { acceptsDrag, readDrag, startDrag, type DragPayload, type DragSource } from './dnd';

export interface ModalActions {
  onCloseSidebars: () => void;
  onSetNotebookTab: (tab: 'bag' | 'notes' | 'codex') => void;
  onSelectRoute: (routeId: string) => void;
  onSortInventory: (src: 'backpack' | 'chest') => void;
  onQuickStack: () => void;
  onDepositAll: () => void;
  onTransferSlot: (from: 'backpack' | 'chest' | 'container', slotIdx: number) => void;
  onTakeAllContainer: () => void;
  onDropBackpackSlot: (slotIdx: number) => void;
  onUseBackpackSlot: (slotIdx: number) => void;
  onBindItem: (hotbarSlot: number, key: ResourceKey) => void;
  onUpgradeBackpack: () => void;
  onEquipBodyArmor: (aid: BodyArmorId) => void;
  onEquipHeadArmor: (hid: HeadArmorId) => void;
  onEquipRanged: (wid: RangedWeaponId) => void;
  onCraftAtFacility: (facilityUid: string, recipeId: string) => void;
  onUpgradeFacility: (facilityUid: string) => void;
  onTrade: (tradeId: string) => void;
  onRollbackStation: () => void;
  onCloseMenu: () => void;
  onToggleMute: () => void;
  onResetZoom: () => void;
  onManualSave: () => void;
  onRestart: () => void;
}

interface ModalsProps {
  world: WorldState;
  menuOpen: boolean;
  muted: boolean;
  zoomPct: number;
  actions: ModalActions;
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared building blocks
   ────────────────────────────────────────────────────────────────────────── */

const CloseBtn: React.FC<{ onClick: () => void; hint?: string }> = ({ onClick, hint = 'Esc' }) => (
  <button onClick={onClick} title={`关闭 (${hint})`} className="btn-ghost w-7 h-7 !gap-0">
    <X className="w-4 h-4" />
  </button>
);

/** Right-docked, non-pausing sidebar. One frame for every panel so they read as one instrument. */
const SidebarShell: React.FC<{
  width: number;
  maxVw?: number;
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  extra?: React.ReactNode;
  onClose: () => void;
  danger?: boolean;
  belowHeader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ width, maxVw = 50, icon, eyebrow, title, extra, onClose, danger, belowHeader, footer, children }) => (
  <div className="pointer-events-none fixed inset-y-5 right-5 z-20 flex items-center">
    <div
      style={{ width, maxWidth: `${maxVw}vw` }}
      className={`pointer-events-auto plate-strong riveted anim-panel-in max-h-full flex flex-col overflow-hidden transition-[border-color] duration-300 ${
        danger ? '!border-rust/80 anim-danger-ring' : ''
      }`}
    >
      <div className="plate-head flex items-center justify-between gap-3 pl-4 pr-2.5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-md border border-brass/30 bg-[radial-gradient(circle_at_50%_35%,rgb(237_196_124/0.16),transparent_70%)] flex items-center justify-center text-brass-hi">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="eyebrow !text-[9px] mb-1">{eyebrow}</div>
            <div className="text-[14px] font-semibold text-parchment truncate tracking-wide">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {extra}
          <CloseBtn onClick={onClose} />
        </div>
      </div>
      {belowHeader}
      <div className="overflow-y-auto flex-1 p-4">{children}</div>
      {footer && <div className="border-t border-white/5 px-4 py-2.5 bg-black/20">{footer}</div>}
    </div>
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode; right?: React.ReactNode; tone?: string }> = ({
  children,
  right,
  tone = 'text-parchment-dim',
}) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <span className={`text-[11.5px] font-semibold tracking-wide ${tone}`}>{children}</span>
    {right && <div className="flex items-center gap-1">{right}</div>}
  </div>
);

const Pill: React.FC<{
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button onClick={onClick} title={title} data-active={active} className="seg px-2 py-[3px] text-[11px]">
    {children}
  </button>
);

const SLOT = 54;
const GAP = 6;
const gridWidth = (cols: number) => cols * SLOT + (cols - 1) * GAP;

/** Fixed-size inventory sockets; any grid can be a drag source and (optionally) a drop target. */
const SlotGrid: React.FC<{
  inv: SlotInventory;
  cols: number;
  source: 'backpack' | 'chest' | 'container';
  selectedIdx?: number | null;
  boundKeys?: Partial<Record<ResourceKey, number>>;
  acceptFrom?: DragSource[];
  onDropFrom?: (p: DragPayload) => void;
  onSlotClick: (idx: number, e: React.MouseEvent) => void;
  onSlotDoubleClick?: (idx: number) => void;
  onSlotContext?: (idx: number) => void;
  hint: string;
}> = ({ inv, cols, source, selectedIdx, boundKeys, acceptFrom, onDropFrom, onSlotClick, onSlotDoubleClick, onSlotContext, hint }) => {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!onDropFrom || !acceptsDrag(e)) return;
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        if (!onDropFrom) return;
        const d = readDrag(e);
        if (!d || d.src === source || (acceptFrom && !acceptFrom.includes(d.src))) return;
        e.preventDefault();
        onDropFrom(d);
      }}
      className={`grid rounded-lg transition-[background-color,box-shadow] duration-150 ${
        over ? 'bg-rune/[0.06] shadow-[0_0_0_1px_rgb(132_200_255/0.45),0_0_20px_-6px_rgb(132_200_255/0.5)]' : ''
      }`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${SLOT}px)`, gap: GAP, width: gridWidth(cols) }}
    >
      {inv.slots.map((slot, idx) => {
        if (!slot) return <div key={idx} className="slot" style={{ width: SLOT, height: SLOT }} />;
        const meta = ITEM_META[slot.key];
        const freshPct = slot.freshness !== undefined ? Math.round(slot.freshness) : null;
        const selected = selectedIdx === idx;
        const bound = boundKeys?.[slot.key];
        return (
          <button
            key={slot.uid}
            type="button"
            draggable
            onDragStart={(e) => startDrag(e, { src: source, idx, key: slot.key })}
            onClick={(e) => onSlotClick(idx, e)}
            onDoubleClick={() => onSlotDoubleClick?.(idx)}
            onContextMenu={(e) => {
              e.preventDefault();
              onSlotContext?.(idx);
            }}
            title={`${meta.name} ×${slot.count}\n${meta.desc}\n${hint}`}
            className={`slot slot-filled flex flex-col items-center justify-center gap-[5px] px-1 ${
              selected ? '!border-brass-hi shadow-[0_0_0_1px_rgb(237_196_124/0.45),0_0_16px_-4px_rgb(237_196_124/0.6)]' : ''
            }`}
            style={{ width: SLOT, height: SLOT }}
          >
            <ItemGlyph itemKey={slot.key} size={22} />
            <span className="text-[9.5px] text-parchment-dim truncate max-w-full leading-none">{meta.short}</span>
            {slot.count > 1 && (
              <span className="absolute top-[3px] right-[4px] text-[9.5px] font-mono font-semibold text-brass-hi leading-none">
                {slot.count}
              </span>
            )}
            {bound !== undefined && (
              <span className="absolute top-[3px] left-[4px] text-[8.5px] font-mono text-rune/90 leading-none" title="已在快捷栏">
                {bound + 1}
              </span>
            )}
            {freshPct !== null && (
              <div className="absolute bottom-[3px] left-1.5 right-1.5 h-[2px] bg-black/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${freshPct}%`, backgroundColor: freshPct < 30 ? '#dc5f4f' : '#82b98d' }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** Selected backpack item: what it is and every way to use it. */
const ItemDetail: React.FC<{
  world: WorldState;
  slotIdx: number;
  chestOpen: boolean;
  actions: ModalActions;
  onDone: () => void;
}> = ({ world, slotIdx, chestOpen, actions, onDone }) => {
  const it = world.backpack.slots[slotIdx];
  if (!it) return null;
  const meta = ITEM_META[it.key];
  const verb = getItemUseVerb(it.key);
  const hint = getItemUseHint(it.key);
  const bindable = isHotbarItem(it.key);
  const bars = getHotbarBindings(world);
  const catLabel: Record<string, string> = {
    material: '材料',
    supply: '补给',
    ammo: '弹药',
    train: '列车',
    relic: '遗物',
    gear: '装备',
  };
  return (
    <div className="anim-fade-in">
      <div className="flex items-start gap-3">
        <ItemGlyph itemKey={it.key} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-parchment">{meta.name}</span>
            <span className="chip !py-0 !text-[9.5px]">{catLabel[meta.category] ?? meta.category}</span>
            <span className="font-mono text-[11px] text-ash ml-auto">×{it.count}</span>
          </div>
          <p className="text-[11px] text-ash leading-relaxed mt-0.5 line-clamp-2">{meta.desc}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {verb ? (
          <button
            onClick={() => actions.onUseBackpackSlot(slotIdx)}
            className="btn-primary px-3.5 py-1.5 text-[11.5px]"
          >
            {verb}
          </button>
        ) : (
          hint && <span className="text-[10.5px] text-ash-dim mr-1">{hint}</span>
        )}
        {chestOpen && (
          <button
            onClick={() => {
              actions.onTransferSlot('backpack', slotIdx);
              onDone();
            }}
            className="btn px-2.5 py-1.5 text-[11px]"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> 存入货箱
          </button>
        )}
        {bindable && (
          <span className="flex items-center gap-1 ml-1">
            <span className="text-[10px] text-ash-dim mr-0.5">快捷栏</span>
            {bars.map((b, i) => {
              const here = b?.kind === 'item' && b.key === it.key;
              return (
                <button
                  key={i}
                  onClick={() => actions.onBindItem(i, it.key)}
                  data-active={here}
                  title={b ? '替换此槽' : '放入空槽'}
                  className={`seg w-[22px] h-[22px] text-[10.5px] font-mono flex items-center justify-center ${b ? '' : 'border-dashed'}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </span>
        )}
        <button
          onClick={() => {
            actions.onDropBackpackSlot(slotIdx);
            onDone();
          }}
          className="btn-ghost px-2 py-1.5 text-[11px] ml-auto hover:!text-[#f0a69b]"
        >
          <Trash2 className="w-3.5 h-3.5" /> 丢弃
        </button>
      </div>
    </div>
  );
};

type CraftGroup = 'supply' | 'ammo' | 'train' | 'weapon' | 'armor' | 'tool';
const CRAFT_GROUPS: Array<{ id: CraftGroup; label: string }> = [
  { id: 'supply', label: '补给' },
  { id: 'ammo', label: '弹药' },
  { id: 'weapon', label: '武器' },
  { id: 'armor', label: '护具' },
  { id: 'tool', label: '工具' },
  { id: 'train', label: '列车' },
];
/** Recipes that grant equipment instead of items still get a recognisable token. */
const RECIPE_GLYPH: Partial<Record<string, ResourceKey>> = {
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

/* ──────────────────────────────────────────────────────────────────────────
   Modals & sidebars
   ────────────────────────────────────────────────────────────────────────── */

export const Modals: React.FC<ModalsProps> = ({ world, menuOpen, muted, zoomPct, actions }) => {
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [craftGroup, setCraftGroup] = useState<CraftGroup | 'all'>('all');
  const [craftSel, setCraftSel] = useState<string | null>(null);
  // --- BLOCKING MODAL 1: Death Station Rollback (#5: No random carriage loss!) ---
  if (world.deathReport) {
    const r = world.deathReport;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 anim-fade-in">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(40_6_6/0.75),rgb(0_0_0/0.94)_75%)] backdrop-blur-[3px]" />
        <div className="relative w-full max-w-md text-center anim-rise-in">
          <Skull className="w-8 h-8 text-rust/90 mx-auto mb-5" strokeWidth={1.5} />
          <div className="eyebrow !text-rust/80 mb-3">第 {r.deathNum} 次倒下</div>
          <h2 className="display text-[30px] text-parchment text-engraved tracking-[0.14em] mb-4">{r.cause}</h2>
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="h-px w-14 bg-gradient-to-l from-rust/60 to-transparent" />
            <span className="w-1 h-1 rotate-45 bg-rust/70" />
            <span className="h-px w-14 bg-gradient-to-r from-rust/60 to-transparent" />
          </div>
          <p className="text-[13px] text-parchment-dim leading-relaxed mb-8 max-w-sm mx-auto">
            列车将回退至最近停靠的站点存档。
            <br />
            车厢与设施不会随机丢失。
          </p>
          <button onClick={actions.onRollbackStation} className="btn-primary px-7 py-2.5 text-[13px] tracking-wider">
            <RotateCcw className="w-4 h-4" />
            回到 {r.rollbackStationName}
          </button>
        </div>
      </div>
    );
  }

  // --- BLOCKING MODAL 2: Esc Pause Menu (U7: Help, Zoom, Audio, Save, Restart) ---
  if (menuOpen) {
    const keys: Array<[string, string]> = [
      ['WASD · Shift', '移动 · 冲刺'],
      ['左键 · 右键', '挥击射击建造 · 拆除'],
      ['E · 长按 E', '交互收获 · 搜刮铺轨存箱'],
      ['1–6 · 滚轮', '切换快捷栏（4 长按吃喝）'],
      ['Tab', '行囊 · 笔记 · 图鉴'],
      ['B · M', '建造（点设施升级）· 航线图'],
      ['R', '搜刮时全部拿走'],
      ['Ctrl + 滚轮', `缩放视野 · ${zoomPct}%`],
    ];
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 anim-fade-in">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" />
        <div className="relative plate-strong riveted anim-pop-in w-full max-w-[560px] overflow-hidden">
          <div className="plate-head flex items-center justify-between px-6 py-4">
            <div>
              <div className="eyebrow mb-1.5">Paused · 世界已暂停</div>
              <h2 className="display text-[22px] text-parchment tracking-[0.14em]">停车检修</h2>
            </div>
            <CloseBtn onClick={actions.onCloseMenu} />
          </div>

          <div className="px-6 py-5 space-y-5">
            <div>
              <SectionLabel>操作指南</SectionLabel>
              <div className="inset-well grid grid-cols-2 gap-x-5 gap-y-2.5 px-4 py-3.5">
                {keys.map(([k, desc]) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-[11.5px]">
                    <span className="font-mono text-brass-hi/90 whitespace-nowrap">{k}</span>
                    <span className="text-ash text-right truncate">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>设置与存档</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={actions.onToggleMute} className="btn py-2.5 text-[12px]">
                  {muted ? <VolumeX className="w-4 h-4 text-rust" /> : <Volume2 className="w-4 h-4 text-brass-hi" />}
                  {muted ? '已静音' : '声音开启'}
                </button>
                <button onClick={actions.onResetZoom} className="btn py-2.5 text-[12px]">
                  <ScanSearch className="w-4 h-4 text-brass-hi" />
                  重置视野 <span className="font-mono text-ash">{zoomPct}%</span>
                </button>
                <button onClick={actions.onManualSave} className="btn py-2.5 text-[12px]">
                  <Save className="w-4 h-4 text-patina" />
                  保存进度
                </button>
                <button onClick={actions.onRestart} className="btn py-2.5 text-[12px] hover:!border-rust/60 hover:!text-[#f0a69b]">
                  <RotateCcw className="w-4 h-4 text-rust" />
                  重开旅程
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <button onClick={actions.onCloseMenu} className="btn-primary w-full py-2.5 text-[13px] tracking-[0.12em]">
              <Play className="w-4 h-4" />
              继续旅程
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- NON-PAUSING SIDEBARS (World stays alive & character stays visible on the left! D + U6 + U8) ---
  const openContainer = getOpenContainerProp(world);
  const openFacility = world.openFacilityUid ? findBuildingByUid(world, world.openFacilityUid) : null;
  const openChest = world.openChestUid ? findBuildingByUid(world, world.openChestUid) : null;
  const dangerNear = world.monsters.some(
    (m) => m.hp > 0 && Math.hypot(m.x - world.player.x, m.y - world.player.y) < 260
  );

  // 1. World Container Loot Sidebar (border turns red when monster approaches, press R to take all!)
  if (openContainer && openContainer.containerInv) {
    const bagCols = BACKPACK_TIERS[world.backpackLevel].cols;
    return (
      <SidebarShell
        width={gridWidth(Math.max(bagCols, 4)) + 34}
        icon={<PackageOpen className="w-4 h-4" />}
        eyebrow="搜刮 · Scavenge"
        title={openContainer.label}
        danger={dangerNear}
        onClose={actions.onCloseSidebars}
        extra={
          <button onClick={actions.onTakeAllContainer} className="btn-primary px-2.5 py-1 text-[11px]">
            全部拿走 <span className="font-mono opacity-60">R</span>
          </button>
        }
        belowHeader={
          dangerNear && (
            <div className="px-4 py-1.5 bg-rust/15 border-b border-rust/40 text-[11px] text-[#f0a69b] tracking-wider anim-fade-in">
              附近有动静逼近……
            </div>
          )
        }
        footer={<div className="text-[10.5px] text-ash-dim text-center">点击拿取 · 拖到行囊或快捷栏 · 行囊内右键直接使用</div>}
      >
        <SectionLabel tone="text-brass-hi">容器内</SectionLabel>
        <SlotGrid
          inv={openContainer.containerInv}
          cols={4}
          source="container"
          onSlotClick={(idx) => actions.onTransferSlot('container', idx)}
          hint="点击拿取"
        />
        <div className="hairline my-4" />
        <SectionLabel
          tone="text-ash"
          right={
            <span className="font-mono text-[10.5px] text-ash">
              {getUsedSlots(world.backpack)}/{world.backpack.capacity}
            </span>
          }
        >
          随身行囊
        </SectionLabel>
        <SlotGrid
          inv={world.backpack}
          cols={bagCols}
          source="backpack"
          acceptFrom={['container']}
          onDropFrom={(d) => actions.onTransferSlot('container', d.idx)}
          onSlotClick={() => {}}
          onSlotContext={actions.onUseBackpackSlot}
          hint="右键使用"
        />
      </SidebarShell>
    );
  }

  // 2. Facility-Scoped Crafting Sidebar (Workbench / Campfire / Filter Barrel)
  //    Compact recipe grid grouped by kind + one pinned detail pane, so the whole bench reads at a glance.
  if (openFacility) {
    const facKind =
      openFacility.type === 'workbench' ? 'workbench' : openFacility.type === 'campfire' ? 'campfire' : 'filter';
    const def = BUILDINGS[openFacility.type];
    const recipes = CRAFT_RECIPES.filter((r) => r.facility === facKind);
    const canUp = openFacility.tier < 2 && !!def.tier2Cost && canAffordCost(world, def.tier2Cost);
    const p = world.player;

    // Only one-way tool tier upgrades can be "done"; weapons & armour can always be crafted again.
    const isOwned = (id: string) => (id === 'upgrade_pickaxe' && p.toolLevel >= 2) || (id === 'upgrade_saw' && p.toolLevel >= 3);

    const groupOf = (r: CraftRecipe): CraftGroup => {
      if (r.category !== 'gear') return r.category;
      if (r.id.startsWith('armor_') || r.id.startsWith('head_')) return 'armor';
      if (r.id.startsWith('craft_')) return 'weapon';
      return 'tool';
    };
    const glyphOf = (r: CraftRecipe): ResourceKey => {
      const out = Object.keys(r.output)[0] as ResourceKey | undefined;
      return out ?? RECIPE_GLYPH[r.id] ?? 'parts';
    };
    type RowState = 'ok' | 'missing' | 'tier' | 'owned';
    const rows = recipes.map((rec) => {
      const owned = isOwned(rec.id);
      const tierOk = (rec.minFacilityTier ?? 1) <= openFacility.tier;
      const missing = Object.entries(rec.cost).filter(([k, v]) => getItemCount(world, k as ResourceKey) < (v ?? 0));
      const state: RowState = owned ? 'owned' : !tierOk ? 'tier' : missing.length > 0 ? 'missing' : 'ok';
      return { rec, group: groupOf(rec), state, missing };
    });
    const rank: Record<RowState, number> = { ok: 0, missing: 1, tier: 2, owned: 3 };
    const groups = CRAFT_GROUPS.filter((g) => rows.some((r) => r.group === g.id));
    const activeGroup = groups.some((g) => g.id === craftGroup) ? craftGroup : 'all';
    const visible = rows
      .filter((r) => activeGroup === 'all' || r.group === activeGroup)
      .sort((a, b) =>
        activeGroup === 'all'
          ? CRAFT_GROUPS.findIndex((g) => g.id === a.group) - CRAFT_GROUPS.findIndex((g) => g.id === b.group) ||
            rank[a.state] - rank[b.state]
          : rank[a.state] - rank[b.state]
      );
    const sel = visible.find((r) => r.rec.id === craftSel) ?? visible.find((r) => r.state === 'ok') ?? visible[0];
    const readyCount = (g: CraftGroup | 'all') =>
      rows.filter((r) => r.state === 'ok' && (g === 'all' || r.group === g)).length;

    const processing = openFacility.processRecipeId
      ? CRAFT_RECIPES.find((r) => r.id === openFacility.processRecipeId)
      : null;

    const tile = (r: (typeof rows)[number]) => {
      const isSel = sel?.rec.id === r.rec.id;
      const key = glyphOf(r.rec);
      const status =
        r.state === 'ok'
          ? { text: '可制作', cls: 'text-patina' }
          : r.state === 'owned'
            ? { text: '已升级', cls: 'text-ash-dim' }
            : r.state === 'tier'
              ? { text: `需 T${r.rec.minFacilityTier}`, cls: 'text-brass/80' }
              : { text: `缺 ${r.missing.length} 种`, cls: 'text-rust/85' };
      return (
        <button
          key={r.rec.id}
          onClick={() => setCraftSel(r.rec.id)}
          onDoubleClick={() => r.state === 'ok' && actions.onCraftAtFacility(openFacility.uid, r.rec.id)}
          data-active={isSel}
          title={r.rec.desc}
          className={`seg relative h-[62px] px-2 py-1.5 flex items-center gap-2 text-left ${
            r.state === 'ok' ? '' : r.state === 'owned' ? 'opacity-45' : 'opacity-75'
          }`}
        >
          {r.state === 'ok' && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-patina shadow-[0_0_6px_rgb(120_190_150/0.8)]" />
          )}
          <ItemGlyph itemKey={key} size={26} dim={r.state === 'owned'} />
          <span className="min-w-0 flex flex-col gap-[3px]">
            <span className="text-[11.5px] font-semibold text-parchment leading-tight line-clamp-2">{r.rec.name}</span>
            <span className={`text-[9.5px] font-mono leading-none ${status.cls}`}>{status.text}</span>
          </span>
        </button>
      );
    };

    return (
      <SidebarShell
        width={600}
        maxVw={60}
        icon={<Wrench className="w-4 h-4" />}
        eyebrow={`设施 · Tier ${openFacility.tier === 2 ? 'II' : 'I'}`}
        title={getBuildingDisplayName(openFacility)}
        onClose={actions.onCloseSidebars}
        extra={
          openFacility.tier < 2 &&
          def.tier2Cost && (
            <button
              onClick={() => actions.onUpgradeFacility(openFacility.uid)}
              disabled={!canUp}
              title={def.tier2Desc}
              className={`${canUp ? 'btn-primary' : 'btn'} px-2.5 py-1 text-[11px]`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              升级为{def.tier2Short}
            </button>
          )
        }
        belowHeader={
          <>
            {processing && (
              <div className="px-4 py-2 border-b border-brass/20 bg-brass/[0.06]">
                <div className="flex justify-between text-[11.5px] text-brass-hi mb-1.5">
                  <span>加工中 · {processing.name}</span>
                  <span className="font-mono">{Math.round(openFacility.processProgress ?? 0)}%</span>
                </div>
                <div className="meter h-1">
                  <div className="meter-fill bg-brass-hi" style={{ width: `${openFacility.processProgress ?? 0}%` }} />
                </div>
              </div>
            )}
            {groups.length > 1 && (
              <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-white/5">
                {[{ id: 'all' as const, label: '全部' }, ...groups].map((g) => {
                  const n = readyCount(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => setCraftGroup(g.id)}
                      data-active={activeGroup === g.id}
                      className="seg px-2.5 py-1 text-[11.5px] inline-flex items-center gap-1.5"
                    >
                      {g.label}
                      {n > 0 && (
                        <span className="min-w-[15px] h-[15px] px-1 rounded-full bg-patina/20 text-patina text-[9.5px] font-mono leading-[15px] text-center">
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        }
        footer={
          sel && (
            <div className="flex gap-3.5 py-1">
              <ItemGlyph itemKey={glyphOf(sel.rec)} size={40} dim={sel.state === 'owned'} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold text-parchment">{sel.rec.name}</span>
                  {sel.rec.processTime ? (
                    <span className="text-[10px] font-mono text-ash">耗时 {sel.rec.processTime}s</span>
                  ) : null}
                  {(() => {
                    const k = glyphOf(sel.rec);
                    if (sel.state === 'owned' || k === 'parts') return null;
                    const have = getItemCount(world, k, true);
                    return <span className="text-[10px] font-mono text-ash">背包/车厢已有 {have}</span>;
                  })()}
                </div>
                <p className="text-[11px] text-ash leading-relaxed">{sel.rec.desc}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {Object.entries(sel.rec.cost).map(([k, v]) => {
                    const have = getItemCount(world, k as ResourceKey);
                    const enough = have >= (v ?? 0);
                    const meta = ITEM_META[k as ResourceKey];
                    return (
                      <span key={k} className="inline-flex items-center gap-1.5" title={enough ? meta.name : meta.sourceHint}>
                        <ItemGlyph itemKey={k as ResourceKey} size={18} />
                        <span className="text-[11px] text-parchment-dim">{meta.name}</span>
                        <span className={`text-[11px] font-mono ${enough ? 'text-patina' : 'text-rust'}`}>
                          {have}/{v}
                        </span>
                      </span>
                    );
                  })}
                </div>
                {sel.state === 'missing' && (
                  <div className="text-[10px] text-ash-dim truncate">
                    去哪找 · {ITEM_META[sel.missing[0][0] as ResourceKey].short}：
                    {ITEM_META[sel.missing[0][0] as ResourceKey].sourceHint}
                  </div>
                )}
              </div>
              <button
                onClick={() => actions.onCraftAtFacility(openFacility.uid, sel.rec.id)}
                disabled={sel.state !== 'ok'}
                className={`${sel.state === 'ok' ? 'btn-primary' : 'btn'} self-center px-4 py-2 text-[12px] shrink-0`}
              >
                {sel.state === 'owned'
                  ? '已升级'
                  : sel.state === 'tier'
                    ? `需 T${sel.rec.minFacilityTier}`
                    : sel.rec.processTime
                      ? '投入加工'
                      : '制作'}
              </button>
            </div>
          )
        }
      >
        {activeGroup === 'all' && groups.length > 1 ? (
          <div className="space-y-3.5">
            {groups.map((g) => {
              const list = visible.filter((r) => r.group === g.id);
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10.5px] tracking-[0.14em] text-ash">{g.label}</span>
                    <span className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">{list.map(tile)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">{visible.map(tile)}</div>
        )}
        <div className="mt-3 text-[10px] text-ash-dim text-center">单击查看 · 双击直接制作</div>
      </SidebarShell>
    );
  }

  // 3. Route Map Sidebar (M, non-pausing)
  if (world.routeOpen) {
    const totalCrystal = +(world.boilerFuel + getItemCount(world, 'magicShard')).toFixed(1);
    return (
      <SidebarShell
        width={452}
        icon={<MapIcon className="w-4 h-4" />}
        eyebrow="航线 · Route"
        title="铁道航线图"
        onClose={actions.onCloseSidebars}
        extra={<span className="chip chip-rune font-mono mr-1">晶石 {totalCrystal}</span>}
      >
        {world.availableRoutes.length === 0 ? (
          <div className="py-12 text-center">
            <div className="display text-[15px] text-parchment-dim tracking-[0.12em] mb-1.5">铁轨仍在延伸</div>
            <div className="text-[11.5px] text-ash">列车仍在驶往首座站点。</div>
          </div>
        ) : (
          <div className="relative space-y-2.5 pl-5">
            <div className="text-[10.5px] text-ash -ml-5 mb-1">{world.availableRoutes.length} 条可选航线 · 选定后启动列车即出发</div>
            {/* the line itself */}
            <div className="absolute left-[5px] top-3 bottom-3 w-px bg-gradient-to-b from-brass/50 via-brass/20 to-transparent" />
            {world.availableRoutes.map((r) => {
              const zm = ZONE_META[r.zone];
              const estNorm = estimateRouteFuel(world, r.distance, 2);
              const estMins = Math.round(r.distance / 7.22 / 60);
              const isSel = world.selectedRoute?.id === r.id;
              const short = totalCrystal < estNorm;
              return (
                <div key={r.id} className="relative">
                  <span
                    className="absolute -left-5 top-4 w-[11px] h-[11px] rounded-full border-2 bg-ink-900"
                    style={{ borderColor: zm.color, boxShadow: isSel ? `0 0 10px ${zm.color}` : undefined }}
                  />
                  <div
                    className={`p-3 rounded-lg border space-y-1.5 transition-colors ${
                      isSel
                        ? 'border-brass-hi/70 bg-[linear-gradient(90deg,rgb(237_196_124/0.1),rgb(237_196_124/0.02))]'
                        : 'border-white/[0.07] bg-black/25 hover:border-brass/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold tracking-wide" style={{ color: zm.color }}>
                          {r.stationName}
                        </div>
                        <div className="text-[10.5px] text-ash font-mono mt-0.5">
                          {zm.name} {getZoneTierRoman(r.tier)} · {r.distance}m · 约 {estMins} 分钟
                        </div>
                      </div>
                      <button
                        onClick={() => actions.onSelectRoute(r.id)}
                        className={`${isSel ? 'btn !text-patina !border-patina/40' : 'btn-primary'} px-3 py-1.5 text-[11.5px] shrink-0`}
                      >
                        {isSel ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> 已锁定
                          </>
                        ) : (
                          '选定'
                        )}
                      </button>
                    </div>
                    <p className="text-[11.5px] text-parchment-dim leading-relaxed line-clamp-2" title={r.desc}>
                      {r.desc}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="chip">特产 · {zm.specialty}</span>
                      {ZONE_WEATHER[r.zone].kind && <span className="chip">天气 · {ZONE_WEATHER[r.zone].label}</span>}
                      <span className={`chip font-mono ${short ? 'chip-bad' : 'chip-rune'}`}>预计晶石 ~{estNorm}</span>
                      {r.warningTag && <span className="chip chip-bad">{r.warningTag}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SidebarShell>
    );
  }

  // 4. Mutant Merchant Trading Sidebar (P3, non-pausing)
  if (world.tradeOpen) {
    const scrap = getItemCount(world, 'scrap');
    const bone = getItemCount(world, 'bone');
    const carapace = getItemCount(world, 'carapace');
    const relic = getItemCount(world, 'ancientRelic');
    const trophyGain = bone * 3 + carapace * 5 + relic * 18;
    const offers = [
      { id: 'buy-crystal', key: 'magicShard', name: '秘法晶石 ×2', desc: '列车燃料与铭文材料', cost: 7 },
      { id: 'buy-coupler', key: 'coupler', name: '正规车钩 ×1', desc: '稳固挂接车厢无磨损', cost: 14 },
      { id: 'buy-parts', key: 'parts', name: '机械零件 ×2', desc: '铁轨、炮塔与工具升级', cost: 8 },
      { id: 'buy-copper', key: 'copper', name: '铜线管件 ×2', desc: '二阶设施与步枪组件', cost: 7 },
      { id: 'buy-rail', key: 'rails', name: '铁轨段 ×1', desc: '沉陷带断轨必备', cost: 6 },
      { id: 'buy-seed', key: 'seeds', name: '耐旱麦种 ×2', desc: '车厢种植箱播种', cost: 4 },
    ] as const;

    return (
      <SidebarShell
        width={412}
        icon={<Coins className="w-4 h-4" />}
        eyebrow="交易 · Barter"
        title="变异行商"
        onClose={actions.onCloseSidebars}
        extra={<span className="chip font-mono text-brass-hi mr-1">废料 {scrap}</span>}
      >
        {trophyGain > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-brass/35 bg-[linear-gradient(90deg,rgb(201_149_77/0.12),rgb(201_149_77/0.03))] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11.5px] font-semibold text-parchment mb-0.5">出售战利品</div>
              <div className="text-[10.5px] text-ash font-mono">
                骨×{bone} · 甲壳×{carapace} · 封匣×{relic}
              </div>
            </div>
            <button onClick={() => actions.onTrade('sell-trophy')} className="btn-primary px-3 py-1.5 text-[11.5px] shrink-0">
              +{trophyGain} 废料
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          {offers.map((of) => {
            const meta = ITEM_META[of.key as ResourceKey];
            const afford = scrap >= of.cost;
            return (
              <div
                key={of.id}
                className="p-2.5 rounded-lg bg-black/25 border border-white/[0.06] hover:border-brass/25 transition-colors flex items-center gap-3"
              >
                {meta && (
                  <span
                    className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold"
                    style={{
                      color: meta.color,
                      background: `radial-gradient(circle at 50% 35%, ${meta.color}33, ${meta.color}0a 70%)`,
                      boxShadow: `inset 0 0 0 1px ${meta.color}55`,
                    }}
                  >
                    {meta.glyph}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-parchment">{of.name}</div>
                  <div className="text-[10.5px] text-ash">{of.desc}</div>
                </div>
                <button
                  onClick={() => actions.onTrade(of.id)}
                  disabled={!afford}
                  className={`${afford ? 'btn-primary' : 'btn'} px-3 py-1.5 text-[11.5px] shrink-0 font-mono`}
                >
                  {of.cost}
                  <Coins className="w-3 h-3 opacity-70" />
                </button>
              </div>
            );
          })}
        </div>
      </SidebarShell>
    );
  }

  // 5. Tab Sidebar: Bag (+ open chest side by side) / Protagonist Notebook / Codex
  if (world.bagOpen) {
    const tab = world.notebookTab;
    const chests = getAllChestGrids(world).length;
    const currTier = BACKPACK_TIERS[world.backpackLevel];
    const nextTier = world.backpackLevel < 4 ? BACKPACK_TIERS[(world.backpackLevel + 1) as 2 | 3 | 4] : null;
    const canUpgradeBag = nextTier?.cost ? canAffordCost(world, nextTier.cost) : false;
    const p = world.player;
    const thoughts = getNotebookThoughts(world);

    const bagCols = currTier.cols;
    const chestGrid = openChest?.chestGrid ?? null;
    const chestCols = chestGrid ? (chestGrid.capacity <= 16 ? 4 : 8) : 0;
    const bagW = Math.max(gridWidth(bagCols), 360);
    const shellW = tab === 'bag' && chestGrid ? bagW + gridWidth(chestCols) + 34 + 28 : Math.max(bagW + 34, 440);
    const sel = selIdx !== null && world.backpack.slots[selIdx] ? selIdx : null;

    // Which backpack items already sit on the hotbar (shown as a tiny blue number)
    const boundKeys: Partial<Record<ResourceKey, number>> = {};
    getHotbarBindings(world).forEach((b, i) => {
      if (b?.kind === 'item' && boundKeys[b.key] === undefined) boundKeys[b.key] = i;
    });

    const tabs = [
      ['bag', '行囊', <Backpack key="b" className="w-3.5 h-3.5" />],
      ['notes', '笔记', <BookOpen key="n" className="w-3.5 h-3.5" />],
      ['codex', '图鉴', <ScrollText key="c" className="w-3.5 h-3.5" />],
    ] as const;
    const tabTitle = tab === 'bag' ? (chestGrid ? '行囊与货箱' : '行囊与装备') : tab === 'notes' ? '主角笔记' : '旅途图鉴';

    const equip: Array<{ label: string; name: string; dur?: number }> = [
      { label: '工具', name: TOOL_META[p.toolLevel].name, dur: p.toolDurability },
      { label: '近战', name: MELEE_META[p.meleeWeapon].name, dur: p.weaponDurability },
      { label: '远程', name: p.rangedWeapon === 'none' ? '—' : RANGED_META[p.rangedWeapon].name },
      { label: '身体', name: BODY_ARMOR_META[p.bodyArmor].name, dur: p.armorDurability },
      { label: '头部', name: HEAD_ARMOR_META[p.headArmor].name },
    ];

    return (
      <SidebarShell
        width={shellW}
        maxVw={tab === 'bag' && chestGrid ? 78 : 50}
        icon={tab === 'bag' ? <Backpack className="w-4 h-4" /> : tab === 'notes' ? <BookOpen className="w-4 h-4" /> : <ScrollText className="w-4 h-4" />}
        eyebrow="随身 · Kit"
        title={tabTitle}
        onClose={actions.onCloseSidebars}
        belowHeader={
          <div className="flex items-center gap-1 px-3 border-b border-white/5 bg-black/15">
            {tabs.map(([id, label, icon]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => actions.onSetNotebookTab(id)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold cursor-pointer transition-colors ${
                    active ? 'text-brass-hi' : 'text-ash hover:text-parchment'
                  }`}
                >
                  {icon}
                  {label}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-brass-hi shadow-[0_0_8px_rgb(237_196_124/0.7)]" />
                  )}
                </button>
              );
            })}
            <span className="ml-auto kbd !text-ash">Tab</span>
          </div>
        }
        footer={
          tab === 'bag' &&
          (sel !== null ? (
            <ItemDetail world={world} slotIdx={sel} chestOpen={!!chestGrid} actions={actions} onDone={() => setSelIdx(null)} />
          ) : (
            <div className="text-[10.5px] text-ash-dim text-center tracking-wide leading-relaxed">
              单击查看 · 右键直接使用 · 拖到下方快捷栏绑定
              {chestGrid ? ' · 在行囊与货箱之间拖动或 Shift+单击转移' : ''}
            </div>
          ))
        }
      >
        {tab === 'bag' && (
          <div className="flex flex-wrap items-start gap-7">
            {/* Left column: equipment + backpack */}
            <div style={{ width: bagW }} className="space-y-4">
              <div className="grid grid-cols-5 gap-1.5">
                {equip.map((e) => (
                  <div key={e.label} className="inset-well px-2 py-1.5 min-w-0" title={e.name}>
                    <div className="text-[9.5px] tracking-[0.14em] text-ash-dim">{e.label}</div>
                    <div className="text-[11px] text-parchment truncate mt-0.5">{e.name}</div>
                    {e.dur !== undefined && (
                      <div className="meter h-[2px] mt-1">
                        <div
                          className="meter-fill"
                          style={{ width: `${Math.max(0, Math.min(100, e.dur))}%`, backgroundColor: e.dur < 25 ? '#dc5f4f' : '#8c8376' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(p.ownedRangedWeapons.length > 1 || p.ownedBodyArmors.length > 1 || p.ownedHeadArmors.length > 1) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px]">
                  <span className="text-ash-dim">切换</span>
                  {p.ownedRangedWeapons.length > 1 && (
                    <span className="flex gap-1">
                      {p.ownedRangedWeapons.map((wid) => (
                        <Pill key={wid} active={p.rangedWeapon === wid} onClick={() => actions.onEquipRanged(wid)} title={RANGED_META[wid].desc}>
                          {RANGED_META[wid].short}
                        </Pill>
                      ))}
                    </span>
                  )}
                  {p.ownedBodyArmors.length > 1 && (
                    <span className="flex gap-1">
                      {p.ownedBodyArmors.map((aid) => (
                        <Pill key={aid} active={p.bodyArmor === aid} onClick={() => actions.onEquipBodyArmor(aid)} title={BODY_ARMOR_META[aid].desc}>
                          {BODY_ARMOR_META[aid].short}
                        </Pill>
                      ))}
                    </span>
                  )}
                  {p.ownedHeadArmors.length > 1 && (
                    <span className="flex gap-1">
                      {p.ownedHeadArmors.map((hid) => (
                        <Pill key={hid} active={p.headArmor === hid} onClick={() => actions.onEquipHeadArmor(hid)} title={HEAD_ARMOR_META[hid].desc}>
                          {HEAD_ARMOR_META[hid].short}
                        </Pill>
                      ))}
                    </span>
                  )}
                </div>
              )}

              <div>
                <SectionLabel
                  right={
                    <>
                      <button onClick={() => actions.onSortInventory('backpack')} className="btn px-2 py-1 text-[10.5px]">
                        <ArrowDownWideNarrow className="w-3 h-3" /> 整理
                      </button>
                      {chests > 0 && (
                        <button onClick={actions.onQuickStack} className="btn px-2 py-1 text-[10.5px]" title="把行囊中与车上货箱同类的物品存进去">
                          <Layers className="w-3 h-3" /> 存同类
                        </button>
                      )}
                      {nextTier && (
                        <button
                          onClick={actions.onUpgradeBackpack}
                          disabled={!canUpgradeBag}
                          title={`升级至 ${nextTier.name} (${nextTier.capacity}格)：${Object.entries(nextTier.cost ?? {})
                            .map(([k, v]) => `${ITEM_META[k as ResourceKey].short}${v}`)
                            .join(' ')}`}
                          className={`${canUpgradeBag ? 'btn-primary' : 'btn'} px-2 py-1 text-[10.5px]`}
                        >
                          <ArrowUpCircle className="w-3 h-3" /> {nextTier.capacity}格
                        </button>
                      )}
                    </>
                  }
                >
                  {currTier.name}
                  <span className="font-mono text-ash font-normal ml-2">
                    {getUsedSlots(world.backpack)}/{world.backpack.capacity}
                  </span>
                </SectionLabel>
                <SlotGrid
                  inv={world.backpack}
                  cols={bagCols}
                  source="backpack"
                  selectedIdx={sel}
                  boundKeys={boundKeys}
                  acceptFrom={['chest', 'container']}
                  onDropFrom={(d) => actions.onTransferSlot(d.src as 'chest' | 'container', d.idx)}
                  onSlotClick={(idx, e) => {
                    if (e.shiftKey && chestGrid) {
                      actions.onTransferSlot('backpack', idx);
                      setSelIdx(null);
                      return;
                    }
                    setSelIdx(sel === idx ? null : idx);
                  }}
                  onSlotDoubleClick={(idx) => {
                    if (chestGrid) actions.onTransferSlot('backpack', idx);
                    else actions.onUseBackpackSlot(idx);
                  }}
                  onSlotContext={actions.onUseBackpackSlot}
                  hint={chestGrid ? 'Shift+单击存入货箱 · 右键使用' : '单击查看 · 右键使用'}
                />
              </div>
            </div>

            {/* Right column: the open chest */}
            {chestGrid && openChest && (
              <div className="anim-panel-in" style={{ width: gridWidth(chestCols) }}>
                <div className="inset-well px-3 py-2 mb-4 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-brass-hi" />
                  <span className="text-[12px] text-parchment font-semibold">{getBuildingDisplayName(openChest)}</span>
                  <span className="font-mono text-[10.5px] text-ash ml-auto">
                    {getUsedSlots(chestGrid)}/{chestGrid.capacity}
                  </span>
                </div>
                <SectionLabel
                  tone="text-brass-hi"
                  right={
                    <>
                      <button onClick={() => actions.onSortInventory('chest')} className="btn px-2 py-1 text-[10.5px]">
                        <ArrowDownWideNarrow className="w-3 h-3" /> 整理
                      </button>
                      <button onClick={actions.onDepositAll} className="btn px-2 py-1 text-[10.5px]" title="把行囊全部存入此货箱">
                        <Archive className="w-3 h-3" /> 全存
                      </button>
                    </>
                  }
                >
                  货箱
                </SectionLabel>
                <SlotGrid
                  inv={chestGrid}
                  cols={chestCols}
                  source="chest"
                  acceptFrom={['backpack']}
                  onDropFrom={(d) => actions.onTransferSlot('backpack', d.idx)}
                  onSlotClick={(idx) => actions.onTransferSlot('chest', idx)}
                  hint="单击取回行囊"
                />
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-4">
            {(
              [
                ['眼前需要', thoughts.shortTerm, 'text-brass-hi', 'bg-brass-hi'],
                ['整备与升级', thoughts.midTerm, 'text-parchment-dim', 'bg-parchment-dim'],
                ['铁轨尽头', thoughts.longTerm, 'text-rune', 'bg-rune'],
              ] as const
            ).map(([label, text, tone, dot]) => (
              <div key={label} className="relative pl-5">
                <span className={`absolute left-0 top-[5px] w-[7px] h-[7px] rotate-45 ${dot} opacity-80`} />
                <div className={`eyebrow !tracking-[0.2em] mb-2 ${tone}`}>{label}</div>
                <p className="display !font-normal !tracking-[0.03em] text-[14px] leading-[1.9] text-parchment">
                  “{text}”
                </p>
              </div>
            ))}
            <div className="hairline" />
            <div className="flex justify-between text-[11px] font-mono text-ash">
              <span>
                站点 <span className="text-parchment-dim">{world.stationName}</span>
              </span>
              <span>
                总里程 <span className="text-parchment-dim">{Math.round(world.totalDistance)}m</span>
              </span>
            </div>
          </div>
        )}

        {tab === 'codex' && (
          <div className="space-y-2.5">
            {world.codex.length === 0 && (
              <div className="py-10 text-center text-[12px] text-ash">尚未拾获任何记录。</div>
            )}
            {world.codex.map((entry) => (
              <div key={entry.id} className="p-3.5 rounded-lg bg-black/25 border border-white/[0.06]">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="display text-[13.5px] text-brass-hi tracking-[0.08em]">{entry.title}</span>
                  <span className="text-[10px] text-ash-dim shrink-0">{entry.foundAt}</span>
                </div>
                <p className="text-[12px] text-parchment-dim leading-[1.8]">{entry.body}</p>
              </div>
            ))}
          </div>
        )}
      </SidebarShell>
    );
  }

  return null;
};
