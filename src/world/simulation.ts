import {
  BACKPACK_TIERS,
  ITEM_META,
  addToInventory,
  createInventory,
  tickPerishables,
  type ResourceKey,
} from '../inventory';
import { BUILDINGS, CRAFT_RECIPES } from '../recipes_v2';
import { sfx } from '../sfx';
import { loadStationSnapshot, saveStationSnapshot, saveWorld } from './save';
import {
  BED_REST_HOURS,
  CITY_ESCAPE_METERS,
  ZONE_WEATHER,
  CONTAINER_SEARCH_DURATION,
  COUPLER_GAP,
  DAY_LENGTH,
  EAT_HOLD_DURATION,
  GEAR_FUEL_MULT,
  GEAR_SPEEDS,
  HALF_H,
  HUNGER_DRAIN_PER_SEC,
  LOCO_COLS,
  LOCO_W,
  MELEE_META,
  PLANTER_GROWTH_WATERED,
  PLANTER_SEED_RETURN_CHANCE,
  QUICKSTACK_HOLD_DURATION,
  RAIL_LAY_DURATION,
  RANGED_META,
  STATION_BOUND_X,
  THIRST_DRAIN_PER_SEC,
  TILE,
  TOOL_META,
  TURRET_RANGE,
  ZONE_META,
  uid,
  type HullPanel,
  type InputState,
  type MonsterEntity,
  type PlacedBuilding,
  type WeatherKind,
  type WorldProp,
  type InteractHint,
  type WorldState,
  type ZoneTier,
} from './types';
import {
  addFloat,
  canAcceptItem,
  canAffordCost,
  createCarHull,
  createFlatbed,
  distToTrainDeck,
  eatOrDrink,
  consumeItem,
  defaultHotbarBindings,
  getActiveBinding,
  enterZone,
  findBlockingHull,
  findBuildingByUid,
  findPropByUid,
  getAllChestGrids,
  getAllHullPanels,
  getArmorStats,
  getBuildingDisplayName,
  getCarBounds,
  getCarIndexAtPoint,
  getCarriageRole,
  getCoreMaxCapacity,
  getCrystalPylonBonus,
  getHullSegment,
  getItemCount,
  getOpenContainerProp,
  getTileCenter,
  getTrainWeight,
  giveItem,
  hasChest,
  hasWorkbench,
  isCarSealed,
  isHullPassage,
  isNight,
  isOverloaded,
  isPanelOpenOrBreached,
  isPointOnTrain,
  pickUpLantern,
  trainDecks,
  playerHasActiveLantern,
  pushLootFeed,
  quickCollectPickup,
  quickStackToChests,
  recordCodex,
  reinforceHullPanel,
  restInBed,
  spawnFlyingPickup,
  spawnParticles,
  spawnPickup,
  spendCost,
  syncFortressHullBonus,
  throwDecoy,
  tryAttachCarriage,
  tryPlaceBuilding,
  upgradeBuildingInPlace,
  getBuildingAtPoint,
  autoEquipNewRangedWeapons,
} from './train';
import {
  buildNextRoutes,
  buildStationMap,
  createMonster,
  createNestGuardian,
  pickZoneEnemyKind,
  updateLostWorldExploration,
} from './station';

export interface NotebookThoughts {
  shortTerm: string;
  midTerm: string;
  longTerm: string;
}

/** Organic protagonist notebook entries derived from real survival needs (replaces rewarded quest chains, A + B + Z6). */
export function getNotebookThoughts(w: WorldState): NotebookThoughts {
  const p = w.player;
  const food = getItemCount(w, 'cookedFood') + getItemCount(w, 'rawFood');
  const water = getItemCount(w, 'water');
  const crystal = w.boilerFuel + getItemCount(w, 'magicShard');

  let shortTerm = '车上补给尚可，趁平静整理行囊、照看炉火与菜地。';
  if (p.sickTimer > 0) shortTerm = '身体发寒作呕……得找草药绷带或蓝火药剂压住病症。';
  else if (w.vineSnare > 20) shortTerm = '青藤缠住了车轮。得下车拿工具或斧头把藤蔓砍开。';
  else if (w.boilerPressure > 85) shortTerm = '炉压表指针偏红了，赶紧去车头放气。';
  else if (w.mode === 'city_escape') shortTerm = '机车正在驶出灰烬教区。等停稳后下车搜刮第一批木材、废料与晶石。';
  else if (crystal < 4) shortTerm = '炉膛里的蓝火快灭了，得在站台或废墟里找更多秘法晶石。';
  else if (water < 3 || p.thirst < 35) shortTerm = '水不多了。得找水塔、接雨水煮沸，或者装个过滤桶。';
  else if (food < 2 || p.hunger < 35) shortTerm = '肚子开始发紧。得把生食烤熟，或在车厢里建个种植箱。';

  let midTerm = '继续收集铜线、零件与兽皮，把车厢里的设施升到二阶。';
  if (!hasWorkbench(w)) midTerm = '空车厢里什么都没有。先按 B 建一张木工作台与储物木箱。';
  else if (!hasChest(w)) midTerm = '行囊格子紧张，得在车上摆个木储物箱，按住 E 就能批量存同类。';
  else if (p.toolLevel < 2) midTerm = '站里有些钢筋铁门撬棍砸不开，得在工作台锻一把重型铁镐。';
  else if (p.rangedWeapon === 'none') midTerm = '只靠近战太吃亏，攒些材料做一把安静的手弩，或一把霰弹枪。';
  else if (w.locoLevel < 2 && w.flatbeds.length >= 2) midTerm = '车厢变重了，遇到水塔镇的龙门吊得把车头升级。';

  let longTerm = '沿着铁轨一直往前走，查清为什么这个世界没有留下任何历史。';
  if (w.chainElderMet && !w.chainPredecessorFound) {
    longTerm = '守塔老者提起过另一列与我一模一样的黑铁火车，它开进了沉陷带……我得去看看。';
  } else if (w.chainPredecessorFound) {
    longTerm = '前代日志说主教选中的从来不止我一人。继续向铁道尽头驶去，看看终点究竟是什么。';
  } else if (w.mode === 'station' && !w.selectedRoute) {
    longTerm = '搜空这站后，按 M 打开航线图选定下一站，准备足够食物、净水与晶石再拉杆出发。';
  }

  return { shortTerm, midTerm, longTerm };
}

export function createInitialWorld(): WorldState {
  const car0 = createFlatbed(0, 'standard', 2.5);
  const backpack = createInventory(BACKPACK_TIERS[1].capacity);
  // Lean start (scavenge the rest): no ranged weapon, no ammo, no spare rails.
  addToInventory(backpack, 'wood', 3);
  addToInventory(backpack, 'scrap', 3);
  addToInventory(backpack, 'water', 2);
  addToInventory(backpack, 'cookedFood', 1);

  return {
    mode: 'city_escape',
    stationIdx: 0,
    stationTemplate: 'abandoned_halt',
    stationName: '灰烬教区 · 郊外铁道',
    legDistance: 0,
    legTotal: CITY_ESCAPE_METERS,
    totalDistance: 0,
    worldScrollX: 0,
    stationAnchorX: 0,
    time: 0,
    hitStop: 0,

    zoneKind: 'fallen_city',
    zoneTier: 1,
    prevZoneKind: null,
    biomeSeamX: -99999,
    cityExitX: 4600,
    stationStreamed: false,
    disembarkedAtStation: false,
    stationWorldTitle: '灰烬教区',
    stationEpigraph: '主教接到无声的神谕，选中一名拾荒者。炉膛里的蓝火已经点亮。',
    exploredFog: new Set(),
    discoveredLandmarks: 0,
    zoneBanner: {
      title: '灰烬教区',
      subtitle: '炉膛蓝火已燃，列车正驶离沉默的钟楼。',
      color: ZONE_META.fallen_city.color,
      timer: 4.5,
    },
    availableRoutes: [],
    selectedRoute: null,
    routeOpen: false,

    wavePhase: 'calm',
    waveIndex: 0,
    omenTimer: 0,
    omenLabel: '',
    dangerSpawnedInWave: false,
    roadsideEventSpawned: 0,
    parallelTrainX: null,
    boilerPressure: 22,
    vineSnare: 0,
    chainElderMet: false,
    chainPredecessorFound: false,

    lastSavedAt: 0,
    victory: false,
    endlessMode: false,

    stationRoads: [],
    stationRooms: [],
    stationWalls: [],
    stationBarriers: [],

    lastSleepDay: 0,
    stomachGrowlCd: 0,
    heartbeatCd: 0,
    lastVitalChangeAt: 0,

    lanternHolder: 'player',
    lanternPos: null,
    locoDeck: { id: -1, baseWeight: 0, couplerKind: 'standard', couplerHp: 100, couplerWarnCd: 0, hull: [], buildings: [] },
    darkThreatLevel: 0,
    darkThreatTimer: 6,
    wastelandStopTimer: 0,
    wastelandSiegeCd: 5,

    dayTime: 0.08,
    dayCount: 1,
    weather: 'clear',
    weatherTimer: 260,
    lightningFlash: 0,

    cameraX: -40,
    cameraY: 0,
    shake: 0,

    locoLevel: 1,
    locoHp: 160,
    locoMaxHp: 160,
    locoHull: createCarHull(LOCO_COLS, 1),
    hasBumper: false,
    bumperTier: 1,
    boilerFuel: 8,
    boilerMax: 20,
    totalFuelAdded: 0,
    gear: 1,
    trainSpeed: GEAR_SPEEDS[1],
    chugTimer: 0,
    flatbeds: [car0],

    player: {
      x: -136,
      y: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      hunger: 88,
      thirst: 88,
      bodyTemp: 100,
      sickTimer: 0,
      sporeExposure: 0,
      wellFedTimer: 0,
      swingTimer: 0,
      swingAngle: 0,
      attackCd: 0,
      hitFlash: 0,
      invulnTimer: 0,
      flashlightOn: true,
      toolLevel: 1,
      toolDurability: 100,
      meleeWeapon: 'club',
      rangedWeapon: 'none',
      weaponDurability: 100,
      bodyArmor: 'rags',
      headArmor: 'bandana',
      armorDurability: 100,
      ownedBodyArmors: ['rags'],
      ownedHeadArmors: ['bandana'],
      ownedRangedWeapons: [],
      alive: true,
    },

    hotbar: 0,
    hotbarBindings: defaultHotbarBindings(),
    buildMode: false,
    selectedBuild: 'workbench',
    backpackLevel: 1,
    backpack,

    props: [],
    trackHazards: [],
    monsters: [],
    pickups: [],
    flyingPickups: [],
    lootFeed: [],
    projectiles: [],
    particles: [],
    floats: [],
    decoyPos: null,
    nestEruptions: [],

    holdAction: null,
    codex: [
      {
        id: 'intro_oracle',
        title: '无声的神谕',
        body: '主教把这列烧着蓝火的旧机车交给我时，没有提过往，也没有说终点在哪。这里没人能说出十年前发生过什么。',
        foundAt: '灰烬教区',
      },
    ],
    activeCard: null,
    exploredChunks: new Set(),
    hazardSpawnTimer: 120,
    nightWavesLeft: 0,
    nightWaveTimer: 0,
    activeHint: null,

    bagOpen: false,
    notebookTab: 'bag',
    openChestUid: null,
    openContainerUid: null,
    openFacilityUid: null,
    tradeOpen: false,
    throttleOpen: false,

    deathReport: null,
    gameOver: false,
    stats: {
      monstersKilled: 0,
      nestsCleared: 0,
      propsHarvested: 0,
      buildingsPlaced: 0,
      railsLaid: 0,
      stationsReached: 0,
      deaths: 0,
    },
  };
}

/** Sound perception (H1): gunshots & smashing containers alert nearby monsters. */
export function alertMonstersByNoise(w: WorldState, x: number, y: number, radius: number): void {
  const nightMult = isNight(w) ? 1.35 : 1.0;
  const effRadius = radius * nightMult;
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - x, m.y - y) <= effRadius) {
      m.aiState = 'chase';
      m.alertedByNoise = 14;
    }
  }
}

export function continueEndless(w: WorldState): void {
  w.victory = false;
  w.endlessMode = true;
  w.availableRoutes = buildNextRoutes(w.stationIdx, true);
  w.selectedRoute = null;
  saveStationSnapshot(w);
  sfx.whistle();
}

/** Rollback cleanly to the most recent station arrival checkpoint on death (#5: no random carriage loss!). */
export function rollbackToStationSave(currentWorld: WorldState): WorldState {
  const deaths = currentWorld.stats.deaths;
  const snap = loadStationSnapshot();
  if (snap) {
    snap.stats.deaths = deaths;
    snap.deathReport = null;
    snap.gameOver = false;
    snap.player.alive = true;
    snap.player.hp = snap.player.maxHp;
    snap.player.invulnTimer = 2.0;
    return snap;
  }
  const fresh = createInitialWorld();
  fresh.stats.deaths = deaths;
  return fresh;
}

