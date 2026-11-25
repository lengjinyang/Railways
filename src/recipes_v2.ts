import type { ResourceKey } from './inventory';

export type BuildingType =
  | 'workbench'
  | 'chest'
  | 'campfire'
  | 'lantern'
  | 'planter'
  | 'rain_collector'
  | 'bed'
  | 'wood_wall'
  | 'iron_wall'
  | 'door'
  | 'turret'
  | 'bumper';

export interface BuildingDef {
  id: BuildingType;
  name: string;
  short: string;
  weight: number;
  maxHp: number;
  solid: boolean; // blocks movement (door toggles)
  cost: Partial<Record<ResourceKey, number>>;
  color: string;
  desc: string;
  locoFrontOnly?: boolean;
  requiresWorkbench?: boolean;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  workbench: {
    id: 'workbench',
    name: '工程工作台',
    short: '工作台',
    weight: 0.9,
    maxHp: 90,
    solid: true,
    cost: { wood: 3, scrap: 3 },
    color: '#c9963b',
    desc: '解锁铁轨段、粗炼魔晶、土制车钩、炮塔与撞角',
  },
  chest: {
    id: 'chest',
    name: '储物木箱',
    short: '货箱',
    weight: 0.4,
    maxHp: 75,
    solid: true,
    cost: { wood: 3, scrap: 1 },
    color: '#a67542',
    desc: '8×5 网格储物箱（40格空间）；箱内材料可直接用于合成/建造，支持手动跨格摆放与存同类',
  },
  campfire: {
    id: 'campfire',
    name: '铁炉熔炉',
    short: '熔炉',
    weight: 0.5,
    maxHp: 75,
    solid: true,
    cost: { scrap: 3, wood: 2 },
    color: '#d9652b',
    desc: '按 E 投料粗炼魔晶或烤热麦饼（行驶途中持续产出）；兼顾照明与取暖',
  },
  lantern: {
    id: 'lantern',
    name: '车厢壁灯',
    short: '壁灯',
    weight: 0.1,
    maxHp: 45,
    solid: false,
    cost: { wood: 1, scrap: 1 },
    color: '#ffd56b',
    desc: '轻便不阻挡通行，照亮车厢夜晚视野，打造温馨移动基地',
  },
  planter: {
    id: 'planter',
    name: '种植箱',
    short: '菜地',
    weight: 0.6,
    maxHp: 60,
    solid: false,
    cost: { wood: 3, scrap: 2 },
    color: '#4e8a4f',
    desc: '按 E 播种/浇水/收获，行驶与停站均实时生长',
  },
  rain_collector: {
    id: 'rain_collector',
    name: '接水斗',
    short: '接水',
    weight: 0.4,
    maxHp: 60,
    solid: true,
    cost: { scrap: 3, wood: 1 },
    color: '#3f8cb8',
    desc: '暴雨/下雨时自动快速蓄水，按 E 收集清水',
  },
  bed: {
    id: 'bed',
    name: '简易床铺',
    short: '床',
    weight: 0.4,
    maxHp: 60,
    solid: false,
    cost: { wood: 4, scrap: 1 },
    color: '#4f8a8b',
    desc: '按 E 休息 4 小时（每日限 1 次：回血+45、满体回暖）；也是招募园丁入住的必要条件',
  },
  wood_wall: {
    id: 'wood_wall',
    name: '室内木隔墙',
    short: '木墙',
    weight: 0.2,
    maxHp: 60,
    solid: true,
    cost: { wood: 2 },
    color: '#8f653b',
    desc: '自由划分车厢内房间或搭建破口后的第二道防线',
  },
  iron_wall: {
    id: 'iron_wall',
    name: '装甲内墙',
    short: '铁墙',
    weight: 0.5,
    maxHp: 140,
    solid: true,
    cost: { scrap: 3 },
    color: '#6b7885',
    desc: '高耐久重型内部防线，抵御破壳闯入的怪物',
  },
  door: {
    id: 'door',
    name: '室内闸门',
    short: '内门',
    weight: 0.3,
    maxHp: 85,
    solid: true,
    cost: { scrap: 2, wood: 1 },
    color: '#a38252',
    desc: '按 E 开关，配合内墙隔出安全房间',
  },
  turret: {
    id: 'turret',
    name: '自动机枪塔',
    short: '炮塔',
    weight: 1.5,
    maxHp: 110,
    solid: true,
    cost: { scrap: 8, parts: 2 },
    color: '#c74c4c',
    desc: '纯自动防卫炮塔：不耗霰弹，自动锁定并持续射杀 420px 内的周边怪物！',
    requiresWorkbench: true,
  },
  bumper: {
    id: 'bumper',
    name: '车头撞角',
    short: '撞角',
    weight: 1.5,
    maxHp: 180,
    solid: false,
    cost: { scrap: 10, parts: 2 },
    color: '#d98a36',
    desc: '装在车头前方：全速直接撞碎迎面怪物！',
    locoFrontOnly: true,
    requiresWorkbench: true,
  },
};

