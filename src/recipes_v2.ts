import type { ResourceKey } from './inventory';

export type BuildingType =
  | 'workbench'
  | 'chest'
  | 'campfire'
  | 'planter'
  | 'rain_collector'
  | 'bed'
  | 'lantern'
  | 'wood_wall'
  | 'door'
  | 'turret'
  | 'bumper'
  | 'crystal_pylon';

export interface BuildingDef {
  id: BuildingType;
  name: string;
  short: string;
  tier2Name?: string;
  tier2Short?: string;
  tier2Weight?: number;
  tier2MaxHp?: number;
  tier2Cost?: Partial<Record<ResourceKey, number>>;
  tier2Desc?: string;
  weight: number;
  maxHp: number;
  solid: boolean;
  cost: Partial<Record<ResourceKey, number>>;
  color: string;
  desc: string;
  locoFrontOnly?: boolean;
  requiresWorkbench?: boolean;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  workbench: {
    id: 'workbench',
    name: '木工作台',
    short: '工作台',
    tier2Name: '精工铁台',
    tier2Short: '精工台',
    tier2Weight: 1.4,
    tier2MaxHp: 140,
    tier2Cost: { scrap: 6, parts: 2, copper: 2 },
    tier2Desc: '解锁 T2 武器、护甲与修理折扣',
    weight: 0.9,
    maxHp: 90,
    solid: true,
    cost: { wood: 4, scrap: 2 },
    color: '#b88642',
    desc: '靠近按 E 打开制造。T1 制造基础工具、弹药与铁轨；可原地升级为精工铁台。',
  },
  chest: {
    id: 'chest',
    name: '木储物箱',
    short: '木箱',
    tier2Name: '铁皮储物柜',
    tier2Short: '铁皮柜',
    tier2Weight: 0.9,
    tier2MaxHp: 160,
    tier2Cost: { scrap: 6, parts: 1 },
    tier2Desc: '扩容至 32 格，耐久大幅提升',
    weight: 0.4,
    maxHp: 70,
    solid: true,
    cost: { wood: 4, scrap: 1 },
    color: '#9c6e3f',
    desc: '16 格储物。短按 E 打开，按住 E 批量存入同类。箱内材料可直接用于建造与制造。',
  },
  campfire: {
    id: 'campfire',
    name: '炭火盆',
    short: '火盆',
    tier2Name: '铁炉灶',
    tier2Short: '炉灶',
    tier2Weight: 1.0,
    tier2MaxHp: 130,
    tier2Cost: { scrap: 6, parts: 2 },
    tier2Desc: '可炖煮增益料理、烧沸净水，取暖范围扩大且加工更快',
    weight: 0.5,
    maxHp: 70,
    solid: true,
    cost: { scrap: 3, wood: 2 },
    color: '#d4662c',
    desc: '靠近按 E 烤制熟食或煮沸脏水（行驶中照常运作），提供小范围取暖。',
  },
  planter: {
    id: 'planter',
    name: '木种植箱',
    short: '种植箱',
    tier2Name: '铁种植槽',
    tier2Short: '种植槽',
    tier2Weight: 1.1,
    tier2MaxHp: 110,
    tier2Cost: { scrap: 5, copper: 2, parts: 1 },
    tier2Desc: '蓄水自动浇灌，冷天不再减速，成熟更快',
    weight: 0.6,
    maxHp: 60,
    solid: false,
    cost: { wood: 4, scrap: 1 },
    color: '#4e8a4f',
    desc: '播种后须浇水才会生长（5–6 分钟成熟，收 2 生食，60% 留种）；冷天生长减半。',
  },
  rain_collector: {
    id: 'rain_collector',
    name: '接水斗',
    short: '接水斗',
    tier2Name: '炭沙过滤桶',
    tier2Short: '过滤桶',
    tier2Weight: 0.8,
    tier2MaxHp: 100,
    tier2Cost: { scrap: 4, cloth: 3, copper: 1 },
    tier2Desc: '接雨直接过滤为净水，并可将背包脏水净化',
    weight: 0.4,
    maxHp: 55,
    solid: true,
    cost: { scrap: 3, wood: 2 },
    color: '#4784a8',
    desc: '雨天自动积蓄雨水（T1 收集为脏水，需过滤桶或火盆煮沸后安全饮用）。',
  },
  bed: {
    id: 'bed',
    name: '旧睡袋',
    short: '睡袋',
    tier2Name: '行军暖床',
    tier2Short: '暖床',
    tier2Weight: 0.8,
    tier2MaxHp: 90,
    tier2Cost: { wood: 4, cloth: 4, hide: 2 },
    tier2Desc: '休息回血更多且全程保暖，不再受寒',
    weight: 0.3,
    maxHp: 50,
    solid: false,
    cost: { cloth: 3, wood: 2 },
    color: '#4f7f82',
    desc: '按 E 休息 4 小时（每日限 1 次）。T1 睡袋回复较少，寒冷夜里易失温。',
  },
  lantern: {
    id: 'lantern',
    name: '车厢油灯',
    short: '油灯',
    tier2Name: '铭文蓝灯',
    tier2Short: '蓝灯',
    tier2Weight: 0.3,
    tier2MaxHp: 75,
    tier2Cost: { copper: 2, magicShard: 1 },
    tier2Desc: '照明范围更大，能有效驱退钻入者与夜行者',
    weight: 0.1,
    maxHp: 45,
    solid: false,
    cost: { scrap: 1, fat: 1 },
    color: '#e6c267',
    desc: '不占通道，照亮夜间车厢视野并驱离畏光生物。',
  },
  wood_wall: {
    id: 'wood_wall',
    name: '木隔墙',
    short: '木墙',
    tier2Name: '铁皮隔墙',
    tier2Short: '铁墙',
    tier2Weight: 0.6,
    tier2MaxHp: 165,
    tier2Cost: { scrap: 4 },
    tier2Desc: '高耐久内部防线',
    weight: 0.2,
    maxHp: 65,
    solid: true,
    cost: { wood: 2 },
    color: '#8a623b',
    desc: '车厢内部隔断或二道防线（外墙本身不占格，可按 E 直接强化外壳）。',
  },
  door: {
    id: 'door',
    name: '木内门',
    short: '内门',
    tier2Name: '铁闸门',
    tier2Short: '铁闸',
    tier2Weight: 0.6,
    tier2MaxHp: 150,
    tier2Cost: { scrap: 4, parts: 1 },
    tier2Desc: '厚重耐打，风雪中锁温效果更好',
    weight: 0.3,
    maxHp: 80,
    solid: true,
    cost: { wood: 2, scrap: 1 },
    color: '#9e7c4d',
    desc: '按 E 开关，配合内墙隔出避寒房间。',
  },
  turret: {
    id: 'turret',
    name: '固定弩台',
    short: '弩台',
    tier2Name: '自动机枪塔',
    tier2Short: '机枪塔',
    tier2Weight: 2.0,
    tier2MaxHp: 140,
    tier2Cost: { scrap: 8, parts: 3, copper: 2 },
    tier2Desc: '自动锁定 260px 内目标，每次开火消耗 1 霰弹',
    weight: 1.2,
    maxHp: 95,
    solid: true,
    cost: { wood: 5, scrap: 4, parts: 1 },
    color: '#b5564c',
    desc: 'T1 弩台（射程 260px，耗弩箭，射速较慢）；可原地升级为自动机枪塔（耗霰弹）。',
    requiresWorkbench: true,
  },
  bumper: {
    id: 'bumper',
    name: '木铁撞角',
    short: '撞角',
    tier2Name: '重铁撞角',
    tier2Short: '铁撞角',
    tier2Weight: 2.0,
    tier2MaxHp: 240,
    tier2Cost: { scrap: 10, parts: 3 },
    tier2Desc: '高速直接撞杀迎面中小型怪物',
    weight: 1.3,
    maxHp: 150,
    solid: false,
    cost: { wood: 6, scrap: 6, parts: 1 },
    color: '#c98438',
    desc: '装在车头正前方。T1 可撞退怪物，升级铁撞角后可高速撞杀小怪。',
    locoFrontOnly: true,
    requiresWorkbench: true,
  },
  crystal_pylon: {
    id: 'crystal_pylon',
    name: '符文稳压柱',
    short: '稳压柱',
    tier2Name: '蓝火谐振柱',
    tier2Short: '谐振柱',
    tier2Weight: 1.3,
    tier2MaxHp: 145,
    tier2Cost: { copper: 3, parts: 2, magicShard: 2 },
    tier2Desc: '行驶晶石消耗 -25%，核心容量 +8，稳定炉压',
    weight: 0.8,
    maxHp: 95,
    solid: true,
    cost: { scrap: 5, parts: 2, magicShard: 2 },
    color: '#6eb2e8',
    desc: '以黄铜与符文稳固炉膛蓝火：降低行驶晶石消耗并扩容，同时照明取暖。',
    requiresWorkbench: true,
  },
};