// --- Primary Left-Click Action ---
export function handlePrimaryAction(w: WorldState, wx: number, wy: number): void {
  if (w.gameOver || w.victory || !w.player.alive || w.deathReport) return;

  if (w.buildMode) {
    // Clicking a facility that's already there upgrades it (T1 → T2) instead of placing.
    const existing = getBuildingAtPoint(w, wx, wy);
    if (existing) {
      const err = upgradeBuildingInPlace(w, existing);
      if (err) {
        addFloat(w, wx, wy - 16, err, '#e07a7a');
        sfx.gridDeny();
      }
      return;
    }
    const err = tryPlaceBuilding(w, wx, wy);
    if (err) addFloat(w, wx, wy - 16, err, '#e07a7a');
    return;
  }

  // Click nearby ground pickup -> instant collect
  for (const pk of w.pickups) {
    if (pk.amount <= 0) continue;
    if (Math.hypot(pk.x - wx, pk.y - wy) <= 32 && Math.hypot(pk.x - w.player.x, pk.y - w.player.y) <= 180) {
      quickCollectPickup(w, pk.uid);
      return;
    }
  }

  const binding = getActiveBinding(w);

  // Item slots: consumables need a 1.0s hold (handled in stepWorld via holdAction), decoys throw, rails lay.
  if (binding?.kind === 'item') {
    const key = binding.key;
    if (key === 'decoys') {
      throwDecoy(w, wx, wy);
      return;
    }
    if (key === 'rails') {
      startRailLayHold(w);
      return;
    }
    if (getItemCount(w, key) <= 0) {
      sfx.gridDeny();
      addFloat(w, w.player.x, w.player.y - 22, `没有${ITEM_META[key].short}`, '#e07a7a');
      return;
    }
    if (!w.holdAction) {
      const verb = key === 'water' || key === 'dirtyWater' ? '饮用' : key === 'bandage' || key === 'arcanePotion' ? '使用' : '食用';
      w.holdAction = {
        kind: 'eat',
        itemKey: key,
        x: w.player.x,
        y: w.player.y - 34,
        label: `${verb} ${ITEM_META[key].short}`,
        progress: 0,
        duration: EAT_HOLD_DURATION,
      };
    }
    return;
  }

  if (w.player.attackCd > 0) return;

  // Ranged weapon slot (Crossbow = quiet / Shotgun & Rifle = loud noise perception!)
  if (binding?.kind === 'ranged') {
    if (w.player.ownedRangedWeapons.includes(binding.weapon)) w.player.rangedWeapon = binding.weapon;
    const wId = w.player.ownedRangedWeapons.includes(binding.weapon) ? binding.weapon : 'none';
    if (wId === 'none') {
      sfx.gridDeny();
      return;
    }
    const meta = RANGED_META[wId];
    if (!meta.ammoKey || getItemCount(w, meta.ammoKey) <= 0) {
      sfx.gridDeny();
      w.player.attackCd = 0.4;
      const ammoName = meta.ammoKey ? ITEM_META[meta.ammoKey].short : '弹药';
      addFloat(w, w.player.x, w.player.y - 22, `没有${ammoName} · 工作台制作或搜刮`, '#e07a7a', 1.8);
      return;
    }
    spendCost(w, { [meta.ammoKey]: 1 });
    w.player.attackCd = meta.cd;
    w.player.weaponDurability = Math.max(0, w.player.weaponDurability - 0.6);
    const dmgScale = w.player.weaponDurability <= 0 ? 0.6 : 1.0;
    const baseAng = Math.atan2(wy - w.player.y, wx - w.player.x);
    const muzX = w.player.x + Math.cos(baseAng) * 18;
    const muzY = w.player.y + Math.sin(baseAng) * 18;

    alertMonstersByNoise(w, w.player.x, w.player.y, meta.noiseRadius);

    if (wId === 'crossbow') {
      w.projectiles.push({
        x: muzX,
        y: muzY,
        vx: Math.cos(baseAng) * 680,
        vy: Math.sin(baseAng) * 680,
        dmg: Math.round(meta.dmg * dmgScale),
        ttl: 0.65,
        fromTurret: false,
        kind: 'bolt',
      });
      sfx.crossbow();
      spawnParticles(w, muzX, muzY, '#c49b6c', 4, 110, baseAng);
    } else if (wId === 'shotgun') {
      for (let p = -2; p <= 2; p++) {
        const a = baseAng + p * 0.08 + (Math.random() - 0.5) * 0.04;
        w.projectiles.push({
          x: muzX,
          y: muzY,
          vx: Math.cos(a) * 560,
          vy: Math.sin(a) * 560,
          dmg: Math.round(meta.dmg * dmgScale),
          ttl: 0.42,
          fromTurret: false,
          kind: 'pellet',
        });
      }
      w.shake = Math.max(w.shake, 6.5);
      sfx.shotgun();
      spawnParticles(w, muzX, muzY, '#e6a04c', 8, 180, baseAng);
    } else {
      w.projectiles.push({
        x: muzX,
        y: muzY,
        vx: Math.cos(baseAng) * 860,
        vy: Math.sin(baseAng) * 860,
        dmg: Math.round(meta.dmg * dmgScale),
        ttl: 0.72,
        fromTurret: false,
        kind: 'rifle',
        pierceLeft: 2,
        hitUids: [],
      });
      w.shake = Math.max(w.shake, 5.5);
      sfx.rifle();
      spawnParticles(w, muzX, muzY, '#ffd43b', 9, 210, baseAng);
    }
    return;
  }

  // Slot 0 (key 1): Tool / Melee swing (harvest resource nodes directly into bag + combat + chop vines + repair)
  // Every swing costs stamina (the axe most). Out of breath = no swing until it refills a bit.
  const melee = MELEE_META[w.player.meleeWeapon];
  const toolMeta = TOOL_META[w.player.toolLevel];
  const swingCost = melee.stamina;
  if (w.player.stamina < swingCost) {
    w.player.attackCd = 0.3;
    sfx.gridDeny();
    addFloat(w, w.player.x, w.player.y - 30, '体力不足', '#e0c078');
    return;
  }
  spendStamina(w, swingCost);
  w.player.attackCd = melee.cd;
  w.player.swingTimer = 0.2;
  const ang = Math.atan2(wy - w.player.y, wx - w.player.x);
  w.player.swingAngle = ang;
  sfx.swing();

  const wellFedMult = w.player.wellFedTimer > 0 ? 1.25 : 1.0;
  const durMult = w.player.toolDurability <= 0 ? 0.65 : 1.0;
  const hitX = w.player.x + Math.cos(ang) * 34;
  const hitY = w.player.y + Math.sin(ang) * 34;
  let hitAnything = false;
  let hitMonster = false;

  // 0) Chop creeping vines in Ivy City!
  if (w.vineSnare > 0 && isPointOnTrain(w, hitX, hitY, 30)) {
    const chop = w.player.meleeWeapon === 'axe' ? 40 : 18;
    w.vineSnare = Math.max(0, w.vineSnare - chop);
    sfx.hitWood();
    spawnParticles(w, hitX, hitY, '#6fb87e', 8, 120);
    if (w.vineSnare <= 0) {
      giveItem(w, 'cloth', 2, true, { x: hitX, y: hitY });
    }
    return;
  }

  // 1) Hit monsters
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - hitX, m.y - hitY) <= m.r + 28) {
      const baseDmg = Math.max(toolMeta.dmg, melee.dmg);
      const dmg = Math.round(baseDmg * wellFedMult * durMult);
      damageMonster(w, m, dmg, Math.cos(ang) * melee.knockback, Math.sin(ang) * melee.knockback);
      w.player.weaponDurability = Math.max(0, w.player.weaponDurability - 0.5);
      w.hitStop = Math.max(w.hitStop, m.hp <= 0 ? 0.055 : 0.026);
      hitAnything = true;
      hitMonster = true;
    }
  }
  // Gathering, repairs and swings that miss cost half: the full price is for fighting.
  if (!hitMonster) w.player.stamina = Math.min(w.player.maxStamina, w.player.stamina + swingCost * 0.5);

  // 1.5) Tool-gated barriers
  for (const bar of w.stationBarriers) {
    if (bar.opened) continue;
    const qx = Math.max(bar.x, Math.min(hitX, bar.x + bar.w));
    const qy = Math.max(bar.y, Math.min(hitY, bar.y + bar.h));
    if (Math.hypot(hitX - qx, hitY - qy) <= 26) {
      hitAnything = true;
      bar.hitFlash = 0.16;
      const cx = bar.x + bar.w / 2;
      const cy = bar.y + bar.h / 2;
      if (w.player.toolLevel < bar.reqTool) {
        sfx.gridDeny();
        addFloat(w, cx, cy - 18, `需${TOOL_META[bar.reqTool].name}`, '#e07a7a');
      } else {
        const dmg = Math.round(toolMeta.harvestDmg * wellFedMult * durMult);
        bar.hp = Math.max(0, bar.hp - dmg);
        w.player.toolDurability = Math.max(0, w.player.toolDurability - 0.8);
        alertMonstersByNoise(w, cx, cy, 340);
        w.hitStop = Math.max(w.hitStop, bar.hp <= 0 ? 0.06 : 0.028);
        w.shake = Math.max(w.shake, bar.hp <= 0 ? 8 : 3.5);
        if (bar.hp <= 0) {
          bar.opened = true;
          sfx.breakMetal();
          spawnParticles(w, cx, cy, '#d9b15f', 18, 175);
        } else {
          sfx.hitMetal();
          spawnParticles(w, cx, cy, '#ffe08a', 7, 110, ang);
          addFloat(w, cx, cy - 16, `-${dmg}`, '#e0c078');
        }
      }
      break;
    }
  }

  // 2) Harvest resource nodes (materials fly DIRECTLY into backpack, U1!) or loudly smash containers
  for (const prop of w.props) {
    if (prop.interactOnly || prop.hp <= 0 || prop.used) continue;
    if (Math.hypot(prop.x - hitX, prop.y - hitY) <= prop.r + 30) {
      const dmg = Math.round(toolMeta.harvestDmg * wellFedMult * durMult);
      prop.hp -= dmg;
      prop.hitFlash = 0.14;
      prop.hitBounce = 0.16;
      prop.hitOffX = Math.cos(ang) * 7;
      prop.hitOffY = Math.sin(ang) * 7;
      w.player.toolDurability = Math.max(0, w.player.toolDurability - 0.6);
      hitAnything = true;

      // Hitting is fast & noisy -> alerts nearby monsters (U1 tradeoff vs quiet hold-E search!)
      alertMonstersByNoise(w, prop.x, prop.y, prop.isContainer ? 320 : 220);

      const mat = prop.mat ?? 'metal';
      const broke = prop.hp <= 0;
      if (prop.kind === 'monster_nest' && !broke) onNestWounded(w, prop);
      w.hitStop = Math.max(w.hitStop, broke ? 0.05 : 0.028);
      w.shake = Math.max(w.shake, broke ? 6.5 : 3.4);

      if (mat === 'wood' || mat === 'organic') {
        if (broke) sfx.breakWood();
        else sfx.hitWood();
        spawnParticles(w, prop.x, prop.y, mat === 'organic' ? '#9c5c52' : '#b88454', broke ? 16 : 7, broke ? 165 : 115, ang);
      } else if (mat === 'crystal') {
        if (broke) sfx.crystalCharge();
        else sfx.hitMetal();
        spawnParticles(w, prop.x, prop.y, '#7cc4ff', broke ? 20 : 9, broke ? 180 : 125, ang);
      } else {
        if (broke) sfx.breakMetal();
        else sfx.hitMetal();
        spawnParticles(w, prop.x, prop.y, '#e0c078', broke ? 16 : 8, broke ? 175 : 125, ang);
      }

      addFloat(w, prop.x, prop.y - 16, `-${dmg}`, '#e0c078');

      if (broke) {
        w.stats.propsHarvested++;
        if (prop.kind === 'monster_nest') {
          w.stats.nestsCleared++;
          addFloat(w, prop.x, prop.y - 26, '巢穴崩塌……深处有东西在动', '#f0a69b');
          w.nestEruptions.push({ x: prop.x, y: prop.y, timer: NEST_ERUPTION_DELAY, maxTimer: NEST_ERUPTION_DELAY });
          sfx.omenHowl();
        }
        if (w.openContainerUid === prop.uid) w.openContainerUid = null;

        // Collect contents directly into backpack with flying visual feedback (drops only if full!)
        if (prop.isContainer && prop.containerInv) {
          for (const slot of prop.containerInv.slots) {
            if (slot && slot.count > 0) {
              giveItem(w, slot.key, slot.count, true, { x: prop.x, y: prop.y });
            }
          }
          sfx.pickup();
        } else if (prop.drops) {
          for (const [k, amt] of Object.entries(prop.drops)) {
            if ((amt ?? 0) > 0) {
              giveItem(w, k as ResourceKey, amt!, true, { x: prop.x, y: prop.y });
            }
          }
          sfx.pickup();
        }
      }
    }
  }

  // 3) Repair train / extinguish fire
  if (!hitAnything) {
    if (w.locoHp < w.locoMaxHp && w.player.x >= -10 && w.player.x <= LOCO_W && Math.abs(w.player.y) <= HALF_H) {
      if (getItemCount(w, 'scrap') >= 1) {
        spendCost(w, { scrap: 1 });
        w.locoHp = Math.min(w.locoMaxHp, w.locoHp + 25);
        sfx.hitMetal();
        spawnParticles(w, hitX, hitY, '#74c0fc', 6, 90);
        addFloat(w, hitX, hitY - 12, '+25', '#74c0fc');
        return;
      }
    }
    for (const car of trainDecks(w)) {
      for (const b of car.buildings) {
        const c = getTileCenter(b.carIdx, b.col, b.row);
        if (Math.hypot(c.x - hitX, c.y - hitY) <= 36) {
          if (b.onFire) {
            b.onFire = false;
            sfx.hitMetal();
            spawnParticles(w, c.x, c.y, '#74c0fc', 10, 110);
            return;
          }
          if (b.hp < b.maxHp && getItemCount(w, 'scrap') >= 1) {
            spendCost(w, { scrap: 1 });
            b.hp = Math.min(b.maxHp, b.hp + 30);
            sfx.hitMetal();
            spawnParticles(w, c.x, c.y, '#74c0fc', 6, 90);
            addFloat(w, c.x, c.y - 14, '+30', '#74c0fc');
            return;
          }
        }
      }
    }
    for (const { carIdx, panel } of getAllHullPanels(w)) {
      if (panel.hp >= panel.maxHp || isHullPassage(w, carIdx, panel)) continue;
      const seg = getHullSegment(carIdx, panel);
      if (Math.hypot(seg.cx - hitX, seg.cy - hitY) < 34 && getItemCount(w, 'scrap') >= 1) {
        spendCost(w, { scrap: 1 });
        panel.hp = Math.min(panel.maxHp, panel.hp + 40);
        sfx.build();
        spawnParticles(w, seg.cx, seg.cy, '#74c0fc', 7, 95);
        addFloat(w, seg.cx, seg.cy - 16, '+40', '#74c0fc');
        return;
      }
    }
  }
}

/** Stamina pause after effort: refilling waits a moment, and much longer if you ran yourself empty. */
const STAMINA_DELAY = 0.9;
const STAMINA_EMPTY_DELAY = 1.8;

function spendStamina(w: WorldState, amount: number): void {
  const p = w.player;
  p.stamina = Math.max(0, p.stamina - amount);
  p.staminaDelay = Math.max(p.staminaDelay ?? 0, p.stamina <= 0.5 ? STAMINA_EMPTY_DELAY : STAMINA_DELAY);
}

function damageMonster(w: WorldState, m: MonsterEntity, dmg: number, kbX: number, kbY: number): void {
  m.hp -= dmg;
  m.hitFlash = 0.14;
  m.vx += kbX;
  m.vy += kbY;
  if (m.aiState === 'wander' || m.aiState === 'alert') m.aiState = 'chase';
  w.shake = Math.max(w.shake, 3.0);
  sfx.hitFlesh();
  spawnParticles(w, m.x, m.y, '#cc554c', 7, 130);
  addFloat(w, m.x, m.y - 16, `-${dmg}`, '#f2a69c');

  // Low HP morale check: hounds may flee when leader/pack hurt (guardians never do)
  if (m.hp > 0 && !m.elite && m.hp < m.maxHp * 0.25 && m.kind === 'hound' && Math.random() < 0.35) {
    m.aiState = 'flee';
    m.stateTimer = 4.0;
  }

  if (m.hp <= 0) {
    w.stats.monstersKilled++;
    spawnParticles(w, m.x, m.y, '#cc554c', 16, 165);
    // H2 useful drops
    if (m.kind === 'hound') {
      spawnPickup(w, 'hide', 1, m.x, m.y, m.onTrain);
      if (Math.random() < 0.7) spawnPickup(w, 'rawFood', 1, m.x + 8, m.y, m.onTrain);
    } else if (m.kind === 'stalker') {
      spawnPickup(w, 'bone', 1, m.x, m.y, m.onTrain);
      if (Math.random() < 0.6) spawnPickup(w, 'hide', 1, m.x + 8, m.y, m.onTrain);
    } else if (m.kind === 'clinger') {
      spawnPickup(w, 'carapace', 1, m.x, m.y, m.onTrain);
    } else if (m.kind === 'burrower') {
      spawnPickup(w, 'fat', 2, m.x, m.y, m.onTrain);
    } else if (m.kind === 'sandworm') {
      spawnPickup(w, 'carapace', 2, m.x, m.y, m.onTrain);
      spawnPickup(w, 'fat', 2, m.x + 10, m.y, m.onTrain);
    } else if (m.kind === 'charger') {
      spawnPickup(w, 'hide', 3, m.x, m.y, m.onTrain);
      spawnPickup(w, 'bone', 2, m.x + 10, m.y, m.onTrain);
    } else if (m.kind === 'mutant_raider') {
      spawnPickup(w, 'ammo', 3, m.x, m.y, m.onTrain);
      spawnPickup(w, 'parts', 1, m.x + 8, m.y, m.onTrain);
      if (Math.random() < 0.5) spawnPickup(w, 'scrap', 3, m.x - 8, m.y, m.onTrain);
    }
    // nightwalker drops nothing (H2)
    if (m.elite) {
      w.stats.elitesKilled = (w.stats.elitesKilled ?? 0) + 1;
      addFloat(w, m.x, m.y - 30, '巢穴守卫倒下', '#f3d58f');
      spawnPickup(w, 'scrap', 3 + Math.floor(Math.random() * 3), m.x - 10, m.y + 6, m.onTrain);
      spawnPickup(w, m.kind === 'clinger' || m.kind === 'sandworm' ? 'carapace' : 'hide', 2, m.x + 10, m.y - 6, m.onTrain);
      spawnPickup(w, 'bone', 2, m.x, m.y + 12, m.onTrain);
      if (Math.random() < 0.6) spawnPickup(w, 'parts', 1, m.x + 12, m.y + 10, m.onTrain);
      if (Math.random() < 0.35) spawnPickup(w, 'magicShard', 1, m.x - 12, m.y - 10, m.onTrain);
      if (Math.random() < 0.5) spawnPickup(w, 'ammo', 2, m.x, m.y - 14, m.onTrain);
    }
  }
}