export const BUILD_ORDER: BuildingType[] = [
  'workbench',
  'chest',
  'campfire',
  'lantern',
  'planter',
  'rain_collector',
  'bed',
  'wood_wall',
  'iron_wall',
  'door',
  'turret',
  'bumper',
];

export interface CraftRecipe {
  id: string;
  name: string;
  desc: string;
  requiresWorkbench: boolean;
  cost: Partial<Record<ResourceKey, number>>;
  output: Partial<Record<ResourceKey, number>>;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'biofuel',
    name: '粗炼魔晶 ×2',
    desc: '用木材蕴养粗制魔晶：4 木材炼成 2 份，够魔核推进一小段',
    requiresWorkbench: true,
    cost: { wood: 4 },
    output: { fuel: 2 },
  },
  {
    id: 'ammo',
    name: '土制霰弹 ×6',
    desc: '供霰弹枪与自动炮塔使用',
    requiresWorkbench: false,
    cost: { scrap: 2 },
    output: { ammo: 6 },
  },
  {
    id: 'cooked_food',
    name: '热麦饼 ×2',
    desc: '吃下回 45 饱食、+15 血并触发 90 秒【饱食精力】Buff',
    requiresWorkbench: false,
    cost: { rawFood: 2, wood: 1 },
    output: { cookedFood: 2 },
  },
  {
    id: 'rail_segment',
    name: '铁轨段 ×1',
    desc: '遇到断裂地裂时在车头前方按 E 铺设通关',
    requiresWorkbench: true,
    cost: { scrap: 4, parts: 1 },
    output: { rails: 1 },
  },
  {
    id: 'crude_coupler',
    name: '土制车钩 ×1',
    desc: '前期自制车钩：可挂接/组装新车厢，但高速颠簸会快速磨损，需随时检修否则脱钩！',
    requiresWorkbench: true,
    cost: { scrap: 6, parts: 1 },
    output: { crudeCoupler: 1 },
  },
  {
    id: 'decoy',
    name: '诱饵肉块 ×1',
    desc: '按 5 投出，吸引所有怪物 10 秒',
    requiresWorkbench: false,
    cost: { rawFood: 1 },
    output: { decoys: 1 },
  },
  {
    id: 'arcane_potion',
    name: '魔力药剂 ×1',
    desc: '消耗魔晶炼制：按 4 饮用回血+55、回满体力与体温，并获强力秘法增益',
    requiresWorkbench: false,
    cost: { fuel: 2, water: 1 },
    output: { arcanePotion: 1 },
  },
  {
    id: 'relic_salvage',
    name: '拆解远古造物（正规车钩+零件）',
    desc: '从旧城远古造物中提取 1 正规车钩 + 3 精密零件 + 2 铁轨段',
    requiresWorkbench: true,
    cost: { ancientRelic: 1 },
    output: { coupler: 1, parts: 3, rails: 2 },
  },
  {
    id: 'upgrade_pickaxe',
    name: '锻造【Lv.2 重型铁镐】',
    desc: '工具升至 2 级：大幅提升采集与近战伤害，可破开站点中层的【2级钢筋铁门】',
    requiresWorkbench: true,
    cost: { scrap: 8, wood: 4, parts: 2 },
    output: {},
  },
  {
    id: 'upgrade_saw',
    name: '组装【Lv.3 蒸汽切割锯】',
    desc: '工具升至 3 级：极高破拆与近战威力，可切开站点最深处的【3级合金防爆门】',
    requiresWorkbench: true,
    cost: { scrap: 12, parts: 5 },
    output: {},
  },
];