export const BUILD_ORDER: BuildingType[] = [
  'workbench',
  'chest',
  'campfire',
  'planter',
  'rain_collector',
  'bed',
  'lantern',
  'wood_wall',
  'door',
  'crystal_pylon',
];

/**
 * Q12: the train does not fight in the demo — no on-board defences (turrets, rams).
 * Definitions stay so they can be switched back on after playtesting; they just can't be built,
 * and older saves have them taken down on load (see save.ts).
 */
export const DEMO_DISABLED_BUILDINGS: ReadonlySet<BuildingType> = new Set<BuildingType>(['turret', 'bumper']);

export type CraftFacility = 'workbench' | 'campfire' | 'filter';

export interface CraftRecipe {
  id: string;
  name: string;
  desc: string;
  facility: CraftFacility;
  minFacilityTier?: 1 | 2;
  category: 'supply' | 'train' | 'gear' | 'ammo';
  /** Duration in seconds if processed in furnace/filter; 0 = instant at workbench */
  processTime?: number;
  cost: Partial<Record<ResourceKey, number>>;
  output: Partial<Record<ResourceKey, number>>;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  // --- Campfire / Stove recipes (processed over time!) ---
  {
    id: 'cook_roast',
    name: '烤制熟食 ×2',
    desc: '将生粮或生肉烤熟，安全果腹并带来暖意（耗时 10 秒）',
    facility: 'campfire',
    category: 'supply',
    processTime: 10,
    cost: { rawFood: 2, wood: 1 },
    output: { cookedFood: 2 },
  },
  {
    id: 'boil_water',
    name: '煮沸净水 ×2',
    desc: '将浑浊雨水烧开沉淀为干净饮水（耗时 8 秒）',
    facility: 'campfire',
    category: 'supply',
    processTime: 8,
    cost: { dirtyWater: 2, wood: 1 },
    output: { water: 2 },
  },
  {
    id: 'stew_meal',
    name: '草药炖菜 ×3',
    desc: '需 T2 铁炉灶：草药与食材慢炖，饱腹且强效御寒（耗时 14 秒）',
    facility: 'campfire',
    minFacilityTier: 2,
    category: 'supply',
    processTime: 14,
    cost: { rawFood: 2, water: 1, herbs: 1 },
    output: { cookedFood: 3 },
  },
  {
    id: 'refine_crystal',
    name: '应急粗炼晶石 ×1',
    desc: '以废铁、兽骨与油脂勉强凝出 1 枚低纯晶石（耗时 16 秒）',
    facility: 'campfire',
    category: 'train',
    processTime: 16,
    cost: { scrap: 3, bone: 2, fat: 1 },
    output: { magicShard: 1 },
  },

