import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const m = await server.ssrLoadModule('/src/world.ts');
  const invMod = await server.ssrLoadModule('/src/inventory.ts');

  const idleInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseDown: false,
  };

  // Helper: advance opening city escape until train arrives at Station 1 (Exile Lands)
  function advanceToStation1(w) {
    let ticks = 0;
    while (w.mode === 'city_escape' && ticks < 2000) {
      m.stepWorld(w, idleInput, 0.05);
      ticks++;
    }
    return ticks;
  }

  // 1. Opening starts slowly escaping the burning Great City with NO enemies, then enters Exile Lands Station 1
  const w = m.createInitialWorld();
  assert.equal(w.mode, 'city_escape', 'Game begins escaping the burning Great City');
  assert.equal(w.zoneKind, 'fallen_city', 'Opening zone is Fallen Great City');
  assert.equal(w.monsters.length, 0, 'No bandits or monsters during opening city escape');
  assert.equal(w.flatbeds[0].buildings.length, 0, 'Car 0 starts empty for freeform building');
  assert.equal(w.lanternHolder, 'train', 'Lantern starts hanging on locomotive hook');

  const escapeTicks = advanceToStation1(w);
  assert.ok(escapeTicks > 100, `City escape should travel a meaningful distance before reaching Exile Lands, ticks=${escapeTicks}`);
  assert.equal(w.mode, 'station', 'Arrives cleanly at Station 1 after escaping city');
  assert.equal(w.zoneKind, 'exile', 'Station 1 is in Exile Lands');
  assert.equal(w.zoneTier, 1, 'Station 1 is Danger Tier I');
  assert.ok(w.stationRoads.length >= 6 && w.stationRooms.length >= 9 && w.stationBarriers.length >= 9, 'City station has full road network & 9+ multi-tier lootable buildings');
  assert.ok(m.STATION_BOUND_X >= 1200 && m.STATION_BOUND_Y >= 900, 'Station covers full city scale');
  const bandits = w.monsters.filter((x) => x.kind === 'bandit');
  const beasts = w.monsters.filter((x) => x.kind !== 'bandit');
  assert.ok(bandits.length >= 2 && beasts.length >= 1, 'Exile Lands station has dehumanized bandits + monsters');

  // 2. Unbounded Lost World exploration (NO air walls!), disembarkation ceremony & NO walk-over instant harvesting!
  const crate = w.props.find((p) => p.kind === 'wood_crate');
  const woodBeforeWalk = m.getItemCount(w, 'wood');
  w.player.x = crate.x;
  w.player.y = crate.y;
  m.stepWorld(w, idleInput, 0.05);
  assert.equal(m.getItemCount(w, 'wood'), woodBeforeWalk, 'Walking over crate must NOT auto-vacuum materials');
  assert.ok(crate.hp > 0, 'Crate remains intact until harvested with tool');
  assert.equal(w.disembarkedAtStation, true, 'Stepping off train at station triggers Lost World disembarkation ceremony');
  assert.ok(w.lostWorldBanner && w.lostWorldBanner.rumors.length >= 2, 'Lost World ceremonial title & treasure rumors appear');

  // Player can walk past old STATION_BOUND_Y with ZERO invisible air walls, streaming outer Lost World chunks!
  const propsBeforeOuter = w.props.length;
  w.player.x = 0;
  w.player.y = -m.STATION_BOUND_Y - 120;
  for (let i = 0; i < 40; i++) m.stepWorld(w, { ...idleInput, up: true }, 0.05);
  assert.ok(w.player.y < -m.STATION_BOUND_Y - 300, `Player explores freely beyond old station wall, got y=${w.player.y}`);
  assert.ok(w.props.length > propsBeforeOuter, 'Exploring deep into unbounded Lost World discovers outer ruins & treasures');

  // 2b. No auto-pickup: walking over dropped ground loot keeps it on ground until manually picked & placed!
  const woodCountBeforeDrop = m.getItemCount(w, 'wood');
  w.pickups.push({ uid: 'pk_test_manual', key: 'wood', amount: 2, x: w.player.x, y: w.player.y, vx: 0, vy: 0, onTrain: false, age: 1.0 });
  for (let i = 0; i < 10; i++) m.stepWorld(w, idleInput, 0.05);
  assert.equal(m.getItemCount(w, 'wood'), woodCountBeforeDrop, 'Walking over ground loot must NOT auto-pickup into backpack');
  assert.ok(w.pickups.some((pk) => pk.uid === 'pk_test_manual'), 'Ground loot stays on the ground awaiting manual pickup');
  assert.equal(m.pickUpGroundLoot(w, 'pk_test_manual'), true, 'Manually pick up ground wood onto cursor hand');
  assert.equal(w.heldItem?.fromSource, 'ground');
  assert.equal(m.placeHeldItemAt(w, 'backpack', 0, 0), true, 'Manually place ground wood into POE2 backpack grid');
  if (w.heldItem) m.returnHeldItemSafely(w);
  assert.equal(m.getItemCount(w, 'wood'), woodCountBeforeDrop + 2, 'Manual placement adds wood cleanly into backpack');

  // 2c. POE2 Spatial Grid Backpack: manual pick up, rotate, place & upgrade tiers (6x4 -> 8x5 -> 10x5 -> 12x6)
  assert.equal(w.backpackLevel, 1);
  assert.equal(w.backpack.cols, 6);
  assert.equal(w.backpack.rows, 4);
  const railItem = w.backpack.items.find((it) => it.key === 'rails');
  assert.ok(railItem, 'Starting grid backpack contains 3x1 rail segment');
  assert.equal(m.pickUpGridItem(w, 'backpack', railItem.uid), true, 'Pick up rail item into cursor hand');
  assert.ok(w.heldItem && w.heldItem.key === 'rails');
  const rotBefore = w.heldItem.rotated;
  m.rotateHeldItem(w);
  assert.notEqual(w.heldItem.rotated, rotBefore, 'Rotating held 3x1 rail flips orientation to 1x3');
  assert.equal(m.placeHeldItemAt(w, 'backpack', 5, 1), true, 'Manually place rotated 1x3 rail on right edge (POE2 swaps fuel into hand!)');
  assert.equal(w.heldItem?.key, 'fuel', 'POE2 1-item swap puts displaced fuel barrel cleanly into cursor hand');
  assert.equal(m.placeHeldItemAt(w, 'backpack', 3, 2), true, 'Place swapped fuel barrel into empty 1x2 space');
  assert.equal(w.heldItem, null, 'Hand is empty after manual placement');

  // Upgrade backpack Lv.1 -> Lv.2
  m.giveItem(w, 'wood', 6);
  m.giveItem(w, 'scrap', 8);
  m.giveItem(w, 'parts', 2);
  assert.equal(m.upgradeBackpack(w), null, 'Upgrade backpack Lv.1 -> Lv.2');
  assert.equal(w.backpackLevel, 2);
  assert.equal(w.backpack.cols, 8);
  assert.equal(w.backpack.rows, 5);

  // 3. Tool-gated deeper zones (Lv.2 Iron Gate & Lv.3 Alloy Vault Door) + stronger deeper guards
  const lv2Bar = w.stationBarriers.find((b) => b.reqTool === 2);
  const lv3Bar = w.stationBarriers.find((b) => b.reqTool === 3);
  assert.ok(lv2Bar && lv3Bar, 'Station has Lv.2 and Lv.3 tool-gated areas');
  const lv2HpBefore = lv2Bar.hp;
  w.player.x = lv2Bar.x + lv2Bar.w / 2;
  w.player.y = lv2Bar.y - 24;
  w.hotbar = 0;
  m.handlePrimaryAction(w, lv2Bar.x + lv2Bar.w / 2, lv2Bar.y + lv2Bar.h / 2);
  assert.equal(lv2Bar.hp, lv2HpBefore, 'Lv.1 Crowbar cannot damage Lv.2 Steel Gate');

  // Place workbench, craft Lv.2 Heavy Pickaxe -> breaks Lv.2 gate; craft Lv.3 Steam Saw -> breaks Lv.3 vault door
  w.player.x = 50;
  w.player.y = 0;
  m.giveItem(w, 'wood', 12);
  m.giveItem(w, 'scrap', 30);
  m.giveItem(w, 'parts', 10);
  w.buildMode = true;
  w.selectedBuild = 'workbench';
  const wbPos = m.getTileCenter(0, 1, 1);
  assert.equal(m.tryPlaceBuilding(w, wbPos.x, wbPos.y), null);
  w.buildMode = false;

  assert.equal(m.craftItem(w, 'upgrade_pickaxe'), null, 'Craft Lv.2 Heavy Pickaxe');
  assert.equal(w.player.toolLevel, 2);
  w.player.x = lv2Bar.x + lv2Bar.w / 2;
  w.player.y = lv2Bar.y - 24;
  w.player.attackCd = 0;
  m.handlePrimaryAction(w, lv2Bar.x + lv2Bar.w / 2, lv2Bar.y + lv2Bar.h / 2);
  assert.ok(lv2Bar.hp < lv2HpBefore, 'Lv.2 Pickaxe damages Lv.2 Steel Gate');

  const lv3HpBefore = lv3Bar.hp;
  w.player.x = lv3Bar.x + lv3Bar.w / 2;
  w.player.y = lv3Bar.y - 24;
  w.player.attackCd = 0;
  m.handlePrimaryAction(w, lv3Bar.x + lv3Bar.w / 2, lv3Bar.y + lv3Bar.h / 2);
  assert.equal(lv3Bar.hp, lv3HpBefore, 'Lv.2 Pickaxe cannot damage Lv.3 Alloy Vault Door');

  assert.equal(m.craftItem(w, 'upgrade_saw'), null, 'Craft Lv.3 Steam Saw');
  assert.equal(w.player.toolLevel, 3);
  w.player.attackCd = 0;
  m.handlePrimaryAction(w, lv3Bar.x + lv3Bar.w / 2, lv3Bar.y + lv3Bar.h / 2);
  assert.ok(lv3Bar.hp < lv3HpBefore, 'Lv.3 Steam Saw cuts Lv.3 Alloy Vault Door');

  // 4. Train Lantern & Night No-Lantern Darkness Threat (farther from train without lantern -> strong dark monsters spawn)
  const wDark = m.createInitialWorld();
  advanceToStation1(wDark);
  wDark.monsters = [];
  wDark.dayTime = 0.75; // midnight
  assert.equal(m.playerHasActiveLantern(wDark), false, 'Lantern is still on train, player has no carried light');
  wDark.player.x = 0;
  wDark.player.y = 380; // far outside train in pitch dark without lantern
  for (let i = 0; i < 120; i++) m.stepWorld(wDark, idleInput, 0.05);
  assert.ok(wDark.darkThreatLevel > 0.8, `Far outdoors at night without lantern raises darkThreatLevel, got ${wDark.darkThreatLevel}`);
  assert.ok(wDark.monsters.length >= 2, `No-lantern night wandering summons dark monsters, got ${wDark.monsters.length}`);

  // Picking up train lantern suppresses darkness threat!
  m.pickupOrPlaceLantern(wDark);
  assert.equal(m.playerHasActiveLantern(wDark), true, 'Picking up train lantern activates player cone light');
  for (let i = 0; i < 40; i++) m.stepWorld(wDark, idleInput, 0.05);
  assert.equal(wDark.darkThreatLevel, 0, 'Active carried lantern suppresses darkness threat');

  // 5. Route selection required before departure, fuel estimate accuracy, fast gear burns more fuel, wasteland stop siege, furnace & crops run while driving!
  const wDrive = m.createInitialWorld();
  advanceToStation1(wDrive);
  wDrive.monsters = [];
  wDrive.player.x = 80;
  wDrive.player.y = 0;
  wDrive.boilerFuel = 20;
  m.shiftGear(wDrive, 1);
  assert.equal(wDrive.gear, 0, 'Cannot depart station without selecting a destination route');
  assert.equal(wDrive.routeOpen, true, 'Attempting to depart opens route selection');

  // Select Monster Zone Tier II route along the railway
  const monsterRoute = wDrive.availableRoutes.find((r) => r.zone === 'monster');
  assert.ok(monsterRoute, 'Forward railway route to Monster Zone available');
  const estNormal = m.estimateRouteFuel(wDrive, monsterRoute.distance, 2);
  const estFast = m.estimateRouteFuel(wDrive, monsterRoute.distance, 3);
  assert.ok(estFast > estNormal * 1.4, `Full speed estimate (${estFast}) should significantly exceed normal cruise (${estNormal})`);
  assert.equal(m.selectRoute(wDrive, monsterRoute.id), true);

  // Build furnace + planter to verify active smelting & crop growth while driving
  m.giveItem(wDrive, 'wood', 12);
  m.giveItem(wDrive, 'scrap', 10);
  m.giveItem(wDrive, 'rawFood', 4);
  wDrive.buildMode = true;
  wDrive.selectedBuild = 'campfire';
  const fPos = m.getTileCenter(0, 0, 0);
  assert.equal(m.tryPlaceBuilding(wDrive, fPos.x, fPos.y), null);
  wDrive.selectedBuild = 'planter';
  const pPos = m.getTileCenter(0, 1, 0);
  assert.equal(m.tryPlaceBuilding(wDrive, pPos.x, pPos.y), null);
  wDrive.buildMode = false;
  const furnace = wDrive.flatbeds[0].buildings.find((b) => b.type === 'campfire');
  const planter = wDrive.flatbeds[0].buildings.find((b) => b.type === 'planter');
  furnace.smeltKind = 'charcoal';
  furnace.smeltQueue = 1;
  furnace.smeltProgress = 0;
  planter.planted = true;
  planter.growth = 0;
  planter.watered = 30;
  const fuelInvBefore = m.getItemCount(wDrive, 'fuel');

  // Depart at Gear 2 -> clears full city bounds, enters wasteland & transitions railway zone to Monster Zone Tier II
  m.shiftGear(wDrive, 2);
  assert.equal(wDrive.gear, 2);
  for (let i = 0; i < 280; i++) m.stepWorld(wDrive, idleInput, 0.05); // 14s driving to clear city perimeter
  assert.equal(wDrive.mode, 'wasteland', 'Train departs into railway wasteland');
  assert.equal(wDrive.zoneKind, 'monster', 'Entering route transitions railway Danger Zone to Monster Zone');
  assert.equal(wDrive.zoneTier, 2, 'Danger Tier updates to II');
  assert.ok(planter.growth > 20, `Crops keep growing while driving, growth=${planter.growth}`);
  assert.ok(m.getItemCount(wDrive, 'fuel') >= fuelInvBefore + 2, 'Furnace finishes smelting charcoal automatically while driving');

  // Compare actual burn per meter: Gear 3 burns more per meter than Gear 2
  wDrive.trackHazards = [];
  wDrive.monsters = [];
  wDrive.boilerFuel = 20;
  wDrive.gear = 2;
  wDrive.trainSpeed = m.GEAR_SPEEDS[2];
  const d0 = wDrive.legDistance;
  for (let i = 0; i < 40; i++) m.stepWorld(wDrive, idleInput, 0.05);
  const burnPerM2 = (20 - wDrive.boilerFuel) / (wDrive.legDistance - d0);

  wDrive.trackHazards = [];
  wDrive.monsters = [];
  wDrive.boilerFuel = 20;
  wDrive.gear = 3;
  wDrive.trainSpeed = m.GEAR_SPEEDS[3];
  const d1 = wDrive.legDistance;
  for (let i = 0; i < 40; i++) m.stepWorld(wDrive, idleInput, 0.05);
  const burnPerM3 = (20 - wDrive.boilerFuel) / (wDrive.legDistance - d1);
  assert.ok(burnPerM3 > burnPerM2 * 1.4, `Gear 3 burn/m (${burnPerM3.toFixed(4)}) must exceed Gear 2 (${burnPerM2.toFixed(4)})`);

  // Stopping in wasteland triggers strong wasteland siege monsters!
  wDrive.monsters = [];
  wDrive.gear = 0;
  wDrive.trainSpeed = 0;
  for (let i = 0; i < 260; i++) m.stepWorld(wDrive, idleInput, 0.05); // 13s stopped in wasteland
  assert.ok(wDrive.monsters.length >= 3, `Stopping mid-wasteland must summon strong siege monsters, got ${wDrive.monsters.length}`);
  assert.ok(wDrive.monsters.some((mon) => mon.tier >= 3), 'Wasteland siege monsters are empowered above base route tier');

  // 6. Hull doors, chest-linked crafting, death carriage loss & auto-turret still work cleanly
  const wTur = m.createInitialWorld();
  advanceToStation1(wTur);
  m.giveItem(wTur, 'wood', 10);
  m.giveItem(wTur, 'scrap', 20);
  m.giveItem(wTur, 'parts', 4);
  wTur.buildMode = true;
  wTur.selectedBuild = 'workbench';
  const wbC = m.getTileCenter(0, 1, 1);
  wTur.player.x = m.getTileCenter(0, 3, 2).x;
  wTur.player.y = m.getTileCenter(0, 3, 2).y;
  assert.equal(m.tryPlaceBuilding(wTur, wbC.x, wbC.y), null);
  wTur.selectedBuild = 'turret';
  const turC = m.getTileCenter(0, 0, 0);
  assert.equal(m.tryPlaceBuilding(wTur, turC.x, turC.y), null);
  const elite = m.createMonster('elite', turC.x - 160, turC.y - 120, false, 1);
  wTur.monsters = [elite];
  for (let i = 0; i < 160; i++) m.stepWorld(wTur, idleInput, 0.05);
  assert.ok(elite.hp <= 0, 'Auto-turret eliminates threats cleanly');

  // 7. Low-vital warnings + Bed rest skips 4 hours and is strictly once per day!
  const wLife = m.createInitialWorld();
  advanceToStation1(wLife);
  wLife.monsters = [];
  wLife.player.hp = 22;
  wLife.player.hunger = 18;
  wLife.player.thirst = 12;
  wLife.player.bodyTemp = 25;
  const warns = m.getVitalWarnings(wLife);
  assert.equal(warns.length, 4, `All 4 critical vitals should surface explicit warnings, got ${warns.length}`);
  const floatsBefore = wLife.floats.length;
  m.stepWorld(wLife, idleInput, 0.05);
  assert.ok(wLife.floats.length > floatsBefore, 'Low vitals also push immediate floating alert');

  // Bed rest advances time by 4h, restores HP/temp, and blocks a 2nd rest on the same day!
  const dayTimeBefore = wLife.dayTime;
  const hpBeforeRest = wLife.player.hp;
  assert.equal(m.restInBed(wLife), null, 'First bed rest of the day succeeds');
  assert.ok(Math.abs(wLife.dayTime - (dayTimeBefore + m.BED_REST_HOURS / 24)) < 0.002, 'Bed rest advances clock by 4 hours');
  assert.ok(wLife.player.hp > hpBeforeRest + 30 && wLife.player.bodyTemp === 100, 'Bed rest heals and warms player');
  assert.ok(m.restInBed(wLife) !== null, 'Second bed rest on the same day must be rejected');
  wLife.dayCount++;
  assert.equal(m.restInBed(wLife), null, 'Bed rest refreshes on the next day');

  console.log('ALL V6 CHECKS PASSED: unbounded Lost World stations, disembarkation ceremony, POE2 spatial grid backpack + rotation + upgrades, seamless transitions, rail zones I-V, lantern darkness threat, tool gates.');
} finally {
  await server.close();
}
