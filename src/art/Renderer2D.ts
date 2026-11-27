import { BUILDINGS } from '../recipes_v2';
import type { ResourceKey } from '../inventory';
import {
  CAR_COLS,
  CAR_H,
  CAR_ROWS,
  CAR_W,
  CARRIAGE_ROLE_META,
  COUPLER_GAP,
  FOG_CELL_SIZE,
  HALF_H,
  ITEM_META,
  LOCO_BUILD_TILES,
  getDeck,
  trainDecks,
  LOCO_W,
  TILE,
  canAffordCost,
  getCarBounds,
  getCarriageRole,
  getHullSegment,
  getTileCenter,
  getTractionLimit,
  getTrainWeight,
  isHullPassage,
  getLightSources,
  playerHasHandLight,
  worldToTrainTile,
  type LightSource,
  type HullPanel,
  type PlacedBuilding,
  type WorldState,
  type ZoneKind,
} from '../world';
import {
  drawBuildingArt,
  drawLocomotiveArt,
  drawPlacedLantern,
  drawMonsterArt,
  drawPlayerArt,
  drawPropArt,
  rrect,
} from './sprites';
import { getArtPatterns, type ArtPatterns } from './textures';
import { BRASS_HI, INK, PARCHMENT, monoFont, uiFont } from './fonts';
import { sfx } from '../sfx';

interface SteamPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

interface EmberSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