  // --- Filter barrel recipe ---
  {
    id: 'filter_water',
    name: '过滤净水 ×3',
    desc: '通过炭沙滤层缓慢将脏水净化为净水（耗时 12 秒）',
    facility: 'filter',
    minFacilityTier: 2,
    category: 'supply',
    processTime: 12,
    cost: { dirtyWater: 3 },
    output: { water: 3 },
  },

  // --- Workbench: Ammo & Supplies ---
  {
    id: 'craft_bolts',
    name: '制作弩箭 ×8',
    desc: '木铁弩箭，射击无声，不会引来远处怪物',
    facility: 'workbench',
    category: 'ammo',
    cost: { wood: 2, scrap: 1 },
    output: { bolts: 8 },
  },
  {
    id: 'craft_ammo',
    name: '装填霰弹 ×6',
    desc: '供霰弹枪、步枪与自动机枪塔消耗；枪声会惊动周围怪物',
    facility: 'workbench',
    category: 'ammo',
    cost: { scrap: 2, fat: 1 },
    output: { ammo: 6 },
  },
  {
    id: 'craft_bandage',
    name: '草药绷带 ×2',
    desc: '止血回血并治愈喝脏水或吸孢子引起的病症',
    facility: 'workbench',
    category: 'supply',
    cost: { cloth: 2, herbs: 1 },
    output: { bandage: 2 },
  },
  {
    id: 'craft_decoy',
    name: '诱饵肉块 ×2',
    desc: '扔在地上吸引周围怪物 10 秒',
    facility: 'workbench',
    category: 'supply',
    cost: { rawFood: 1, fat: 1 },
    output: { decoys: 2 },
  },
  {
    id: 'craft_potion',
    name: '蓝火药剂 ×1',
    desc: '烈性药剂，迅速回暖、治病并回复大量生命与体力',
    facility: 'workbench',
    minFacilityTier: 2,
    category: 'supply',
    cost: { magicShard: 1, herbs: 2, water: 1 },
    output: { arcanePotion: 1 },
  },