/** Hitting a nest: its guardian bursts out the first time it drops below 60%, and it spits defenders. */
function onNestWounded(w: WorldState, nest: WorldProp): void {
  if (!nest.guardianWoken && nest.hp < nest.maxHp * 0.6) {
    nest.guardianWoken = true;
    const g = createNestGuardian(w, nest.x, nest.y, nest.uid);
    g.aiState = 'chase';
    w.monsters.push(g);
    addFloat(w, nest.x, nest.y - 34, '巢穴守卫被惊醒！', '#f0a69b');
    spawnParticles(w, nest.x, nest.y, '#7a4a3a', 18, 150);
    sfx.omenHowl();
  }
  const brood = w.monsters.filter((m) => m.nestUid === nest.uid && m.hp > 0).length;
  if (brood < 6 && Math.random() < 0.28) {
    const a = Math.random() * Math.PI * 2;
    const m = createMonster(pickZoneEnemyKind(w.zoneKind, w.zoneTier), nest.x + Math.cos(a) * (nest.r + 14), nest.y + Math.sin(a) * (nest.r + 14), false, w.zoneTier, nest.uid);
    m.aiState = 'chase';
    w.monsters.push(m);
    spawnParticles(w, m.x, m.y, '#7a4a3a', 8, 100);
  }
}

const NEST_ERUPTION_DELAY = 2.6;

/**
 * A destroyed nest doesn't go quietly: after a short rumble (time to back off), everything still
 * down there bursts out at once — an elite plus a pack from the next tier down, bigger further along.
 */
function updateNestEruptions(w: WorldState, dt: number): void {
  for (let i = w.nestEruptions.length - 1; i >= 0; i--) {
    const er = w.nestEruptions[i];
    er.timer -= dt;
    if (Math.random() < dt * 9) spawnParticles(w, er.x + (Math.random() - 0.5) * 50, er.y + (Math.random() - 0.5) * 36, '#6b4634', 2, 60);
    w.shake = Math.max(w.shake, 1.6 * (1 - er.timer / er.maxTimer));
    if (er.timer > 0) continue;
    w.nestEruptions.splice(i, 1);

    const tier = Math.min(5, w.zoneTier + 1) as ZoneTier;
    const count = Math.min(6, 3 + w.stationIdx);
    const guardian = createNestGuardian(w, er.x, er.y, 'ruin');
    guardian.aiState = 'chase';
    w.monsters.push(guardian);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.5;
      const rr = 26 + Math.random() * 22;
      const kind = w.stationIdx === 0 ? 'hound' : pickZoneEnemyKind(w.zoneKind, tier);
      const m = createMonster(kind, er.x + Math.cos(a) * rr, er.y + Math.sin(a) * rr, false, tier);
      m.aiState = 'chase';
      m.vx = Math.cos(a) * 160;
      m.vy = Math.sin(a) * 160;
      w.monsters.push(m);
    }
    w.shake = Math.max(w.shake, 9);
    w.hitStop = Math.max(w.hitStop, 0.06);
    spawnParticles(w, er.x, er.y, '#7a4a3a', 34, 220);
    spawnParticles(w, er.x, er.y, '#cc554c', 14, 160);
    addFloat(w, er.x, er.y - 34, '巢穴深处的兽群冲了出来！', '#f0a69b');
    sfx.breakWood();
    sfx.omenHowl();
  }
}

/**
 * Live nests keep breeding while you're in the area: every ~15–25 s by day (up to 4 of their own
 * alive), almost twice as fast at night in pairs (up to 6), with the odd elite after dark.
 */
function updateNests(w: WorldState, dt: number, nowNight: boolean): void {
  if (w.mode !== 'station' && !w.stationStreamed) return;
  for (const nest of w.props) {
    if (nest.kind !== 'monster_nest' || nest.hp <= 0) continue;
    const d = Math.hypot(nest.x - w.player.x, nest.y - w.player.y);
    if (d > 1400) continue;
    nest.nestTimer = (nest.nestTimer ?? 15) - dt * (nowNight ? 1.8 : 1);
    if (nest.nestTimer > 0) continue;
    nest.nestTimer = 15 + Math.random() * 10;
    const brood = w.monsters.filter((m) => m.nestUid === nest.uid && m.hp > 0);
    // The first stop is where new players learn the ropes: smaller broods there.
    const cap = w.stationIdx === 0 ? (nowNight ? 4 : 3) : nowNight ? 6 : 4;
    if (brood.length >= cap || w.monsters.length >= 24) continue;
    const n = nowNight && brood.length + 2 <= cap ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = nest.x + Math.cos(a) * (nest.r + 16);
      const y = nest.y + Math.sin(a) * (nest.r + 16);
      const eliteAlive = brood.some((m) => m.elite);
      const m =
        nowNight && w.stationIdx >= 1 && !eliteAlive && Math.random() < 0.22
          ? createNestGuardian(w, nest.x, nest.y, nest.uid)
          : createMonster(pickZoneEnemyKind(w.zoneKind, w.zoneTier), x, y, false, w.zoneTier, nest.uid);
      w.monsters.push(m);
    }
    spawnParticles(w, nest.x, nest.y, '#7a4a3a', 10, 90);
  }
}

export function startRailLayHold(w: WorldState): boolean {
  const broken = w.trackHazards.find(
    (h) => h.kind === 'broken' && !h.repaired && h.x >= LOCO_W - 30 && h.x <= LOCO_W + 200
  );
  if (!broken) return false;
  if (Math.hypot(w.player.x - LOCO_W, w.player.y) > 120) return false;
  if (w.trainSpeed > 40) {
    addFloat(w, LOCO_W, -28, '需先刹车停稳', '#e07a7a');
    return true;
  }
  if (getItemCount(w, 'rails') <= 0) {
    addFloat(w, LOCO_W, -28, '无铁轨段', '#e07a7a');
    return true;
  }
  w.holdAction = {
    kind: 'rail',
    targetUid: broken.uid,
    x: LOCO_W + 24,
    y: -48,
    label: '铺设铁轨',
    progress: 0,
    duration: RAIL_LAY_DURATION,
  };
  sfx.railHammer();
  return true;
}

export function handlePlayerDeath(w: WorldState, cause = '重伤倒下'): void {
  w.stats.deaths++;
  w.gear = 0;
  w.trainSpeed = 0;
  w.holdAction = null;
  w.bagOpen = false;
  w.tradeOpen = false;
  w.routeOpen = false;
  w.throttleOpen = false;
  w.openChestUid = null;
  w.openContainerUid = null;
  w.openFacilityUid = null;
  w.player.alive = false;

  const snap = loadStationSnapshot();
  w.deathReport = {
    deathNum: w.stats.deaths,
    rollbackStationName: snap?.stationName ?? '上一站点',
    cause,
  };
  sfx.crash();
  w.shake = 14;
}

