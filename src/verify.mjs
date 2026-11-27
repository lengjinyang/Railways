import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const m = await server.ssrLoadModule('/src/world.ts');
  const recipes = await server.ssrLoadModule('/src/recipes_v2.ts');
  const inv = await server.ssrLoadModule('/src/inventory.ts');

  const idleInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    holdE: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseDown: false,
  };

  function advanceToStation1(w) {
    let ticks = 0;
    while (w.mode === 'city_escape' && ticks < 12000) {
      m.stepWorld(w, idleInput, 0.05);
      ticks++;
    }
    return ticks;
  }

  // 1. Opening starts in Fallen Parish -> arrives at Station 1 (Abandoned Halt, Rust Plains)
  //    ZERO crew/gardener, NO passive parked decay, NO linger waves!
  const w = m.createInitialWorld();
  assert.equal(w.mode, 'city_escape');
  assert.equal(w.companion, undefined, 'Crew/gardener companion removed per P1');
  const escapeTicks = advanceToStation1(w);
  assert.ok(escapeTicks * 0.05 > 120, `Leaving the city takes a while (${(escapeTicks * 0.05).toFixed(0)}s)`);
  assert.equal(w.mode, 'station');
  assert.equal(w.zoneKind, 'rust_plains');
  assert.equal(w.stationTemplate, 'abandoned_halt');
  assert.equal(w.props.some((p) => p.kind === 'npc_gardener'), false, 'No gardener NPC spawned');

  const fuelBeforePark = w.boilerFuel;
  const strays = () => w.monsters.filter((mo) => !mo.nestUid).length; // nests breed on purpose
  const monstersBeforePark = strays();
  for (let i = 0; i < 200; i++) m.stepWorld(w, idleInput, 0.05); // 10s parked
  // Design §7: standing still still burns the firebox (warmth, cooking, light)
  const idleBurn = fuelBeforePark - w.boilerFuel;
  const expectedIdle = m.getIdleFuelPerSec(w) * 10;
  assert.ok(Math.abs(idleBurn - expectedIdle) < 1e-6, `Parked firebox burns ${expectedIdle.toFixed(4)} in 10s, got ${idleBurn.toFixed(4)}`);
  assert.ok(m.getIdleFuelPerSec(w) * 600 < 2.5, 'A 10-minute stop costs well under a quarter of the boiler');
  assert.equal(strays(), monstersBeforePark, 'Zero lingering wave spawns while parked');
  // Sections 2–4 measure economy on an idle player: keep combat out so nothing kills them mid-test
  const calm = () => {
    w.monsters = [];
    for (const pr of w.props) if (pr.kind === 'monster_nest') pr.nestTimer = 1e9;
    w.nightWavesLeft = 0;
  };
  calm();

  // 2. Survival rates (#1): halved hunger/thirst drain + 8-11 min route legs (3500-4600m)
  const routes = m.buildNextRoutes(0, false);
  assert.ok(routes.every((r) => r.distance >= 3400 && r.distance <= 4800), 'Route legs are 8-11 min cruise distance');
  const h0 = w.player.hunger;
  const t0 = w.player.thirst;
  for (let i = 0; i < 200; i++) m.stepWorld(w, idleInput, 0.05); // 10s
  const hDrain = (h0 - w.player.hunger) / 10;
  const tDrain = (t0 - w.player.thirst) / 10;
  assert.ok(hDrain >= 0.11 && hDrain <= 0.15, `Hunger drain ~0.13/s, got ${hDrain.toFixed(3)}`);
  assert.ok(tDrain >= 0.13 && tDrain <= 0.17, `Thirst drain ~0.15/s, got ${tDrain.toFixed(3)}`);

  // 3. Slot-based backpack (U3: 16 -> 24 -> 32 -> 40 slots; Lv.4 does NOT use magicShard/ancientRelic)
  assert.equal(w.backpack.capacity, 16, 'Lv.1 backpack has 16 regular slots');
  assert.equal(m.BACKPACK_TIERS[4].cost.magicShard, undefined, 'Lv.4 backpack no longer uses magicShard');
  assert.equal(m.BACKPACK_TIERS[4].cost.ancientRelic, undefined, 'Lv.4 backpack no longer uses ancientRelic');
  m.giveItem(w, 'cloth', 12);
  m.giveItem(w, 'hide', 12);
  m.giveItem(w, 'scrap', 25);
  m.giveItem(w, 'parts', 12);
  m.giveItem(w, 'carapace', 6);
  m.giveItem(w, 'copper', 8);
  assert.equal(m.upgradeBackpack(w), null);
  assert.equal(w.backpack.capacity, 24);
  assert.equal(m.upgradeBackpack(w), null);
  assert.equal(w.backpack.capacity, 32);
  assert.equal(m.upgradeBackpack(w), null);
  assert.equal(w.backpack.capacity, 40);

  // 4. Farming balance (#2): stops growing when unwatered; ~5.5 min watered; yields 2 rawFood
  calm();
  w.player.x = 60;
  w.player.y = 0;
  w.buildMode = true;
  w.selectedBuild = 'planter';
  m.giveItem(w, 'wood', 10);
  const plPos = m.getTileCenter(0, 1, 1);
  assert.equal(m.tryPlaceBuilding(w, plPos.x, plPos.y), null);
  w.buildMode = false;
  const planter = w.flatbeds[0].buildings.find((b) => b.type === 'planter');
  planter.planted = true;
  planter.growth = 0;
  planter.watered = 0;
  for (let i = 0; i < 40; i++) m.stepWorld(w, idleInput, 0.05); // 2s unwatered
  assert.equal(planter.growth, 0, 'Unwatered planter stops growing completely');
  planter.watered = 180;
  for (let i = 0; i < 200; i++) m.stepWorld(w, idleInput, 0.05); // 10s watered
  assert.ok(planter.growth > 2.5 && planter.growth < 4.5, `Watered planter grows at ~5.5 min rate, got ${planter.growth.toFixed(2)}% in 10s`);

  // 5. Q12: the train doesn't fight in the demo — no turrets, no ram
  w.buildMode = true;
  w.selectedBuild = 'workbench';
  const wbPos = m.getTileCenter(0, 2, 1);
  assert.equal(m.tryPlaceBuilding(w, wbPos.x, wbPos.y), null);
  assert.equal(recipes.BUILD_ORDER.includes('turret') || recipes.BUILD_ORDER.includes('bumper'), false, 'Turret and ram are off the build list');
  m.giveItem(w, 'wood', 12);
  m.giveItem(w, 'scrap', 12);
  m.giveItem(w, 'parts', 4);
  w.selectedBuild = 'turret';
  const turPos = m.getTileCenter(0, 3, 1);
  assert.notEqual(m.tryPlaceBuilding(w, turPos.x, turPos.y), null, 'Turret cannot be placed');
  w.selectedBuild = 'bumper';
  assert.notEqual(m.tryPlaceBuilding(w, m.LOCO_W + 20, 0), null, 'Ram cannot be placed');
  w.buildMode = false;
  assert.equal(w.flatbeds[0].buildings.some((b) => b.type === 'turret'), false);
  assert.equal(w.hasBumper, false);
  // An older save that still carries a turret and a ram gets them taken down, materials refunded
  {
    const old = m.createInitialWorld();
    old.flatbeds[0].buildings.push({ uid: 'b_old_turret', type: 'turret', carIdx: 0, col: 3, row: 0, tier: 2, hp: 95, maxHp: 95 });
    old.hasBumper = true;
    old.selectedBuild = 'turret';
    const scrapBefore = inv.countInInventory(old.backpack, 'scrap');
    const loaded = m.deserializeWorld(m.serializeWorld(old));
    assert.equal(loaded.flatbeds[0].buildings.some((b) => b.type === 'turret'), false, 'Loaded save has no turret');
    assert.equal(loaded.hasBumper, false, 'Loaded save has no ram');
    assert.equal(loaded.selectedBuild, 'workbench');
    assert.equal(inv.countInInventory(loaded.backpack, 'scrap') - scrapBefore, 4 + 6, 'Turret + ram scrap refunded');
  }

  // 5b. Design §7: carriage upkeep each day, visible forecast
  {
    const u = m.createInitialWorld();
    advanceToStation1(u);
    u.monsters = [];
    for (const pr of u.props) if (pr.kind === 'monster_nest') pr.nestTimer = 1e9;
    u.nightWavesLeft = 0;
    const cars = u.flatbeds.length;
    assert.equal(m.getDailyUpkeepScrap(u), cars * m.CAR_UPKEEP_SCRAP);
    // Enough scrap: paid at the next day
    m.spendCost(u, { scrap: m.getItemCount(u, 'scrap') });
    m.giveItem(u, 'scrap', 10);
    u.dayCount = u.lastUpkeepDay + 1;
    m.stepWorld(u, idleInput, 0.05);
    assert.equal(m.getItemCount(u, 'scrap'), 10 - cars * m.CAR_UPKEEP_SCRAP, 'Upkeep paid at a new day');
    assert.equal(u.lastUpkeepDay, u.dayCount);
    // No scrap: hull wears but never breaches by itself
    m.spendCost(u, { scrap: m.getItemCount(u, 'scrap') });
    const hull = u.flatbeds[0].hull;
    const hpBefore = hull.map((h) => h.hp);
    u.dayCount += 1;
    m.stepWorld(u, idleInput, 0.05);
    hull.forEach((h, i) => {
      if (hpBefore[i] > 0) assert.ok(h.hp >= 1 && h.hp <= Math.max(1, hpBefore[i] - m.CAR_UPKEEP_WEAR) + 1e-9, 'Unpaid carriage hull wears');
    });
    // Forecast reports something finite and names the scarce supply
    const f = m.getSupplyForecast(u);
    assert.equal(f.limiting, '废料', 'With no scrap, upkeep is what runs out first');
    assert.equal(f.days, 0);
    assert.ok(typeof m.describeSupplyForecast(u) === 'string');
  }

  // 5c. Design §5.2: a route offers a stretch of land, the station stays hidden until arrival —
  //     every route still carries a zone + distance for the card to show.
  assert.ok(routes.every((r) => r.zone && r.distance > 0));

  // 6. Finite outer exploration (#3): capped at ring 2, zero random ancient_vaults
  const wOuter = m.createInitialWorld();
  advanceToStation1(wOuter);
  const vaultsBefore = wOuter.props.filter((p) => p.kind === 'ancient_vault').length;
  // Walk far beyond ring 2 (e.g., x = 4200, y = 2600)
  wOuter.player.x = 4200;
  wOuter.player.y = 2600;
  m.stepWorld(wOuter, idleInput, 0.05);
  assert.equal(wOuter.exploredChunks.size, 0, 'Beyond ring 2 generates zero outer chunks (barren wasteland)');
  // Walk inside ring 1-2 (x = 1800, y = 900)
  wOuter.player.x = 1800;
  wOuter.player.y = 900;
  m.stepWorld(wOuter, idleInput, 0.05);
  assert.ok(wOuter.exploredChunks.size > 0, 'Ring 1-2 generates outer chunks');
  const vaultsAfter = wOuter.props.filter((p) => p.kind === 'ancient_vault').length;
  assert.equal(vaultsAfter, vaultsBefore, 'Random outer chunks NEVER spawn ancient_vault relics');

  // 7. Design §6: death = back to the last station + a not-quite-random loss
  const makeDeathWorld = () => {
    const wd = m.createInitialWorld();
    advanceToStation1(wd);
    wd.monsters = [];
    m.giveItem(wd, 'coupler', 2);
    m.giveItem(wd, 'scrap', 20);
    m.giveItem(wd, 'wood', 20);
    assert.equal(m.tryAttachCarriage(wd, true), null);
    assert.equal(m.tryAttachCarriage(wd, true), null);
    assert.equal(wd.flatbeds.length, 3);
    // Mark the cars so we can tell which one went
    wd.flatbeds[1].baseWeight = 2.81;
    wd.flatbeds[2].baseWeight = 2.82;
    // Car 2 is battered
    for (const h of wd.flatbeds[2].hull) h.hp = Math.min(h.hp, 20);
    m.saveStationSnapshot(wd);
    return wd;
  };
  {
    // Fell on the locomotive: the most battered carriage is the one at risk; the first never is
    const wDeath = makeDeathWorld();
    wDeath.player.x = 100;
    wDeath.player.y = 0;
    wDeath.player.hp = 0;
    m.stepWorld(wDeath, idleInput, 0.05);
    assert.ok(wDeath.deathReport !== null, 'Triggers death report modal');
    assert.equal(wDeath.deathReport.lossCarIdx, 2, 'Most battered carriage is at risk');
    const rolled = m.rollbackToStationSave(wDeath, () => 0); // every roll loses
    assert.equal(rolled.flatbeds.length, 2, 'One carriage lost');
    assert.equal(rolled.flatbeds[0].baseWeight, 2.5, 'First carriage is never lost');
    assert.equal(rolled.flatbeds[1].baseWeight, 2.81, 'The battered one went, not the other');
    assert.equal(rolled.backpack.slots.every((s) => s === null), true, 'Backpack stacks can be lost');
    assert.equal(rolled.stats.deaths, 1, 'Preserves death count across rollback');
    assert.ok(rolled.zoneBanner && rolled.zoneBanner.subtitle.includes('第 3 节车厢'), 'Arrival banner names the loss');
    // The checkpoint itself now reflects the loss — reloading can't undo it
    assert.equal(m.loadStationSnapshot().flatbeds.length, 2);
  }
  {
    // Lucky rolls: nothing lost
    const wDeath = makeDeathWorld();
    const woodAtStation = m.getItemCount(wDeath, 'wood');
    wDeath.player.hp = 0;
    m.stepWorld(wDeath, idleInput, 0.05);
    const rolled = m.rollbackToStationSave(wDeath, () => 0.99);
    assert.equal(rolled.flatbeds.length, 3, 'No carriage lost on a lucky roll');
    assert.equal(m.getItemCount(rolled, 'wood'), woodAtStation, 'No items lost on a lucky roll');
  }
  {
    // Fell inside carriage 2 (index 1): that one is at risk, even though carriage 3 is more battered
    const wDeath = makeDeathWorld();
    const c = m.getTileCenter(1, 2, 1);
    wDeath.player.x = c.x;
    wDeath.player.y = c.y;
    wDeath.player.hp = 0;
    m.stepWorld(wDeath, idleInput, 0.05);
    assert.equal(wDeath.deathReport.lossCarIdx, 1, 'The carriage you fell in is at risk');
    const rolled = m.rollbackToStationSave(wDeath, () => 0);
    assert.equal(rolled.flatbeds[1].baseWeight, 2.82, 'Carriages behind close up the gap');
    assert.equal(rolled.flatbeds[1].id, 1);
    assert.ok(rolled.flatbeds[1].buildings.every((b) => b.carIdx === 1), 'Buildings are re-indexed');
  }

  // 8. Facility-scoped crafting (D), lateral armor (G5), and hold-E container search (U1/U6)
  m.giveItem(w, 'hide', 8);
  m.giveItem(w, 'cloth', 6);
  m.giveItem(w, 'fat', 2);
  m.giveItem(w, 'scrap', 10);
  m.giveItem(w, 'copper', 4);
  const wb = w.flatbeds[0].buildings.find((b) => b.type === 'workbench');
  assert.equal(m.craftAtFacility(w, wb.uid, 'armor_fur_coat'), null, 'Crafts fur coat at workbench');
  assert.equal(w.player.bodyArmor, 'fur_coat');
  assert.equal(m.craftAtFacility(w, wb.uid, 'head_weld_mask'), null, 'Crafts welding mask at workbench');
  assert.equal(w.player.headArmor, 'weld_mask');
  assert.equal(m.getArmorStats(w).sporeProof, true, 'Welding mask grants Ivy City spore immunity');

  // Container quiet search via hold-E
  const cont = w.props.find((p) => p.isContainer && p.containerInv);
  assert.ok(cont, 'Station spawns searchable containers');
  w.player.x = cont.x;
  w.player.y = cont.y + cont.r + 12;
  m.stepWorld(w, idleInput, 0.05);
  const holdEInput = { ...idleInput, holdE: true };
  for (let i = 0; i < 30; i++) m.stepWorld(w, holdEInput, 0.05); // 1.5s hold E
  assert.equal(cont.searched, true, 'Holding E completes quiet container search');
  assert.equal(w.openContainerUid, cont.uid, 'Opens non-pausing container loot panel');
  const lootedCount = m.takeAllFromOpenContainer(w);
  assert.ok(lootedCount > 0, 'Pressing R / take-all moves container loot into backpack');

  // 9. Three Station Templates & Sinking Belt Rail Hazards (H4, H5, H8)
  const wT = m.createInitialWorld();
  m.buildStationMap(wT, 'rust_plains', 1, '水塔镇', 'watertower_town', 0, false);
  assert.ok(wT.props.some((p) => p.kind === 'npc_keeper'), 'Watertower town has rational mutant merchant');
  assert.ok(wT.props.some((p) => p.kind === 'npc_elder'), 'Watertower town has tower elder chain event');
  assert.equal(wT.props.some((p) => p.kind === 'npc_gardener'), false, 'Zero gardener in watertower town');
  m.buildStationMap(wT, 'sinking_belt', 2, '前代列车残骸', 'predecessor_wreck', 0, false);
  assert.ok(wT.props.some((p) => p.kind === 'predecessor_loco'), 'Predecessor wreck spawns derailed twin locomotive');
  assert.ok(wT.props.some((p) => p.kind === 'special_diary'), 'Predecessor wreck spawns predecessor diary');

  // 10. Save / Load Serialization Round-Trip
  const rawSave = m.serializeWorld(w);
  const loaded = m.deserializeWorld(rawSave);
  assert.ok(loaded, 'Deserializes v3 save cleanly');
  assert.equal(loaded.backpack.capacity, w.backpack.capacity, 'Preserves slot backpack capacity');
  assert.equal(m.deserializeWorld('{"version":1}'), null, 'Rejects outdated save versions');

  // 11. Lean start, lootable gear, usable items & bindable hotbar
  const wS = m.createInitialWorld();
  assert.equal(wS.player.rangedWeapon, 'none', 'Starts without a ranged weapon');
  assert.equal(m.getItemCount(wS, 'bolts'), 0, 'Starts without bolts');
  assert.ok(wS.backpack.slots.filter(Boolean).length <= 4, 'Starting backpack is lean');
  const wHalt = m.createInitialWorld();
  m.buildStationMap(wHalt, 'rust_plains', 1, '废弃小站', 'abandoned_halt', 0, false);
  assert.ok(
    wHalt.props.some((p) => p.containerInv && p.containerInv.slots.some((sl) => sl && sl.key === 'gearCrossbow')),
    'First station hides a crossbow to scavenge'
  );
  m.giveItem(wS, 'gearCrossbow', 1, false);
  assert.ok(m.useItem(wS, 'gearCrossbow'), 'Using a looted crossbow equips it');
  assert.equal(wS.player.rangedWeapon, 'crossbow');
  assert.equal(m.getItemCount(wS, 'gearCrossbow'), 0, 'Gear item is consumed on equip');
  assert.ok(m.getHotbarBindings(wS).some((b) => b && b.kind === 'ranged' && b.weapon === 'crossbow'), 'New weapon auto-binds to hotbar');
  wS.player.thirst = 40;
  assert.ok(m.useItem(wS, 'water'), 'Water can be drunk from the backpack');
  assert.ok(wS.player.thirst > 40);
  m.giveItem(wS, 'bandage', 1, false);
  assert.ok(m.bindItemToHotbar(wS, 5, 'bandage'), 'Consumables bind to hotbar');
  assert.deepEqual(m.getHotbarBindings(wS)[5], { kind: 'item', key: 'bandage' });
  assert.equal(m.bindItemToHotbar(wS, 4, 'wood'), false, 'Raw materials cannot be bound');

  // 12. Carried lantern, locomotive deck, regional weather, more routes
  const wL = m.createInitialWorld();
  assert.equal(wL.lanternHolder, 'player', 'Lantern is carried from the start');
  assert.ok(m.playerHasActiveLantern(wL));
  wL.player.x = -150;
  wL.player.y = 30;
  assert.ok(m.placeLantern(wL), 'Lantern can be set down anywhere');
  assert.equal(wL.lanternHolder, 'placed');
  assert.ok(m.playerHasActiveLantern(wL), 'Standing in the placed lantern light counts as lit');
  wL.player.x = -900;
  assert.equal(m.playerHasActiveLantern(wL), false, 'Walking away from it leaves you in the dark');
  wL.player.x = wL.lanternPos.x;
  wL.player.y = wL.lanternPos.y;
  m.toggleLantern(wL);
  assert.equal(wL.lanternHolder, 'player', 'F next to the lantern picks it back up');

  m.giveItem(wL, 'wood', 10);
  wL.selectedBuild = 'chest';
  wL.player.x = -150;
  wL.player.y = 0;
  const locoTile = m.getTileCenter(-1, 3, 3);
  assert.equal(m.tryPlaceBuilding(wL, locoTile.x, locoTile.y), null, 'Free locomotive tiles accept buildings');
  assert.equal(wL.locoDeck.buildings.length, 1);
  assert.ok(m.hasChest(wL), 'Locomotive chest counts as a train chest');
  const boilerTile = m.getTileCenter(-1, 0, 0);
  assert.notEqual(m.tryPlaceBuilding(wL, boilerTile.x, boilerTile.y), null, 'Boiler tiles stay clear');

  for (const [zone, zw] of Object.entries(m.ZONE_WEATHER)) {
    const wz = m.createInitialWorld();
    wz.mode = 'station';
    m.enterZone(wz, zone, 1);
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      wz.weatherTimer = 0;
      m.stepWorld(wz, idleInput, 0.05);
      seen.add(wz.weather);
    }
    for (const k of seen) assert.ok(k === 'clear' || k === zw.kind, `${zone} only gets its own weather (saw ${k})`);
  }
  for (let i = 0; i < 6; i++) {
    const rs = m.buildNextRoutes(i, false);
    if (i === 3) {
      // Design §5.2: every route of act 1 converges on the one BOSS station, known in advance
      assert.equal(rs.length, 1, 'Act 1 converges on a single BOSS route');
      assert.equal(rs[0].boss, true);
    } else {
      assert.ok(rs.length >= 3, `Station ${i} offers at least 3 routes`);
      assert.ok(rs.every((r) => !r.boss));
    }
  }

  // 13. Light pools, night hand-light, nest breeding & guardians, E never upgrades
  const wB = m.createInitialWorld();
  wB.boilerFuel = 0;
  m.giveItem(wB, 'scrap', 30);
  m.giveItem(wB, 'wood', 30);
  m.giveItem(wB, 'parts', 6);
  wB.selectedBuild = 'campfire';
  wB.player.x = -150;
  wB.player.y = 70;
  const fireTile = m.getTileCenter(-1, 3, 3);
  assert.equal(m.tryPlaceBuilding(wB, fireTile.x, fireTile.y), null);
  assert.ok(m.getLightSources(wB).some((l) => Math.hypot(l.x - fireTile.x, l.y - fireTile.y) < 1), 'Brazier is a light source');
  m.placeLantern(wB);
  wB.lanternPos.x = -3000;
  wB.player.x = fireTile.x - 60;
  wB.player.y = fireTile.y;
  assert.equal(m.playerHasHandLight(wB), false);
  assert.ok(m.playerHasActiveLantern(wB), 'Standing by a brazier counts as being in light');
  wB.player.x = fireTile.x - 600;
  assert.equal(m.playerHasActiveLantern(wB), false, 'Far from every light is dark');

  // Build mode: clicking an existing facility upgrades it; E on it never does
  wB.player.x = fireTile.x - 60;
  wB.buildMode = true;
  m.handlePrimaryAction(wB, fireTile.x, fireTile.y);
  const fire = wB.locoDeck.buildings[0];
  assert.equal(fire.tier, 2, 'Build-mode click on a facility upgrades it in place');
  wB.buildMode = false;
  m.giveItem(wB, 'wood', 10);
  m.giveItem(wB, 'scrap', 10);
  m.giveItem(wB, 'copper', 4);
  wB.selectedBuild = 'planter';
  const plTile = m.getTileCenter(0, 1, 1);
  wB.player.x = -150;
  wB.player.y = 0;
  assert.equal(m.tryPlaceBuilding(wB, plTile.x, plTile.y), null);
  const planterB = wB.flatbeds[0].buildings.find((b) => b.type === 'planter');
  planterB.planted = true;
  planterB.growth = 100;
  wB.player.x = plTile.x + 4;
  wB.player.y = plTile.y + 30;
  m.stepWorld(wB, idleInput, 0.016);
  assert.ok(wB.activeHint && wB.activeHint.label.includes('收获'), 'Ripe planter offers harvest');
  assert.ok(!wB.activeHint.holdAction, 'Harvest has no hold action that could turn into an upgrade');
  const foodBefore = m.getItemCount(wB, 'rawFood');
  m.stepWorld(wB, { ...idleInput, holdE: true }, 1.5);
  assert.equal(planterB.tier, 1, 'Holding E next to a facility never upgrades it');
  m.triggerInteract(wB);
  assert.ok(m.getItemCount(wB, 'rawFood') > foodBefore, 'E harvests');

  // Nests breed and are guarded
  const wN = m.createInitialWorld();
  wN.mode = 'station';
  wN.stationIdx = 1;
  wN.zoneKind = 'rust_plains';
  wN.zoneTier = 1;
  m.buildStationMap(wN, 'rust_plains', 1, '测试站', 'watertower_town', 0, false);
  const nests = wN.props.filter((pr) => pr.kind === 'monster_nest');
  assert.ok(nests.length > 0);
  for (const n of nests) {
    assert.ok(wN.monsters.some((mo) => mo.elite && mo.nestUid === n.uid), 'Nests past the first stop are guarded by an elite');
  }
  const elite = wN.monsters.find((mo) => mo.elite);
  assert.ok(elite.maxHp > 70 && elite.r > 15, 'Elites are bigger and tougher');
  const nest = nests[0];
  wN.player.x = nest.x + 300;
  wN.player.y = nest.y;
  wN.player.hp = 9999;
  const broodOf = () => wN.monsters.filter((mo) => mo.nestUid === nest.uid && mo.hp > 0).length;
  for (const mo of wN.monsters) if (mo.nestUid === nest.uid) mo.hp = 0;
  wN.monsters = wN.monsters.filter((mo) => mo.hp > 0);
  for (let i = 0; i < 3; i++) {
    nest.nestTimer = 0;
    m.stepWorld(wN, idleInput, 0.016);
  }
  assert.ok(broodOf() >= 2, `Live nests keep breeding (brood ${broodOf()})`);

  // First stop: guardian wakes when the nest is wounded
  const wF = m.createInitialWorld();
  wF.mode = 'station';
  wF.stationIdx = 0;
  m.buildStationMap(wF, 'rust_plains', 1, '测试站', 'abandoned_halt', 0, false);
  const fNest = wF.props.find((pr) => pr.kind === 'monster_nest');
  assert.ok(!wF.monsters.some((mo) => mo.elite), 'First stop starts without a guardian');
  assert.equal(fNest.guardianWoken, false);

  // Breaking a nest: short rumble, then a strong wave bursts out where it stood
  wF.player.hp = 9999;
  wF.player.maxHp = 9999;
  wF.hotbar = 0;
  wF.player.x = fNest.x + fNest.r + 14;
  wF.player.y = fNest.y;
  wF.player.angle = Math.PI;
  wF.monsters = [];
  fNest.hp = 1;
  fNest.guardianWoken = true;
  m.handlePrimaryAction(wF, fNest.x, fNest.y);
  assert.ok(fNest.hp <= 0, 'Nest breaks');
  assert.equal(wF.nestEruptions.length, 1, 'A broken nest starts rumbling');
  assert.equal(wF.monsters.length, 0, 'Nothing bursts out instantly: there is time to back off');
  for (let i = 0; i < 70; i++) m.stepWorld(wF, idleInput, 0.05);
  assert.equal(wF.nestEruptions.length, 0);
  const burst = wF.monsters.filter((mo) => Math.hypot(mo.x - fNest.x, mo.y - fNest.y) < 400);
  assert.ok(burst.length >= 4, `A strong wave bursts out of the ruin (${burst.length})`);
  assert.ok(burst.some((mo) => mo.elite), 'The wave is led by an elite');

  // 14. Design §6: only station arrivals save; leaving the page writes a one-shot suspend save
  {
    const store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
    try {
      const wA = m.createInitialWorld();
      advanceToStation1(wA); // arrival writes the station checkpoint
      wA.monsters = [];
      assert.equal(m.getSaveSummary().suspended, false, 'Arrival checkpoint is the save');
      assert.equal(m.isSafeToAutosave, undefined, 'No timed autosave any more');
      // Leave the page mid-run: a suspend save, read once by continue, then gone
      wA.dayCount = 7;
      assert.ok(m.saveSuspend(wA));
      assert.equal(m.getSaveSummary().suspended, true, 'Continue offers the suspend save first');
      const resumed = m.loadWorld();
      assert.equal(resumed.dayCount, 7, 'Continue resumes where you left');
      assert.equal(m.getSaveSummary().suspended, false, 'Suspend save is deleted once read');
      assert.notEqual(m.loadWorld().dayCount, 7, 'Second continue falls back to the station checkpoint');
      // A dead run is never suspended, and dying drops any suspend save
      assert.ok(m.saveSuspend(wA));
      wA.player.hp = 0;
      m.stepWorld(wA, idleInput, 0.05);
      assert.equal(m.getSaveSummary().suspended, false, 'Death clears the suspend save');
      assert.equal(m.saveSuspend(wA), false, 'A dead run is never suspended');
      const rt = m.deserializeWorld(m.serializeWorld(wA));
      assert.ok(rt && rt.flatbeds.length === wA.flatbeds.length, 'Saved world round-trips');
    } finally {
      delete globalThis.window;
    }
  }

  // 15. Swings cost real stamina, refill waits a moment and is slow; weapons hit softer
  const wSt = m.createInitialWorld();
  wSt.monsters = [];
  wSt.hotbar = 0;
  const swingCost = m.MELEE_META[wSt.player.meleeWeapon].stamina;
  const target = m.createMonster('hound', wSt.player.x + 30, wSt.player.y, wSt.player.onTrain ?? false, 1);
  target.hp = target.maxHp = 9999;
  wSt.monsters.push(target);
  m.handlePrimaryAction(wSt, target.x, target.y);
  assert.ok(target.hp < 9999, 'Swing lands');
  assert.equal(Math.round(wSt.player.stamina), 100 - swingCost, `A combat swing costs ${swingCost} stamina`);
  assert.ok(9999 - target.hp <= 15, `Melee damage is modest (${9999 - target.hp})`);
  m.stepWorld(wSt, idleInput, 0.5);
  assert.equal(Math.round(wSt.player.stamina), 100 - swingCost, 'No refill right after a swing');
  for (let i = 0; i < 20; i++) m.stepWorld(wSt, idleInput, 0.05);
  assert.ok(wSt.player.stamina > 100 - swingCost && wSt.player.stamina < 100 - swingCost + 12, `Refill is slow (${wSt.player.stamina.toFixed(1)})`);
  wSt.player.stamina = swingCost - 1;
  wSt.player.attackCd = 0;
  const hpBefore = target.hp;
  m.handlePrimaryAction(wSt, target.x, target.y);
  assert.equal(target.hp, hpBefore, 'Too tired to swing');
  assert.ok(m.RANGED_META.rifle.dmg < 40 && m.MELEE_META.axe.dmg < 25, 'Weapon damage toned down');

  // 16. A looted crossbow equips itself and always gets a hotbar slot
  const wX = m.createInitialWorld();
  wX.monsters = [];
  const bars = m.getHotbarBindings(wX);
  for (let i = 1; i < bars.length; i++) bars[i] = { kind: 'item', key: i % 2 ? 'water' : 'cookedFood' };
  m.giveItem(wX, 'gearCrossbow', 1, false);
  m.giveItem(wX, 'bolts', 6, false);
  m.stepWorld(wX, idleInput, 0.016);
  assert.ok(wX.player.ownedRangedWeapons.includes('crossbow'), 'Looted crossbow equips itself');
  assert.equal(m.getItemCount(wX, 'gearCrossbow'), 0, 'The gear item is consumed');
  const xbSlot = m.getHotbarBindings(wX).findIndex((b) => b && b.kind === 'ranged' && b.weapon === 'crossbow');
  assert.ok(xbSlot > 0, 'Crossbow takes a hotbar slot even when the bar was full');
  wX.hotbar = xbSlot;
  wX.player.attackCd = 0;
  const boltsBefore = m.getItemCount(wX, 'bolts');
  m.handlePrimaryAction(wX, wX.player.x + 200, wX.player.y);
  assert.equal(m.getItemCount(wX, 'bolts'), boltsBefore - 1, 'Selecting the slot and clicking fires a bolt');

  // 17. E targets what you point at / face, not whatever comes first in a fixed list
  const wI = m.createInitialWorld();
  wI.monsters = [];
  m.giveItem(wI, 'wood', 10);
  wI.selectedBuild = 'planter';
  wI.player.x = -150;
  wI.player.y = 0;
  const lp = m.getTileCenter(-1, 2, 3); // engine tile next to the lever, a door and hull plating
  assert.equal(m.tryPlaceBuilding(wI, lp.x, lp.y), null);
  const lpl = wI.locoDeck.buildings[0];
  lpl.planted = true;
  lpl.growth = 100;
  wI.player.x = lp.x + 4;
  wI.player.y = lp.y - 32;
  const aimAt = (x, y) => ({ ...idleInput, mouseWorldX: x, mouseWorldY: y });
  m.stepWorld(wI, aimAt(lp.x, lp.y), 0.016);
  assert.ok(wI.activeHint && wI.activeHint.label.includes('收获'), `Pointing at the planter targets it (got ${wI.activeHint?.label})`);
  assert.ok(Math.hypot(wI.activeHint.tx - lp.x, wI.activeHint.ty - lp.y) < 30, 'Highlight sits on the planter');
  m.stepWorld(wI, aimAt(136, 0), 0.016);
  assert.ok(wI.activeHint && wI.activeHint.label.includes('拉杆'), `Pointing at the lever targets it (got ${wI.activeHint?.label})`);

  // 18. No crafting cap on weapons/armour: first one is equipped, the next ones go into the bag
  const wC = m.createInitialWorld();
  wC.monsters = [];
  m.giveItem(wC, 'wood', 40);
  m.giveItem(wC, 'scrap', 30);
  m.giveItem(wC, 'cloth', 10);
  wC.selectedBuild = 'workbench';
  wC.player.x = -150;
  wC.player.y = 60;
  const wbTile = m.getTileCenter(0, 1, 1);
  assert.equal(m.tryPlaceBuilding(wC, wbTile.x, wbTile.y), null);
  const wbC = wC.flatbeds[0].buildings.find((b) => b.type === 'workbench');
  assert.equal(m.craftAtFacility(wC, wbC.uid, 'craft_crossbow'), null, 'First crossbow crafts');
  assert.ok(wC.player.ownedRangedWeapons.includes('crossbow'), 'and is equipped');
  assert.equal(m.craftAtFacility(wC, wbC.uid, 'craft_crossbow'), null, 'Owning one does not block crafting another');
  assert.equal(m.getItemCount(wC, 'gearCrossbow'), 1, 'The second crossbow lands in the backpack');
  assert.equal(m.craftAtFacility(wC, wbC.uid, 'craft_crossbow'), null);
  assert.equal(m.getItemCount(wC, 'gearCrossbow'), 2, 'and a third');
  m.stepWorld(wC, idleInput, 0.016);
  assert.equal(m.getItemCount(wC, 'gearCrossbow'), 2, 'Spares are not auto-consumed once you own one');

  // 20. Design §5.3: an elite sleeps on the exit track; the train can't leave until it's beaten
  const stationWithGuard = (boss = false) => {
    const ws = m.createInitialWorld();
    advanceToStation1(ws);
    ws.stationIdx = 1;
    if (boss) ws.selectedRoute = m.buildNextRoutes(3, false)[0];
    m.buildStationMap(ws, 'rust_plains', boss ? 4 : 1, 'test', 'abandoned_halt', 0, true);
    ws.mode = 'station';
    ws.trainSpeed = 0;
    ws.gear = 0;
    for (const pr of ws.props) if (pr.kind === 'monster_nest') pr.nestTimer = 1e9;
    ws.monsters = ws.monsters.filter((mo) => mo.guard);
    ws.player.x = 136;
    ws.player.y = 0;
    return ws;
  };
  const hitWith = (ws, mo, dmg) => {
    ws.projectiles.push({ x: mo.x, y: mo.y, vx: 0, vy: 0, dmg, ttl: 0.5, fromTurret: false, kind: 'bolt' });
    m.stepWorld(ws, idleInput, 0.016);
  };
  {
    const ws = stationWithGuard();
    const g = m.getExitGuard(ws);
    assert.ok(g && g.guard.asleep, 'Exit guard sleeps on the rails');
    assert.ok(Math.abs(g.y) < 1 && g.x > m.LOCO_W, 'It lies on the track ahead of the locomotive');
    ws.selectedRoute = ws.availableRoutes[0];
    assert.match(m.setThrottleGear(ws, 2) ?? '', /守关者/, 'Lever refuses while it lives');
    m.alertMonstersByNoise(ws, g.x, g.y, 500);
    m.stepWorld(ws, idleInput, 0.05);
    assert.equal(g.guard.asleep, true, 'Scavenging noise does not wake it');
    ws.player.x = g.x - 150;
    ws.player.y = 0;
    m.stepWorld(ws, idleInput, 0.05);
    assert.equal(g.guard.asleep, false, 'Coming close wakes it');
    // hole up on the train: it batters the train a while, then goes home and heals a little
    g.hp = Math.round(g.maxHp * 0.5);
    let slept = false;
    for (let i = 0; i < 900 && !slept; i++) {
      ws.player.hp = ws.player.maxHp;
      ws.player.x = 60;
      ws.player.y = 0;
      m.stepWorld(ws, idleInput, 0.05);
      slept = g.guard.asleep;
    }
    assert.ok(slept, 'Guard gives up on the train and goes back to sleep on its rails');
    assert.ok(g.hp > g.maxHp * 0.6 && g.hp < g.maxHp * 0.7, `and heals a little (${(g.hp / g.maxHp).toFixed(2)})`);
    hitWith(ws, g, 99999);
    assert.equal(m.getExitGuard(ws), null, 'Guard beaten');
    ws.player.x = 136;
    ws.player.y = 0;
    assert.equal(m.setThrottleGear(ws, 2), null, 'Exit track clear: the train can leave');
  }
  {
    // The act-end BOSS: every route converges on it; it fights in phases
    const ws = stationWithGuard(true);
    const b = m.getExitGuard(ws);
    assert.ok(b.boss && b.title === '铁闸之主', 'BOSS station has its BOSS on the exit track');
    const before = ws.monsters.length;
    hitWith(ws, b, Math.ceil(b.maxHp * 0.4));
    assert.equal(b.boss.phase, 1, 'BOSS enters phase 2 below 2/3 hp');
    assert.ok(ws.monsters.length >= before + 3, 'and calls in a pack');
    hitWith(ws, b, 99999);
    assert.equal(ws.stats.bossesKilled, 1);
    assert.equal(ws.zoneBanner.title, '第一幕 · 终');
  }
  {
    const w0 = m.createInitialWorld();
    advanceToStation1(w0);
    assert.equal(m.getExitGuard(w0), null, 'First station has no exit guard');
  }

  // 21. Design §4.3: boarders chase, leap and cling; each kind does its own thing; hit them from inside
  const roadWorld = () => {
    const wr = m.createInitialWorld();
    advanceToStation1(wr);
    wr.mode = 'wasteland';
    wr.props = [];
    wr.monsters = [];
    wr.roadEvents = [];
    wr.trainSpeed = 0;
    wr.gear = 0;
    wr.player.x = 100;
    wr.player.y = 0;
    return wr;
  };
  const runUntil = (wr, pred, secs) => {
    for (let i = 0; i < secs * 20 && !pred(); i++) {
      wr.player.hp = wr.player.maxHp;
      m.stepWorld(wr, idleInput, 0.05);
    }
    return pred();
  };
  {
    const wr = roadWorld();
    const [rip] = m.spawnBoarders(wr, 1, 1, ['ripper']);
    assert.ok(runUntil(wr, () => rip.board.phase === 'latched', 15), 'Ripper runs the train down and latches on');
    const panel = m.getAllHullPanels(wr).find((r) => r.panel.uid === rip.board.panelUid).panel;
    const hp0 = panel.hp;
    wr.trainSpeed = 130;
    wr.gear = 2;
    const x0 = rip.x;
    runUntil(wr, () => false, 3);
    assert.ok(Math.abs(rip.x - x0) < 1, 'Latched boarder rides with the train');
    assert.ok(panel.hp < hp0, 'Ripper tears at its plate');
    hitWith(wr, rip, 9999);
    assert.ok(wr.pickups.length > 0 && wr.pickups.every((pk) => pk.onTrain), 'Boarder loot drops inside the train');
  }
  {
    const wr = roadWorld();
    for (const { panel } of m.getAllHullPanels(wr)) if (panel.isDoor) panel.doorOpen = false;
    const [borer] = m.spawnBoarders(wr, 1, 1, ['borer']);
    assert.ok(runUntil(wr, () => borer.board?.phase === 'latched', 15), 'Borer latches on');
    runUntil(wr, () => borer.onTrain, 8);
    assert.equal(borer.onTrain, false, 'A shut train keeps the borer out');
    const side = borer.board.side;
    const door = m.getAllHullPanels(wr).find((r) => r.panel.isDoor && r.panel.side === side).panel;
    door.doorOpen = true;
    assert.ok(runUntil(wr, () => borer.onTrain, 20), 'Borer crawls to the open door and climbs in');
    assert.equal(borer.board, undefined);
  }
  {
    const wr = roadWorld();
    m.giveItem(wr, 'wood', 10);
    wr.buildMode = true;
    wr.selectedBuild = 'planter';
    const pc = m.getTileCenter(0, 4, 2);
    assert.equal(m.tryPlaceBuilding(wr, pc.x, pc.y), null);
    wr.buildMode = false;
    const pl = wr.flatbeds[0].buildings.find((b) => b.type === 'planter');
    pl.planted = true;
    pl.growth = 50;
    pl.watered = 999;
    const [cr] = m.spawnBoarders(wr, 1, 1, ['creeper']);
    assert.ok(runUntil(wr, () => !pl.planted, 40), 'Creeper crawls to the crops and wrecks them through the wall');
    assert.ok(cr.board && cr.board.phase === 'latched');
  }

  // 22. Design §4.2: road events — a handful per leg, one or two light raids, no repeats, one-offs once
  {
    const wr = roadWorld();
    wr.stationIdx = 2;
    for (let t = 0; t < 30; t++) {
      const plan = m.planRoadEvents(wr, 4000, 'rust_plains');
      assert.ok(plan.length >= 3 && plan.length <= 5, 'A handful of events per leg');
      assert.ok(plan.some((e) => e.kind === 'boarders'), 'At least one light raid');
      assert.ok(plan.filter((e) => e.kind === 'boarders').length <= 2, 'At most two raids');
      const others = plan.filter((e) => e.kind !== 'boarders').map((e) => e.kind);
      assert.equal(new Set(others).size, others.length, 'No repeats within a leg');
      assert.ok(plan.every((e, i) => e.at > 0.1 && e.at < 0.9 && (i === 0 || e.at > plan[i - 1].at)), 'Spread along the leg');
    }
    wr.eventFlags = { seen_graves: true, seen_ghost_train: true };
    for (let t = 0; t < 30; t++) {
      const kinds = m.planRoadEvents(wr, 4000, 'rust_plains').map((e) => e.kind);
      assert.ok(!kinds.includes('graves') && !kinds.includes('ghost_train'), 'One-off events happen once per run');
    }
    assert.equal(m.meetWaver(wr, 0, 0, () => 0), 'helped');
    let sawReturn = false;
    for (let t = 0; t < 40 && !sawReturn; t++) sawReturn = m.planRoadEvents(wr, 4000, 'rust_plains').some((e) => e.kind === 'waver_return');
    assert.ok(sawReturn, 'Helping the mutant unlocks its chained follow-up');
    // A raid is warned about first, then arrives
    wr.roadEvents = [{ at: 0.2, kind: 'boarders', fired: false }];
    wr.legDistance = wr.legTotal * 0.3;
    m.stepWorld(wr, idleInput, 0.05);
    assert.equal(wr.wavePhase, 'omen', 'Raid comes with a warning');
    assert.ok(wr.omenLabel.length > 0);
    runUntil(wr, () => wr.wavePhase === 'danger', 10);
    assert.ok(wr.monsters.some((mo) => mo.board), 'then boarders arrive');
    // Stopping out here no longer summons a siege
    wr.monsters = [];
    wr.roadEvents = [];
    wr.pendingOmen = null;
    runUntil(wr, () => false, 20);
    assert.equal(wr.monsters.length, 0, 'Stopping in the wasteland summons nothing by itself');
  }

  // 23. Uncoupling, and no more timed night raids
  {
    const wu = m.createInitialWorld();
    advanceToStation1(wu);
    m.giveItem(wu, 'coupler', 2);
    m.giveItem(wu, 'scrap', 20);
    m.giveItem(wu, 'wood', 20);
    m.tryAttachCarriage(wu, true);
    m.tryAttachCarriage(wu, true);
    assert.equal(m.uncoupleFrom(wu, 0), 0, 'The core carriage cannot be uncoupled');
    assert.equal(m.uncoupleFrom(wu, 1), 2, 'Uncoupling drops that carriage and all behind it');
    assert.equal(wu.flatbeds.length, 1);
    wu.monsters = [];
    for (const pr of wu.props) if (pr.kind === 'monster_nest') pr.nestTimer = 1e9;
    wu.dayTime = 0.74;
    for (let i = 0; i < 800; i++) {
      wu.player.hp = wu.player.maxHp;
      m.stepWorld(wu, idleInput, 0.05);
    }
    assert.equal(wu.nightWavesLeft, 0, 'Nightfall no longer schedules raids');
  }

  console.log('ALL PENDING_FIXES VERIFICATION CHECKS PASSED!');
} finally {
  await server.close();
}