  // --- Workbench: Train ---
  {
    id: 'rail_segment',
    name: '铁轨段 ×1',
    desc: '沉陷带断轨时在车头前方铺设通过',
    facility: 'workbench',
    category: 'train',
    cost: { scrap: 4, parts: 1 },
    output: { rails: 1 },
  },
  {
    id: 'crude_coupler',
    name: '土制车钩 ×1',
    desc: '应急挂接新车厢，高速行驶会磨损',
    facility: 'workbench',
    category: 'train',
    cost: { scrap: 6, parts: 1 },
    output: { crudeCoupler: 1 },
  },
  {
    id: 'relic_salvage',
    name: '拆解遗迹封匣',
    desc: '拆出 1 正规车钩、3 零件、2 铁轨与 3 晶石',
    facility: 'workbench',
    category: 'train',
    cost: { ancientRelic: 1 },
    output: { coupler: 1, parts: 3, rails: 2, magicShard: 3 },
  },

  // --- Workbench: Tools & Repair (G4, G7) ---
  {
    id: 'repair_gear',
    name: '整修随身工具与装备',
    desc: '将当前工具、武器与护甲耐久完全修复',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 2, wood: 1 },
    output: {},
  },
  {
    id: 'upgrade_pickaxe',
    name: '锻造重型铁镐 (Lv.2 工具)',
    desc: '采集与破拆更强，可破开中层钢筋铁门',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 8, wood: 4, parts: 2 },
    output: {},
  },
  {
    id: 'upgrade_saw',
    name: '组装蒸汽切割锯 (Lv.3 工具)',
    desc: '需 T2 精工台：切开深层合金防爆门，获取站内封匣',
    facility: 'workbench',
    minFacilityTier: 2,
    category: 'gear',
    cost: { scrap: 10, parts: 4, copper: 3 },
    output: {},
  },

  // --- Workbench: Weapons (G4: separate weapon line) ---
  {
    id: 'craft_axe',
    name: '打造消防斧 (近战 T2)',
    desc: '高击退重型近战武器，可快速斩断青藤都市缠车藤蔓',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 6, wood: 3, hide: 1 },
    output: {},
  },
  {
    id: 'craft_crossbow',
    name: '组装手弩 (远程 T1)',
    desc: '消耗弩箭，射声极轻不会引怪，箭矢有概率回收',
    facility: 'workbench',
    category: 'gear',
    cost: { wood: 5, scrap: 3, cloth: 2 },
    output: {},
  },
  {
    id: 'craft_shotgun',
    name: '组装土制霰弹枪 (远程 T2)',
    desc: '近距 5 发高爆发，但枪声响亮会吸引周围怪物',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 8, parts: 2, wood: 2 },
    output: {},
  },
  {
    id: 'craft_rifle',
    name: '组装栓动步枪 (远程 T3)',
    desc: '需 T2 精工台：远距高伤穿甲，穿透 2 名敌人',
    facility: 'workbench',
    minFacilityTier: 2,
    category: 'gear',
    cost: { scrap: 10, parts: 3, copper: 3 },
    output: {},
  },

  // --- Workbench: Lateral Body & Head Armor (G5) ---
  {
    id: 'armor_leather',
    name: '缝制皮革外套 (均衡)',
    desc: '中护甲（减伤 18%）· 中保暖（抗寒 35%）· 无移速惩罚',
    facility: 'workbench',
    category: 'gear',
    cost: { hide: 4, cloth: 3 },
    output: {},
  },
  {
    id: 'armor_iron_vest',
    name: '铆接铁片背心 (高甲)',
    desc: '高护甲（减伤 36%、+35 血）· 低保暖 · 移速 -10%',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 10, hide: 2, carapace: 2 },
    output: {},
  },
  {
    id: 'armor_fur_coat',
    name: '缝制毛皮大衣 (极寒)',
    desc: '低护甲（减伤 10%）· 高保暖（抗寒 85%），暴风雪与夜行首选',
    facility: 'workbench',
    category: 'gear',
    cost: { hide: 6, cloth: 4, fat: 2 },
    output: {},
  },
  {
    id: 'head_fur_cap',
    name: '缝制皮帽 (头部·保暖)',
    desc: '抗寒 +25%，轻便保暖',
    facility: 'workbench',
    category: 'gear',
    cost: { hide: 2, cloth: 2 },
    output: {},
  },
  {
    id: 'head_weld_mask',
    name: '焊接面罩 (头部·防护/防孢子)',
    desc: '减伤 +10%，且完全阻挡青藤都市空气孢子致病',
    facility: 'workbench',
    category: 'gear',
    cost: { scrap: 5, copper: 2, cloth: 1 },
    output: {},
  },
];