// --- Single Closest Contextual [E] Hint Discovery (U7) ---
function updateActiveHint(w: WorldState, input?: InputState): void {
  w.activeHint = null;
  if (w.gameOver || w.victory || w.deathReport) return;
  const px = w.player.x;
  const py = w.player.y;
  // Every interactable in reach offers its hint; the one you point at / face / stand closest to wins.
  const offers: InteractHint[] = [];
  const offer = (h: InteractHint): void => {
    offers.push(h);
  };
  collectHints();
  w.activeHint = pickBestHint(w, offers, input);
  return;

  function collectHints(): void {

  // 1. Lay rail at front of locomotive
  const brokenAhead = w.trackHazards.find(
    (h) => h.kind === 'broken' && !h.repaired && h.x >= LOCO_W - 30 && h.x <= LOCO_W + 200
  );
  if (brokenAhead && Math.hypot(px - LOCO_W, py) < 120) {
    offer({
      x: LOCO_W + 24,
      y: -36,
      label: `按住 E 铺设铁轨 · 余 ${getItemCount(w, 'rails')}`,
      holdAction: {
        kind: 'rail',
        targetUid: brokenAhead.uid,
        x: LOCO_W + 24,
        y: -48,
        label: '铺设铁轨',
        duration: RAIL_LAY_DURATION,
      },
      action: () => {
        startRailLayHold(w);
      },
    });
  }

  // 2. Locomotive Throttle Lever (only place to change gear! D/U8)
  if (Math.hypot(px - 136, py) < 48) {
    offer({
      x: 136,
      y: -36,
      label: w.throttleOpen ? 'E 收起驾驶盘' : 'E 操纵拉杆',
      action: () => {
        w.throttleOpen = !w.throttleOpen;
        sfx.lever();
      },
    });
  }

  // 2.5 A lantern you set down
  if (w.lanternHolder === 'placed' && w.lanternPos && Math.hypot(px - w.lanternPos.x, py - w.lanternPos.y) < 40) {
    offer({
      x: w.lanternPos.x,
      y: w.lanternPos.y - 26,
      label: 'E 拾起手提灯',
      action: () => pickUpLantern(w),
    });
  }

  // 3. Boiler / Crystal Reactor (vent overpressure or add crystals)
  if (Math.hypot(px - 54, py + 28) < 46) {
    if (w.boilerPressure >= 80) {
      offer({
        x: 54,
        y: -58,
        label: 'E 放气降压',
        action: () => {
          w.boilerPressure = 24;
          sfx.steamVent();
          spawnParticles(w, 68, -28, '#d0e2f2', 18, 130);
        },
      });
    }
    const avail = getItemCount(w, 'magicShard');
    offer({
      x: 54,
      y: -58,
      label: `E 填入晶石 · 炉膛 ${w.boilerFuel.toFixed(1)}/${w.boilerMax}`,
      action: () => {
        if (avail <= 0) {
          sfx.gridDeny();
          return;
        }
        const add = Math.min(3, avail, Math.ceil(w.boilerMax - w.boilerFuel));
        if (add <= 0) return;
        spendCost(w, { magicShard: add });
        w.boilerFuel = Math.min(w.boilerMax, w.boilerFuel + add);
        w.totalFuelAdded += add;
        sfx.crystalCharge();
        spawnParticles(w, 54, -28, '#7cc4ff', 12, 100);
        addFloat(w, 54, -42, `+${add} 燃料`, '#7cc4ff');
      },
    });
  }

  // 4. Car Hull Doors, Repair & Reinforcement
  let bestHull: { carIdx: number; panel: HullPanel; cx: number; cy: number; d: number } | null = null;
  for (const { carIdx, panel } of getAllHullPanels(w)) {
    if (isHullPassage(w, carIdx, panel)) continue;
    const canReinforce = !panel.isDoor && panel.hp >= panel.maxHp && (panel.armorTier ?? 1) < 2 && canAffordCost(w, { scrap: 3 });
    if (!(panel.isDoor || panel.hp < panel.maxHp || canReinforce)) continue;
    const seg = getHullSegment(carIdx, panel);
    const d = Math.hypot(px - seg.cx, py - seg.cy);
    if (d < 44 && (!bestHull || d < bestHull.d)) {
      bestHull = { carIdx, panel, cx: seg.cx, cy: seg.cy, d };
    }
  }
  if (bestHull) {
    const p = bestHull.panel;
    if (p.hp < p.maxHp && (!p.isDoor || p.hp <= 0)) {
      offer({
        x: bestHull.cx,
        y: bestHull.cy - 24,
        label: 'E 修补车壳 · 1废料',
        action: () => {
          if (getItemCount(w, 'scrap') < 1) {
            sfx.gridDeny();
            return;
          }
          spendCost(w, { scrap: 1 });
          p.hp = Math.min(p.maxHp, p.hp + 55);
          sfx.build();
          spawnParticles(w, bestHull!.cx, bestHull!.cy, '#74c0fc', 8, 95);
        },
      });
    }
    if (p.isDoor) {
      offer({
        x: bestHull.cx,
        y: bestHull.cy - 24,
        label: p.doorOpen ? 'E 关闭车门' : 'E 打开车门',
        action: () => {
          p.doorOpen = !p.doorOpen;
          if (!p.doorOpen && Math.abs(w.player.y - bestHull!.cy) < 16 && Math.abs(w.player.x - bestHull!.cx) < 26) {
            w.player.y = bestHull!.cy + (w.player.y >= bestHull!.cy ? 17 : -17);
          }
          sfx.door(p.doorOpen);
        },
      });
    }
    if ((p.armorTier ?? 1) < 2) {
      offer({
        x: bestHull.cx,
        y: bestHull.cy - 24,
        label: 'E 强化车壳 · 3废料',
        action: () => reinforceHullPanel(w, p, bestHull!.cx, bestHull!.cy),
      });
    }
  }

  // 5. Crude Coupler Repair / Upgrade
  for (let i = 0; i < w.flatbeds.length; i++) {
    const car = w.flatbeds[i];
    if (car.couplerKind !== 'crude') continue;
    const b = getCarBounds(i);
    const cx = b.right + COUPLER_GAP / 2;
    if (Math.hypot(px - cx, py) < 42) {
      if (getItemCount(w, 'coupler') > 0) {
        offer({
          x: cx,
          y: -34,
          label: 'E 换装正规车钩',
          action: () => {
            spendCost(w, { coupler: 1 });
            car.couplerKind = 'standard';
            car.couplerHp = 100;
            sfx.build();
          },
        });
      }
      if (car.couplerHp < 95) {
        offer({
          x: cx,
          y: -34,
          label: `E 检修土钩 · ${Math.round(car.couplerHp)}%`,
          action: () => {
            if (getItemCount(w, 'scrap') < 1) {
              sfx.gridDeny();
              return;
            }
            spendCost(w, { scrap: 1 });
            car.couplerHp = 100;
            sfx.hitMetal();
          },
        });
      }
    }
  }

  // 6. DIY Carriage at Train Tail
  if (w.trainSpeed < 8 && (getItemCount(w, 'coupler') > 0 || getItemCount(w, 'crudeCoupler') > 0)) {
    const tailX = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
    if (Math.hypot(px - (tailX - 18), py) < 46) {
      offer({
        x: tailX - 24,
        y: -34,
        label: 'E 挂接新车厢 · 8废+6木',
        action: () => {
          const err = tryAttachCarriage(w, true);
          if (err) addFloat(w, tailX - 24, -22, err, '#e07a7a');
        },
      });
    }
  }

  // 7. Placed Train Buildings (E = use/open/harvest; hold E on a chest = quick-stack).
  //    Upgrading lives in build mode (click the facility) and the facility panel, never on E.
  for (const car of trainDecks(w)) {
    for (const b of car.buildings) {
      const c = getTileCenter(b.carIdx, b.col, b.row);
      if (Math.hypot(px - c.x, py - c.y) > 46) continue;
      const def = BUILDINGS[b.type];

      if (b.type === 'chest') {
        offer({
          x: c.x,
          y: c.y - 26,
          label: `E 打开${getBuildingDisplayName(b)} · 按住E存同类`,
          holdAction: {
            kind: 'quickstack',
            targetUid: b.uid,
            x: c.x,
            y: c.y - 34,
            label: '批量存入同类',
            duration: QUICKSTACK_HOLD_DURATION,
          },
          action: () => {
            w.openChestUid = w.openChestUid === b.uid ? null : b.uid;
            w.openContainerUid = null;
            w.openFacilityUid = null;
            w.bagOpen = w.openChestUid !== null;
            w.notebookTab = 'bag';
            sfx.lever();
          },
        });
      }
      if (b.type === 'workbench' || b.type === 'campfire') {
        offer({
          x: c.x,
          y: c.y - 26,
          label: `E 打开${getBuildingDisplayName(b)}`,
          action: () => {
            w.openFacilityUid = w.openFacilityUid === b.uid ? null : b.uid;
            w.openChestUid = null;
            w.openContainerUid = null;
            sfx.uiClick();
          },
        });
      }
      if (b.type === 'rain_collector') {
        const stored = Math.floor(b.storedWater ?? 0);
        offer({
          x: c.x,
          y: c.y - 26,
          label:
            stored > 0
              ? `E 收取${b.tier >= 2 ? '净水' : '脏水'} +${stored}`
              : b.tier >= 2
                ? 'E 打开过滤桶'
                : '接水斗 · 等待下雨',
          action: () => {
            if (stored > 0) {
              const key: ResourceKey = b.tier >= 2 ? 'water' : 'dirtyWater';
              giveItem(w, key, stored, true, c);
              b.storedWater = (b.storedWater ?? 0) - stored;
              sfx.pickup();
            } else if (b.tier >= 2) {
              w.openFacilityUid = w.openFacilityUid === b.uid ? null : b.uid;
              sfx.uiClick();
            }
          },
        });
      }
      if (b.type === 'door') {
        offer({
          x: c.x,
          y: c.y - 26,
          label: `${b.doorOpen ? 'E 关闭' : 'E 打开'}${getBuildingDisplayName(b)}`,
          action: () => {
            b.doorOpen = !b.doorOpen;
            sfx.door(b.doorOpen);
          },
        });
      }
      if (b.type === 'planter') {
        if (b.pestInfested) {
          offer({
            x: c.x,
            y: c.y - 26,
            label: 'E 清除虫害（损失一半长势）',
            action: () => {
              b.pestInfested = false;
              b.growth = Math.max(0, (b.growth ?? 0) * 0.5);
              sfx.hitWood();
            },
          });
        }
        if (!b.planted) {
          offer({
            x: c.x,
            y: c.y - 26,
            label: `E 播种 · 余 ${getItemCount(w, 'seeds')}`,
            action: () => {
              if (getItemCount(w, 'seeds') <= 0) {
                sfx.gridDeny();
                return;
              }
              spendCost(w, { seeds: 1 });
              b.planted = true;
              b.growth = 0;
              b.watered = 0; // Must water manually (T1) or auto-water (T2)! (#2)
              sfx.build();
            },
          });
        } else if ((b.growth ?? 0) >= 100) {
          offer({
            x: c.x,
            y: c.y - 26,
            label: `E 收获耐旱麦 · +2生食`,
            action: () => {
              giveItem(w, 'rawFood', 2, true, c);
              if (Math.random() < PLANTER_SEED_RETURN_CHANCE) {
                giveItem(w, 'seeds', 1, true, c);
              }
              b.planted = false;
              b.growth = 0;
              b.watered = 0;
              sfx.pickup();
            },
          });
        } else {
          const isWet = (b.watered ?? 0) > 0;
          offer({
            x: c.x,
            y: c.y - 26,
            label: `E 浇水 · ${Math.round(b.growth ?? 0)}% ${isWet ? '(生长中)' : '(缺水停长)'}`,
            action: () => {
              const useDirty = getItemCount(w, 'dirtyWater') > 0;
              const useClean = !useDirty && getItemCount(w, 'water') > 0;
              if (!useDirty && !useClean) {
                sfx.gridDeny();
                return;
              }
              spendCost(w, useDirty ? { dirtyWater: 1 } : { water: 1 });
              b.watered = 185; // 185s moisture => ~2 waterings to mature in 5.5 min
              sfx.pickup();
              spawnParticles(w, c.x, c.y, '#5fa8e6', 7, 75);
            },
          });
        }
        continue;
      }
      if (b.type === 'bed') {
        const canSleep = w.lastSleepDay < w.dayCount;
        offer({
          x: c.x,
          y: c.y - 26,
          label: canSleep ? `E 休息 ${BED_REST_HOURS}h` : '今日已休息',
          action: () => restInBed(w, b.tier, c.x, c.y),
        });
      }
    }
  }

  // 8. Tool-Gated Barriers
  for (const bar of w.stationBarriers) {
    if (bar.opened) continue;
    const cx = bar.x + bar.w / 2;
    const cy = bar.y + bar.h / 2;
    if (Math.hypot(px - cx, py - cy) < 52) {
      offer({
        x: cx,
        y: cy - 22,
        label: w.player.toolLevel >= bar.reqTool ? `左键破开 · ${bar.label}` : `需 ${TOOL_META[bar.reqTool].name}`,
        action: () => {},
      });
    }
  }

  // 9. World Props, Containers (U1/U6), Special Lore Items & NPCs (P2/P3)
  for (const prop of w.props) {
    if (prop.used || prop.hp <= 0) continue;
    if (Math.hypot(px - prop.x, py - prop.y) > prop.r + 42) continue;
    if (prop.isContainer && prop.containerInv) {
      if (prop.searched) {
        offer({
          x: prop.x,
          tx: prop.x,
          ty: prop.y,
          y: prop.y - prop.r - 18,
          label: `E 打开 · ${prop.label}`,
          action: () => {
            w.openContainerUid = w.openContainerUid === prop.uid ? null : prop.uid;
            w.openChestUid = null;
            w.openFacilityUid = null;
            sfx.uiClick();
          },
        });
      } else {
        offer({
          x: prop.x,
          tx: prop.x,
          ty: prop.y,
          y: prop.y - prop.r - 18,
          label: `按住 E 搜刮 · ${prop.label}`,
          holdAction: {
            kind: 'loot',
            targetUid: prop.uid,
            x: prop.x,
            y: prop.y - prop.r - 22,
            label: `搜刮 ${prop.label}`,
            duration: CONTAINER_SEARCH_DURATION,
          },
          action: () => {},
        });
      }
      continue;
    }

    if (prop.kind === 'oracle_altar') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 34,
        label: 'E 拾取祭坛上的供物',
        action: () => {
          prop.used = true;
          if (prop.drops) {
            for (const [k, v] of Object.entries(prop.drops)) {
              if ((v ?? 0) > 0) giveItem(w, k as ResourceKey, v!, true, { x: prop.x, y: prop.y });
            }
          }
          sfx.crystalCharge();
          recordCodex(
            w,
            `altar_${w.stationIdx}`,
            '站台祭坛的馈赠',
            '无人的石台上静静放着刚摆好的物资，摸起来还有余温。没人知道是谁留下的。'
          );
        },
      });
    }

    if (prop.kind === 'special_diary' || prop.kind === 'npc_elder' || prop.kind === 'nameless_graves') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 32,
        label: prop.kind === 'npc_elder' ? `E 交谈 · ${prop.label}` : `E 查看 · ${prop.label}`,
        action: () => {
          if (prop.kind === 'npc_elder') w.chainElderMet = true;
          if (prop.loreId === 'predecessor_diary_1') w.chainPredecessorFound = true;
          if (prop.loreId && prop.loreTitle && prop.loreText) {
            recordCodex(w, prop.loreId, prop.loreTitle, prop.loreText);
          }
          if (prop.kind === 'special_diary') prop.used = true;
          sfx.uiClick();
        },
      });
    }

    if (prop.kind === 'roadside_waver') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 34,
        label: 'E 靠近路边的变异拾荒者',
        action: () => {
          prop.used = true;
          if (Math.random() < 0.65) {
            giveItem(w, 'water', 2, true, { x: prop.x, y: prop.y });
            giveItem(w, 'parts', 1, true, { x: prop.x, y: prop.y });
            recordCodex(
              w,
              `waver_${Math.floor(w.totalDistance)}`,
              '路边的变异者',
              '它喉咙里发出含糊的音节，把两壶清水和零件递进车厢，随即转身走进雾里。'
            );
            sfx.pickup();
          } else {
            w.monsters.push(
              createMonster('mutant_raider', prop.x + 25, prop.y - 40, false, w.zoneTier),
              createMonster('hound', prop.x - 30, prop.y + 45, false, w.zoneTier)
            );
            sfx.omenHowl();
          }
        },
      });
    }

    if (prop.kind === 'flatbed_siding') {
      const hasCoupler = getItemCount(w, 'coupler') > 0 || getItemCount(w, 'crudeCoupler') > 0;
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 42,
        label: hasCoupler ? 'E 挂接备用车厢' : '挂接车厢需车钩',
        action: () => {
          const err = tryAttachCarriage(w, false);
          if (err) sfx.gridDeny();
          else prop.used = true;
        },
      });
    }

    if (prop.kind === 'water_tower') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 42,
        label: 'E 在水塔打水 · +8净水',
        action: () => {
          prop.used = true;
          giveItem(w, 'water', 8, true, { x: prop.x, y: prop.y });
          w.player.thirst = 100;
          w.lastVitalChangeAt = w.time;
          sfx.pickup();
        },
      });
    }

    if (prop.kind === 'npc_keeper') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 34,
        label: 'E 交易 · 变异行商',
        action: () => {
          w.tradeOpen = !w.tradeOpen;
          sfx.uiClick();
        },
      });
    }

    if (prop.kind === 'loco_crane') {
      offer({
        x: prop.x,
        tx: prop.x,
        ty: prop.y,
        y: prop.y - 42,
        label: 'E 升级车头 II · 28废+5零',
        action: () => {
          if (!canAffordCost(w, { scrap: 28, parts: 5 })) {
            sfx.gridDeny();
            return;
          }
          spendCost(w, { scrap: 28, parts: 5 });
          w.locoLevel = 2;
          w.locoMaxHp = 240;
          w.locoHp = 240;
          w.boilerMax = getCoreMaxCapacity(w);
          prop.used = true;
          sfx.build();
          w.shake = 8;
        },
      });
    }
  }
}
}

/** The hint's object sits a little below its floating label. */
function hintTarget(h: InteractHint): { x: number; y: number } {
  return { x: h.tx ?? h.x, y: h.ty ?? h.y + 24 };
}

let lastHintKey = '';
/**
 * Choose what E acts on: the thing under the mouse cursor first, otherwise what you're facing,
 * then what's nearest. A small bias keeps the current pick so it doesn't flicker between neighbours.
 */
function pickBestHint(w: WorldState, offers: InteractHint[], input?: InputState): InteractHint | null {
  if (offers.length === 0) {
    lastHintKey = '';
    return null;
  }
  const p = w.player;
  let best: InteractHint | null = null;
  let bestScore = Infinity;
  offers.forEach((h, order) => {
    const t = hintTarget(h);
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    let da = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) - p.angle);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (d < 16) da = 0;
    let score = d + da * 40 + order * 0.01;
    if (input && Math.hypot(input.mouseWorldX - t.x, input.mouseWorldY - t.y) < 30) score -= 240;
    if (`${h.label}@${Math.round(t.x)},${Math.round(t.y)}` === lastHintKey) score -= 10;
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  });
  const chosen = best as InteractHint | null;
  if (chosen) {
    const t = hintTarget(chosen);
    chosen.tx = t.x;
    chosen.ty = t.y;
    lastHintKey = `${chosen.label}@${Math.round(t.x)},${Math.round(t.y)}`;
  }
  return chosen;
}

export function triggerInteract(w: WorldState): void {
  if (w.activeHint) {
    w.activeHint.action();
  }
}

function updateHoldAction(w: WorldState, input: InputState, dt: number): void {
  const p = w.player;

  // Start hold-E action if holding E over a holdable hint
  if (input.holdE && !w.holdAction && w.activeHint?.holdAction) {
    w.holdAction = {
      ...w.activeHint.holdAction,
      progress: 0,
    };
    if (w.holdAction.kind === 'loot') sfx.rummage();
    else if (w.holdAction.kind === 'rail') sfx.railHammer();
  }

  if (!w.holdAction) return;
  const ha = w.holdAction;

  // Validate continued hold
  if (ha.kind === 'eat') {
    const active = getActiveBinding(w);
    if (!input.mouseDown || active?.kind !== 'item' || active.key !== ha.itemKey) {
      w.holdAction = null;
      return;
    }
    ha.x = p.x;
    ha.y = p.y - 34;
  } else {
    if (!input.holdE || Math.hypot(p.x - ha.x, p.y - ha.y) > 130) {
      w.holdAction = null;
      return;
    }
  }

  ha.progress += dt / ha.duration;
  if (ha.kind === 'rail' && Math.random() < dt * 2.4) {
    sfx.railHammer();
    spawnParticles(w, LOCO_W + 28, 0, '#d9b15f', 5, 100);
  } else if (ha.kind === 'loot' && Math.random() < dt * 2.2) {
    sfx.rummage();
  }

  if (ha.progress >= 1) {
    const done = ha;
    w.holdAction = null;
    if (done.kind === 'eat') {
      if (done.itemKey) consumeItem(w, done.itemKey);
      else eatOrDrink(w);
    } else if (done.kind === 'quickstack') {
      quickStackToChests(w);
    } else if (done.kind === 'upgrade' && done.targetUid) {
      const b = findBuildingByUid(w, done.targetUid);
      if (b) upgradeBuildingInPlace(w, b);
    } else if (done.kind === 'loot' && done.targetUid) {
      const prop = findPropByUid(w, done.targetUid);
      if (prop && prop.isContainer && prop.containerInv) {
        prop.searched = true;
        w.openContainerUid = prop.uid;
        w.openChestUid = null;
        w.openFacilityUid = null;
        sfx.pickup();
      }
    } else if (done.kind === 'rail' && done.targetUid) {
      const hz = w.trackHazards.find((h) => h.uid === done.targetUid && !h.repaired);
      if (hz && getItemCount(w, 'rails') > 0) {
        spendCost(w, { rails: 1 });
        hz.repaired = true;
        w.stats.railsLaid++;
        sfx.build();
        spawnParticles(w, hz.x + hz.width / 2, 0, '#7bc985', 18, 160);
      }
    }
  }
}

