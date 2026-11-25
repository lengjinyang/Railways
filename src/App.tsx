import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildingType } from './recipes_v2';
import { Renderer2D } from './art/Renderer2D';
import { sfx } from './sfx';
import {
  canAffordCost,
  craftItem,
  createInitialWorld,
  depositAllToOpenChest,
  dropHeldItemToGround,
  eatOrDrink,
  getItemCount,
  giveItem,
  handlePrimaryAction,
  pickUpGridItem,
  pickUpGroundLoot,
  placeHeldItemAt,
  quickStackToChests,
  quickTransferGridItem,
  returnHeldItemSafely,
  rotateHeldItem,
  selectRoute,
  shiftGear,
  spendCost,
  stepWorld,
  toggleFlashlight,
  triggerInteract,
  tryRemoveBuilding,
  upgradeBackpack,
  type GearLevel,
  type HotbarSlot,
  type InputState,
  type WorldState,
} from './world';
import { TitlePrologue } from './components/TitlePrologue';
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
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseDown: false,
  });
  const mouseScreenRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const [started, setStarted] = useState(false);
  const [prologueStep, setPrologueStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(sfx.muted);
  const [zoomPct, setZoomPct] = useState(100);
  const [, setHudTick] = useState(0);

  const startedRef = useRef(started);
  const prologueStepRef = useRef(prologueStep);
  const helpOpenRef = useRef(helpOpen);
  startedRef.current = started;
  prologueStepRef.current = prologueStep;
  helpOpenRef.current = helpOpen;

  const forceHudSync = useCallback(() => {
    setHudTick((n) => (n + 1) % 1000000);
  }, []);

  const isModalOpen = useCallback(() => {
    const w = worldRef.current;
    return (
      helpOpenRef.current ||
      w.craftOpen ||
      w.tradeOpen ||
      w.bagOpen ||
      w.routeOpen ||
      w.deathReport !== null ||
      w.gameOver
    );
  }, []);

  const closeAllModals = useCallback(() => {
    const w = worldRef.current;
    returnHeldItemSafely(w);
    w.craftOpen = false;
    w.tradeOpen = false;
    w.bagOpen = false;
    w.routeOpen = false;
    w.openChestUid = null;
    setHelpOpen(false);
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
      if (!startedRef.current || isModalOpen()) return;
      const pt = renderer.screenToWorld(e.clientX, e.clientY);
      const w = worldRef.current;
      if (e.button === 2) {
        tryRemoveBuilding(w, pt.x, pt.y);
        forceHudSync();
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
      if (!startedRef.current || isModalOpen()) return;
      const z = renderer.adjustZoom(e.deltaY);
      setZoomPct(Math.round(z * 100));
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('mouseup', onMouseUp);

    let rafId = 0;
    let lastT = performance.now();
    let hudAccum = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      const w = worldRef.current;
      const worldMouse = renderer.screenToWorld(mouseScreenRef.current.x, mouseScreenRef.current.y);
      inputRef.current.mouseWorldX = worldMouse.x;
      inputRef.current.mouseWorldY = worldMouse.y;

      if (startedRef.current && !isModalOpen()) {
        const prevDeath = w.deathReport;
        const prevGameOver = w.gameOver;
        const prevRoute = w.routeOpen;
        stepWorld(w, inputRef.current, dt);
        if (
          (!prevDeath && w.deathReport) ||
          (!prevGameOver && w.gameOver) ||
          (!prevRoute && w.routeOpen)
        ) {
          forceHudSync();
        }
      } else if (!startedRef.current) {
        // Gentle idle city escape animation behind Prologue card
        w.time += dt;
        w.worldScrollX += 46 * dt;
      }

      renderer.render(w, dt, worldMouse.x, worldMouse.y);

      if (startedRef.current) {
        hudAccum += dt;
        if (hudAccum >= 0.1) {
          hudAccum = 0;
          forceHudSync();
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
  }, [forceHudSync, isModalOpen]);

  // Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const w = worldRef.current;
      const inp = inputRef.current;

      if (!startedRef.current) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (prologueStepRef.current < 2) {
            setPrologueStep((s) => s + 1);
            sfx.lever();
          } else {
            setStarted(true);
            sfx.whistle();
            sfx.enterZone(w.zoneKind, w.zoneTier);
          }
        }
        return;
      }

      if (e.code === 'Escape') {
        returnHeldItemSafely(w);
        w.craftOpen = false;
        w.tradeOpen = false;
        w.bagOpen = false;
        w.routeOpen = false;
        w.openChestUid = null;
        w.buildMode = false;
        setHelpOpen(false);
        forceHudSync();
        return;
      }

      if (e.code === 'KeyR' && w.bagOpen && w.heldItem) {
        e.preventDefault();
        rotateHeldItem(w);
        forceHudSync();
        return;
      }

      if (e.code === 'KeyH') {
        if (w.deathReport || w.gameOver) return;
        setHelpOpen((o) => !o);
        sfx.uiClick();
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        if (w.deathReport || w.gameOver) return;
        returnHeldItemSafely(w);
        w.craftOpen = !w.craftOpen;
        w.tradeOpen = false;
        w.bagOpen = false;
        w.routeOpen = false;
        w.openChestUid = null;
        setHelpOpen(false);
        sfx.uiClick();
        forceHudSync();
        return;
      }

      if (e.code === 'KeyI') {
        if (w.deathReport || w.gameOver) return;
        if (w.bagOpen) returnHeldItemSafely(w);
        w.bagOpen = !w.bagOpen;
        if (!w.bagOpen) w.openChestUid = null;
        w.craftOpen = false;
        w.tradeOpen = false;
        w.routeOpen = false;
        setHelpOpen(false);
        sfx.uiClick();
        forceHudSync();
        return;
      }

      if (isModalOpen()) return;

      if (e.code === 'KeyW') inp.up = true;
      if (e.code === 'KeyS') inp.down = true;
      if (e.code === 'KeyA') inp.left = true;
      if (e.code === 'KeyD') inp.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = true;

      if (e.code === 'KeyE') {
        triggerInteract(w);
        forceHudSync();
      }
      if (e.code === 'KeyB') {
        w.buildMode = !w.buildMode;
        sfx.uiClick();
        forceHudSync();
      }
      if (e.code === 'KeyQ') {
        shiftGear(w, -1);
        forceHudSync();
      }
      if (e.code === 'KeyF') {
        shiftGear(w, 1);
        forceHudSync();
      }
      if (e.code === 'KeyL') {
        toggleFlashlight(w);
        forceHudSync();
      }
      if (e.code === 'KeyV') {
        if (rendererRef.current) {
          const z = rendererRef.current.resetZoom();
          setZoomPct(Math.round(z * 100));
          sfx.uiClick();
        }
      }
      if (e.key >= '1' && e.key <= '6') {
        const slot = (Number(e.key) - 1) as HotbarSlot;
        w.hotbar = slot;
        w.buildMode = slot === 5;
        if (slot === 3) eatOrDrink(w);
        forceHudSync();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      if (e.code === 'KeyW') inp.up = false;
      if (e.code === 'KeyS') inp.down = false;
      if (e.code === 'KeyA') inp.left = false;
      if (e.code === 'KeyD') inp.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [forceHudSync, isModalOpen]);

  const handleRestart = useCallback(() => {
    worldRef.current = createInitialWorld();
    setStarted(true);
    setHelpOpen(false);
    sfx.whistle();
    forceHudSync();
  }, [forceHudSync]);

  const hudActions: HudActions = {
    onShiftGearTo: (targetGear: GearLevel) => {
      const w = worldRef.current;
      const diff = targetGear - w.gear;
      if (diff === 0) return;
      const step = diff > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(diff); i++) {
        shiftGear(w, step);
      }
      forceHudSync();
    },
    onToggleRoute: () => {
      const w = worldRef.current;
      w.routeOpen = !w.routeOpen;
      w.craftOpen = false;
      w.tradeOpen = false;
      w.bagOpen = false;
      setHelpOpen(false);
      sfx.uiClick();
      forceHudSync();
    },
    onToggleLight: () => {
      toggleFlashlight(worldRef.current);
      forceHudSync();
    },
    onToggleBuild: () => {
      const w = worldRef.current;
      w.buildMode = !w.buildMode;
      sfx.uiClick();
      forceHudSync();
    },
    onToggleBag: () => {
      const w = worldRef.current;
      w.bagOpen = !w.bagOpen;
      if (!w.bagOpen) w.openChestUid = null;
      w.craftOpen = false;
      w.tradeOpen = false;
      w.routeOpen = false;
      setHelpOpen(false);
      sfx.uiClick();
      forceHudSync();
    },
    onToggleCraft: () => {
      const w = worldRef.current;
      w.craftOpen = !w.craftOpen;
      w.tradeOpen = false;
      w.bagOpen = false;
      w.routeOpen = false;
      w.openChestUid = null;
      setHelpOpen(false);
      sfx.uiClick();
      forceHudSync();
    },
    onResetZoom: () => {
      if (rendererRef.current) {
        const z = rendererRef.current.resetZoom();
        setZoomPct(Math.round(z * 100));
        sfx.uiClick();
      }
    },
    onToggleHelp: () => {
      setHelpOpen((o) => !o);
      sfx.uiClick();
    },
    onToggleMute: () => {
      sfx.muted = !sfx.muted;
      setMuted(sfx.muted);
    },
    onRestart: handleRestart,
    onSelectHotbar: (slot: HotbarSlot) => {
      const w = worldRef.current;
      w.hotbar = slot;
      w.buildMode = slot === 5;
      if (slot === 3) eatOrDrink(w);
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
    onClose: closeAllModals,
    onSelectRoute: (routeId: string) => {
      selectRoute(worldRef.current, routeId);
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
    onPickGridItem: (src, uid) => {
      pickUpGridItem(worldRef.current, src, uid);
      forceHudSync();
    },
    onPlaceGridItem: (src, x, y) => {
      placeHeldItemAt(worldRef.current, src, x, y);
      forceHudSync();
    },
    onQuickTransferItem: (src, uid) => {
      quickTransferGridItem(worldRef.current, src, uid);
      forceHudSync();
    },
    onPickGroundLoot: (pickupUid) => {
      pickUpGroundLoot(worldRef.current, pickupUid);
      forceHudSync();
    },
    onRotateHeld: () => {
      rotateHeldItem(worldRef.current);
      forceHudSync();
    },
    onDropHeld: () => {
      dropHeldItemToGround(worldRef.current);
      forceHudSync();
    },
    onUpgradeBackpack: () => {
      upgradeBackpack(worldRef.current);
      forceHudSync();
    },
    onCraft: (recipeId) => {
      craftItem(worldRef.current, recipeId);
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
          giveItem(w, 'scrap', bone * 4 + car * 5 + relic * 18);
          sfx.pickup();
        }
      } else if (t === 'buy-fuel' && canAffordCost(w, { scrap: 6 })) {
        spendCost(w, { scrap: 6 });
        giveItem(w, 'fuel', 3);
        sfx.pickup();
      } else if (t === 'buy-coupler' && canAffordCost(w, { scrap: 14 })) {
        spendCost(w, { scrap: 14 });
        giveItem(w, 'coupler', 1);
        sfx.pickup();
      } else if (t === 'buy-parts' && canAffordCost(w, { scrap: 8 })) {
        spendCost(w, { scrap: 8 });
        giveItem(w, 'parts', 2);
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
    onDismissDeath: () => {
      worldRef.current.deathReport = null;
      forceHudSync();
    },
    onRestart: handleRestart,
  };

  const w = worldRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c0a09]">
      {/* Painterly HiDPI 2D Top-Down Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 w-full h-full cursor-crosshair block" />

      {/* World Alerts, Vignettes, Radar & City Minimap */}
      {started && <WorldOverlay world={w} />}

      {/* Diegetic Brass HUD */}
      {started && (
        <HudPanels world={w} muted={muted} zoomPct={zoomPct} actions={hudActions} />
      )}

      {/* Modals */}
      {started && (
        <Modals
          world={w}
          helpOpen={helpOpen}
          onCloseHelp={() => setHelpOpen(false)}
          actions={modalActions}
        />
      )}

      {/* Atmospheric Opening Prologue over live 2D Burning City Escape */}
      {!started && (
        <TitlePrologue
          step={prologueStep}
          onNext={() => {
            if (prologueStep < 2) {
              setPrologueStep((s) => s + 1);
              sfx.lever();
            } else {
              setStarted(true);
              sfx.whistle();
              sfx.enterZone(w.zoneKind, w.zoneTier);
            }
          }}
          onSkip={() => {
            setStarted(true);
            sfx.whistle();
            sfx.enterZone(w.zoneKind, w.zoneTier);
          }}
        />
      )}
    </div>
  );
};