function fillTiledRect(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  originX = rx,
  originY = ry
): void {
  if (rw <= 0 || rh <= 0) return;
  const tw = tile.width;
  const th = tile.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  const startX = originX + Math.floor((rx - originX) / tw) * tw;
  const startY = originY + Math.floor((ry - originY) / th) * th;
  for (let y = startY; y < ry + rh; y += th) {
    for (let x = startX; x < rx + rw; x += tw) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
}

/** Per-frame field-of-view: cone half-angle and soft edge in radians, distances in world px. */
interface VisionParams {
  range: number;
  half: number;
  feather: number;
  near: number;
  outside: number;
  /** 0 by day → 1 at night: how strongly light pools reveal the dark around them. */
  lightReveal: number;
}

export class Renderer2D {
  public zoom = 1.0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private fovCanvas: HTMLCanvasElement;
  private fovCtx: CanvasRenderingContext2D;
  private revealCanvas: HTMLCanvasElement;
  private revealCtx: CanvasRenderingContext2D;
  private visionSmooth: VisionParams | null = null;
  private frameLights: LightSource[] = [];
  private hearing = new Map<string, { stepT: number; growlT: number; pulse: number; jx: number; jy: number; loud: number }>();
  private hearingWorldTime = -1;
  private hearingSfxCd = 0;
  /** Per-frame: show hull HP bars on damaged panels (danger / attackers / building / player close). */
  private hullBarsVisible = false;
  private seamCanvas: HTMLCanvasElement;
  private seamCtx: CanvasRenderingContext2D;
  private patterns: ArtPatterns;

  private steamPuffs: SteamPuff[] = [];
  private embers: EmberSpark[] = [];
  private steamTimer = 0;
  private emberTimer = 0;

  private smoothCamX = 0;
  private smoothCamY = 0;
  private initializedCam = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.fovCanvas = document.createElement('canvas');
    this.fovCtx = this.fovCanvas.getContext('2d')!;
    this.revealCanvas = document.createElement('canvas');
    this.revealCtx = this.revealCanvas.getContext('2d')!;
    this.seamCanvas = document.createElement('canvas');
    this.seamCtx = this.seamCanvas.getContext('2d')!;
    this.patterns = getArtPatterns();
  }

  public adjustZoom(deltaY: number): number {
    this.zoom = Math.max(0.68, Math.min(1.45, this.zoom + (deltaY > 0 ? -0.07 : 0.07)));
    return this.zoom;
  }

  public resetZoom(): number {
    this.zoom = 1.0;
    return this.zoom;
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    return {
      x: (sx - w / 2) / this.zoom + this.smoothCamX,
      y: (sy - h / 2) / this.zoom + this.smoothCamY,
    };
  }

  private getAmbientLighting(w: WorldState): { darkness: number; tint: string } {
    const t = w.dayTime;
    let dark = 0;
    let tint = 'rgba(6, 9, 18, 1)';

    if (t >= 0.52 && t < 0.625) {
      const k = (t - 0.52) / 0.105;
      dark = k * 0.9;
      tint = k < 0.45 ? 'rgba(38, 18, 14, 1)' : 'rgba(6, 9, 18, 1)';
    } else if (t >= 0.625 && t <= 0.925) {
      dark = 0.92;
    } else if (t > 0.925) {
      dark = ((1 - t) / 0.075) * 0.92;
    } else if (t < 0.06) {
      dark = ((0.06 - t) / 0.06) * 0.24;
      tint = 'rgba(32, 22, 16, 1)';
    }

    if (w.weather === 'rainstorm') {
      dark = Math.min(0.94, dark + 0.14);
      tint = 'rgba(8, 14, 24, 1)';
    } else if (w.weather === 'blizzard') {
      dark = Math.min(0.9, dark + 0.1);
      tint = 'rgba(10, 18, 30, 1)';
    } else if (w.weather === 'fog') {
      dark = Math.min(0.88, Math.max(dark, 0.34));
      tint = 'rgba(20, 25, 32, 1)';
    } else if (w.weather === 'sandstorm') {
      dark = Math.min(0.85, Math.max(dark, 0.28));
      tint = 'rgba(42, 28, 16, 1)';
    } else if (w.wavePhase === 'omen') {
      // Subtle darkening horizon during wave omen (C)
      dark = Math.max(dark, 0.22);
    } else if (w.cityExitX > -450) {
      const citySmoke = Math.max(0, Math.min(1, (w.cityExitX + 450) / 950));
      if (citySmoke * 0.34 > dark) {
        dark = citySmoke * 0.34;
        tint = 'rgba(22, 13, 12, 1)';
      }
    }

    return { darkness: dark, tint };
  }

  public render(w: WorldState, dt: number, mouseWorldX: number, mouseWorldY: number): void {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    if (this.canvas.width !== Math.floor(W * dpr) || this.canvas.height !== Math.floor(H * dpr)) {
      this.canvas.width = Math.floor(W * dpr);
      this.canvas.height = Math.floor(H * dpr);
    }

    if (!this.initializedCam) {
      this.smoothCamX = w.cameraX;
      this.smoothCamY = w.cameraY;
      this.initializedCam = true;
    } else {
      const aimOffX = Math.max(-42, Math.min(42, (mouseWorldX - w.cameraX) * 0.07));
      const aimOffY = Math.max(-32, Math.min(32, (mouseWorldY - w.cameraY) * 0.07));
      const lerp = Math.min(1, dt * 10);
      this.smoothCamX += (w.cameraX + aimOffX - this.smoothCamX) * lerp;
      this.smoothCamY += (w.cameraY + aimOffY - this.smoothCamY) * lerp;
    }

    const shakeX = w.shake > 0 ? (Math.random() - 0.5) * w.shake * 1.8 : 0;
    const shakeY = w.shake > 0 ? (Math.random() - 0.5) * w.shake * 1.8 : 0;

    this.updateAmbientVfx(w, dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Subtle epic camera pull-out during parallel ghost train or zone reveal (Z4)
    const epicPull = w.parallelTrainX !== null ? 0.86 : 1.0;
    const effZoom = this.zoom * epicPull;

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(effZoom, effZoom);
    ctx.translate(-this.smoothCamX, -this.smoothCamY);

    const halfW = W / (2 * effZoom) + 120;
    const halfH = H / (2 * effZoom) + 120;
    const viewLeft = this.smoothCamX - halfW;
    const viewRight = this.smoothCamX + halfW;
    const viewTop = this.smoothCamY - halfH;
    const viewBottom = this.smoothCamY + halfH;

    // 1. Ground
    this.drawGround(ctx, w, viewLeft, viewRight, viewTop, viewBottom);

    // 1.5 Uncanny Parallel Ghost Train Silhouette on far north track (H7 #7 / Z4)
    if (w.parallelTrainX !== null) {
      this.drawParallelGhostTrain(ctx, w.parallelTrainX);
    }

    // 2. Burning Parish Backdrop
    if (w.cityExitX > viewLeft - 380) {
      this.drawBurningCityBackdrop(ctx, w, viewLeft, Math.min(viewRight, w.cityExitX));
    }

    // 3. Station Architecture
    if (w.stationRoads.length > 0 || w.stationRooms.length > 0) {
      this.drawStationArchitecture(ctx, w, viewLeft, viewRight, viewTop, viewBottom);
    }

    // 4. Railway & Track Hazards
    this.drawTracks(ctx, w, viewLeft, viewRight);

    // 5. World Props
    for (const pr of w.props) {
      if (pr.used) continue;
      if (pr.x < viewLeft - 90 || pr.x > viewRight + 90 || pr.y < viewTop - 90 || pr.y > viewBottom + 90) continue;
      drawPropArt(ctx, w, pr);
    }

    // 6. Train
    {
      const trainLeft = getCarBounds(Math.max(0, w.flatbeds.length - 1)).left;
      this.hullBarsVisible =
        w.buildMode ||
        w.wavePhase === 'danger' ||
        w.monsters.some((m) => m.hp > 0 && m.x > trainLeft - 160 && m.x < LOCO_W + 160 && Math.abs(m.y) < HALF_H + 160);
    }
    this.drawTrain(ctx, w);

    // 7. Build Ghost Hologram + Weight Preview (U8)
    if (w.buildMode) {
      this.drawBuildGhost(ctx, w, mouseWorldX, mouseWorldY);
    }

    // 8. Decoy Meat Beacon
    if (w.decoyPos) {
      const pulse = 1 + Math.sin(w.time * 10) * 0.2;
      ctx.strokeStyle = 'rgba(217, 177, 95, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.decoyPos.x, w.decoyPos.y, 24 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c9624b';
      ctx.beginPath();
      ctx.arc(w.decoyPos.x, w.decoyPos.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Ground Pickups (Uniform dim glint, NO loot-game rarity colors/beams! F/U2)
    for (const pk of w.pickups) {
      if (pk.amount <= 0) continue;
      const meta = ITEM_META[pk.key];
      const bob = Math.sin(w.time * 4 + pk.x) * 1.6;
      const glint = 0.25 + Math.sin(w.time * 5 + pk.y) * 0.15;

      ctx.fillStyle = `rgba(225, 210, 175, ${glint})`;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#181412';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const distP = Math.hypot(pk.x - w.player.x, pk.y - w.player.y);
      if (distP < 200) {
        const tag = `${meta.short} ×${pk.amount}`;
        ctx.font = uiFont(10, 600);
        const tw = ctx.measureText(tag).width + 16;
        const fade = Math.min(1, (200 - distP) / 60);
        ctx.globalAlpha = fade;
        ctx.fillStyle = INK;
        ctx.strokeStyle = 'rgba(201, 149, 77, 0.35)';
        ctx.lineWidth = 1;
        rrect(ctx, pk.x - tw / 2, pk.y - 25, tw, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = meta.color;
        ctx.fillRect(pk.x - tw / 2 + 4, pk.y - 20, 2, 6);
        ctx.fillStyle = PARCHMENT;
        ctx.textAlign = 'center';
        ctx.fillText(tag, pk.x + 2, pk.y - 13.5);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }

    // 9.5 Flying Pickups arcing into player (U4)
    for (const fp of w.flyingPickups) {
      const k = Math.min(1, fp.progress);
      const ease = 1 - (1 - k) * (1 - k);
      const fx = fp.startX + (w.player.x - fp.startX) * ease;
      const fy = fp.startY + (w.player.y - fp.startY) * ease - Math.sin(k * Math.PI) * 28;
      ctx.fillStyle = fp.color;
      ctx.beginPath();
      ctx.arc(fx, fy, 4.5 * (1 - k * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    drawPlacedLantern(ctx, w);
    this.drawNestEruptions(ctx, w);

    // 10. Monsters (only what the player can actually see) & Player
    const vision = this.getVision(w, dt);
    for (const m of w.monsters) {
      if (m.x < viewLeft - 80 || m.x > viewRight + 80 || m.y < viewTop - 80 || m.y > viewBottom + 80) continue;
      const vis = this.visibilityAt(w, vision, m.x, m.y, m.r);
      if (vis <= 0.01) continue;
      ctx.globalAlpha = vis;
      drawMonsterArt(ctx, w, m);
      ctx.globalAlpha = 1;
    }
    drawPlayerArt(ctx, w);

    // 11. Projectiles
    ctx.save();
    ctx.lineCap = 'round';
    for (const pr of w.projectiles) {
      const isBolt = pr.kind === 'bolt';
      const isEnemy = !!pr.fromEnemy;
      ctx.strokeStyle = isEnemy ? '#e07a7a' : isBolt ? '#c49b6c' : '#ffd884';
      ctx.lineWidth = isBolt ? 2.2 : 2.8;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.036, pr.y - pr.vy * 0.036);
      ctx.stroke();
    }
    ctx.restore();

    // 12. Particles, Steam & Embers
    for (const pt of w.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sp of this.steamPuffs) {
      const p = 1 - sp.life / sp.maxLife;
      const rad = sp.r * (1 + p * 2.1);
      const sg = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, rad);
      sg.addColorStop(0, `rgba(215, 225, 232, ${(1 - p) * 0.3})`);
      sg.addColorStop(1, 'rgba(180, 175, 168, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const em of this.embers) {
      ctx.globalAlpha = Math.max(0, em.life / em.maxLife);
      ctx.fillStyle = '#e69445';
      ctx.beginPath();
      ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 12b. Fog of War at stations
    if (w.mode === 'station' && w.exploredFog.size > 0) {
      this.drawLostWorldFog(ctx, w, viewLeft, viewRight, viewTop, viewBottom);
    }

    ctx.restore();

    // 12c. Field of view: only what lies ahead is visible; the cone shortens at night
    this.drawVisionMask(w, W, H, shakeX, shakeY, effZoom, vision);
    ctx.drawImage(this.fovCanvas, 0, 0, W, H);

    // 13. Dynamic Lighting
    const { darkness, tint } = this.getAmbientLighting(w);
    if (darkness > 0.02) {
      this.drawAtmosphericLighting(ctx, w, W, H, darkness, tint, shakeX, shakeY, effZoom);
    }

    // 14. Weather Overlay
    this.drawWeather(ctx, w, W, H);

    // 14b. What you can't see, you can hear: ripples + panned footfalls for unseen movement
    this.drawHearingCues(ctx, w, dt, vision, W, H, shakeX, shakeY, effZoom);

    // 15. World-Space Floating Numbers, Hold-E Radial Progress Ring & Single [E] Hint
    this.drawCrispWorldOverlays(ctx, w, W, H, shakeX, shakeY, effZoom);
  }

  private drawParallelGhostTrain(ctx: CanvasRenderingContext2D, gx: number): void {
    ctx.save();
    ctx.globalAlpha = 0.28;
    // Far northern phantom rails
    ctx.fillStyle = '#181c24';
    ctx.fillRect(gx - 500, -440, 1500, 10);
    // Train silhouette
    ctx.fillStyle = '#0e1117';
    rrect(ctx, gx, -475, 160, 70, 5);
    ctx.fill();
    rrect(ctx, gx - 250, -472, 230, 64, 4);
    ctx.fill();
    rrect(ctx, gx - 500, -472, 230, 64, 4);
    ctx.fill();
    // Dim blue firebox light
    ctx.fillStyle = '#7cc4ff';
    ctx.beginPath();
    ctx.arc(gx + 150, -440, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private updateAmbientVfx(w: WorldState, dt: number): void {
    if (w.boilerFuel > 0) {
      this.steamTimer -= dt;
      const fuelRatio = Math.max(0.25, w.boilerFuel / Math.max(1, w.boilerMax));
      const interval = (w.gear === 3 ? 0.07 : w.gear === 2 ? 0.13 : w.gear === 1 ? 0.2 : 0.36) / fuelRatio;
      if (this.steamTimer <= 0) {
        this.steamTimer = interval;
        this.steamPuffs.push({
          x: 70,
          y: -28,
          vx: -48 - w.trainSpeed * 0.65 + (Math.random() - 0.5) * 16,
          vy: -14 + (Math.random() - 0.5) * 22,
          r: (10 + (w.trainSpeed / 205) * 8) * fuelRatio,
          life: 1.4,
          maxLife: 1.4,
        });
      }
    }
    for (let i = this.steamPuffs.length - 1; i >= 0; i--) {
      const s = this.steamPuffs[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.steamPuffs.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }

    if (w.cityExitX > -250) {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0 && this.embers.length < 44) {
        this.emberTimer = 0.09;
        this.embers.push({
          x: Math.min(w.cityExitX, this.smoothCamX + (Math.random() - 0.35) * 1100),
          y: this.smoothCamY + (Math.random() - 0.5) * 700,
          vx: -70 - Math.random() * 80,
          vy: (Math.random() - 0.5) * 45,
          life: 1.8 + Math.random() * 1.4,
          maxLife: 3.2,
          size: 1.4 + Math.random() * 1.6,
        });
      }
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.embers.splice(i, 1);
        continue;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  private drawGround(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    left: number,
    right: number,
    top: number,
    bottom: number
  ): void {
    const worldOriginX = -w.worldScrollX;
    const snow = w.weather === 'blizzard';
    const currKey: ZoneKind | 'snow' = snow ? 'snow' : w.zoneKind;
    const currTile = this.patterns.ground[currKey];

    const seamHalf = 220;
    const hasPrev = !snow && w.prevZoneKind !== null && w.prevZoneKind !== w.zoneKind && w.biomeSeamX + seamHalf > left;

    if (!hasPrev) {
      fillTiledRect(ctx, currTile, left, top, right - left, bottom - top, worldOriginX, 0);
      return;
    }

    const prevTile = this.patterns.ground[w.prevZoneKind!];
    const seamLeft = w.biomeSeamX - seamHalf;
    const seamRight = w.biomeSeamX + seamHalf;

    if (seamRight > left) {
      fillTiledRect(ctx, prevTile, left, top, Math.min(right, seamRight) - left, bottom - top, worldOriginX, 0);
    }
    if (seamRight < right) {
      const rx = Math.max(left, seamRight);
      fillTiledRect(ctx, currTile, rx, top, right - rx, bottom - top, worldOriginX, 0);
    }

    const bandLeft = Math.max(left, seamLeft);
    const bandRight = Math.min(right, seamRight);
    const bandW = Math.ceil(bandRight - bandLeft);
    const bandH = Math.ceil(bottom - top);
    if (bandW > 2 && bandH > 2) {
      if (this.seamCanvas.width < bandW || this.seamCanvas.height < bandH) {
        this.seamCanvas.width = Math.max(this.seamCanvas.width, bandW);
        this.seamCanvas.height = Math.max(this.seamCanvas.height, bandH);
      }
      const sctx = this.seamCtx;
      sctx.clearRect(0, 0, bandW, bandH);
      sctx.globalCompositeOperation = 'source-over';
      sctx.save();
      sctx.translate(-bandLeft, -top);
      fillTiledRect(sctx, currTile, bandLeft, top, bandW, bandH, worldOriginX, 0);
      sctx.restore();
      sctx.globalCompositeOperation = 'destination-in';
      const grad = sctx.createLinearGradient(seamLeft - bandLeft, 0, seamRight - bandLeft, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, bandW, bandH);
      sctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.seamCanvas, 0, 0, bandW, bandH, bandLeft, top, bandW, bandH);
    }
  }

  private drawBurningCityBackdrop(ctx: CanvasRenderingContext2D, w: WorldState, left: number, cityRight: number): void {
    if (cityRight <= left) return;
    const worldOriginX = -w.worldScrollX;
    fillTiledRect(ctx, this.patterns.asphalt, left, -520, cityRight - left, 405, worldOriginX, -520);
    fillTiledRect(ctx, this.patterns.asphalt, left, 115, cityRight - left, 405, worldOriginX, 115);

    const ex = w.cityExitX;
    for (const [py, ph] of [[-480, 355], [125, 355]] as const) {
      fillTiledRect(ctx, this.patterns.masonry, ex - 18, py, 32, ph, ex - 18, py);
      ctx.strokeStyle = '#171412';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex - 18, py, 32, ph);
    }

    const blockW = 250;
    const mod = w.worldScrollX % blockW;
    const bxStart = Math.floor((left + mod) / blockW) * blockW - mod;
    for (let bx = bxStart; bx < cityRight - 140; bx += blockW) {
      const idx = Math.round((bx + w.worldScrollX) / blockW);
      const h1 = 150 + (Math.abs(idx * 37) % 85);
      const h2 = 145 + (Math.abs(idx * 53) % 85);
      const blocks = [
        [bx + 18, -172 - h1, 190, h1, idx * 2],
        [bx + 24, 172, 184, h2, idx * 2 + 1],
      ] as const;
      for (const [rx, ry, rw, rh, seed] of blocks) {
        if (rx + rw > w.cityExitX - 24) continue;
        fillTiledRect(ctx, this.patterns.masonry, rx, ry, rw, rh, rx, ry);
        this.drawParishRoof(ctx, w, rx + 10, ry + 10, rw - 20, rh - 20, seed);
      }
    }
  }

  /** Top-down gabled roof: two slate planes lit from the north, a ridge, chimneys and the odd burnt-through hole. */
  private drawParishRoof(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    x: number,
    y: number,
    rw: number,
    rh: number,
    seed: number
  ): void {
    const hash = (n: number) => {
      const s = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const ridgeY = y + rh * (0.45 + hash(1) * 0.1);

    // North plane catches the cold sky light, south plane falls into shadow.
    const north = ctx.createLinearGradient(0, y, 0, ridgeY);
    north.addColorStop(0, '#2b2628');
    north.addColorStop(1, '#3a3233');
    ctx.fillStyle = north;
    ctx.fillRect(x, y, rw, ridgeY - y);
    const south = ctx.createLinearGradient(0, ridgeY, 0, y + rh);
    south.addColorStop(0, '#1d1a1c');
    south.addColorStop(1, '#141214');
    ctx.fillStyle = south;
    ctx.fillRect(x, ridgeY, rw, y + rh - ridgeY);

    // Slate courses
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ly = y + 7; ly < y + rh; ly += 7) {
      if (Math.abs(ly - ridgeY) < 3) continue;
      ctx.moveTo(x, ly + 0.5);
      ctx.lineTo(x + rw, ly + 0.5);
    }
    ctx.stroke();

    // Ridge cap
    ctx.fillStyle = '#463c3a';
    ctx.fillRect(x, ridgeY - 2, rw, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, ridgeY + 1, rw, 2);

    // Eave shadow inside the parapet
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, rw - 4, rh - 4);

    // Chimney stacks
    const chimneys = 1 + Math.floor(hash(2) * 2);
    for (let i = 0; i < chimneys; i++) {
      const cx = x + 18 + hash(3 + i) * (rw - 46);
      const cy = ridgeY - 26 + hash(5 + i) * 10;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cx + 4, cy + 4, 14, 14);
      ctx.fillStyle = '#4a3a32';
      ctx.fillRect(cx, cy, 14, 14);
      ctx.fillStyle = '#0c0a0a';
      ctx.fillRect(cx + 3, cy + 3, 8, 8);
    }

    // Burnt-through hole with smouldering rim on some roofs.
    if (hash(7) < 0.45) {
      const hx = x + 24 + hash(8) * (rw - 60);
      const hy = y + 18 + hash(9) * (rh - 44);
      const hr = 8 + hash(10) * 7;
      const flicker = 0.55 + 0.25 * Math.sin(w.time * (5 + hash(11) * 4) + seed) + 0.12 * Math.sin(w.time * 13 + seed * 3);
      const glow = ctx.createRadialGradient(hx, hy, hr * 0.3, hx, hy, hr * 2.6);
      glow.addColorStop(0, `rgba(255, 140, 60, ${0.55 * flicker})`);
      glow.addColorStop(0.45, `rgba(214, 84, 36, ${0.22 * flicker})`);
      glow.addColorStop(1, 'rgba(120, 30, 10, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(hx - hr * 2.6, hy - hr * 2.6, hr * 5.2, hr * 5.2);
      // Ragged opening: charred ring, then fire visible down inside the building.
      const ragged = (scale: number) => {
        ctx.beginPath();
        const pts = 11;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const rr = hr * scale * (0.72 + hash(20 + (i % pts)) * 0.5);
          const px = hx + Math.cos(a) * rr;
          const py = hy + Math.sin(a) * rr * 0.82;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };
      ctx.fillStyle = 'rgba(12, 9, 8, 0.85)';
      ragged(1.35);
      ctx.fill();
      const inner = ctx.createRadialGradient(hx, hy + hr * 0.25, 0, hx, hy, hr);
      inner.addColorStop(0, `rgba(255, 170, 80, ${0.9 * flicker})`);
      inner.addColorStop(0.45, `rgba(200, 70, 24, ${0.75 * flicker})`);
      inner.addColorStop(1, '#0a0605');
      ctx.fillStyle = inner;
      ragged(1);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 150, 70, ${0.55 * flicker})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawLostWorldFog(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number
  ): void {
    const ox = w.stationAnchorX;
    const cell = FOG_CELL_SIZE;
    const minFX = Math.floor((viewLeft - ox) / cell) - 1;
    const maxFX = Math.floor((viewRight - ox) / cell) + 1;
    const minFY = Math.floor(viewTop / cell) - 1;
    const maxFY = Math.floor(viewBottom / cell) + 1;

    const fogColor =
      w.zoneKind === 'ivy_city'
        ? 'rgba(12, 22, 16, 0.72)'
        : w.zoneKind === 'sinking_belt'
          ? 'rgba(16, 20, 26, 0.78)'
          : 'rgba(16, 14, 12, 0.72)';

    ctx.save();
    for (let fy = minFY; fy <= maxFY; fy++) {
      for (let fx = minFX; fx <= maxFX; fx++) {
        if (w.exploredFog.has(`${fx},${fy}`)) continue;
        const wx = ox + fx * cell;
        const wy = fy * cell;
        const g = ctx.createRadialGradient(wx + cell / 2, wy + cell / 2, cell * 0.25, wx + cell / 2, wy + cell / 2, cell * 0.85);
        g.addColorStop(0, fogColor);
        g.addColorStop(1, 'rgba(12, 10, 9, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(wx - cell * 0.35, wy - cell * 0.35, cell * 1.7, cell * 1.7);
      }
    }
    ctx.restore();
  }

  private drawStationArchitecture(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number
  ): void {
    const ox = w.stationAnchorX;
    for (const rd of w.stationRoads) {
      if (rd.x + rd.w < viewLeft || rd.x > viewRight || rd.y + rd.h < viewTop || rd.y > viewBottom) continue;
      fillTiledRect(ctx, this.patterns.asphalt, rd.x, rd.y, rd.w, rd.h, ox, 0);
    }

    const platX = -520 + ox;
    if (platX + 1040 > viewLeft && platX < viewRight) {
      fillTiledRect(ctx, this.patterns.platform, platX, -255, 1040, 130, platX, -255);
      ctx.strokeStyle = '#24201c';
      ctx.lineWidth = 2;
      ctx.strokeRect(platX, -255, 1040, 130);
      ctx.fillStyle = '#c48f2a';
      ctx.fillRect(-490 + ox, -138, 980, 5);
    }

    for (const rm of w.stationRooms) {
      if (rm.x + rm.w < viewLeft || rm.x > viewRight || rm.y + rm.h < viewTop || rm.y > viewBottom) continue;
      ctx.fillStyle = rm.floorColor;
      ctx.fillRect(rm.x, rm.y, rm.w, rm.h);
      ctx.fillStyle = rm.reqTool === 3 ? '#d9b15f' : rm.reqTool === 2 ? '#d9934c' : '#b8c4b2';
      ctx.font = uiFont(11, 600);
      ctx.globalAlpha = 0.82;
      ctx.fillText(rm.label, rm.x + 16, rm.y + 26);
      ctx.fillRect(rm.x + 16, rm.y + 32, 18, 1.5);
      ctx.globalAlpha = 1;
    }

    for (const wl of w.stationWalls) {
      if (wl.x + wl.w < viewLeft || wl.x > viewRight || wl.y + wl.h < viewTop || wl.y > viewBottom) continue;
      fillTiledRect(ctx, this.patterns.masonry, wl.x, wl.y, wl.w, wl.h, wl.x, wl.y);
      ctx.strokeStyle = '#1f1b18';
      ctx.lineWidth = 2;
      ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
    }

    for (const br of w.stationBarriers) {
      if (br.opened) continue;
      if (br.x + br.w < viewLeft || br.x > viewRight || br.y + br.h < viewTop || br.y > viewBottom) continue;
      const base = br.hitFlash > 0 ? '#fff' : br.reqTool === 1 ? '#7d522c' : br.reqTool === 2 ? '#556575' : '#3d485c';
      ctx.fillStyle = base;
      ctx.fillRect(br.x, br.y, br.w, br.h);
      const accent = br.reqTool === 3 ? '#d9b15f' : br.reqTool === 2 ? '#d9934c' : '#c99b56';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(br.x, br.y, br.w, br.h);
      if (br.hp < br.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(br.x, br.y + br.h + 4, br.w, 4);
        ctx.fillStyle = accent;
        ctx.fillRect(br.x + 1, br.y + br.h + 5, (br.w - 2) * (br.hp / br.maxHp), 2);
      }
    }
  }

  private drawTracks(ctx: CanvasRenderingContext2D, w: WorldState, left: number, right: number): void {
    fillTiledRect(ctx, this.patterns.ballast, left, -112, right - left, 224, -w.worldScrollX, -112);

    const step = 24;
    const off = w.worldScrollX % step;
    const sx = Math.floor((left + off) / step) * step - off;
    for (let x = sx; x < right; x += step) {
      ctx.fillStyle = '#4c3d30';
      ctx.fillRect(x, -76, 8, 152);
    }

    for (const ry of [-55, 49]) {
      ctx.fillStyle = '#86909c';
      ctx.fillRect(left, ry, right - left, 6);
    }

    // Track Hazards drawn directly in world (no radar popup needed, A!)
    for (const h of w.trackHazards) {
      if (h.kind === 'loose') {
        ctx.fillStyle = 'rgba(217, 155, 55, 0.18)';
        ctx.fillRect(h.x, -88, h.width, 176);
        ctx.strokeStyle = '#d99b37';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(h.x, -86, h.width, 172);
        ctx.setLineDash([]);
      } else if (h.kind === 'broken') {
        if (!h.repaired) {
          // Visible ground fissure + warning trackside flare lamp ahead of fissure!
          ctx.fillStyle = '#0d0909';
          rrect(ctx, h.x, -106, h.width, 212, 8);
          ctx.fill();
          ctx.strokeStyle = '#c94c4c';
          ctx.lineWidth = 2.8;
          ctx.stroke();

          // Trackside warning beacon 260px ahead of fissure so player spots it visually without a radar!
          const beaconX = h.x - 240;
          const blink = Math.sin(w.time * 9) > 0;
          ctx.fillStyle = '#2b2623';
          ctx.fillRect(beaconX - 3, -98, 6, 18);
          if (blink) {
            const bg = ctx.createRadialGradient(beaconX, -98, 2, beaconX, -98, 24);
            bg.addColorStop(0, 'rgba(240, 90, 80, 0.9)');
            bg.addColorStop(1, 'rgba(240, 90, 80, 0)');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(beaconX, -98, 24, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = '#24382a';
          rrect(ctx, h.x, -74, h.width, 148, 4);
          ctx.fill();
          ctx.fillStyle = '#88b892';
          ctx.fillRect(h.x, -55, h.width, 6);
          ctx.fillRect(h.x, 49, h.width, 6);
        }
      }
    }
  }

  private drawHullPanels(ctx: CanvasRenderingContext2D, w: WorldState, carIdx: number, panels: HullPanel[]): void {
    for (const panel of panels) {
      if (isHullPassage(w, carIdx, panel)) continue;
      const seg = getHullSegment(carIdx, panel);
      const horiz = panel.side === 'top' || panel.side === 'bottom';

      if (panel.hp <= 0) {
        ctx.strokeStyle = '#c94c4c';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(seg.x1 + (horiz ? 4 : 0), seg.y1 + (horiz ? 0 : 4));
        ctx.lineTo(seg.x2 - (horiz ? 4 : 0), seg.y2 - (horiz ? 0 : 4));
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      if (panel.isDoor) {
        if (panel.doorOpen) {
          ctx.strokeStyle = 'rgba(110, 195, 125, 0.78)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(seg.x1 + 2, seg.y1);
          ctx.lineTo(seg.x1 + 11, seg.y1);
          ctx.moveTo(seg.x2 - 11, seg.y2);
          ctx.lineTo(seg.x2 - 2, seg.y2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = panel.hitFlash > 0 ? '#fff' : '#c98f38';
          ctx.lineWidth = 8.5;
          ctx.beginPath();
          ctx.moveTo(seg.x1 + 1, seg.y1);
          ctx.lineTo(seg.x2 - 1, seg.y2);
          ctx.stroke();
        }
      } else {
        const ratio = panel.hp / panel.maxHp;
        ctx.strokeStyle = panel.hitFlash > 0 ? '#fff' : ratio < 0.45 ? '#a85336' : (panel.armorTier ?? 1) >= 2 ? '#98a7b5' : '#73808c';
        ctx.lineWidth = (panel.armorTier ?? 1) >= 2 ? 10 : 8;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      // Durability bar just outside a damaged panel, only when it matters
      if (panel.hp < panel.maxHp) {
        const near = Math.hypot(seg.cx - w.player.x, seg.cy - w.player.y) < 190;
        if (this.hullBarsVisible || near || panel.hitFlash > 0) {
          const ratio = Math.max(0, panel.hp / panel.maxHp);
          const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) * 0.72;
          const out = 10;
          const ox = panel.side === 'left' ? -out : panel.side === 'right' ? out : 0;
          const oy = panel.side === 'top' ? -out : panel.side === 'bottom' ? out : 0;
          const bx = seg.cx + ox;
          const by = seg.cy + oy;
          const color = ratio < 0.35 ? '#dc5f4f' : ratio < 0.7 ? '#d9a14f' : '#a9b6c2';
          ctx.save();
          ctx.translate(bx, by);
          if (!horiz) ctx.rotate(Math.PI / 2);
          ctx.fillStyle = 'rgba(8, 6, 5, 0.85)';
          rrect(ctx, -len / 2 - 1.5, -2.5, len + 3, 5, 2.5);
          ctx.fill();
          ctx.fillStyle = color;
          rrect(ctx, -len / 2, -1.5, len * ratio, 3, 1.5);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  /**
   * Vision cone parameters for this frame. Daylight gives a ~180° field; night and heavy
   * weather narrow and shorten it. Values ease toward their targets so weather/dusk never pop.
   */
  private getVision(w: WorldState, dt: number): VisionParams {
    // Sun height: 1 at 12:00, falling smoothly to 0 by 21:00 (clock = dayTime·24 + 6h).
    const hour = (w.dayTime * 24 + 6) % 24;
    const sunLin = Math.max(0, Math.min(1, 1 - Math.abs(hour - 12) / 9));
    const sun = sunLin * sunLin * (3 - 2 * sunLin);
    const night = 1 - sun;

    // [range, angle] multipliers per weather
    const wx: Record<string, [number, number]> = {
      clear: [1, 1],
      rainstorm: [0.7, 0.8],
      blizzard: [0.6, 0.74],
      sandstorm: [0.55, 0.7],
      fog: [0.5, 0.84],
    };
    const [wRange, wAngle] = wx[w.weather] ?? [0.8, 0.85];
    // Dusk → night factor (0 while the sun is up, 1 in full dark)
    const nl = Math.max(0, Math.min(1, (0.42 - sun) / 0.42));
    const nightK = nl * nl * (3 - 2 * nl);
    this.frameLights = getLightSources(w);

    // Range keeps growing all the way to noon; the cone is ~180° for most of the day.
    const wide = Math.min(1, sun / 0.55);
    let range = (270 + 430 * sun) * wRange;
    let half = (0.86 + (Math.PI / 2 - 0.86) * wide * wide * (3 - 2 * wide)) * wAngle;
    if (!playerHasHandLight(w)) {
      // No lantern in hand at night: only a short sliver right in front of you.
      range *= 1 - 0.66 * nightK;
      half *= 1 - 0.42 * nightK;
    }
    const target: VisionParams = {
      range,
      half: Math.max(0.5, half),
      feather: 0.42 + 0.12 * night, // angular soft edge on each side (rad)
      near: 20, // just the player's own body, no awareness bubble
      outside: w.buildMode ? 0.34 : 0.56 + 0.3 * night + (1 - wRange) * 0.12,
      lightReveal: nightK,
    };

    const cur = this.visionSmooth;
    if (!cur) {
      this.visionSmooth = { ...target };
      return this.visionSmooth;
    }
    const k = 1 - Math.exp(-Math.min(0.1, Math.max(0, dt)) * 2.2);
    cur.range += (target.range - cur.range) * k;
    cur.half += (target.half - cur.half) * k;
    cur.feather += (target.feather - cur.feather) * k;
    cur.near += (target.near - cur.near) * k;
    cur.outside += (target.outside - cur.outside) * Math.min(1, k * 2.5);
    cur.lightReveal += (target.lightReveal - cur.lightReveal) * k;
    return cur;
  }

  /**
   * Unseen monsters within earshot leave sound ripples at their rough position and a tick on
   * the ring around the player, and play soft panned footfalls. Rain/sand/wind mask hearing.
   */
  private drawHearingCues(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    dt: number,
    v: VisionParams,
    W: number,
    H: number,
    shakeX: number,
    shakeY: number,
    effZoom: number
  ): void {
    const p = w.player;
    const advancing = w.time !== this.hearingWorldTime; // paused game: no new sounds
    this.hearingWorldTime = w.time;
    const step = advancing ? Math.min(0.1, Math.max(0, dt)) : 0;
    this.hearingSfxCd = Math.max(0, this.hearingSfxCd - step);
    const masking = w.weather === 'clear' || w.weather === 'fog' ? 1 : 0.72;
    const range = 640 * masking;
    const toSX = (x: number) => (x - this.smoothCamX) * effZoom + W / 2 + shakeX;
    const toSY = (y: number) => (y - this.smoothCamY) * effZoom + H / 2 + shakeY;
    const psx = toSX(p.x);
    const psy = toSY(p.y);

    const live = new Set<string>();
    ctx.save();
    ctx.lineCap = 'round';
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      const vis = this.visibilityAt(w, v, m.x, m.y, m.r);
      if (vis > 0.65) continue;
      live.add(m.uid);
      let st = this.hearing.get(m.uid);
      if (!st) {
        st = { stepT: Math.random() * 0.5, growlT: 3 + Math.random() * 5, pulse: 0, jx: 0, jy: 0, loud: 0 };
        this.hearing.set(m.uid, st);
      }
      const prox = Math.pow(1 - d / range, 1.15);
      const loud = prox * (1 - vis);
      st.loud += (loud - st.loud) * Math.min(1, step * 6 + (advancing ? 0 : 1));
      // Positional uncertainty grows with distance; it drifts instead of jumping.
      const spread = 14 + d * 0.07;
      st.jx += ((Math.random() - 0.5) * spread - st.jx) * step * 0.8;
      st.jy += ((Math.random() - 0.5) * spread - st.jy) * step * 0.8;

      st.pulse = Math.max(0, st.pulse - step * 1.7);
      st.stepT -= step;
      if (st.stepT <= 0) {
        st.stepT = 0.48 + Math.random() * 0.22;
        st.pulse = 1;
        if (this.hearingSfxCd <= 0) {
          this.hearingSfxCd = 0.16;
          sfx.unseenStep(Math.max(-1, Math.min(1, dx / 320)), st.loud * 0.9);
        }
      }
      st.growlT -= step;
      if (st.growlT <= 0) {
        st.growlT = 4 + Math.random() * 5;
        if (d < 300) sfx.unseenGrowl(Math.max(-1, Math.min(1, dx / 320)), st.loud);
      }

      if (st.loud < 0.03) continue;
      // Ripples at the rough source
      const sx = toSX(m.x + st.jx);
      const sy = toSY(m.y + st.jy);
      const k = 1 - st.pulse;
      for (let ring = 0; ring < 2; ring++) {
        const kk = Math.min(1, k + ring * 0.35);
        const a = st.loud * (1 - kk) * 0.75;
        if (a < 0.02) continue;
        ctx.strokeStyle = `rgba(236, 214, 172, ${a})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, (8 + kk * 26) * effZoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Direction tick around the player
      const ang = Math.atan2(dy, dx);
      const rad = 58 * effZoom;
      const ta = st.loud * (0.35 + 0.55 * st.pulse);
      ctx.strokeStyle = `rgba(236, 214, 172, ${ta})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(psx, psy, rad, ang - 0.22, ang + 0.22);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(psx, psy, rad + 6 * effZoom, ang - 0.14, ang + 0.14);
      ctx.stroke();
    }
    ctx.restore();
    for (const id of this.hearing.keys()) if (!live.has(id)) this.hearing.delete(id);
  }

  /** 0..1 how visible a world point is to the player — same falloff as the drawn mask. */
  private visibilityAt(w: WorldState, v: VisionParams, x: number, y: number, r = 0): number {
    const dx = x - w.player.x;
    const dy = y - w.player.y;
    const dist = Math.hypot(dx, dy);
    const smooth = (e0: number, e1: number, x0: number) => {
      const u = Math.max(0, Math.min(1, (x0 - e0) / (e1 - e0)));
      return u * u * (3 - 2 * u);
    };
    // near bubble
    const nearK = 1 - smooth(v.near * 0.55, v.near, dist - r);
    // forward cone
    let da = Math.abs(Math.atan2(dy, dx) - w.player.angle);
    if (da > Math.PI) da = Math.PI * 2 - da;
    da = Math.max(0, da - Math.atan2(r, Math.max(1, dist)));
    const angK = 1 - smooth(v.half - v.feather / 2, v.half + v.feather / 2, da);
    const distK = 1 - smooth(v.range * 0.62, v.range, dist - r);
    const coneK = angK * distK;
    let seen = 1 - (1 - nearK) * (1 - coneK);
    if (v.lightReveal > 0.01) {
      for (const l of this.frameLights) {
        const ld = Math.hypot(x - l.x, y - l.y) - r;
        const lk = (1 - smooth(l.r * 0.5, l.r * 0.95, ld)) * v.lightReveal;
        if (lk > 0) seen = 1 - (1 - seen) * (1 - lk);
      }
    }
    return seen;
  }

  private drawVisionMask(
    w: WorldState,
    W: number,
    H: number,
    shakeX: number,
    shakeY: number,
    effZoom: number,
    v: VisionParams
  ): void {
    if (this.fovCanvas.width !== W || this.fovCanvas.height !== H) {
      this.fovCanvas.width = W;
      this.fovCanvas.height = H;
    }
    // The reveal shape is rendered at quarter resolution and upscaled — cheap and naturally soft.
    const S = 0.25;
    const rw = Math.max(1, Math.ceil(W * S));
    const rh = Math.max(1, Math.ceil(H * S));
    if (this.revealCanvas.width !== rw || this.revealCanvas.height !== rh) {
      this.revealCanvas.width = rw;
      this.revealCanvas.height = rh;
    }

    const sx = ((w.player.x - this.smoothCamX) * effZoom + W / 2 + shakeX) * S;
    const sy = ((w.player.y - this.smoothCamY) * effZoom + H / 2 + shakeY) * S;
    const ang = w.player.angle;
    const range = Math.max(2, v.range * effZoom * S);
    const near = Math.max(2, v.near * effZoom * S);

    const r = this.revealCtx;
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, rw, rh);

    // 1) Angular falloff: a conic gradient centred on the facing direction, smoothstep edges
    const cg = r.createConicGradient(ang - Math.PI, sx, sy);
    const TAU = Math.PI * 2;
    const inner = Math.max(0, v.half - v.feather / 2);
    const outer = Math.min(Math.PI, v.half + v.feather / 2);
    const STEPS = 10;
    const stops: Array<[number, number]> = [];
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const a = outer - (outer - inner) * u; // from outer edge toward the centre
      const alpha = u * u * (3 - 2 * u);
      stops.push([a, alpha]);
    }
    // left side (angles below facing), then right side mirrored
    cg.addColorStop(0, 'rgba(0,0,0,0)');
    for (const [a, al] of stops) cg.addColorStop(Math.max(0, Math.min(1, 0.5 - a / TAU)), `rgba(0,0,0,${al})`);
    for (let i = stops.length - 1; i >= 0; i--) {
      const [a, al] = stops[i];
      cg.addColorStop(Math.max(0, Math.min(1, 0.5 + a / TAU)), `rgba(0,0,0,${al})`);
    }
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = cg;
    r.fillRect(0, 0, rw, rh);

    // 2) Distance falloff multiplied in (destination-in keeps cone × radial)
    r.globalCompositeOperation = 'destination-in';
    const rg = r.createRadialGradient(sx, sy, 0, sx, sy, range);
    for (let i = 0; i <= 8; i++) {
      const p = 0.62 + (0.38 * i) / 8;
      const u = i / 8;
      rg.addColorStop(p, `rgba(0,0,0,${1 - u * u * (3 - 2 * u)})`);
    }
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    r.fillStyle = rg;
    r.fillRect(0, 0, rw, rh);

    // 3) Close awareness bubble, unioned on top
    r.globalCompositeOperation = 'source-over';
    const ng = r.createRadialGradient(sx, sy, 0, sx, sy, near);
    ng.addColorStop(0, 'rgba(0,0,0,1)');
    ng.addColorStop(0.55, 'rgba(0,0,0,1)');
    ng.addColorStop(0.78, 'rgba(0,0,0,0.5)');
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = ng;
    r.beginPath();
    r.arc(sx, sy, near, 0, TAU);
    r.fill();

    // 3b) Anything standing in a light pool is visible at night, whichever way you face
    if (v.lightReveal > 0.01) {
      for (const l of this.frameLights) {
        const lx = ((l.x - this.smoothCamX) * effZoom + W / 2 + shakeX) * S;
        const ly = ((l.y - this.smoothCamY) * effZoom + H / 2 + shakeY) * S;
        const lr = Math.max(2, l.r * effZoom * S * (l.fire ? 1 + Math.sin(w.time * 7.3 + l.x) * 0.025 : 1));
        if (lx < -lr || ly < -lr || lx > rw + lr || ly > rh + lr) continue;
        const a = v.lightReveal;
        const lg = r.createRadialGradient(lx, ly, 0, lx, ly, lr);
        lg.addColorStop(0, `rgba(0,0,0,${a})`);
        lg.addColorStop(0.5, `rgba(0,0,0,${a * 0.92})`);
        lg.addColorStop(0.78, `rgba(0,0,0,${a * 0.45})`);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        r.fillStyle = lg;
        r.beginPath();
        r.arc(lx, ly, lr, 0, TAU);
        r.fill();
      }
    }

    // 4) Darkness everywhere, then punch the reveal out of it
    const c = this.fovCtx;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.fillStyle = `rgba(5, 4, 4, ${v.outside})`;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out';
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(this.revealCanvas, 0, 0, rw, rh, 0, 0, rw / S, rh / S);
    c.globalCompositeOperation = 'source-over';
  }

  private drawTrain(ctx: CanvasRenderingContext2D, w: WorldState): void {
    for (let i = 0; i < w.flatbeds.length; i++) {
      const car = w.flatbeds[i];
      const b = getCarBounds(i);

      const isCrude = car.couplerKind === 'crude';
      ctx.fillStyle = isCrude ? (car.couplerHp < 35 ? '#963426' : '#78502b') : '#4f4841';
      ctx.fillRect(b.right, -34, COUPLER_GAP, 68);
      ctx.strokeStyle = isCrude ? '#d9933c' : '#26211d';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.right, -34, COUPLER_GAP, 68);
      if (isCrude) {
        ctx.fillStyle = '#111';
        ctx.fillRect(b.right + 2, 37, COUPLER_GAP - 4, 5);
        ctx.fillStyle = car.couplerHp < 35 ? '#d9534f' : '#d9b15f';
        ctx.fillRect(b.right + 3, 38, (COUPLER_GAP - 6) * (car.couplerHp / 100), 3);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      rrect(ctx, b.left - 4, b.top + 8, CAR_W + 8, CAR_H + 6, 6);
      ctx.fill();

      ctx.save();
      rrect(ctx, b.left, b.top, CAR_W, CAR_H, 3);
      ctx.clip();
      ctx.drawImage(this.patterns.flatbedDeck, b.left, b.top);
      ctx.restore();

      ctx.strokeStyle = w.buildMode ? 'rgba(235, 200, 120, 0.38)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let c = 1; c < CAR_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(b.left + c * TILE, b.top);
        ctx.lineTo(b.left + c * TILE, b.bottom);
        ctx.stroke();
      }
      for (let r = 1; r < CAR_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(b.left, b.top + r * TILE);
        ctx.lineTo(b.right, b.top + r * TILE);
        ctx.stroke();
      }

      for (const bld of car.buildings) {
        const tc = getTileCenter(bld.carIdx, bld.col, bld.row);
        ctx.save();
        ctx.translate(tc.x, tc.y);
        drawBuildingArt(ctx, w, bld);
        ctx.restore();
      }

      this.drawHullPanels(ctx, w, i, car.hull);

      const role = getCarriageRole(car);
      if (role !== 'none') {
        const rm = CARRIAGE_ROLE_META[role];
        const cx = (b.left + b.right) / 2;
        ctx.font = uiFont(10, 700);
        const bw = ctx.measureText(rm.label).width + 14;
        ctx.fillStyle = INK;
        ctx.strokeStyle = rm.color;
        ctx.lineWidth = 1;
        rrect(ctx, cx - bw / 2, b.top - 21, bw, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rm.color;
        ctx.textAlign = 'center';
        ctx.fillText(rm.label, cx, b.top - 9);
        ctx.textAlign = 'left';
      }
    }

    drawLocomotiveArt(ctx, w, this.patterns.locoDeck);

    // Cab deck: free tiles hint in build mode, then anything placed up front
    if (w.buildMode) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(217, 177, 95, 0.4)';
      ctx.lineWidth = 1.2;
      for (const [c, r] of LOCO_BUILD_TILES) {
        if (w.locoDeck.buildings.some((b) => b.col === c && b.row === r)) continue;
        const tc = getTileCenter(-1, c, r);
        rrect(ctx, tc.x - TILE / 2 + 4, tc.y - TILE / 2 + 4, TILE - 8, TILE - 8, 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const bld of w.locoDeck.buildings) {
      const tc = getTileCenter(-1, bld.col, bld.row);
      ctx.save();
      ctx.translate(tc.x, tc.y);
      drawBuildingArt(ctx, w, bld);
      ctx.restore();
    }

    this.drawHullPanels(ctx, w, -1, w.locoHull);
  }

  private drawBuildGhost(ctx: CanvasRenderingContext2D, w: WorldState, wx: number, wy: number): void {
    const def = BUILDINGS[w.selectedBuild];
    const afford = canAffordCost(w, def.cost);
    const currW = getTrainWeight(w);
    const nextW = +(currW + def.weight).toFixed(1);
    const limit = getTractionLimit(w);
    const over = nextW > limit;

    let gx = wx;
    let gy = wy;

    if (def.locoFrontOnly) {
      const ok = afford && !w.hasBumper;
      ctx.fillStyle = ok ? 'rgba(104, 184, 116, 0.34)' : 'rgba(217, 83, 79, 0.34)';
      ctx.strokeStyle = ok ? '#7bc985' : '#e07a7a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(LOCO_W, -58);
      ctx.lineTo(LOCO_W + 42, 0);
      ctx.lineTo(LOCO_W, 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      gx = LOCO_W + 24;
      gy = -28;
    } else {
      const tile = worldToTrainTile(w, wx, wy);
      if (!tile) return;
      const here = (getDeck(w, tile.carIdx)?.buildings ?? []).find((b) => b.col === tile.col && b.row === tile.row);
      if (here) {
        this.drawUpgradeGhost(ctx, w, here);
        return;
      }
      const ok = afford;
      const c = getTileCenter(tile.carIdx, tile.col, tile.row);
      ctx.fillStyle = ok ? 'rgba(104, 184, 116, 0.32)' : 'rgba(217, 83, 79, 0.32)';
      ctx.strokeStyle = ok ? '#7bc985' : '#e07a7a';
      ctx.lineWidth = 2;
      rrect(ctx, c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4, 5);
      ctx.fill();
      ctx.stroke();
      gx = c.x;
      gy = c.y - 30;
    }

    // Weight change tag directly next to build cursor (U8!)
    const txt = `重量 ${currW} → ${nextW} / ${limit}t`;
    ctx.font = monoFont(10.5, 600);
    const tw = ctx.measureText(txt).width + 16;
    ctx.fillStyle = INK;
    ctx.strokeStyle = over ? '#dc5f4f' : 'rgba(201, 149, 77, 0.7)';
    ctx.lineWidth = 1;
    rrect(ctx, gx - tw / 2, gy - 10, tw, 19, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = over ? '#f0a69b' : PARCHMENT;
    ctx.textAlign = 'center';
    ctx.fillText(txt, gx, gy + 3);
    ctx.textAlign = 'left';
  }

  /** Rumbling ruin of a destroyed nest: a widening, quickening ring of cracks before the wave bursts out. */
  private drawNestEruptions(ctx: CanvasRenderingContext2D, w: WorldState): void {
    for (const er of w.nestEruptions) {
      const k = 1 - Math.max(0, er.timer) / er.maxTimer; // 0 → 1 as it builds
      const pulse = 0.5 + 0.5 * Math.sin(w.time * (8 + k * 18));
      const R = 46 + k * 34;
      ctx.save();
      ctx.translate(er.x, er.y);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
      g.addColorStop(0, `rgba(40, 14, 10, ${0.55 + k * 0.3})`);
      g.addColorStop(0.6, `rgba(150, 52, 38, ${0.18 + k * 0.22})`);
      g.addColorStop(1, 'rgba(150, 52, 38, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      // radiating cracks
      ctx.strokeStyle = `rgba(232, 110, 72, ${0.35 + pulse * 0.45})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i * 0.698 + (i % 2) * 0.21;
        const len = (18 + (i % 3) * 9) * (0.4 + k * 0.9);
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a + 0.12) * len * 0.6, Math.sin(a + 0.12) * len * 0.47);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len * 0.78);
      }
      ctx.stroke();
      // danger ring: where the pack lands
      ctx.strokeStyle = `rgba(240, 120, 96, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.78, w.time * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /** Build mode, cursor over an existing facility: preview the in-place T1 → T2 upgrade. */
  private drawUpgradeGhost(ctx: CanvasRenderingContext2D, w: WorldState, b: PlacedBuilding): void {
    const def = BUILDINGS[b.type];
    const c = getTileCenter(b.carIdx, b.col, b.row);
    const canTier = b.tier < 2 && !!def.tier2Cost;
    const afford = canTier && canAffordCost(w, def.tier2Cost!);
    const col = !canTier ? 'rgba(200, 190, 170, 0.7)' : afford ? '#e2b65e' : '#e07a7a';
    ctx.strokeStyle = col;
    ctx.fillStyle = !canTier ? 'rgba(200,190,170,0.1)' : afford ? 'rgba(226, 182, 94, 0.2)' : 'rgba(217, 83, 79, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    rrect(ctx, c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4, 5);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const head = !canTier ? (b.tier >= 2 ? `${def.tier2Name ?? def.name} · 已满级` : `${def.name} · 不可升级`) : `左键升级为 ${def.tier2Name}`;
    const cost = canTier
      ? Object.entries(def.tier2Cost!)
          .map(([k, v]) => `${ITEM_META[k as ResourceKey]?.short ?? k}×${v}`)
          .join('  ')
      : '右键拆除（返还 75%）';
    ctx.font = monoFont(10.5, 600);
    const tw = Math.max(ctx.measureText(head).width, ctx.measureText(cost).width) + 18;
    const gx = c.x;
    const gy = c.y - TILE / 2 - 30;
    ctx.fillStyle = INK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    rrect(ctx, gx - tw / 2, gy - 12, tw, 34, 3);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = canTier ? (afford ? '#f3d58f' : '#f0a69b') : PARCHMENT;
    ctx.fillText(head, gx, gy + 1);
    ctx.fillStyle = 'rgba(232, 220, 196, 0.78)';
    ctx.fillText(cost, gx, gy + 15);
    ctx.textAlign = 'left';
  }

  private drawAtmosphericLighting(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    W: number,
    H: number,
    darkAlpha: number,
    tint: string,
    shakeX: number,
    shakeY: number,
    effZoom: number
  ): void {
    if (this.lightCanvas.width !== W || this.lightCanvas.height !== H) {
      this.lightCanvas.width = W;
      this.lightCanvas.height = H;
    }
    const lctx = this.lightCtx;
    lctx.clearRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = darkAlpha;
    lctx.fillStyle = tint;
    lctx.fillRect(0, 0, W, H);
    lctx.globalAlpha = 1;

    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - this.smoothCamX) * effZoom + W / 2 + shakeX,
      sy: (wy - this.smoothCamY) * effZoom + H / 2 + shakeY,
    });

    lctx.globalCompositeOperation = 'destination-out';

    const punchRadial = (wx: number, wy: number, radius: number, strength = 1): void => {
      const { sx, sy } = toScreen(wx, wy);
      const r = radius * effZoom;
      const g = lctx.createRadialGradient(sx, sy, r * 0.08, sx, sy, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.58})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(sx, sy, r, 0, Math.PI * 2);
      lctx.fill();
    };

    const punchCone = (wx: number, wy: number, angle: number, range: number, halfAngle: number): void => {
      const { sx, sy } = toScreen(wx, wy);
      const r = range * effZoom;
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(sx, sy);
      lctx.arc(sx, sy, r, angle - halfAngle, angle + halfAngle);
      lctx.closePath();
      lctx.clip();
      const g = lctx.createRadialGradient(sx, sy, 8, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      lctx.restore();
    };

    const weatherShort = w.weather === 'fog' ? 0.6 : w.weather === 'clear' ? 1 : 0.78;
    const hasLitLantern = playerHasHandLight(w);

    if (hasLitLantern) {
      punchRadial(w.player.x, w.player.y, 52, 0.94);
      punchCone(w.player.x, w.player.y, w.player.angle, 240 * weatherShort, 0.46);
    } else {
      punchRadial(w.player.x, w.player.y, 38, 0.56);
    }

    if (w.boilerFuel > 0) {
      const bScale = 0.4 + 0.6 * (w.boilerFuel / Math.max(1, w.boilerMax));
      punchCone(LOCO_W + 6, 0, 0, 310 * weatherShort * bScale, 0.36);
    }
    for (const l of getLightSources(w)) {
      const flick = l.fire ? 1 + Math.sin(w.time * 7.3 + l.x) * 0.025 : 1;
      punchRadial(l.x, l.y, l.r * flick, l.fire ? 0.93 : 0.85);
    }

    ctx.drawImage(this.lightCanvas, 0, 0);
  }

  private drawWeather(ctx: CanvasRenderingContext2D, w: WorldState, W: number, H: number): void {
    if (w.weather === 'rainstorm') {
      ctx.strokeStyle = 'rgba(148, 208, 255, 0.38)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 110; i++) {
        const rx = ((i * 89 + w.time * 540) % (W + 140)) - 70;
        const ry = ((i * 53 + w.time * 820) % (H + 140)) - 70;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 18, ry + 30);
      }
      ctx.stroke();
      if (w.lightningFlash > 0) {
        ctx.fillStyle = `rgba(220, 238, 255, ${w.lightningFlash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (w.weather === 'blizzard') {
      ctx.fillStyle = 'rgba(225, 242, 255, 0.68)';
      for (let i = 0; i < 120; i++) {
        const sx = (((i * 113 - w.time * (280 + (i % 5) * 35)) % (W + 80)) + W + 80) % (W + 80) - 40;
        const sy = ((i * 71 + w.time * (200 + (i % 4) * 28)) % (H + 80)) - 40;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 3) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (w.weather === 'sandstorm') {
      ctx.fillStyle = 'rgba(165, 118, 66, 0.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(218, 174, 115, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 85; i++) {
        const sx = (((i * 127 - w.time * 460) % (W + 120)) + W + 120) % (W + 120) - 60;
        const sy = ((i * 79 + w.time * 90) % H);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 44, sy + 7);
      }
      ctx.stroke();
    } else if (w.weather === 'fog') {
      const fg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.65);
      fg.addColorStop(0, 'rgba(160, 175, 190, 0.04)');
      fg.addColorStop(1, 'rgba(110, 125, 140, 0.42)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawCrispWorldOverlays(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    W: number,
    H: number,
    shakeX: number,
    shakeY: number,
    effZoom: number
  ): void {
    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - this.smoothCamX) * effZoom + W / 2 + shakeX,
      sy: (wy - this.smoothCamY) * effZoom + H / 2 + shakeY,
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = uiFont(12, 700);
    ctx.lineJoin = 'round';
    for (const fl of w.floats) {
      const { sx, sy } = toScreen(fl.x, fl.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, fl.life * 1.4);
      ctx.strokeStyle = 'rgba(8, 6, 5, 0.9)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(fl.text, sx, sy);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, sx, sy);
      ctx.restore();
    }

    // Radial progress ring for hold-E / hold-eat actions (U7)
    if (w.holdAction) {
      const ha = w.holdAction;
      const { sx, sy } = toScreen(ha.x, ha.y);
      const pct = Math.max(0, Math.min(1, ha.progress));
      const start = -Math.PI / 2;
      ctx.save();
      // Dial face
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(sx, sy, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(201, 149, 77, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Track + tick marks
      ctx.strokeStyle = 'rgba(255, 245, 225, 0.1)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 15.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = start + (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 13.5, sy + Math.sin(a) * 13.5);
        ctx.lineTo(sx + Math.cos(a) * 17.5, sy + Math.sin(a) * 17.5);
        ctx.stroke();
      }
      // Progress
      ctx.shadowColor = 'rgba(237, 196, 124, 0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = BRASS_HI;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(sx, sy, 15.5, start, start + pct * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = monoFont(9.5, 700);
      ctx.fillStyle = BRASS_HI;
      ctx.fillText(`${Math.round(pct * 100)}`, sx, sy + 0.5);
      // Label tag
      ctx.font = uiFont(11, 600);
      const lw = ctx.measureText(ha.label).width + 18;
      ctx.fillStyle = INK;
      rrect(ctx, sx - lw / 2, sy - 46, lw, 20, 3);
      ctx.fill();
      ctx.fillStyle = PARCHMENT;
      ctx.fillText(ha.label, sx, sy - 35.5);
      ctx.restore();
    } else if (w.activeHint) {
      const h = w.activeHint;
      // Corner brackets on the exact object E will act on
      if (h.tx !== undefined && h.ty !== undefined) {
        const t = toScreen(h.tx, h.ty);
        const half = (17 + Math.sin(w.time * 5) * 1.5) * effZoom;
        const arm = 7 * effZoom;
        ctx.save();
        ctx.strokeStyle = 'rgba(237, 196, 124, 0.9)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          const cx = t.sx + dx * half;
          const cy = t.sy + dy * half;
          ctx.moveTo(cx, cy - dy * arm);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx - dx * arm, cy);
        }
        ctx.stroke();
        ctx.restore();
      }
      const { sx, sy } = toScreen(h.x, h.y);
      // "E 操纵拉杆" / "按住 E 铺设铁轨" → keycap + verb
      const m = /^(按住\s*)?E\s+(.*)$/.exec(h.label);
      const hold = !!m?.[1];
      const text = m ? m[2] : h.label;
      ctx.font = uiFont(11.5, 600);
      const textW = ctx.measureText(text).width;
      const capW = m ? (hold ? 40 : 20) : 0;
      const gap = m ? 8 : 0;
      const tw = capW + gap + textW + 22;
      const left = sx - tw / 2;
      const bob = Math.sin(w.time * 3) * 1.2;
      const top = sy - 14 + bob;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = 'rgba(16, 13, 11, 0.92)';
      rrect(ctx, left, top, tw, 28, 5);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(201, 149, 77, 0.55)';
      ctx.lineWidth = 1;
      rrect(ctx, left + 0.5, top + 0.5, tw - 1, 27, 5);
      ctx.stroke();

      let cursor = left + 11;
      if (m) {
        // Keycap
        const capTop = top + 5;
        ctx.fillStyle = '#2a241e';
        rrect(ctx, cursor, capTop, capW, 18, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cursor + 1, capTop + 16, capW - 2, 2);
        ctx.strokeStyle = 'rgba(201, 149, 77, 0.6)';
        rrect(ctx, cursor + 0.5, capTop + 0.5, capW - 1, 17, 3);
        ctx.stroke();
        ctx.font = monoFont(10.5, 700);
        ctx.fillStyle = BRASS_HI;
        ctx.fillText(hold ? 'E ⋯' : 'E', cursor + capW / 2, capTop + 9);
        cursor += capW + gap;
      }
      ctx.font = uiFont(11.5, 600);
      ctx.textAlign = 'left';
      ctx.fillStyle = PARCHMENT;
      ctx.fillText(text, cursor, top + 14.5);
      ctx.textAlign = 'center';
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