function resolvePlayerCollisions(w: WorldState): void {
  const p = w.player;
  const bRad = 10;
  const bHalf = TILE / 2 - 3;
  const hThresh = 12;

  for (let iter = 0; iter < 3; iter++) {
    for (const car of trainDecks(w)) {
      for (const b of car.buildings) {
        if (!BUILDINGS[b.type].solid || (b.type === 'door' && b.doorOpen)) continue;
        const c = getTileCenter(b.carIdx, b.col, b.row);
        const qx = Math.max(c.x - bHalf, Math.min(p.x, c.x + bHalf));
        const qy = Math.max(c.y - bHalf, Math.min(p.y, c.y + bHalf));
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d = Math.hypot(dx, dy);
        if (d > 0.0001 && d < bRad) {
          const push = bRad - d;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        } else if (d <= 0.0001) {
          const penLeft = p.x - (c.x - bHalf);
          const penRight = c.x + bHalf - p.x;
          const penTop = p.y - (c.y - bHalf);
          const penBottom = c.y + bHalf - p.y;
          const m = Math.min(penLeft, penRight, penTop, penBottom);
          if (m === penLeft) p.x = c.x - bHalf - bRad;
          else if (m === penRight) p.x = c.x + bHalf + bRad;
          else if (m === penTop) p.y = c.y - bHalf - bRad;
          else p.y = c.y + bHalf + bRad;
        }
      }
    }

    for (const { carIdx, panel } of getAllHullPanels(w)) {
      if (panel.hp <= 0 || isHullPassage(w, carIdx, panel) || (panel.isDoor && panel.doorOpen)) continue;
      const seg = getHullSegment(carIdx, panel);
      const trimStart = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx - 1) ? 7 : 1;
      const trimEnd = isPanelOpenOrBreached(w, carIdx, panel.side, panel.idx + 1) ? 7 : 1;
      const horiz = panel.side === 'top' || panel.side === 'bottom';
      const x1 = horiz ? seg.x1 + trimStart : seg.x1;
      const x2 = horiz ? seg.x2 - trimEnd : seg.x2;
      const y1 = horiz ? seg.y1 : seg.y1 + trimStart;
      const y2 = horiz ? seg.y2 : seg.y2 - trimEnd;

      const sdx = x2 - x1;
      const sdy = y2 - y1;
      const lenSq = sdx * sdx + sdy * sdy;
      const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, ((p.x - x1) * sdx + (p.y - y1) * sdy) / lenSq)) : 0;
      const qx = x1 + t * sdx;
      const qy = y1 + t * sdy;
      const dx = p.x - qx;
      const dy = p.y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < hThresh) {
        const push = hThresh - d;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      } else if (d <= 0.0001) {
        if (panel.side === 'top') p.y = seg.y1 + hThresh;
        else if (panel.side === 'bottom') p.y = seg.y1 - hThresh;
        else if (panel.side === 'left') p.x = seg.x1 + hThresh;
        else p.x = seg.x1 - hThresh;
      }
    }

    const pushAABB = (rx: number, ry: number, rw: number, rh: number): void => {
      const qx = Math.max(rx, Math.min(p.x, rx + rw));
      const qy = Math.max(ry, Math.min(p.y, ry + rh));
      const dx = p.x - qx;
      const dy = p.y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < bRad) {
        const push = bRad - d;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      } else if (d <= 0.0001) {
        const penL = p.x - rx;
        const penR = rx + rw - p.x;
        const penT = p.y - ry;
        const penB = ry + rh - p.y;
        const m = Math.min(penL, penR, penT, penB);
        if (m === penL) p.x = rx - bRad;
        else if (m === penR) p.x = rx + rw + bRad;
        else if (m === penT) p.y = ry - bRad;
        else p.y = ry + rh + bRad;
      }
    };
    for (const wall of w.stationWalls) pushAABB(wall.x, wall.y, wall.w, wall.h);
    for (const bar of w.stationBarriers) {
      if (!bar.opened) pushAABB(bar.x, bar.y, bar.w, bar.h);
    }

    if (w.trainSpeed >= 8) {
      const minLeft = w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0;
      p.x = Math.max(minLeft + 10, Math.min(LOCO_W - 10, p.x));
      let inGap = false;
      for (let i = 0; i < w.flatbeds.length; i++) {
        const b = getCarBounds(i);
        if (p.x > b.right + 2 && p.x < b.right + COUPLER_GAP - 2) {
          inGap = true;
          break;
        }
      }
      const maxY = inGap ? 34 : HALF_H - 10;
      p.y = Math.max(-maxY, Math.min(maxY, p.y));
    }
  }
}

