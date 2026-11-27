import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildingType } from './recipes_v2';
import { Renderer2D } from './art/Renderer2D';
import { sfx } from './sfx';
import {
  addFloat,
  bindHotbarSlot,
  bindItemToHotbar,
  canAffordCost,
  clearSavedWorld,
  craftAtFacility,
  createInitialWorld,
  depositAllToOpenChest,
  dropBackpackSlot,
  equipBodyArmor,
  equipHeadArmor,
  equipRangedWeapon,
  findBuildingByUid,
  getItemCount,
  getSaveSummary,
  giveItem,
  handlePrimaryAction,
  loadWorld,
  quickStackToChests,
  rollbackToStationSave,
  saveSuspend,
  clearSuspend,
  selectRoute,
  setThrottleGear,
  sortInventoryGrid,
  spendCost,
  stepWorld,
  swapHotbarSlots,
  takeAllFromOpenContainer,
  toggleLantern,
  transferSlotBetween,
  triggerInteract,
  tryRemoveBuilding,
  upgradeBackpack,
  upgradeBuildingInPlace,
  useBackpackSlot,
  type GearLevel,
  type HotbarSlot,
  type InputState,
  type SaveSummary,
  type WorldState,
} from './world';
import { TitlePrologue } from './components/TitlePrologue';
import { ConfirmNewGame } from './components/ConfirmNewGame';
import { HudPanels, type HudActions } from './components/HudPanels';
import { WorldOverlay } from './components/WorldOverlay';
import { Modals, type ModalActions } from './components/Modals';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer2D | null>(null);
  const worldRef = useRef<WorldState>(createInitialWorld());
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    holdE: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseDown: false,
  });
  const mouseScreenRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const eKeyDownAtRef = useRef<number | null>(null);

  const [started, setStarted] = useState(false);
  const [prologueStep, setPrologueStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Pending "this will overwrite / erase your save" question, if any. */
  const [confirmNewGame, setConfirmNewGame] = useState<null | 'title' | 'restart'>(null);
  const confirmNewGameRef = useRef(confirmNewGame);
  confirmNewGameRef.current = confirmNewGame;
  const saveSummaryRef = useRef<SaveSummary | null>(null);
  const [muted, setMuted] = useState(sfx.muted);
  const [zoomPct, setZoomPct] = useState(100);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(() => getSaveSummary());
  /** performance.now() of the last save of any kind (timed, station checkpoint, manual) — drives the HUD badge. */
  const [savedFlashAt, setSavedFlashAt] = useState(0);
  saveSummaryRef.current = saveSummary;
  const [, setHudTick] = useState(0);

  const startedRef = useRef(started);
  const prologueStepRef = useRef(prologueStep);
  const menuOpenRef = useRef(menuOpen);
  startedRef.current = started;
  prologueStepRef.current = prologueStep;
  menuOpenRef.current = menuOpen;

  const forceHudSync = useCallback(() => {
    setHudTick((n) => (n + 1) % 1000000);
  }, []);  /** ONLY Esc Menu, Death, and Victory pause the world! Sidebars keep the world running live (D + U8). */
  const isWorldPaused = useCallback(() => {
    const w = worldRef.current;
    return menuOpenRef.current || w.deathReport !== null || w.gameOver || w.victory;
  }, []);

  const hasOpenSidebar = useCallback(() => {
    const w = worldRef.current;
    return (
      w.bagOpen ||
      w.routeOpen ||
      w.tradeOpen ||
      w.throttleOpen ||
      w.openChestUid !== null ||
      w.openContainerUid !== null ||
      w.openFacilityUid !== null
    );
  }, []);

  const closeAllSidebars = useCallback(() => {
    const w = worldRef.current;
    w.bagOpen = false;
    w.routeOpen = false;
    w.tradeOpen = false;
    w.throttleOpen = false;
    w.openChestUid = null;
    w.openContainerUid = null;
    w.openFacilityUid = null;
    forceHudSync();
  }, [forceHudSync]);

  // Initialize Painterly 2D Top-Down Renderer & 60fps Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer2D(canvas);
    rendererRef.current = renderer;

    const onMouseMove = (e: MouseEvent) => {
      mouseScreenRef.current.x = e.clientX;
      mouseScreenRef.current.y = e.clientY;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!startedRef.current || isWorldPaused()) return;
      const pt = renderer.screenToWorld(e.clientX, e.clientY);
      const w = worldRef.current;
      if (e.button === 2) {
        if (w.buildMode) {
          tryRemoveBuilding(w, pt.x, pt.y);
          forceHudSync();
        }
        return;
      }
      if (e.button === 0) {
        inputRef.current.mouseDown = true;
        handlePrimaryAction(w, pt.x, pt.y);
        forceHudSync();
      }
    };

    const onMouseUp = () => {
      inputRef.current.mouseDown = false;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      if (!startedRef.current || isWorldPaused()) return;
      if (e.ctrlKey) {
        e.preventDefault();
        const z = renderer.adjustZoom(e.deltaY);
        setZoomPct(Math.round(z * 100));
        return;
      }
      // Scroll wheel cycles the 6 hotbar slots (build mode is its own toggle on B)
      const w = worldRef.current;
      if (w.buildMode) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      w.hotbar = ((w.hotbar + dir + 6) % 6) as HotbarSlot;
      forceHudSync();
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mouseup', onMouseUp);

    let rafId = 0;
    let lastT = performance.now();
    let hudAccum = 0;
    let lastSig = '';
    let seenSavedAt = worldRef.current.lastSavedAt;
    let seenWorld = worldRef.current;

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      const w = worldRef.current;
      const worldMouse = renderer.screenToWorld(mouseScreenRef.current.x, mouseScreenRef.current.y);
      inputRef.current.mouseWorldX = worldMouse.x;
      inputRef.current.mouseWorldY = worldMouse.y;

      if (startedRef.current && !isWorldPaused()) {
        stepWorld(w, inputRef.current, dt);
        if (w !== seenWorld) {
          // Loaded / restarted / rolled back: not a new save, just a new world to watch
          seenWorld = w;
          seenSavedAt = w.lastSavedAt;
        } else if (w.lastSavedAt !== seenSavedAt) {
          // A station checkpoint refreshes the title card + badge
          seenSavedAt = w.lastSavedAt;
          setSaveSummary(getSaveSummary());
          setSavedFlashAt(performance.now());
        }
      } else {
        sfx.updateAmbient(dt, 0, w.weather, 0, w.zoneKind, false);
        if (!startedRef.current) {
          w.time += dt;
          w.worldScrollX += 42 * dt;
        }
      }

      renderer.render(w, dt, worldMouse.x, worldMouse.y);

      // Z5: Only re-render React HUD when visible UI state actually changes (or slow 250ms tick)
      if (startedRef.current) {
        hudAccum += dt;
        if (hudAccum >= 0.16) {
          hudAccum = 0;
          const sig = [
            Math.round(w.player.hp),
            Math.round(w.player.hunger),
            Math.round(w.player.thirst),
            Math.round(w.player.bodyTemp),
            Math.round(w.player.sickTimer),
            Math.round(w.boilerFuel * 2),
            Math.round(w.boilerPressure),
            w.gear,
            w.mode,
            w.weather,
            w.wavePhase,
            w.lootFeed.length,
            w.lootFeed[w.lootFeed.length - 1]?.count ?? 0,
            w.zoneBanner ? Math.round(w.zoneBanner.timer * 4) : 0,
            w.activeCard ? 1 : 0,
            w.bagOpen ? 1 : 0,
            w.routeOpen ? 1 : 0,
            w.tradeOpen ? 1 : 0,
            w.throttleOpen ? 1 : 0,
            w.openChestUid ?? '',
            w.openContainerUid ?? '',
            w.openFacilityUid ?? '',
            w.deathReport ? 1 : 0,
            w.hotbar,
            (w.hotbarBindings ?? []).map((b) => (b ? (b.kind === 'ranged' ? b.weapon : b.kind === 'item' ? b.key : 't') : '-')).join(','),
            w.player.ownedRangedWeapons.length,
            Math.round(w.legDistance / 2),
            Math.round(w.trainSpeed / 6),
            w.waveIndex,
          ].join('|');
          if (sig !== lastSig || hasOpenSidebar()) {
            lastSig = sig;
            forceHudSync();
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      rendererRef.current = null;
    };
  }, [forceHudSync, hasOpenSidebar, isWorldPaused]);

  // Simplified ~10 Keybindings (U7: WASD/Shift, E/Hold-E, 1-6, Tab, B, M, R, Esc; removed Q/F/I/L/V/H!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const w = worldRef.current;
      const inp = inputRef.current;

      if (confirmNewGameRef.current) {
        // Only Esc (cancel) works while the overwrite question is up; Space/Enter never confirm it.
        if (e.code === 'Escape') {
          e.preventDefault();
          setConfirmNewGame(null);
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault(); // never activates a dialog button by keyboard accident
        }
        return;
      }

      if (!startedRef.current) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (prologueStepRef.current < 2) {
            setPrologueStep((s) => s + 1);
            sfx.lever();
          } else {
            requestTitleStartRef.current();
          }
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (w.deathReport || w.gameOver) return;
        if (w.buildMode) {
          w.buildMode = false;
          forceHudSync();
          return;
        }
        if (hasOpenSidebar()) {
          closeAllSidebars();
          return;
        }
        setMenuOpen((o) => !o);
        sfx.uiClick();
        return;
      }

      if (isWorldPaused()) return;

      if (e.code === 'Tab') {
        e.preventDefault();
        w.bagOpen = !w.bagOpen;
        if (!w.bagOpen) w.openChestUid = null;
        w.routeOpen = false;
        w.tradeOpen = false;
        w.openContainerUid = null;
        w.openFacilityUid = null;
        sfx.uiClick();
        forceHudSync();
        return;
      }

      if (e.code === 'KeyM') {
        w.routeOpen = !w.routeOpen;
        w.bagOpen = false;
        w.tradeOpen = false;
        w.openContainerUid = null;
        w.openFacilityUid = null;
        sfx.uiClick();
        forceHudSync();
        return;
      }

      if (e.code === 'KeyB') {
        w.buildMode = !w.buildMode;
        sfx.uiClick();
        forceHudSync();
        return;
      }

      if (e.code === 'KeyF' && !e.repeat) {
        toggleLantern(w);
        forceHudSync();
        return;
      }

      if (e.code === 'KeyR' && w.openContainerUid) {
        takeAllFromOpenContainer(w);
        forceHudSync();
        return;
      }

      if (e.code === 'KeyW') inp.up = true;
      if (e.code === 'KeyS') inp.down = true;
      if (e.code === 'KeyA') inp.left = true;
      if (e.code === 'KeyD') inp.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = true;

      if (e.code === 'KeyE' && !e.repeat) {
        if (w.activeHint && !w.activeHint.holdAction) {
          // Nothing to hold here (harvest, water, open…): act right away, however long the key stays down.
          eKeyDownAtRef.current = null;
          triggerInteract(w);
          forceHudSync();
        } else {
          inp.holdE = true;
          eKeyDownAtRef.current = performance.now();
        }
      }

      if (e.key >= '1' && e.key <= '6') {
        const slot = (Number(e.key) - 1) as HotbarSlot;
        w.hotbar = slot;
        w.buildMode = false;
        forceHudSync();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const w = worldRef.current;
      const inp = inputRef.current;
      if (e.code === 'KeyW') inp.up = false;
      if (e.code === 'KeyS') inp.down = false;
      if (e.code === 'KeyA') inp.left = false;
      if (e.code === 'KeyD') inp.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = false;

      if (e.code === 'KeyE') {
        const downAt = eKeyDownAtRef.current;
        eKeyDownAtRef.current = null;
        inp.holdE = false;
        const heldMs = downAt ? performance.now() - downAt : 0;
        // Short tap E on a holdable target (chest, container…) still does its tap action.
        if (downAt && heldMs < 280 && !isWorldPaused() && startedRef.current) {
          w.holdAction = null;
          triggerInteract(w);
          forceHudSync();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [closeAllSidebars, forceHudSync, hasOpenSidebar, isWorldPaused]);

  // Design §6: only station arrivals save. Leaving the page (tab switch, minimise, close, reload)
  // writes a one-shot suspend save; coming back to the page drops it again, so it can't be used
  // to undo a death later on.
  useEffect(() => {
    const saveOnLeave = () => {
      if (!startedRef.current) return;
      saveSuspend(worldRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveOnLeave();
      else if (startedRef.current) clearSuspend();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveOnLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveOnLeave);
    };
  }, []);

  const handleContinueSave = useCallback(() => {
    const loaded = loadWorld();
    if (!loaded) return;
    worldRef.current = loaded;
    setStarted(true);
    setMenuOpen(false);
    sfx.whistle();
    sfx.enterZone(loaded.zoneKind, loaded.zoneTier);
    forceHudSync();
  }, [forceHudSync]);

  /** "Take a break": suspend the run as it is and go back to the title. Continue resumes it once. */
  const handleManualSave = useCallback(() => {
    if (saveSuspend(worldRef.current)) window.location.reload();
  }, []);

  /** Begin the fresh run that's already waiting in worldRef (title screen). */
  const beginFreshRun = useCallback(() => {
    const w = worldRef.current;
    setConfirmNewGame(null);
    setStarted(true);
    sfx.whistle();
    sfx.enterZone(w.zoneKind, w.zoneTier);
  }, []);

  /** Title "start" / "skip": ask first if a save would get overwritten. */
  const requestTitleStart = useCallback(() => {
    if (saveSummaryRef.current) {
      setConfirmNewGame('title');
      sfx.uiClick();
    } else {
      beginFreshRun();
    }
  }, [beginFreshRun]);
  const requestTitleStartRef = useRef(requestTitleStart);
  requestTitleStartRef.current = requestTitleStart;

  const handleRestart = useCallback(() => {
    setConfirmNewGame(null);
    clearSavedWorld();
    setSaveSummary(null);
    worldRef.current = createInitialWorld();
    setStarted(true);
    setMenuOpen(false);
    sfx.whistle();
    forceHudSync();
  }, [forceHudSync]);

  const hudActions: HudActions = {
    onSetThrottleGear: (g: GearLevel) => {
      const err = setThrottleGear(worldRef.current, g);
      if (err) addFloat(worldRef.current, 136, -24, err, '#e07a7a');
      forceHudSync();
    },
    onToggleRoute: () => {
      const w = worldRef.current;
      w.routeOpen = !w.routeOpen;
      w.bagOpen = false;
      w.tradeOpen = false;
      sfx.uiClick();
      forceHudSync();
    },
    onSelectHotbar: (slot: HotbarSlot) => {
      const w = worldRef.current;
      w.hotbar = slot;
      w.buildMode = false;
      forceHudSync();
    },
    onToggleBuild: () => {
      const w = worldRef.current;
      w.buildMode = !w.buildMode;
      sfx.uiClick();
      forceHudSync();
    },
    onToggleLantern: () => {
      toggleLantern(worldRef.current);
      forceHudSync();
    },
    onBindItem: (slot, key) => {
      bindItemToHotbar(worldRef.current, slot, key);
      forceHudSync();
    },
    onSwapHotbar: (a, b) => {
      swapHotbarSlots(worldRef.current, a, b);
      sfx.uiClick();
      forceHudSync();
    },
    onClearHotbar: (slot) => {
      bindHotbarSlot(worldRef.current, slot, null);
      sfx.uiClick();
      forceHudSync();
    },
    onSelectBuild: (bId: BuildingType) => {
      const w = worldRef.current;
      w.selectedBuild = bId;
      w.buildMode = true;
      sfx.uiClick();
      forceHudSync();
    },
  };

  const modalActions: ModalActions = {
    onCloseSidebars: closeAllSidebars,
    onSetNotebookTab: (tab) => {
      worldRef.current.notebookTab = tab;
      sfx.uiClick();
      forceHudSync();
    },
    onSelectRoute: (routeId) => {
      selectRoute(worldRef.current, routeId);
      forceHudSync();
    },
    onSortInventory: (src) => {
      sortInventoryGrid(worldRef.current, src);
      forceHudSync();
    },
    onQuickStack: () => {
      quickStackToChests(worldRef.current);
      forceHudSync();
    },
    onDepositAll: () => {
      depositAllToOpenChest(worldRef.current);
      forceHudSync();
    },
    onTransferSlot: (from, slotIdx) => {
      transferSlotBetween(worldRef.current, from, slotIdx);
      forceHudSync();
    },
    onTakeAllContainer: () => {
      takeAllFromOpenContainer(worldRef.current);
      forceHudSync();
    },
    onDropBackpackSlot: (slotIdx) => {
      dropBackpackSlot(worldRef.current, slotIdx);
      forceHudSync();
    },
    onUseBackpackSlot: (slotIdx) => {
      useBackpackSlot(worldRef.current, slotIdx);
      forceHudSync();
    },
    onBindItem: (slot, key) => {
      bindItemToHotbar(worldRef.current, slot, key);
      forceHudSync();
    },
    onUpgradeBackpack: () => {
      upgradeBackpack(worldRef.current);
      forceHudSync();
    },
    onEquipBodyArmor: (aid) => {
      equipBodyArmor(worldRef.current, aid);
      sfx.uiClick();
      forceHudSync();
    },
    onEquipHeadArmor: (hid) => {
      equipHeadArmor(worldRef.current, hid);
      sfx.uiClick();
      forceHudSync();
    },
    onEquipRanged: (wid) => {
      equipRangedWeapon(worldRef.current, wid);
      sfx.uiClick();
      forceHudSync();
    },
    onCraftAtFacility: (facUid, recipeId) => {
      const err = craftAtFacility(worldRef.current, facUid, recipeId);
      if (err) sfx.gridDeny();
      forceHudSync();
    },
    onUpgradeFacility: (facUid) => {
      const b = findBuildingByUid(worldRef.current, facUid);
      if (b) {
        const err = upgradeBuildingInPlace(worldRef.current, b);
        if (err) sfx.gridDeny();
      }
      forceHudSync();
    },
    onTrade: (t) => {
      const w = worldRef.current;
      if (t === 'sell-trophy') {
        const bone = getItemCount(w, 'bone');
        const car = getItemCount(w, 'carapace');
        const relic = getItemCount(w, 'ancientRelic');
        if (bone + car + relic > 0) {
          spendCost(w, { bone, carapace: car, ancientRelic: relic });
          giveItem(w, 'scrap', bone * 3 + car * 5 + relic * 18);
          sfx.pickup();
        }
      } else if (t === 'buy-crystal' && canAffordCost(w, { scrap: 7 })) {
        spendCost(w, { scrap: 7 });
        giveItem(w, 'magicShard', 2);
        sfx.crystalCharge();
      } else if (t === 'buy-coupler' && canAffordCost(w, { scrap: 14 })) {
        spendCost(w, { scrap: 14 });
        giveItem(w, 'coupler', 1);
        sfx.pickup();
      } else if (t === 'buy-parts' && canAffordCost(w, { scrap: 8 })) {
        spendCost(w, { scrap: 8 });
        giveItem(w, 'parts', 2);
        sfx.pickup();
      } else if (t === 'buy-copper' && canAffordCost(w, { scrap: 7 })) {
        spendCost(w, { scrap: 7 });
        giveItem(w, 'copper', 2);
        sfx.pickup();
      } else if (t === 'buy-rail' && canAffordCost(w, { scrap: 6 })) {
        spendCost(w, { scrap: 6 });
        giveItem(w, 'rails', 1);
        sfx.pickup();
      } else if (t === 'buy-seed' && canAffordCost(w, { scrap: 4 })) {
        spendCost(w, { scrap: 4 });
        giveItem(w, 'seeds', 2);
        sfx.pickup();
      }
      forceHudSync();
    },
    onRollbackStation: () => {
      worldRef.current = rollbackToStationSave(worldRef.current);
      sfx.whistle();
      forceHudSync();
    },
    onCloseMenu: () => {
      setMenuOpen(false);
      sfx.uiClick();
    },
    onToggleMute: () => {
      sfx.muted = !sfx.muted;
      setMuted(sfx.muted);
    },
    onResetZoom: () => {
      if (rendererRef.current) {
        const z = rendererRef.current.resetZoom();
        setZoomPct(Math.round(z * 100));
        sfx.uiClick();
      }
    },
    onManualSave: handleManualSave,
    onRestart: () => {
      setConfirmNewGame('restart');
      sfx.uiClick();
    },
  };

  const w = worldRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c0a09]">
      <canvas ref={canvasRef} className="fixed inset-0 z-0 w-full h-full cursor-crosshair block" />

      {started && (
        <WorldOverlay
          world={w}
          onDismissCard={() => {
            worldRef.current.activeCard = null;
            forceHudSync();
          }}
        />
      )}

      {started && <HudPanels world={w} actions={hudActions} />}

      {started && (
        <Modals
          world={w}
          menuOpen={menuOpen}
          muted={muted}
          zoomPct={zoomPct}
          actions={modalActions}
        />
      )}

      {started && savedFlashAt > 0 && (
        <div
          key={savedFlashAt}
          className="pointer-events-none fixed top-[54px] right-5 z-20 flex items-center gap-1.5 text-[10.5px] tracking-wider text-ash anim-save-flash"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brass-hi animate-pulse" />
          已保存
        </div>
      )}

      {!started && (
        <TitlePrologue
          step={prologueStep}
          saveSummary={saveSummary}
          onContinueSave={handleContinueSave}
          onNext={() => {
            if (prologueStep < 2) {
              setPrologueStep((s) => s + 1);
              sfx.lever();
            } else {
              requestTitleStart();
            }
          }}
          onSkip={requestTitleStart}
        />
      )}

      {confirmNewGame && (
        <ConfirmNewGame
          save={saveSummary}
          reason={confirmNewGame}
          onCancel={() => {
            setConfirmNewGame(null);
            sfx.uiClick();
          }}
          onConfirm={confirmNewGame === 'restart' ? handleRestart : beginFreshRun}
        />
      )}
    </div>
  );
};