// --- Main Real-Time Simulation Tick ---
export function stepWorld(w: WorldState, input: InputState, rawDt: number): void {
  if (w.gameOver || w.victory || w.deathReport) return;
  const dt = Math.min(rawDt, 0.05);
  w.shake = Math.max(0, w.shake - 24 * dt);

  if (w.hitStop > 0) {
    w.hitStop = Math.max(0, w.hitStop - dt);
    return;
  }

  w.time += dt;
  w.lightningFlash = Math.max(0, w.lightningFlash - dt * 2.5);
  if (w.zoneBanner) {
    w.zoneBanner.timer -= dt;
    if (w.zoneBanner.timer <= 0) w.zoneBanner = null;
  }
  if (w.activeCard) {
    w.activeCard.timer -= dt;
    if (w.activeCard.timer <= 0) w.activeCard = null;
  }

  // Update ambient soundscape (E)
  sfx.updateAmbient(dt, w.trainSpeed, w.weather, w.boilerFuel / Math.max(1, w.boilerMax), w.zoneKind, true);

  updateLostWorldExploration(w, dt);

  // Auto-close proximity panels when walking away (D + U6 + U8)
  if (w.throttleOpen && Math.hypot(w.player.x - 136, w.player.y) > 90) {
    w.throttleOpen = false;
  }
  if (w.openContainerUid) {
    const cp = getOpenContainerProp(w);
    if (!cp || Math.hypot(w.player.x - cp.x, w.player.y - cp.y) > 150) {
      w.openContainerUid = null;
    }
  }
  if (w.openFacilityUid) {
    const fb = findBuildingByUid(w, w.openFacilityUid);
    if (!fb) {
      w.openFacilityUid = null;
    } else {
      const c = getTileCenter(fb.carIdx, fb.col, fb.row);
      if (Math.hypot(w.player.x - c.x, w.player.y - c.y) > 120) w.openFacilityUid = null;
    }
  }
  if (w.openChestUid) {
    const cb = findBuildingByUid(w, w.openChestUid);
    if (!cb) {
      w.openChestUid = null;
    } else {
      const c = getTileCenter(cb.carIdx, cb.col, cb.row);
      if (Math.hypot(w.player.x - c.x, w.player.y - c.y) > 120) w.openChestUid = null;
    }
  }

  for (const { panel } of getAllHullPanels(w)) panel.hitFlash = Math.max(0, panel.hitFlash - dt);
  for (const bar of w.stationBarriers) bar.hitFlash = Math.max(0, bar.hitFlash - dt);
  for (const pr of w.props) {
    pr.hitFlash = Math.max(0, pr.hitFlash - dt);
    if ((pr.hitBounce ?? 0) > 0) {
      pr.hitBounce = Math.max(0, (pr.hitBounce ?? 0) - dt);
      pr.hitOffX = (pr.hitOffX ?? 0) * 0.8;
      pr.hitOffY = (pr.hitOffY ?? 0) * 0.8;
    }
  }

  // 0. Day/Night & Regional Weather (H6)
  const prevNight = isNight(w);
  w.dayTime += dt / DAY_LENGTH;
  if (w.dayTime >= 1) {
    w.dayTime -= 1;
    w.dayCount++;
  }
  const nowNight = isNight(w);
  const hasLiveNests = w.props.some((pr) => pr.kind === 'monster_nest' && pr.hp > 0);
  if (!prevNight && nowNight) {
    // H3: Clearing all nests at a station prevents night raids!
    if (w.mode !== 'station' || hasLiveNests) {
      w.nightWavesLeft = 2;
      w.nightWaveTimer = 24;
      sfx.omenHowl();
    }
  } else if (prevNight && !nowNight) {
    w.nightWavesLeft = 0;
  }

  // Regional weather: only this region's own kind, and only now and then.
  w.weatherTimer -= dt;
  if (w.weatherTimer <= 0) {
    const zw = ZONE_WEATHER[w.zoneKind];
    if (w.weather !== 'clear') {
      w.weather = 'clear';
      w.weatherTimer = 420 + Math.random() * 240; // 7–11 min of calm after a spell
    } else if (zw.kind && Math.random() < zw.chance) {
      w.weather = zw.kind;
      w.weatherTimer = 110 + Math.random() * 90;
      if (w.weather === 'rainstorm') {
        sfx.thunder();
        w.lightningFlash = 0.7;
      }
    } else {
      w.weatherTimer = 300 + Math.random() * 240;
    }
  }
  if (w.weather === 'rainstorm' && Math.random() < dt * 0.08) {
    w.lightningFlash = 0.65;
    sfx.thunder();
  }

  // Perishables decay slowly in backpack & chests (G6)
  tickPerishables(w.backpack, dt, 1.0);
  for (const ch of getAllChestGrids(w)) tickPerishables(ch, dt, 0.75);

  const p = w.player;
  const armor = getArmorStats(w);
  p.maxHp = armor.maxHp;
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.swingTimer = Math.max(0, p.swingTimer - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);

  // 1. Survival Stats (#1 halved drain: 0.13/s hunger, 0.15/s thirst + sickness + spores + diegetic audio!)
  const prevHpBucket = Math.floor(p.hp);
  if (p.wellFedTimer > 0) {
    p.wellFedTimer = Math.max(0, p.wellFedTimer - dt);
    p.maxStamina = 145;
    p.hp = Math.min(p.maxHp, p.hp + 0.9 * dt);
  } else {
    p.maxStamina = 100;
  }
  if (p.sickTimer > 0) {
    p.sickTimer = Math.max(0, p.sickTimer - dt);
    p.hp = Math.max(1, p.hp - 0.35 * dt);
  }

  const heatThirstMult = w.weather === 'sandstorm' ? 1.45 : 1.0;
  p.hunger = Math.max(0, p.hunger - HUNGER_DRAIN_PER_SEC * dt);
  p.thirst = Math.max(0, p.thirst - THIRST_DRAIN_PER_SEC * heatThirstMult * dt);

  const carUnderPlayer = getCarIndexAtPoint(w, p.x, p.y);
  const playerCarRole = carUnderPlayer !== null && carUnderPlayer >= 0 ? getCarriageRole(w.flatbeds[carUnderPlayer]) : 'none';

  // Ivy City outdoor spores (W4/W5) & parked vine creep
  if (w.zoneKind === 'ivy_city') {
    if (carUnderPlayer === null && !armor.sporeProof) {
      p.sporeExposure = Math.min(100, p.sporeExposure + 3.2 * dt);
      if (p.sporeExposure >= 100) {
        p.sporeExposure = 40;
        p.sickTimer = Math.max(p.sickTimer, 70);
      }
    } else {
      p.sporeExposure = Math.max(0, p.sporeExposure - 8 * dt);
    }
    if (w.mode === 'station' && w.trainSpeed < 5) {
      w.vineSnare = Math.min(100, w.vineSnare + 0.35 * dt);
    }
  } else {
    p.sporeExposure = Math.max(0, p.sporeExposure - 10 * dt);
  }

  let nearHeat = w.boilerFuel > 0 && Math.hypot(p.x - 54, p.y + 28) < 125;
  if (!nearHeat) {
    for (const car of trainDecks(w)) {
      for (const b of car.buildings) {
        if (b.type === 'campfire' || b.type === 'crystal_pylon') {
          const c = getTileCenter(b.carIdx, b.col, b.row);
          const heatRange = b.type === 'campfire' && b.tier >= 2 ? 175 : 120;
          if (Math.hypot(p.x - c.x, p.y - c.y) < heatRange) {
            nearHeat = true;
            break;
          }
        }
      }
      if (nearHeat) break;
    }
  }
  const shelteredSealed = carUnderPlayer !== null && isCarSealed(w, carUnderPlayer);
  const coldFactor = Math.max(0.05, 1 - armor.coldResist);

  if (w.weather === 'blizzard') {
    if (nearHeat || playerCarRole === 'quarters') p.bodyTemp = Math.min(100, p.bodyTemp + 14 * dt);
    else if (shelteredSealed && w.boilerFuel > 0) p.bodyTemp = Math.min(100, p.bodyTemp + 3.5 * dt);
    else if (carUnderPlayer !== null) p.bodyTemp = Math.max(0, p.bodyTemp - 2.2 * coldFactor * dt);
    else p.bodyTemp = Math.max(0, p.bodyTemp - 5.2 * coldFactor * dt);
  } else if (w.weather === 'rainstorm' && nowNight && carUnderPlayer === null) {
    p.bodyTemp = Math.max(0, p.bodyTemp - 1.5 * coldFactor * dt);
  } else {
    p.bodyTemp = Math.min(100, p.bodyTemp + (nearHeat || playerCarRole === 'quarters' ? 16 : 8) * dt);
  }

  if (w.weather === 'sandstorm' && carUnderPlayer === null && !armor.sporeProof) {
    p.hp = Math.max(0, p.hp - 0.55 * dt);
  }
  if (p.hunger <= 0 || p.thirst <= 0) p.hp = Math.max(0, p.hp - 1.2 * dt);
  if (p.bodyTemp <= 0) p.hp = Math.max(0, p.hp - 2.2 * dt);

  if (Math.floor(p.hp) !== prevHpBucket || p.hunger < 30 || p.thirst < 30 || p.bodyTemp < 45 || p.sickTimer > 0) {
    w.lastVitalChangeAt = w.time;
  }

  // Diegetic body audio cues instead of nagging alert popups (A!)
  w.stomachGrowlCd = Math.max(0, w.stomachGrowlCd - dt);
  if (p.hunger <= 28 && w.stomachGrowlCd <= 0) {
    w.stomachGrowlCd = 24;
    sfx.stomachGrowl();
  }
  w.heartbeatCd = Math.max(0, w.heartbeatCd - dt);
  if (p.hp > 0 && p.hp <= p.maxHp * 0.28 && w.heartbeatCd <= 0) {
    w.heartbeatCd = 1.65;
    sfx.heartbeat();
  }

  // 2. Player Movement
  p.angle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(mx, my);
  const quartersStamMult = playerCarRole === 'quarters' ? 1.45 : 1.0;
  const sickStamMult = p.sickTimer > 0 ? 0.55 : 1.0;

  if (mag > 0) {
    mx /= mag;
    my /= mag;
    const sprinting = input.sprint && p.stamina > 5 && (p.staminaDelay ?? 0) < STAMINA_EMPTY_DELAY - 0.05;
    const coldMult = p.bodyTemp < 28 ? 0.74 : 1.0;
    const hungryMult = p.hunger < 20 ? 0.86 : 1.0;
    const baseSpeed = (p.wellFedTimer > 0 ? 192 : 164) * (sprinting ? 1.38 : 1.0) * coldMult * hungryMult * armor.speedMult;
    if (sprinting) spendStamina(w, 24 * dt);
    else if ((p.staminaDelay ?? 0) <= 0) p.stamina = Math.min(p.maxStamina, p.stamina + 6 * quartersStamMult * sickStamMult * dt);

    p.x += mx * baseSpeed * dt;
    p.y += my * baseSpeed * dt;
  } else if ((p.staminaDelay ?? 0) <= 0) {
    p.stamina = Math.min(p.maxStamina, p.stamina + 11 * quartersStamMult * sickStamMult * dt);
  }
  p.staminaDelay = Math.max(0, (p.staminaDelay ?? 0) - dt);
  resolvePlayerCollisions(w);

  // Hold-E / Hold-Eat update
  updateHoldAction(w, input, dt);

  const heldBinding = getActiveBinding(w);
  if (input.mouseDown && !w.buildMode && heldBinding?.kind !== 'item') {
    handlePrimaryAction(w, input.mouseWorldX, input.mouseWorldY);
  }

  // 3. Train Momentum, Driving-Only Fuel Burn, Wave Pacing (C), Sinking Rail Hazards (H5) & World Events (H7)
  const overloaded = isOverloaded(w);
  if (overloaded && w.gear === 3) w.gear = 2;
  if (w.boilerFuel <= 0 && w.gear > 0) {
    w.gear = 0;
  }

  if (w.mode === 'station' && w.gear > 0) {
    if (!w.selectedRoute) {
      w.gear = 0;
      w.routeOpen = true;
    } else if (!isPointOnTrain(w, p.x, p.y, 18)) {
      w.gear = 0;
    }
  }

  const targetSpeed = GEAR_SPEEDS[w.gear] * (w.vineSnare > 20 ? 0.35 : 1.0);
  const accel = targetSpeed > w.trainSpeed ? 65 : 130;
  if (w.trainSpeed < targetSpeed) w.trainSpeed = Math.min(targetSpeed, w.trainSpeed + accel * dt);
  else if (w.trainSpeed > targetSpeed) w.trainSpeed = Math.max(targetSpeed, w.trainSpeed - accel * dt);

  // Boiler pressure event at Gear 3 (H7 #9)
  if (w.gear === 3 && w.boilerFuel > 0) {
    w.boilerPressure = Math.min(100, w.boilerPressure + 2.6 * dt);
    if (w.boilerPressure >= 99) {
      w.boilerPressure = 45;
      w.locoHp = Math.max(15, w.locoHp - 18);
      w.shake = 10;
      sfx.steamVent();
      spawnParticles(w, 60, -28, '#e07a7a', 18, 150);
    }
  } else {
    w.boilerPressure = Math.max(18, w.boilerPressure - 3.5 * dt);
  }

  if (w.trainSpeed > 1) {
    const dx = w.trainSpeed * dt;
    const dm = dx / 18;
    w.worldScrollX += dx;
    w.totalDistance += dm;

    const pylonBonus = getCrystalPylonBonus(w);
    const weightFactor = Math.max(0.75, 0.65 + getTrainWeight(w) / 15);
    const overloadMult = overloaded ? 1.3 : 1.0;
    const speedMult = GEAR_FUEL_MULT[w.gear] || 1.0;
    const escapeDiscount = w.mode === 'city_escape' ? 0.35 : 1.0;
    const coreUsed = (dm / 460) * weightFactor * overloadMult * speedMult * pylonBonus.fuelMult * escapeDiscount;
    w.boilerFuel = Math.max(0, w.boilerFuel - coreUsed);

    // Crude Coupler Wear (kept advantage!)
    for (let i = w.flatbeds.length - 1; i >= 0; i--) {
      const car = w.flatbeds[i];
      if (car.couplerKind !== 'crude') continue;
      const wearRate = w.gear === 3 ? 1.6 : w.gear === 2 ? 0.6 : 0.2;
      car.couplerHp = Math.max(0, car.couplerHp - wearRate * dt);
      car.couplerWarnCd = Math.max(0, car.couplerWarnCd - dt);
      const b = getCarBounds(i);
      const cx = b.right + COUPLER_GAP / 2;
      if (car.couplerHp < 42 && Math.random() < dt * 6) spawnParticles(w, cx, 0, '#e6a04c', 2, 100);
      if (car.couplerHp < 35 && car.couplerWarnCd <= 0) {
        car.couplerWarnCd = 10;
        sfx.couplerWarn();
      }
      if (car.couplerHp <= 0) {
        w.flatbeds.splice(i);
        w.boilerMax = getCoreMaxCapacity(w);
        if (p.x < b.right) {
          p.x = Math.max(b.right + 28, 30);
          p.y = 0;
        }
        w.gear = 0;
        w.trainSpeed *= 0.2;
        w.shake = 16;
        sfx.crash();
        spawnParticles(w, cx, 0, '#e07a7a', 22, 200);
        break;
      }
    }

    w.chugTimer -= dt * (w.trainSpeed / 100);
    if (w.chugTimer <= 0) {
      w.chugTimer = 0.36;
      sfx.chug(w.boilerFuel / Math.max(1, w.boilerMax));
      w.particles.push({
        x: 115,
        y: -30,
        vx: -w.trainSpeed * 0.65,
        vy: -25 - Math.random() * 20,
        life: 0.7,
        maxLife: 0.7,
        size: 8 + Math.random() * 6,
        color: w.boilerPressure > 82 ? 'rgba(225, 110, 95, 0.5)' : 'rgba(135, 195, 245, 0.38)',
      });
    }

    w.stationAnchorX -= dx;
    w.biomeSeamX -= dx;
    w.cityExitX -= dx;
    for (const pr of w.props) pr.x -= dx;
    for (const rd of w.stationRoads) rd.x -= dx;
    for (const rm of w.stationRooms) rm.x -= dx;
    for (const wl of w.stationWalls) wl.x -= dx;
    for (const br of w.stationBarriers) br.x -= dx;
    for (const h of w.trackHazards) h.x -= dx;
    for (const m of w.monsters) if (!m.onTrain) m.x -= dx;
    for (const pk of w.pickups) if (!pk.onTrain) pk.x -= dx;
    if (w.decoyPos) w.decoyPos.x -= dx;
    for (const er of w.nestEruptions) er.x -= dx;
    if (w.lanternPos && !w.lanternPos.onTrain) {
      w.lanternPos.x -= dx;
      // Left far behind on the line: someone of the crew runs back for it
      if (w.lanternPos.x < -3200) {
        pickUpLantern(w, true);
        addFloat(w, w.player.x, w.player.y - 30, '留在铁道旁的手提灯已取回', '#ffd98a');
      }
    }

    // Parallel ghost train silhouette (W1/H7 #7)
    if (w.parallelTrainX !== null) {
      w.parallelTrainX += 35 * dt;
      if (w.parallelTrainX > 1800) w.parallelTrainX = null;
    }

    // Opening City Escape -> Station 1 (Abandoned Halt)
    if (w.mode === 'city_escape') {
      w.legDistance += dm;
      const remPx = Math.max(0, (w.legTotal - w.legDistance) * 18);
      const progress = w.legDistance / Math.max(1, w.legTotal);

      // The burning parish falls behind; open rust plains before the first halt
      if (w.zoneKind === 'fallen_city' && w.cityExitX < 900) {
        w.prevZoneKind = 'fallen_city';
        w.biomeSeamX = w.cityExitX;
        enterZone(w, 'rust_plains', 1);
      }

      // One overturned wagon beside the line on the way out — worth a stop
      if (w.roadsideEventSpawned === 0 && progress >= 0.55 && !w.stationStreamed) {
        w.roadsideEventSpawned = 1;
        const inv = createInventory(6);
        addToInventory(inv, 'scrap', 3);
        addToInventory(inv, 'wood', 2);
        addToInventory(inv, 'rawFood', 1);
        addToInventory(inv, 'water', 1);
        w.props.push({
          uid: uid('ev'),
          kind: 'roadside_wreck',
          mat: 'metal',
          x: 1180,
          y: -175,
          r: 30,
          hp: 55,
          maxHp: 55,
          hitFlash: 0,
          label: '翻倒的逃难马车',
          isContainer: true,
          searched: false,
          containerInv: inv,
        });
      }

      if (!w.stationStreamed && remPx <= 2200) {
        w.stationStreamed = true;
        if (w.zoneKind !== 'rust_plains') {
          w.prevZoneKind = 'fallen_city';
          w.biomeSeamX = Math.max(920, remPx - STATION_BOUND_X + 120);
          enterZone(w, 'rust_plains', 1);
        }
        buildStationMap(w, 'rust_plains', 1, '锈原 · 废弃小站', 'abandoned_halt', remPx, false);
      }

      if (w.stationStreamed && w.stationAnchorX < 220 && w.stationAnchorX > 0) {
        const approachCap = Math.max(30, (w.stationAnchorX / 220) * GEAR_SPEEDS[1]);
        w.trainSpeed = Math.min(w.trainSpeed, approachCap);
      }

      if ((w.stationStreamed && w.stationAnchorX <= 4) || w.legDistance >= w.legTotal) {
        if (!w.stationStreamed) {
          w.prevZoneKind = 'fallen_city';
          w.biomeSeamX = -2000;
          if (w.zoneKind !== 'rust_plains') enterZone(w, 'rust_plains', 1);
          buildStationMap(w, 'rust_plains', 1, '锈原 · 废弃小站', 'abandoned_halt', 0, false);
        }
        w.mode = 'station';
        w.stationIdx = 0;
        w.stats.stationsReached = 1;
        w.gear = 0;
        w.trainSpeed = 0;
        w.legDistance = 0;
        w.stationStreamed = false;
        saveStationSnapshot(w);
        sfx.questDone();
      }
    }

    // Leave Station -> Wasteland leg
    if (w.mode === 'station' && w.selectedRoute) {
      if (w.stationAnchorX < -420 && (w.zoneKind !== w.selectedRoute.zone || w.zoneTier !== w.selectedRoute.tier)) {
        w.prevZoneKind = w.zoneKind;
        w.biomeSeamX = 1120;
        enterZone(w, w.selectedRoute.zone, w.selectedRoute.tier);
      }
      if (w.stationAnchorX < -1480) {
        const route = w.selectedRoute;
        w.mode = 'wasteland';
        w.props = [];
        w.stationRoads = [];
        w.stationRooms = [];
        w.stationWalls = [];
        w.stationBarriers = [];
        w.monsters = w.monsters.filter((m) => m.onTrain);
        w.legDistance = 0;
        w.legTotal = route.distance;
        w.stationStreamed = false;
        w.wavePhase = 'calm';
        w.waveIndex = 0;
        w.omenTimer = 0;
        w.omenLabel = '';
        w.dangerSpawnedInWave = false;
        w.roadsideEventSpawned = 0;
        w.parallelTrainX = null;
        w.wastelandStopTimer = 0;
        // H5: Frequent hazards ONLY in sinking_belt; rare loose rail elsewhere
        w.hazardSpawnTimer = route.zone === 'sinking_belt' ? 28 : 220;
        if (route.zone === 'sinking_belt') {
          w.weather = 'fog';
          w.weatherTimer = 180;
        }
        saveWorld(w);
      }
    }

    // Driving in Wasteland: Wave Pacing (C: calm -> omen -> danger -> calm) & World Roadside Events (H7)
    if (w.mode === 'wasteland') {
      w.legDistance += dm;
      w.wastelandStopTimer = 0;
      const progress = Math.min(1, w.legDistance / Math.max(1, w.legTotal));
      const remPx = Math.max(0, (w.legTotal - w.legDistance) * 18);

      // Trigger 3 structured waves along the 8-12 min leg: ~24%, ~54%, ~80%
      const waveMarks = [0.24, 0.54, 0.8];
      if (w.wavePhase === 'calm' && w.waveIndex < waveMarks.length && progress >= waveMarks[w.waveIndex]) {
        w.wavePhase = 'omen';
        w.omenTimer = 20;
        w.dangerSpawnedInWave = false;
        w.omenLabel =
          w.zoneKind === 'sinking_belt'
            ? '路基传来闷响，浓雾更深了'
            : w.zoneKind === 'ivy_city'
              ? '高架阴影里有东西在跟着列车'
              : '远处荒原传来低沉的嚎叫';
        sfx.omenHowl();
      } else if (w.wavePhase === 'omen') {
        w.omenTimer -= dt;
        if (w.omenTimer <= 0) {
          w.wavePhase = 'danger';
          w.omenTimer = 32;
          w.omenLabel = '';
        }
      } else if (w.wavePhase === 'danger') {
        if (!w.dangerSpawnedInWave && !w.stationStreamed) {
          w.dangerSpawnedInWave = true;
          const count = w.zoneKind === 'monster_wastes' || w.zoneTier >= 3 ? 3 : 2;
          const fromNorth = Math.random() < 0.5;
          for (let i = 0; i < count; i++) {
            const k = pickZoneEnemyKind(w.zoneKind, w.zoneTier, true);
            w.monsters.push(createMonster(k, 420 + i * 65, fromNorth ? -340 : 340, false, w.zoneTier));
          }
          // Occasional crop pest on wave 2
          if (w.waveIndex === 1) {
            for (const car of trainDecks(w)) {
              const pl = car.buildings.find((b) => b.type === 'planter' && b.planted && !b.pestInfested);
              if (pl && Math.random() < 0.35) {
                pl.pestInfested = true;
                break;
              }
            }
          }
        }
        w.omenTimer -= dt;
        if (w.omenTimer <= 0 && w.monsters.filter((m) => !m.onTrain).length === 0) {
          w.wavePhase = 'calm';
          w.waveIndex++;
        }
      }

      // World roadside events (H7, no popups! Appear directly beside tracks)
      if (w.roadsideEventSpawned === 0 && progress >= 0.38 && !w.stationStreamed) {
        w.roadsideEventSpawned = 1;
        const roll = Math.random();
        if (roll < 0.45) {
          // Overturned roadside truck (container players can brake to loot!)
          const inv = createInventory(6);
          addToInventory(inv, 'scrap', 5);
          addToInventory(inv, 'parts', 2);
          addToInventory(inv, 'cookedFood', 1);
          w.props.push({
            uid: uid('ev'),
            kind: 'roadside_wreck',
            mat: 'metal',
            x: 1180,
            y: -175,
            r: 30,
            hp: 55,
            maxHp: 55,
            hitFlash: 0,
            label: '路边翻倒的货车',
            isContainer: true,
            searched: false,
            containerInv: inv,
          });
        } else if (roll < 0.78) {
          w.props.push({
            uid: uid('ev'),
            kind: 'roadside_waver',
            x: 1180,
            y: 175,
            r: 20,
            hp: 999,
            maxHp: 999,
            hitFlash: 0,
            label: '路边挥手的变异者',
            interactOnly: true,
          });
        } else {
          w.props.push({
            uid: uid('ev'),
            kind: 'nameless_graves',
            x: 1180,
            y: -185,
            r: 32,
            hp: 999,
            maxHp: 999,
            hitFlash: 0,
            label: '无字墓群',
            interactOnly: true,
            loreId: `graves_${w.stationIdx}`,
            loreTitle: '沿轨排列的无字墓碑',
            loreText: '数十座低矮石碑顺着铁道排开。碑面干净得反常，连风化的刻痕都没有。',
          });
        }
      } else if (w.roadsideEventSpawned === 1 && progress >= 0.68 && !w.stationStreamed) {
        w.roadsideEventSpawned = 2;
        if (w.stationIdx >= 1) {
          // Uncanny parallel ghost train passes on the far northern horizon!
          w.parallelTrainX = -1100;
        }
      }

      // Stream next station into view
      if (!w.stationStreamed && w.selectedRoute && remPx <= 2200) {
        const dest = w.selectedRoute;
        w.stationStreamed = true;
        w.stationIdx++;
        w.trackHazards = w.trackHazards.filter((h) => h.x < remPx - STATION_BOUND_X - 180);
        buildStationMap(w, dest.zone, dest.tier, dest.stationName, dest.template, remPx, true);
      }

      if (w.stationStreamed && w.stationAnchorX < 240 && w.stationAnchorX > 0) {
        const approachCap = Math.max(32, (w.stationAnchorX / 240) * Math.max(GEAR_SPEEDS[1], w.trainSpeed));
        w.trainSpeed = Math.min(w.trainSpeed, approachCap);
      }

      if (((w.stationStreamed && w.stationAnchorX <= 4) || w.legDistance >= w.legTotal) && w.selectedRoute) {
        const dest = w.selectedRoute;
        if (!w.stationStreamed) {
          w.stationIdx++;
          buildStationMap(w, dest.zone, dest.tier, dest.stationName, dest.template, 0, true);
        }
        w.mode = 'station';
        w.stats.stationsReached++;
        w.gear = 0;
        w.trainSpeed = 0;
        w.trackHazards = [];
        w.wastelandStopTimer = 0;
        w.stationStreamed = false;
        w.wavePhase = 'calm';
        w.availableRoutes = buildNextRoutes(w.stationIdx, w.endlessMode);
        w.selectedRoute = null;
        saveStationSnapshot(w); // Station auto-checkpoint (#5)
        sfx.questDone();
      }
    }
  } else if (w.mode === 'wasteland') {
    // Kept advantage: stopping in the wasteland draws siege pressure!
    w.wastelandStopTimer += dt;
    if (w.wastelandStopTimer > 5.0) {
      w.wastelandSiegeCd -= dt;
      if (w.wastelandSiegeCd <= 0 && w.monsters.length < 10) {
        w.wastelandSiegeCd = 11.0;
        const count = 2;
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
          w.monsters.push(createMonster(pickZoneEnemyKind(w.zoneKind, w.zoneTier), Math.cos(ang) * 520, Math.sin(ang) * 380, false, w.zoneTier));
        }
        sfx.omenHowl();
      }
    }
  }

  // 4. Buildings Update (#2 Farming, #4 Turrets consume ammo & 260px range, Timed Facility Processing!)
  const isRaining = w.weather === 'rainstorm';
  for (const car of trainDecks(w)) {
    const role = getCarriageRole(car);
    for (const b of car.buildings) {
      b.hitFlash = Math.max(0, (b.hitFlash ?? 0) - dt);
      const c = getTileCenter(b.carIdx, b.col, b.row);

      // #2 Farming: 5-6 min when watered, STOPS when unwatered!
      if (b.type === 'planter' && b.planted && (b.growth ?? 0) < 100 && !b.pestInfested) {
        if (isRaining) b.watered = Math.max(b.watered ?? 0, 15);
        // T2 iron planter auto-waters if train has any water/dirtyWater
        if (b.tier >= 2 && (b.watered ?? 0) <= 0) {
          if (getItemCount(w, 'dirtyWater') > 0) {
            spendCost(w, { dirtyWater: 1 });
            b.watered = 185;
          } else if (getItemCount(w, 'water') > 0) {
            spendCost(w, { water: 1 });
            b.watered = 185;
          }
        }
        if ((b.watered ?? 0) > 0) {
          const coldMult =
            w.weather === 'blizzard' && b.tier < 2 && !isCarSealed(w, b.carIdx) && role !== 'greenhouse' ? 0.5 : 1.0;
          const sandMult = w.weather === 'sandstorm' && !isCarSealed(w, b.carIdx) ? 0.6 : 1.0;
          const tierMult = b.tier >= 2 ? 1.2 : 1.0;
          const greenMult = role === 'greenhouse' ? 1.25 : 1.0;
          b.watered = Math.max(0, (b.watered ?? 0) - dt);
          b.growth = Math.min(100, (b.growth ?? 0) + PLANTER_GROWTH_WATERED * coldMult * sandMult * tierMult * greenMult * dt);
        }
      }

      if (b.type === 'rain_collector' && isRaining) {
        b.storedWater = Math.min(6, (b.storedWater ?? 0) + 0.35 * dt);
      }

      // Timed facility processing (Campfire / Stove / Filter Barrel, G2 + U8)
      if (b.processRecipeId && (b.processDuration ?? 0) > 0) {
        const speedMult = (b.tier >= 2 ? 1.25 : 1.0) * (role === 'workshop' ? 1.3 : 1.0);
        b.processProgress = (b.processProgress ?? 0) + (100 / b.processDuration!) * speedMult * dt;
        if (b.type === 'campfire' && Math.random() < dt * 4) {
          spawnParticles(w, c.x, c.y - 6, '#e6a04c', 1, 35);
        }
        if (b.processProgress >= 100) {
          const rec = CRAFT_RECIPES.find((r) => r.id === b.processRecipeId);
          if (rec) {
            for (const [k, v] of Object.entries(rec.output)) {
              if ((v ?? 0) > 0) giveItem(w, k as ResourceKey, v!, true, c);
            }
          }
          sfx.pickup();
          const nextId = b.processQueue && b.processQueue.length > 0 ? b.processQueue.shift()! : null;
          if (nextId) {
            const nextRec = CRAFT_RECIPES.find((r) => r.id === nextId);
            b.processRecipeId = nextId;
            b.processProgress = 0;
            b.processDuration = nextRec?.processTime ?? 10;
          } else {
            b.processRecipeId = null;
            b.processProgress = 0;
            b.processDuration = 0;
          }
        }
      }

      if (b.onFire) {
        b.hp -= 3.0 * dt;
        if (Math.random() < 0.18) spawnParticles(w, c.x, c.y, '#e66c38', 1, 45);
      }

      // #4 Turret balance: range 260px, consumes ammo (T1 bolts / T2 ammo)!
      if (b.type === 'turret') {
        const cd = Number.isFinite(b.turretCooldown) ? (b.turretCooldown as number) : 0;
        b.turretCooldown = Math.max(0, cd - dt);
        const ammoKey: ResourceKey = b.tier >= 2 ? 'ammo' : 'bolts';
        const hasAmmo = getItemCount(w, ammoKey) > 0;
        b.turretOutOfAmmo = !hasAmmo;
        if (!hasAmmo) continue;

        let best: MonsterEntity | null = null;
        let bestD = TURRET_RANGE;
        for (const m of w.monsters) {
          if (m.hp <= 0) continue;
          const d = Math.hypot(m.x - c.x, m.y - c.y);
          if (d < bestD) {
            bestD = d;
            best = m;
          }
        }
        if (best) {
          const ang = Math.atan2(best.y - c.y, best.x - c.x);
          b.turretAngle = ang;
          if (b.turretCooldown <= 0) {
            spendCost(w, { [ammoKey]: 1 });
            const baseCd = b.tier >= 2 ? 0.65 : 1.05;
            b.turretCooldown = role === 'fortress' ? baseCd * 0.85 : baseCd;
            w.projectiles.push({
              x: c.x + Math.cos(ang) * 20,
              y: c.y + Math.sin(ang) * 20,
              vx: Math.cos(ang) * 620,
              vy: Math.sin(ang) * 620,
              dmg: b.tier >= 2 ? 16 : 14,
              ttl: 0.55,
              fromTurret: true,
              kind: b.tier >= 2 ? 'turret' : 'bolt',
            });
            if (b.tier >= 2) sfx.turret();
            else sfx.crossbow();
            spawnParticles(w, c.x + Math.cos(ang) * 20, c.y + Math.sin(ang) * 20, '#d9b15f', 3, 110, ang);
          }
        }
      }
    }

    const prevLen = car.buildings.length;
    car.buildings = car.buildings.filter((b) => {
      if (b.hp <= 0) {
        const c = getTileCenter(b.carIdx, b.col, b.row);
        if (w.openChestUid === b.uid) w.openChestUid = null;
        if (w.openFacilityUid === b.uid) w.openFacilityUid = null;
        if (b.chestGrid) {
          for (const s of b.chestGrid.slots) if (s && s.count > 0) spawnPickup(w, s.key, s.count, c.x, c.y, true);
        }
        spawnParticles(w, c.x, c.y, '#cc554c', 12, 130);
        sfx.crash();
        return false;
      }
      return true;
    });
    if (car.buildings.length !== prevLen) {
      w.boilerMax = getCoreMaxCapacity(w);
      syncFortressHullBonus(car);
    }
  }

  // 5. Track Hazards (H5: Frequent ONLY in sinking_belt; rare loose rail elsewhere)
  if (w.mode === 'wasteland' && !w.stationStreamed && w.trainSpeed > 15) {
    w.hazardSpawnTimer -= dt;
    if (w.hazardSpawnTimer <= 0 && w.legTotal - w.legDistance > 160) {
      if (w.zoneKind === 'sinking_belt') {
        w.hazardSpawnTimer = Math.max(22, 42 - w.zoneTier * 4) + Math.random() * 14;
        const brokenChance = w.zoneTier <= 1 ? 0.1 : w.zoneTier === 2 ? 0.45 : 0.65;
        const isBroken = Math.random() < brokenChance;
        w.trackHazards.push({
          uid: uid('hz'),
          kind: isBroken ? 'broken' : 'loose',
          x: 1260,
          width: isBroken ? 92 : 160,
          triggered: false,
          repaired: false,
          alerted: false,
        });
      } else {
        // Ordinary zones: rails are mostly intact (at most occasional loose rail, no random breaks!)
        w.hazardSpawnTimer = 260 + Math.random() * 140;
        w.trackHazards.push({
          uid: uid('hz'),
          kind: 'loose',
          x: 1260,
          width: 150,
          triggered: false,
          repaired: false,
          alerted: false,
        });
      }
    }
  }

  updateNests(w, dt, nowNight);
  autoEquipNewRangedWeapons(w);
  updateNestEruptions(w, dt);

  // Night waves (only if wasteland OR station still has live monster nests, H3!)
  if (nowNight && w.mode !== 'city_escape' && w.nightWavesLeft > 0) {
    w.nightWaveTimer -= dt;
    if (w.nightWaveTimer <= 0 && w.monsters.length < 7) {
      w.nightWavesLeft--;
      w.nightWaveTimer = 110;
      if (w.mode !== 'station' || hasLiveNests) {
        const count = 2;
        const fromNorth = Math.random() < 0.5;
        for (let i = 0; i < count; i++) {
          const kind = i === 0 ? 'nightwalker' : pickZoneEnemyKind(w.zoneKind, w.zoneTier);
          const offX = w.cameraX + (Math.random() < 0.5 ? -860 - i * 45 : 860 + i * 45);
          const offY = fromNorth ? -560 : 560;
          w.monsters.push(createMonster(kind, offX, offY, false, w.zoneTier));
        }
        sfx.omenHowl();
      }
    }
  }

  // Night No-Lantern Darkness Threat (kept advantage!)
  const outsideInDarkNoLantern =
    nowNight && w.mode !== 'city_escape' && !isPointOnTrain(w, p.x, p.y, 18) && !playerHasActiveLantern(w);
  if (outsideInDarkNoLantern) {
    const dist = distToTrainDeck(w, p.x, p.y);
    w.darkThreatLevel = Math.min(1, dist / 340);
    w.darkThreatTimer -= dt;
    if (w.darkThreatTimer <= 0 && w.monsters.length < 12) {
      w.darkThreatTimer = Math.max(3.5, 9.0 - dist / 65);
      const a = Math.random() * Math.PI * 2;
      w.monsters.push(createMonster('nightwalker', p.x + Math.cos(a) * 280, p.y + Math.sin(a) * 280, false, w.zoneTier));
      sfx.omenHowl();
    }
  } else {
    w.darkThreatLevel = Math.max(0, w.darkThreatLevel - dt * 2);
    w.darkThreatTimer = Math.min(6, w.darkThreatTimer + dt * 0.5);
  }

  // Track Hazard Collisions (No radar popup — players see cracks on tracks & distant signal posts!)
  for (const h of w.trackHazards) {
    if (!h.triggered && !h.repaired && h.x <= LOCO_W && h.x + h.width >= 40) {
      if (h.kind === 'loose' && w.trainSpeed > GEAR_SPEEDS[2] + 15) {
        h.triggered = true;
        w.shake = 12;
        w.locoHp = Math.max(10, w.locoHp - 20);
        w.trainSpeed *= 0.45;
        w.gear = 1;
        for (const car of w.flatbeds) {
          if (car.couplerKind === 'crude') car.couplerHp = Math.max(5, car.couplerHp - 22);
        }
        sfx.crash();
        spawnParticles(w, LOCO_W, 0, '#e6a04c', 16, 170);
      } else if (h.kind === 'broken' && w.trainSpeed > 35) {
        h.triggered = true;
        h.repaired = true;
        w.shake = 18;
        w.locoHp = Math.max(10, w.locoHp - 38);
        w.trainSpeed = 0;
        w.gear = 0;
        sfx.crash();
        spawnParticles(w, LOCO_W, 0, '#cc554c', 22, 210);
      }
    }
  }
  w.trackHazards = w.trackHazards.filter((h) => h.x + h.width > -900);
  if (w.mode !== 'station') {
    w.props = w.props.filter((pr) => pr.hp > 0 && (pr.x > -2400 || Math.hypot(pr.x - p.x, pr.y - p.y) < 1600));
  } else {
    w.props = w.props.filter((pr) => pr.hp > 0);
  }

  // 6. Decoy Timer
  if (w.decoyPos) {
    w.decoyPos.ttl -= dt;
    if (w.decoyPos.ttl <= 0) w.decoyPos = null;
  }

  // 7. Differentiated Monster AI (H1/H2: windup, charger stun, burrower light fear, nightwalker light orbit, mutant_raider ranged!)
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.attackCd = Math.max(0, m.attackCd - dt);
    if ((m.alertedByNoise ?? 0) > 0) m.alertedByNoise = Math.max(0, (m.alertedByNoise ?? 0) - dt);

    // Bumper ram
    if (w.hasBumper && w.trainSpeed >= GEAR_SPEEDS[3] - 25 && Math.hypot(m.x - (LOCO_W + 18), m.y) < 42) {
      damageMonster(w, m, w.bumperTier >= 2 ? 999 : 45, 260, 0);
      w.shake = 8;
      if (m.hp <= 0) continue;
    }

    // The moving nose shoves whatever stands in front of it (world scroll would otherwise push
    // a monster straight through the locomotive's front plating and onto the deck).
    if (!m.onTrain && w.trainSpeed > 0 && m.x > LOCO_W - 14 && m.x < LOCO_W + m.r + 2 && Math.abs(m.y) < HALF_H + m.r * 0.5) {
      m.x = LOCO_W + m.r + 3;
      m.y += (m.y >= 0 ? 1 : -1) * 70 * dt;
    }

    // Sandworm emergence telegraph
    if (m.aiState === 'emerge') {
      m.stateTimer -= dt;
      if (Math.random() < dt * 8) spawnParticles(w, m.x, m.y, '#8f7d65', 2, 65);
      if (m.stateTimer <= 0) m.aiState = 'chase';
      continue;
    }

    // Stunned (e.g., Charger slammed a wall/hull!)
    if (m.aiState === 'stunned') {
      m.stateTimer -= dt;
      m.vx *= 0.85;
      m.vy *= 0.85;
      if (m.stateTimer <= 0) m.aiState = 'chase';
      continue;
    }

    // Charger straight charge burst
    if (m.aiState === 'charge') {
      m.stateTimer -= dt;
      const nx = m.x + (m.chargeDirX ?? 1) * 320 * dt;
      const ny = m.y + (m.chargeDirY ?? 0) * 320 * dt;
      const hitHull = findBlockingHull(w, nx, ny, m.r);
      const hitWall = w.stationWalls.some((wl) => nx + m.r > wl.x && nx - m.r < wl.x + wl.w && ny + m.r > wl.y && ny - m.r < wl.y + wl.h);
      if (hitHull || hitWall) {
        m.aiState = 'stunned';
        m.stateTimer = 2.6;
        w.shake = Math.max(w.shake, 7);
        sfx.crash();
        spawnParticles(w, m.x, m.y, '#d9b15f', 12, 130);
        addFloat(w, m.x, m.y - 24, '晕眩', '#d9b15f');
        if (hitHull) hitHull.panel.hp = Math.max(0, hitHull.panel.hp - m.dps);
        continue;
      }
      m.x = nx;
      m.y = ny;
      if (Math.hypot(p.x - m.x, p.y - m.y) < m.r + 18 && p.invulnTimer <= 0) {
        const reduced = Math.max(3, Math.round(m.dps * 1.25 * (1 - armor.dr)));
        p.hp = Math.max(0, p.hp - reduced);
        p.hitFlash = 0.22;
        p.invulnTimer = 0.5;
        w.holdAction = null;
        w.shake = Math.max(w.shake, 9);
        sfx.hitFlesh();
        addFloat(w, p.x, p.y - 20, `-${reduced}`, '#e07a7a');
        m.aiState = 'chase';
        m.attackCd = 1.4;
      } else if (m.stateTimer <= 0) {
        m.aiState = 'chase';
        m.attackCd = 1.2;
      }
      continue;
    }

    // Active attack windup telegraph (readable 0.5-0.85s dodge!)
    if (m.windupTimer > 0) {
      m.windupTimer -= dt;
      if (m.windupTimer <= 0) {
        if (m.kind === 'charger') {
          m.aiState = 'charge';
          m.stateTimer = 0.65;
          m.chargeDirX = Math.cos(m.windupAngle);
          m.chargeDirY = Math.sin(m.windupAngle);
          continue;
        }
        m.attackCd = 0.95;
        m.vx += Math.cos(m.windupAngle) * 125;
        m.vy += Math.sin(m.windupAngle) * 125;
        const distNow = Math.hypot(p.x - m.x, p.y - m.y);
        if (!w.decoyPos && p.invulnTimer <= 0 && distNow <= m.windupRange + 8) {
          const reduced = Math.max(2, Math.round(m.dps * (1 - armor.dr)));
          p.hp = Math.max(0, p.hp - reduced);
          p.hitFlash = 0.22;
          p.armorDurability = Math.max(0, p.armorDurability - 1.2);
          w.holdAction = null;
          w.shake = Math.max(w.shake, 7);
          sfx.hitFlesh();
          addFloat(w, p.x, p.y - 20, `-${reduced}`, '#e07a7a');
        } else if (!w.decoyPos && distNow <= m.windupRange + 95) {
          sfx.dodge();
          addFloat(w, p.x, p.y - 24, '闪避', '#7bc985');
        }
      }
      m.vx *= 0.8;
      m.vy *= 0.8;
      continue;
    }

    // Fleeing low-HP hound
    if (m.aiState === 'flee') {
      m.stateTimer -= dt;
      const fa = Math.atan2(m.y - p.y, m.x - p.x);
      m.x += Math.cos(fa) * m.speed * 1.1 * dt;
      m.y += Math.sin(fa) * m.speed * 1.1 * dt;
      if (m.stateTimer <= 0) m.aiState = 'wander';
      continue;
    }

    let tx = p.x;
    let ty = p.y;
    let targetBuilding: PlacedBuilding | null = null;
    const distToPlayer = Math.hypot(p.x - m.x, p.y - m.y);
    const playerLit = playerHasActiveLantern(w);

    if (w.decoyPos) {
      tx = w.decoyPos.x;
      ty = w.decoyPos.y;
    } else if (m.kind === 'nightwalker' && playerLit && distToPlayer < 210) {
      // H2: Nightwalker circles outside lantern light, closes in if light is off!
      const orbitA = Math.atan2(m.y - p.y, m.x - p.x) + 0.85;
      tx = p.x + Math.cos(orbitA) * 235;
      ty = p.y + Math.sin(orbitA) * 235;
    } else if (m.kind === 'burrower') {
      for (const car of trainDecks(w)) {
        const pl = car.buildings.find((b) => b.type === 'planter');
        if (pl) {
          targetBuilding = pl;
          const c = getTileCenter(pl.carIdx, pl.col, pl.row);
          tx = c.x;
          ty = c.y;
          break;
        }
      }
    } else if (m.kind === 'mutant_raider' && distToPlayer < 260 && distToPlayer > 110 && !m.onTrain) {
      // H2: Mutant raider holds distance and fires shots!
      tx = m.x;
      ty = m.y;
      if (m.attackCd <= 0) {
        m.attackCd = 1.85;
        const a = Math.atan2(p.y - m.y, p.x - m.x);
        w.projectiles.push({
          x: m.x + Math.cos(a) * 16,
          y: m.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 420,
          vy: Math.sin(a) * 420,
          dmg: m.dps,
          ttl: 0.9,
          fromTurret: false,
          fromEnemy: true,
          kind: 'enemy_shot',
        });
        sfx.shotgun();
      }
    } else if (
      (w.stationStreamed || (!nowNight && w.mode === 'station')) &&
      !isPointOnTrain(w, m.x, m.y) &&
      (m.alertedByNoise ?? 0) <= 0 &&
      (w.stationStreamed || distToPlayer > (playerLit ? 310 : 250))
    ) {
      // Passive daytime nest wander until player gets close or makes noise!
      tx = m.x + Math.cos(w.time * 0.7 + m.r) * 22;
      ty = m.y + Math.sin(w.time * 0.7 + m.r) * 22;
    }

    let steeringToOpenEntry = false;
    if (!m.onTrain && getCarIndexAtPoint(w, tx, ty) !== null) {
      const wp = getMonsterOpenEntryWaypoint(w, m);
      if (wp) {
        tx = wp.x;
        ty = wp.y;
        steeringToOpenEntry = true;
      }
    }

    const dx = tx - m.x;
    const dy = ty - m.y;
    const dist = Math.hypot(dx, dy);

    m.vx *= 0.85;
    m.vy *= 0.85;

    let stepX = m.vx * dt;
    let stepY = m.vy * dt;
    if (dist > 6) {
      const lightFear = m.kind === 'burrower' && playerLit && distToPlayer < 170 ? 0.55 : 1.0;
      const moveSp = (!m.onTrain && w.trainSpeed > 0 ? m.speed + 145 : m.speed) * (nowNight ? 1.12 : 1.0) * lightFear;
      stepX += (dx / dist) * moveSp * dt;
      stepY += (dy / dist) * moveSp * dt;
    }

    // Sub-step fast movers (chasing a moving train adds +145 px/s) so they can't tunnel through hull panels
    let nx = m.x + stepX;
    let ny = m.y + stepY;
    let hitHull: ReturnType<typeof findBlockingHull> = null;
    const sub = Math.max(1, Math.ceil(Math.hypot(stepX, stepY) / Math.max(3, (m.r - 2) * 0.6)));
    for (let si = 1; si <= sub; si++) {
      const sx = m.x + (stepX * si) / sub;
      const sy = m.y + (stepY * si) / sub;
      const hh = findBlockingHull(w, sx, sy, m.r - 2);
      if (hh) {
        hitHull = hh;
        nx = sx;
        ny = sy;
        break;
      }
    }
    if (hitHull) {
      if (steeringToOpenEntry) {
        if (!findBlockingHull(w, nx, m.y, m.r - 2)) m.x = nx;
        else if (!findBlockingHull(w, m.x, ny, m.r - 2)) m.y = ny;
      } else if (m.attackCd <= 0) {
        m.attackCd = m.kind === 'clinger' ? 0.65 : 0.85;
        hitHull.panel.hp = Math.max(0, hitHull.panel.hp - m.dps);
        hitHull.panel.hitFlash = 0.16;
        sfx.hitMetal();
        spawnParticles(w, hitHull.cx, hitHull.cy, '#e68c4c', 5, 95);
        if (hitHull.panel.hp <= 0) {
          sfx.breakMetal();
          w.shake = Math.max(w.shake, 7);
          spawnParticles(w, hitHull.cx, hitHull.cy, '#cc554c', 15, 150);
        }
      }
    } else {
      let hitWall: PlacedBuilding | null = null;
      for (const car of trainDecks(w)) {
        for (const b of car.buildings) {
          if (!BUILDINGS[b.type].solid || (b.type === 'door' && b.doorOpen)) continue;
          const c = getTileCenter(b.carIdx, b.col, b.row);
          if (Math.hypot(nx - c.x, ny - c.y) < TILE * 0.54 + m.r) {
            hitWall = b;
            break;
          }
        }
        if (hitWall) break;
      }

      if (hitWall) {
        if (m.attackCd <= 0) {
          m.attackCd = 0.82;
          hitWall.hp -= m.dps;
          hitWall.hitFlash = 0.15;
          if (hitWall.hp < hitWall.maxHp * 0.3 && Math.random() < 0.18) hitWall.onFire = true;
          const c = getTileCenter(hitWall.carIdx, hitWall.col, hitWall.row);
          sfx.hitMetal();
          spawnParticles(w, c.x, c.y, '#e68c4c', 4, 90);
        }
      } else {
        const blockedByStation =
          w.stationWalls.some((wl) => nx + m.r > wl.x && nx - m.r < wl.x + wl.w && ny + m.r > wl.y && ny - m.r < wl.y + wl.h) ||
          w.stationBarriers.some((br) => !br.opened && nx + m.r > br.x && nx - m.r < br.x + br.w && ny + m.r > br.y && ny - m.r < br.y + br.h);
        if (!blockedByStation) {
          m.x = nx;
          m.y = ny;
          if (isPointOnTrain(w, m.x, m.y, -4)) m.onTrain = true;
        }
      }
    }

    if (targetBuilding && dist < 28 && m.attackCd <= 0) {
      m.attackCd = 0.9;
      targetBuilding.hp -= m.dps;
      targetBuilding.hitFlash = 0.15;
      if (targetBuilding.planted) {
        targetBuilding.planted = false;
        targetBuilding.growth = 0;
      }
      sfx.hitFlesh();
    }

    // Trigger telegraphed windup (charger triggers at mid-range 190px; melee at close range)
    if (!w.decoyPos && m.attackCd <= 0) {
      if (m.kind === 'charger' && distToPlayer < 190 && distToPlayer > 55) {
        m.windupMax = 0.85;
        m.windupTimer = 0.85;
        m.windupAngle = Math.atan2(p.y - m.y, p.x - m.x);
        m.windupRange = 180;
        sfx.windup();
      } else if (distToPlayer < m.r + 24) {
        m.windupMax = m.kind === 'sandworm' ? 0.65 : 0.52;
        m.windupTimer = m.windupMax;
        m.windupAngle = Math.atan2(p.y - m.y, p.x - m.x);
        m.windupRange = m.r + 34;
        sfx.windup();
      }
    }
  }
  w.monsters = w.monsters.filter((m) => m.hp > 0 && (m.x > -2400 || Math.hypot(m.x - p.x, m.y - p.y) < 1600));

  // 8. Projectiles (Player bolts/pellets/rifle + Enemy raider shots!)
  for (const pr of w.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.ttl -= dt;
    if (pr.fromEnemy) {
      if (p.invulnTimer <= 0 && Math.hypot(p.x - pr.x, p.y - pr.y) < 16) {
        const reduced = Math.max(2, Math.round(pr.dmg * (1 - armor.dr)));
        p.hp = Math.max(0, p.hp - reduced);
        p.hitFlash = 0.2;
        p.armorDurability = Math.max(0, p.armorDurability - 1);
        w.shake = Math.max(w.shake, 5);
        sfx.hitFlesh();
        addFloat(w, p.x, p.y - 20, `-${reduced}`, '#e07a7a');
        pr.ttl = 0;
      }
      continue;
    }

    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      if (pr.hitUids && pr.hitUids.includes(m.uid)) continue;
      if (Math.hypot(m.x - pr.x, m.y - pr.y) < m.r + 8) {
        damageMonster(w, m, pr.dmg, pr.vx * 0.1, pr.vy * 0.1);
        if (pr.hitUids) pr.hitUids.push(m.uid);
        // Crossbow bolts have 45% recovery chance (G4!)
        if (pr.kind === 'bolt' && !pr.fromTurret && Math.random() < 0.45) {
          spawnPickup(w, 'bolts', 1, m.x, m.y, m.onTrain);
        }
        if ((pr.pierceLeft ?? 0) > 0) {
          pr.pierceLeft = (pr.pierceLeft ?? 1) - 1;
        } else {
          pr.ttl = 0;
          break;
        }
      }
    }
  }
  w.projectiles = w.projectiles.filter((pr) => pr.ttl > 0);

  // 9. Ground Pickups Magnet + Flying Pickups + Loot Feed (U2 + U4)
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const pk = w.pickups[i];
    if (pk.amount <= 0) continue;
    pk.age += dt;
    pk.vx *= 0.86;
    pk.vy *= 0.86;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;

    if (pk.age >= 0.22) {
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 140 && canAcceptItem(w, pk.key)) {
        if (dist <= 28) {
          quickCollectPickup(w, pk.uid);
        } else {
          const pull = Math.min(dist, (330 + (140 - dist) * 2.2) * dt);
          pk.x += (dx / dist) * pull;
          pk.y += (dy / dist) * pull;
        }
      }
    }
  }
  if (w.mode !== 'station') {
    w.pickups = w.pickups.filter((pk) => pk.amount > 0 && (pk.x > -2400 || Math.hypot(pk.x - p.x, pk.y - p.y) < 1600));
  } else {
    w.pickups = w.pickups.filter((pk) => pk.amount > 0);
  }

  for (const fp of w.flyingPickups) fp.progress += dt * 4.2;
  w.flyingPickups = w.flyingPickups.filter((fp) => fp.progress < 1);

  for (const lf of w.lootFeed) lf.timer -= dt;
  w.lootFeed = w.lootFeed.filter((lf) => lf.timer > 0);

  // 10. Particles & Floating Texts
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.91;
    pt.vy *= 0.91;
    pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);

  for (const fl of w.floats) {
    // Long-lived notices (instructions) barely drift at first so they stay readable
    fl.y -= (fl.life > 1.2 ? 5 : 26) * dt;
    fl.life -= dt;
  }
  w.floats = w.floats.filter((fl) => fl.life > 0);

  // 11. Camera Follow & Hints
  const targetCamX = p.x + (w.trainSpeed > 50 ? 110 : 0);
  const targetCamY = p.y;
  w.cameraX += (targetCamX - w.cameraX) * Math.min(1, dt * 6);
  w.cameraY += (targetCamY - w.cameraY) * Math.min(1, dt * 6);

  updateActiveHint(w, input);

  // 12. Check Death (Station Save Rollback!)
  if (w.locoHp <= 0) {
    handlePlayerDeath(w, '机车车头损毁');
  } else if (p.hp <= 0) {
    handlePlayerDeath(w, p.bodyTemp <= 0 ? '失温昏迷' : p.hunger <= 0 ? '饥饿力竭' : p.thirst <= 0 ? '脱水昏迷' : '重伤倒下');
  }
}

function getMonsterOpenEntryWaypoint(w: WorldState, m: MonsterEntity): { x: number; y: number } | null {
  const all = getAllHullPanels(w);
  let entries = all.filter(({ panel }) => panel.isDoor && panel.doorOpen && panel.hp > 0);
  if (entries.length === 0) {
    entries = all.filter(({ carIdx, panel }) => panel.hp <= 0 && !isHullPassage(w, carIdx, panel));
  }
  if (entries.length === 0) return null;

  let best = entries[0];
  let bestSeg = getHullSegment(best.carIdx, best.panel);
  let bestD = Math.hypot(m.x - bestSeg.cx, m.y - bestSeg.cy);
  for (let i = 1; i < entries.length; i++) {
    const seg = getHullSegment(entries[i].carIdx, entries[i].panel);
    const d = Math.hypot(m.x - seg.cx, m.y - seg.cy);
    if (d < bestD) {
      bestD = d;
      best = entries[i];
      bestSeg = seg;
    }
  }

  const side = best.panel.side;
  const trainLeft = (w.flatbeds.length > 0 ? getCarBounds(w.flatbeds.length - 1).left : 0) - 34;
  const trainRight = LOCO_W + 34;

  if (side === 'top' || side === 'bottom') {
    const dir = side === 'top' ? -1 : 1;
    const outY = bestSeg.cy + dir * 26;
    const inY = bestSeg.cy - dir * 28;
    const sameSide = side === 'top' ? m.y <= -HALF_H + 4 : m.y >= HALF_H - 4;
    if (sameSide) {
      if (Math.abs(m.x - bestSeg.cx) <= 16) return { x: bestSeg.cx, y: inY };
      return { x: bestSeg.cx, y: side === 'top' ? Math.min(m.y, outY) : Math.max(m.y, outY) };
    }
    const endX = Math.abs(m.x - trainLeft) < Math.abs(m.x - trainRight) ? trainLeft : trainRight;
    if (m.x > trainLeft + 10 && m.x < trainRight - 10) {
      return { x: endX, y: m.y >= 0 ? Math.max(m.y, HALF_H + 28) : Math.min(m.y, -HALF_H - 28) };
    }
    return { x: endX, y: outY };
  }

  const dirX = side === 'left' ? -1 : 1;
  const outX = bestSeg.cx + dirX * 26;
  const inX = bestSeg.cx - dirX * 28;
  if (Math.abs(m.y - bestSeg.cy) <= 16) return { x: inX, y: bestSeg.cy };
  return { x: outX, y: bestSeg.cy };
}

export { pushLootFeed, spawnFlyingPickup };
