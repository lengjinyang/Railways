import { BUILDINGS } from '../recipes_v2';
import {
  CAR_COLS,
  CAR_H,
  CAR_ROWS,
  CAR_W,
  COUPLER_GAP,
  FOG_CELL_SIZE,
  HALF_H,
  ITEM_META,
  LANTERN_HOOK_X,
  LANTERN_HOOK_Y,
  LOCO_COLS,
  LOCO_W,
  TILE,
  canAffordCost,
  getCarBounds,
  getHullSegment,
  getTileCenter,
  getTrainBuildingLists,
  isHullPassage,
  isLocoCoreTile,
  playerHasActiveLantern,
  worldToTrainTile,
  type HullPanel,
  type WorldState,
  type ZoneKind,
} from '../world';
import {
  drawBuildingArt,
  drawCompanionArt,
  drawLocomotiveArt,
  drawMonsterArt,
  drawPlayerArt,
  drawPropArt,
  rrect,
} from './sprites';
import { getArtPatterns, type ArtPatterns } from './textures';

const PICKUP_COLORS: Record<string, string> = {
  wood: '#b07d4f',
  scrap: '#a3b1bf',
  parts: '#ffd56b',
  fuel: '#c77dff',
  water: '#4dabf7',
  rawFood: '#94d82d',
  cookedFood: '#fcc419',
  ammo: '#ff8787',
  rails: '#ced4da',
  seeds: '#69db7c',
  bone: '#f1f3f5',
  carapace: '#da77f2',
  coupler: '#66d9e8',
  crudeCoupler: '#ffa94d',
  arcanePotion: '#e0aaff',
  ancientRelic: '#ffd43b',
};

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

/**
 * Draws a tiled texture strictly anchored to `(originX, originY)` inside the clipped rect `(rx, ry, rw, rh)`.
 * Because it uses pure `drawImage` in object-local coordinates, textures NEVER swim or scroll when the camera moves!
 */
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

export class Renderer2D {
  public zoom = 1.0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
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
    this.seamCanvas = document.createElement('canvas');
    this.seamCtx = this.seamCanvas.getContext('2d')!;
    this.patterns = getArtPatterns();
  }

  public adjustZoom(deltaY: number): number {
    this.zoom = Math.max(0.72, Math.min(1.48, this.zoom + (deltaY > 0 ? -0.07 : 0.07)));
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
      dark = k * 0.92;
      tint = k < 0.45 ? 'rgba(38, 18, 14, 1)' : 'rgba(6, 9, 18, 1)';
    } else if (t >= 0.625 && t <= 0.925) {
      dark = 0.93;
    } else if (t > 0.925) {
      dark = ((1 - t) / 0.075) * 0.93;
    } else if (t < 0.06) {
      dark = ((0.06 - t) / 0.06) * 0.25;
      tint = 'rgba(32, 22, 16, 1)';
    }

    if (w.weather === 'rainstorm') {
      dark = Math.min(0.95, dark + 0.16);
      tint = 'rgba(8, 14, 24, 1)';
    } else if (w.weather === 'blizzard') {
      dark = Math.min(0.92, dark + 0.1);
      tint = 'rgba(10, 18, 30, 1)';
    } else if (w.cityExitX > -450) {
      // Smoothly lift the smoke-darkened city dusk as the train physically leaves the burning metropolis!
      const citySmoke = Math.max(0, Math.min(1, (w.cityExitX + 450) / 950));
      if (citySmoke * 0.36 > dark) {
        dark = citySmoke * 0.36;
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

    // Camera transform (gentle cinematic breathe-out when stepping into a new Lost World!)
    const ceremonyBreath =
      w.lostWorldBanner && w.lostWorldBanner.timer > 3.5
        ? 1 - Math.sin(((6.5 - w.lostWorldBanner.timer) / 3.0) * Math.PI) * 0.08
        : 1;
    const effZoom = this.zoom * ceremonyBreath;

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

    // 1. Seamless World-Locked Biome Ground (with smooth painterly cross-fade across biomeSeamX!)
    this.drawGround(ctx, w, viewLeft, viewRight, viewTop, viewBottom);

    // 2. Burning Great City Backdrop (ends physically at cityExitX — never snaps off!)
    if (w.cityExitX > viewLeft - 380) {
      this.drawBurningCityBackdrop(ctx, w, viewLeft, Math.min(viewRight, w.cityExitX));
    }

    // 3. Full-City Station Architecture (renders seamlessly while approaching, docked, OR departing!)
    if (w.stationRoads.length > 0 || w.stationRooms.length > 0) {
      this.drawStationArchitecture(ctx, w, viewLeft, viewRight, viewTop, viewBottom);
    }

    // 4. Railway Ballast, Sleepers, Specular Rails & Track Hazards
    this.drawTracks(ctx, w, viewLeft, viewRight);

    // 5. World Props
    for (const pr of w.props) {
      if (pr.used) continue;
      if (pr.x < viewLeft - 90 || pr.x > viewRight + 90 || pr.y < viewTop - 90 || pr.y > viewBottom + 90) continue;
      drawPropArt(ctx, w, pr);
    }

    // 6. Train (Flatbeds, Couplers, Buildings, Outer Hull & Doors, Locomotive)
    this.drawTrain(ctx, w);

    // 7. Build Ghost Hologram
    if (w.buildMode || w.hotbar === 5) {
      this.drawBuildGhost(ctx, w, mouseWorldX, mouseWorldY);
    }

    // 8. Decoy Meat Beacon
    if (w.decoyPos) {
      const pulse = 1 + Math.sin(w.time * 10) * 0.22;
      ctx.strokeStyle = 'rgba(255, 208, 70, 0.62)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w.decoyPos.x, w.decoyPos.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d9573b';
      ctx.beginPath();
      ctx.arc(w.decoyPos.x, w.decoyPos.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd8a8';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 9. Ground Pickups with POE2 Rarity Loot Beams & Readable Tags (Manual Loot!)
    for (const pk of w.pickups) {
      if (pk.amount <= 0) continue;
      const meta = ITEM_META[pk.key];
      const bob = Math.sin(w.time * 5 + pk.x) * 2;
      const col = PICKUP_COLORS[pk.key] ?? '#ffffff';
      const isRare = meta.rarity === 'rare';
      const isUnique = meta.rarity === 'unique';

      // Subtle vertical rarity loot beam for Rare / Unique treasures
      if (isRare || isUnique) {
        const beamGrad = ctx.createLinearGradient(pk.x, pk.y, pk.x, pk.y - 54);
        beamGrad.addColorStop(0, isUnique ? 'rgba(210, 125, 255, 0.55)' : 'rgba(255, 200, 75, 0.45)');
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(pk.x - 5, pk.y - 54, 10, 54);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(pk.x, pk.y + 7, 8.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, isUnique ? 8 : 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isUnique ? '#f3d9fa' : isRare ? '#ffe066' : '#14110f';
      ctx.lineWidth = isUnique || isRare ? 2 : 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(pk.x - 2, pk.y + bob - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Crisp POE2-style ground loot label pill when within player vision
      const distP = Math.hypot(pk.x - w.player.x, pk.y - w.player.y);
      if (distP < 260) {
        const tag = `${meta.icon} ${meta.short}×${pk.amount}`;
        ctx.font = 'bold 10px "Inter", "PingFang SC", sans-serif';
        const tw = ctx.measureText(tag).width + 12;
        const borderCol =
          meta.rarity === 'unique'
            ? '#d988ff'
            : meta.rarity === 'rare'
              ? '#ffd56b'
              : meta.rarity === 'magic'
                ? '#74c0fc'
                : 'rgba(180, 170, 155, 0.55)';
        const textCol =
          meta.rarity === 'unique'
            ? '#f3d9fa'
            : meta.rarity === 'rare'
              ? '#ffe8a3'
              : meta.rarity === 'magic'
                ? '#d0ebff'
                : '#f0e8dc';
        ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.2;
        rrect(ctx, pk.x - tw / 2, pk.y - 25, tw, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = textCol;
        ctx.textAlign = 'center';
        ctx.fillText(tag, pk.x, pk.y - 13.5);
        ctx.textAlign = 'left';
      }
    }

    // 10. Companion, Monsters & Player
    drawCompanionArt(ctx, w);
    for (const m of w.monsters) {
      if (m.x < viewLeft - 80 || m.x > viewRight + 80 || m.y < viewTop - 80 || m.y > viewBottom + 80) continue;
      drawMonsterArt(ctx, w, m);
    }
    drawPlayerArt(ctx, w);

    // 11. Glowing Projectile Tracers
    ctx.save();
    ctx.lineCap = 'round';
    for (const pr of w.projectiles) {
      ctx.strokeStyle = pr.fromTurret ? 'rgba(255, 224, 102, 0.35)' : 'rgba(255, 160, 50, 0.35)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.032, pr.y - pr.vy * 0.032);
      ctx.stroke();

      ctx.strokeStyle = pr.fromTurret ? '#fff3bf' : '#ffd43b';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.032, pr.y - pr.vy * 0.032);
      ctx.stroke();
    }
    ctx.restore();

    // 12. Impact Particles, Steam Plume & Floating Embers
    for (const pt of w.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sp of this.steamPuffs) {
      const p = 1 - sp.life / sp.maxLife;
      const rad = sp.r * (1 + p * 2.2);
      const sg = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, rad);
      sg.addColorStop(0, `rgba(225, 220, 212, ${(1 - p) * 0.34})`);
      sg.addColorStop(1, 'rgba(180, 175, 168, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const em of this.embers) {
      ctx.globalAlpha = Math.max(0, em.life / em.maxLife);
      ctx.fillStyle = '#ff9c3b';
      ctx.beginPath();
      ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 12b. Soft Uncharted Lost World Mist (Fog of War beyond explored territory!)
    if (w.mode === 'station' && w.exploredFog.size > 0) {
      this.drawLostWorldFog(ctx, w, viewLeft, viewRight, viewTop, viewBottom);
    }

    ctx.restore();

    // 13. Multi-Pass Dynamic Darkness & Volumetric Cone Lighting
    const { darkness, tint } = this.getAmbientLighting(w);
    if (darkness > 0.02) {
      this.drawAtmosphericLighting(ctx, w, W, H, darkness, tint, shakeX, shakeY);
    }

    // 14. Weather Overlay
    this.drawWeather(ctx, w, W, H);

    // 15. Crisp World-Space Floating Combat Numbers & [E] Interaction Pill
    this.drawCrispWorldOverlays(ctx, w, W, H, shakeX, shakeY);
  }

  private updateAmbientVfx(w: WorldState, dt: number): void {
    if (w.boilerFuel > 0) {
      this.steamTimer -= dt;
      const interval = w.gear === 3 ? 0.07 : w.gear === 2 ? 0.12 : w.gear === 1 ? 0.18 : 0.32;
      if (this.steamTimer <= 0) {
        this.steamTimer = interval;
        this.steamPuffs.push({
          x: 70,
          y: -28,
          vx: -48 - w.trainSpeed * 0.65 + (Math.random() - 0.5) * 16,
          vy: -14 + (Math.random() - 0.5) * 22,
          r: 12 + (w.trainSpeed / 205) * 8,
          life: 1.5,
          maxLife: 1.5,
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
      if (this.emberTimer <= 0 && this.embers.length < 48) {
        this.emberTimer = 0.08;
        this.embers.push({
          x: Math.min(w.cityExitX, this.smoothCamX + (Math.random() - 0.35) * 1100),
          y: this.smoothCamY + (Math.random() - 0.5) * 700,
          vx: -70 - Math.random() * 80,
          vy: (Math.random() - 0.5) * 45,
          life: 1.8 + Math.random() * 1.4,
          maxLife: 3.2,
          size: 1.4 + Math.random() * 1.8,
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

  /**
   * Draws world-locked ground tiles via pure `drawImage` (zero camera drift!)
   * and smoothly cross-fades across `w.biomeSeamX` when crossing between regions!
   */
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

    // Left of seam: old biome
    if (seamRight > left) {
      const lx = left;
      const lw = Math.min(right, seamRight) - lx;
      fillTiledRect(ctx, prevTile, lx, top, lw, bottom - top, worldOriginX, 0);
    }

    // Right of seam: new biome
    if (seamRight < right) {
      const rx = Math.max(left, seamRight);
      fillTiledRect(ctx, currTile, rx, top, right - rx, bottom - top, worldOriginX, 0);
    }

    // Feathered 440px cross-fade strip seamlessly blending prevZone -> currZone!
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

      // Feather left -> right using destination-in linear alpha gradient
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

  private drawBurningCityBackdrop(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    left: number,
    cityRight: number
  ): void {
    if (cityRight <= left) return;
    const worldOriginX = -w.worldScrollX;

    // Paved urban boulevards north & south of the railway, ending cleanly at cityExitX
    fillTiledRect(ctx, this.patterns.asphalt, left, -520, cityRight - left, 405, worldOriginX, -520);
    fillTiledRect(ctx, this.patterns.asphalt, left, 115, cityRight - left, 405, worldOriginX, 115);

    // Faded dashed boulevard lines
    ctx.strokeStyle = 'rgba(225, 200, 155, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([28, 20]);
    ctx.beginPath();
    ctx.moveTo(left, -138);
    ctx.lineTo(cityRight, -138);
    ctx.moveTo(left, 138);
    ctx.lineTo(cityRight, 138);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ruined Great City Exit Gate / Concrete Perimeter Wall at cityExitX!
    const ex = w.cityExitX;
    for (const [py, ph] of [
      [-480, 355],
      [125, 355],
    ] as const) {
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(ex - 16, py + 6, 36, ph);
      fillTiledRect(ctx, this.patterns.masonry, ex - 18, py, 32, ph, ex - 18, py);
      ctx.strokeStyle = '#171412';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex - 18, py, 32, ph);
    }
    // Exit warning hazard stripe on boulevard edge
    ctx.fillStyle = '#c98229';
    ctx.fillRect(ex - 22, -134, 8, 18);
    ctx.fillRect(ex - 22, 116, 8, 18);

    const blockW = 250;
    const mod = w.worldScrollX % blockW;
    const bxStart = Math.floor((left + mod) / blockW) * blockW - mod;

    for (let bx = bxStart; bx < cityRight - 140; bx += blockW) {
      const idx = Math.round((bx + w.worldScrollX) / blockW);
      const h1 = 150 + (Math.abs(idx * 37) % 85);
      const h2 = 145 + (Math.abs(idx * 53) % 85);

      for (const [rx, ry, rw, rh, side] of [
        [bx + 18, -172 - h1, 190, h1, -1],
        [bx + 24, 172, 184, h2, 1],
      ] as const) {
        if (rx + rw > w.cityExitX - 24) continue;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(rx + 8, ry + 10, rw, rh);

        // Object-locked masonry exterior rim (NEVER slides across building!)
        fillTiledRect(ctx, this.patterns.masonry, rx, ry, rw, rh, rx, ry);

        // Dark recessed roof interior
        ctx.fillStyle = '#1b191e';
        ctx.fillRect(rx + 10, ry + 10, rw - 20, rh - 20);
        ctx.strokeStyle = '#0e0c0f';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);

        // Flickering fire pit & glowing shattered windows
        const pulse = 0.55 + Math.sin(w.time * 7.5 + idx * 1.3 + side) * 0.25;
        if (Math.abs(idx + (side > 0 ? 1 : 0)) % 2 === 0) {
          const fy = side < 0 ? ry + rh - 34 : ry + 34;
          const fx = rx + rw * 0.5;
          const fg = ctx.createRadialGradient(fx, fy, 4, fx, fy, 52);
          fg.addColorStop(0, `rgba(255, 220, 120, ${pulse})`);
          fg.addColorStop(0.45, `rgba(255, 100, 25, ${pulse * 0.72})`);
          fg.addColorStop(1, 'rgba(180, 30, 10, 0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fx, fy, 52, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 175, 70, ${pulse})`;
          ctx.fillRect(rx + 28, fy - 14, 24, 14);
          ctx.fillRect(rx + rw - 54, fy - 14, 24, 14);
        }

        // Cast-iron streetlamp
        const ly = side < 0 ? -126 : 126;
        ctx.fillStyle = '#4e555d';
        ctx.beginPath();
        ctx.arc(bx + 6, ly, 4.5, 0, Math.PI * 2);
        ctx.fill();
        const lg = ctx.createRadialGradient(bx + 6, ly, 2, bx + 6, ly, 36);
        lg.addColorStop(0, 'rgba(255, 224, 145, 0.52)');
        lg.addColorStop(1, 'rgba(255, 190, 90, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(bx + 6, ly, 36, 0, Math.PI * 2);
        ctx.fill();
      }
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
      w.zoneKind === 'fantasy'
        ? 'rgba(18, 12, 34, 0.72)'
        : w.zoneKind === 'old_city'
          ? 'rgba(14, 19, 26, 0.72)'
          : w.zoneKind === 'monster'
            ? 'rgba(24, 11, 11, 0.72)'
            : 'rgba(18, 15, 12, 0.72)';

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

    // City Road Grid — textures anchored strictly to stationAnchorX (zero air walls, zero tile swimming!)
    for (const rd of w.stationRoads) {
      if (rd.x + rd.w < viewLeft || rd.x > viewRight || rd.y + rd.h < viewTop || rd.y > viewBottom) continue;
      fillTiledRect(ctx, this.patterns.asphalt, rd.x, rd.y, rd.w, rd.h, ox, 0);
      ctx.strokeStyle = 'rgba(220, 205, 175, 0.14)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rd.x, rd.y, rd.w, rd.h);
    }

    // Concrete Station Platform + Yellow Tactile Safety Line (anchored to ox!)
    const platX = -520 + ox;
    if (platX + 1040 > viewLeft && platX < viewRight) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(platX, -250, 1040, 134);
      fillTiledRect(ctx, this.patterns.platform, platX, -255, 1040, 130, platX, -255);
      ctx.strokeStyle = '#24201c';
      ctx.lineWidth = 2;
      ctx.strokeRect(platX, -255, 1040, 130);
      ctx.fillStyle = '#d49a2a';
      ctx.fillRect(-490 + ox, -138, 980, 6);

      // Ornate Station Disembarkation Archway & World Stele on North Platform Edge!
      const gx = ox;
      const gy = -255;
      // Stone archway pillars flanking the exit avenue
      for (const px of [gx - 68, gx + 48]) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        rrect(ctx, px + 3, gy - 12, 22, 28, 4);
        ctx.fill();
        ctx.fillStyle = '#5c5248';
        rrect(ctx, px, gy - 15, 22, 26, 4);
        ctx.fill();
        ctx.strokeStyle = '#d9933c';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Warm brass pillar lantern glow
        const pulse = 1 + Math.sin(w.time * 5 + px) * 0.1;
        const lg = ctx.createRadialGradient(px + 11, gy - 2, 2, px + 11, gy - 2, 34 * pulse);
        lg.addColorStop(0, 'rgba(255, 232, 165, 0.85)');
        lg.addColorStop(0.5, 'rgba(231, 160, 67, 0.3)');
        lg.addColorStop(1, 'rgba(231, 160, 67, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(px + 11, gy - 2, 34 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe8a3';
        ctx.beginPath();
        ctx.arc(px + 11, gy - 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Archway overhead brass sign plaque
      ctx.fillStyle = 'rgba(18, 14, 11, 0.9)';
      ctx.strokeStyle = '#d9933c';
      ctx.lineWidth = 1.6;
      rrect(ctx, gx - 58, gy - 36, 116, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd884';
      ctx.font = 'bold 10px "Inter", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.disembarkedAtStation ? '✦ 失落世界入口 ✦' : '✦ 出站口 · 探索未知 ✦', gx, gy - 23);
      ctx.textAlign = 'left';
    }

    // Lootable City Building Floors & Room Labels
    for (const rm of w.stationRooms) {
      if (rm.x + rm.w < viewLeft || rm.x > viewRight || rm.y + rm.h < viewTop || rm.y > viewBottom) continue;
      ctx.fillStyle = rm.floorColor;
      ctx.fillRect(rm.x, rm.y, rm.w, rm.h);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.lineWidth = 1;
      for (let gx = rm.x + 32; gx < rm.x + rm.w; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, rm.y);
        ctx.lineTo(gx, rm.y + rm.h);
        ctx.stroke();
      }
      ctx.fillStyle = rm.reqTool === 3 ? '#ffd43b' : rm.reqTool === 2 ? '#ffa94d' : '#c8e0c2';
      ctx.font = 'bold 12px "Inter", "PingFang SC", sans-serif';
      ctx.fillText(rm.label, rm.x + 18, rm.y + 30);
    }

    // Solid Ruined Masonry Walls — object-locked masonry tiles!
    for (const wl of w.stationWalls) {
      if (wl.x + wl.w < viewLeft || wl.x > viewRight || wl.y + wl.h < viewTop || wl.y > viewBottom) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
      ctx.fillRect(wl.x + 5, wl.y + 7, wl.w, wl.h);

      fillTiledRect(ctx, this.patterns.masonry, wl.x, wl.y, wl.w, wl.h, wl.x, wl.y);
      ctx.fillStyle = 'rgba(255, 240, 220, 0.08)';
      ctx.fillRect(wl.x, wl.y, wl.w, 4);
      ctx.strokeStyle = '#1f1b18';
      ctx.lineWidth = 2;
      ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
    }

    // Tool-Gated Barriers
    for (const br of w.stationBarriers) {
      if (br.opened) continue;
      if (br.x + br.w < viewLeft || br.x > viewRight || br.y + br.h < viewTop || br.y > viewBottom) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(br.x + 4, br.y + 6, br.w, br.h);

      const base =
        br.hitFlash > 0
          ? '#ffffff'
          : br.reqTool === 1
            ? '#8c5a2e'
            : br.reqTool === 2
              ? '#5a6c7d'
              : '#443a63';
      ctx.fillStyle = base;
      ctx.fillRect(br.x, br.y, br.w, br.h);

      const accent = br.reqTool === 3 ? '#ffd43b' : br.reqTool === 2 ? '#ff922b' : '#e0a958';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.6;
      ctx.strokeRect(br.x, br.y, br.w, br.h);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(br.x + 4, br.y + 4);
      ctx.lineTo(br.x + br.w - 4, br.y + br.h - 4);
      ctx.stroke();

      ctx.font = 'bold 11px "Inter", "PingFang SC", sans-serif';
      const tw = ctx.measureText(br.label).width + 12;
      ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
      rrect(ctx, br.x + br.w / 2 - tw / 2, br.y - 22, tw, 17, 5);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.fillText(br.label, br.x + br.w / 2, br.y - 10);
      ctx.textAlign = 'left';

      if (br.hp < br.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(br.x, br.y + br.h + 4, br.w, 5);
        ctx.fillStyle = accent;
        ctx.fillRect(br.x + 1, br.y + br.h + 5, (br.w - 2) * (br.hp / br.maxHp), 3);
      }
    }
  }

  private drawTracks(ctx: CanvasRenderingContext2D, w: WorldState, left: number, right: number): void {
    // World-locked crushed gravel ballast bed (pure drawImage tiling!)
    fillTiledRect(ctx, this.patterns.ballast, left, -112, right - left, 224, -w.worldScrollX, -112);

    // Weathered oak sleepers + iron tie-plates
    const step = 24;
    const off = w.worldScrollX % step;
    const sx = Math.floor((left + off) / step) * step - off;
    for (let x = sx; x < right; x += step) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 2, -75, 8, 152);
      ctx.fillStyle = '#4c3d30';
      ctx.fillRect(x, -76, 8, 152);
      ctx.fillStyle = 'rgba(255, 220, 180, 0.08)';
      ctx.fillRect(x, -76, 2, 152);
      ctx.fillStyle = '#26292e';
      ctx.fillRect(x - 1, -58, 10, 12);
      ctx.fillRect(x - 1, 46, 10, 12);
    }

    // Brushed Specular Steel Rails
    for (const ry of [-55, 49]) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(left, ry + 5, right - left, 3);
      const rg = ctx.createLinearGradient(0, ry, 0, ry + 6);
      rg.addColorStop(0, '#cfd6de');
      rg.addColorStop(0.45, '#86909c');
      rg.addColorStop(1, '#434a52');
      ctx.fillStyle = rg;
      ctx.fillRect(left, ry, right - left, 6);
    }

    // Track Hazards
    for (const h of w.trackHazards) {
      if (h.kind === 'loose') {
        ctx.fillStyle = 'rgba(245, 159, 0, 0.22)';
        ctx.fillRect(h.x, -92, h.width, 184);
        ctx.strokeStyle = '#f59f00';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.strokeRect(h.x, -88, h.width, 176);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd56b';
        ctx.font = 'bold 13px "Inter", "PingFang SC", sans-serif';
        ctx.fillText('⚠ 松动铁轨 (≤常速通过)', h.x + 10, -66);
      } else if (h.kind === 'broken') {
        if (!h.repaired) {
          const cg = ctx.createRadialGradient(h.x + h.width / 2, 0, 12, h.x + h.width / 2, 0, h.width * 0.95);
          cg.addColorStop(0, '#040303');
          cg.addColorStop(0.75, '#120a0a');
          cg.addColorStop(1, '#261414');
          ctx.fillStyle = cg;
          rrect(ctx, h.x, -108, h.width, 216, 8);
          ctx.fill();
          ctx.strokeStyle = '#ff4d4d';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#ff8787';
          ctx.font = 'bold 13px "Inter", "PingFang SC", sans-serif';
          ctx.fillText('✖ 断裂地裂 (停稳后车头按E铺轨)', h.x - 10, -116);
        } else {
          ctx.fillStyle = '#223d2a';
          rrect(ctx, h.x, -74, h.width, 148, 4);
          ctx.fill();
          ctx.fillStyle = '#8ce99a';
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
        ctx.strokeStyle = '#ff5c5c';
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
          ctx.strokeStyle = 'rgba(105, 219, 124, 0.82)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(seg.x1 + 2, seg.y1);
          ctx.lineTo(seg.x1 + 11, seg.y1);
          ctx.moveTo(seg.x2 - 11, seg.y2);
          ctx.lineTo(seg.x2 - 2, seg.y2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = panel.hitFlash > 0 ? '#fff' : '#e0a23e';
          ctx.lineWidth = 8.5;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(seg.x1 + 1, seg.y1);
          ctx.lineTo(seg.x2 - 1, seg.y2);
          ctx.stroke();
          ctx.strokeStyle = '#402a0d';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(seg.cx - 9, seg.cy);
          ctx.lineTo(seg.cx + 9, seg.cy);
          ctx.stroke();
        }
      } else {
        const ratio = panel.hp / panel.maxHp;
        ctx.strokeStyle = panel.hitFlash > 0 ? '#fff' : ratio < 0.45 ? '#b35536' : '#7e8c99';
        ctx.lineWidth = 8.5;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
        ctx.strokeStyle = '#1e2429';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
    }
  }

  private drawTrain(ctx: CanvasRenderingContext2D, w: WorldState): void {
    // 1. Flatbed Carriages & Couplers (pre-baked deck stamped via drawImage — 100% locked!)
    for (let i = 0; i < w.flatbeds.length; i++) {
      const car = w.flatbeds[i];
      const b = getCarBounds(i);

      const isCrude = car.couplerKind === 'crude';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(b.right, -30, COUPLER_GAP, 66);
      ctx.fillStyle = isCrude ? (car.couplerHp < 35 ? '#a63426' : '#7d542d') : '#4f4841';
      ctx.fillRect(b.right, -34, COUPLER_GAP, 68);
      ctx.strokeStyle = isCrude ? '#ffae42' : '#26211d';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.right, -34, COUPLER_GAP, 68);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.4;
      for (let gx = b.right + 5; gx < b.right + COUPLER_GAP - 2; gx += 6) {
        ctx.beginPath();
        ctx.moveTo(gx, -30);
        ctx.lineTo(gx, 30);
        ctx.stroke();
      }
      if (isCrude) {
        ctx.fillStyle = '#111';
        ctx.fillRect(b.right + 2, 37, COUPLER_GAP - 4, 5);
        ctx.fillStyle = car.couplerHp < 35 ? '#ff5252' : '#ffd56b';
        ctx.fillRect(b.right + 3, 38, (COUPLER_GAP - 6) * (car.couplerHp / 100), 3);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      rrect(ctx, b.left - 4, b.top + 8, CAR_W + 8, CAR_H + 6, 6);
      ctx.fill();

      ctx.fillStyle = '#25292e';
      for (const wx of [b.left + 38, b.right - 38]) {
        ctx.fillRect(wx - 12, b.top - 5, 24, 6);
        ctx.fillRect(wx - 12, b.bottom - 1, 24, 6);
      }

      ctx.save();
      rrect(ctx, b.left, b.top, CAR_W, CAR_H, 3);
      ctx.clip();
      ctx.drawImage(this.patterns.flatbedDeck, b.left, b.top);
      const edgeGrad = ctx.createLinearGradient(0, b.top, 0, b.bottom);
      edgeGrad.addColorStop(0, 'rgba(0,0,0,0.28)');
      edgeGrad.addColorStop(0.12, 'rgba(0,0,0,0)');
      edgeGrad.addColorStop(0.88, 'rgba(0,0,0,0)');
      edgeGrad.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(b.left, b.top, CAR_W, CAR_H);
      ctx.restore();

      ctx.strokeStyle = w.buildMode || w.hotbar === 5 ? 'rgba(255, 220, 120, 0.42)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = w.buildMode || w.hotbar === 5 ? 1.2 : 1;
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
    }

    // 2. Locomotive deck, build grid, placed buildings, then hull
    drawLocomotiveArt(ctx, w, this.patterns.locoDeck);
    this.drawLocoBuildGrid(ctx, w);
    for (const bld of w.locoBuildings) {
      const tc = getTileCenter(bld.carIdx, bld.col, bld.row);
      ctx.save();
      ctx.translate(tc.x, tc.y);
      drawBuildingArt(ctx, w, bld);
      ctx.restore();
    }
    this.drawHullPanels(ctx, w, -1, w.locoHull);
  }

  /** 4×4 locomotive grid. Core tiles (boiler, throttle, lantern) are marked unbuildable. */
  private drawLocoBuildGrid(ctx: CanvasRenderingContext2D, w: WorldState): void {
    if (!(w.buildMode || w.hotbar === 5)) return;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.42)';
    for (let c = 1; c < LOCO_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, -HALF_H);
      ctx.lineTo(c * TILE, HALF_H);
      ctx.stroke();
    }
    for (let r = 1; r < CAR_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, -HALF_H + r * TILE);
      ctx.lineTo(LOCO_W, -HALF_H + r * TILE);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 140, 140, 0.7)';
    for (let col = 0; col < LOCO_COLS; col++) {
      for (let row = 0; row < CAR_ROWS; row++) {
        if (!isLocoCoreTile(col, row)) continue;
        const x = col * TILE;
        const y = -HALF_H + row * TILE;
        ctx.fillStyle = 'rgba(90, 36, 48, 0.28)';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + TILE - 10, y + TILE - 10);
        ctx.moveTo(x + TILE - 10, y + 10);
        ctx.lineTo(x + 10, y + TILE - 10);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawBuildGhost(ctx: CanvasRenderingContext2D, w: WorldState, wx: number, wy: number): void {
    const def = BUILDINGS[w.selectedBuild];
    const afford = canAffordCost(w, def.cost);

    if (def.locoFrontOnly) {
      const ok = afford && !w.hasBumper;
      ctx.fillStyle = ok ? 'rgba(89, 201, 115, 0.36)' : 'rgba(255, 82, 82, 0.36)';
      ctx.strokeStyle = ok ? '#8ce99a' : '#ff8787';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(LOCO_W, -58);
      ctx.lineTo(LOCO_W + 42, 0);
      ctx.lineTo(LOCO_W, 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }

    const tile = worldToTrainTile(w, wx, wy);
    if (!tile) return;
    const host = tile.carIdx < 0 ? w.locoBuildings : w.flatbeds[tile.carIdx].buildings;
    const blockedCore = tile.carIdx < 0 && isLocoCoreTile(tile.col, tile.row);
    const occupied = host.some((b) => b.col === tile.col && b.row === tile.row);
    const ok = afford && !occupied && !blockedCore;
    const c = getTileCenter(tile.carIdx, tile.col, tile.row);

    ctx.fillStyle = ok ? 'rgba(89, 201, 115, 0.34)' : 'rgba(255, 82, 82, 0.34)';
    ctx.strokeStyle = ok ? '#8ce99a' : '#ff8787';
    ctx.lineWidth = 2;
    rrect(ctx, c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4, 5);
    ctx.fill();
    ctx.stroke();
  }

  private drawAtmosphericLighting(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    W: number,
    H: number,
    darkAlpha: number,
    tint: string,
    shakeX: number,
    shakeY: number
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
      sx: (wx - this.smoothCamX) * this.zoom + W / 2 + shakeX,
      sy: (wy - this.smoothCamY) * this.zoom + H / 2 + shakeY,
    });

    lctx.globalCompositeOperation = 'destination-out';

    const punchRadial = (wx: number, wy: number, radius: number, strength = 1): void => {
      const { sx, sy } = toScreen(wx, wy);
      const r = radius * this.zoom;
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
      const r = range * this.zoom;
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(sx, sy);
      lctx.arc(sx, sy, r, angle - halfAngle, angle + halfAngle);
      lctx.closePath();
      lctx.clip();
      const g = lctx.createRadialGradient(sx, sy, 8, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.58, 'rgba(0,0,0,0.88)');
      g.addColorStop(0.86, 'rgba(0,0,0,0.34)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      lctx.restore();
    };

    const weatherShort = w.weather === 'clear' ? 1 : 0.78;
    const hasLitLantern = playerHasActiveLantern(w);

    if (hasLitLantern) {
      punchRadial(w.player.x, w.player.y, 52, 0.94);
      punchCone(w.player.x, w.player.y, w.player.angle, 240 * weatherShort, 0.46);
    } else {
      punchRadial(w.player.x, w.player.y, 34, 0.52);
    }

    if (w.lanternHolder === 'train') {
      punchRadial(LANTERN_HOOK_X, LANTERN_HOOK_Y, 132, 0.95);
    }

    if (w.boilerFuel > 0) {
      punchRadial(54, -22, 118, 0.92);
      punchCone(LOCO_W + 6, 0, 0, 310 * weatherShort, 0.36);
    } else {
      punchRadial(88, 0, 66, 0.58);
    }

    for (const deck of getTrainBuildingLists(w)) {
      for (const b of deck) {
        if (b.type === 'campfire' || b.type === 'lantern') {
          const tc = getTileCenter(b.carIdx, b.col, b.row);
          punchRadial(tc.x, tc.y, b.type === 'campfire' ? 136 : 120, 0.94);
        }
      }
    }

    for (const pr of w.props) {
      if (!pr.used && pr.kind === 'arcane_crystal') {
        punchRadial(pr.x, pr.y, 92, 0.85);
      }
    }

    ctx.drawImage(this.lightCanvas, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (w.boilerFuel > 0 && darkAlpha > 0.15) {
      const { sx, sy } = toScreen(LOCO_W + 6, 0);
      const r = 310 * weatherShort * this.zoom;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, r);
      g.addColorStop(0, `rgba(255, 224, 150, ${0.18 * darkAlpha})`);
      g.addColorStop(1, 'rgba(255, 195, 95, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, r, -0.36, 0.36);
      ctx.closePath();
      ctx.fill();
    }
    if (hasLitLantern && darkAlpha > 0.2) {
      const { sx, sy } = toScreen(w.player.x, w.player.y);
      const r = 240 * weatherShort * this.zoom;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, r);
      g.addColorStop(0, `rgba(255, 228, 160, ${0.15 * darkAlpha})`);
      g.addColorStop(1, 'rgba(255, 200, 110, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, r, w.player.angle - 0.46, w.player.angle + 0.46);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWeather(ctx: CanvasRenderingContext2D, w: WorldState, W: number, H: number): void {
    if (w.weather === 'rainstorm') {
      ctx.strokeStyle = 'rgba(148, 208, 255, 0.42)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 120; i++) {
        const rx = ((i * 89 + w.time * 540) % (W + 140)) - 70;
        const ry = ((i * 53 + w.time * 820) % (H + 140)) - 70;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 18, ry + 30);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(180, 225, 255, 0.22)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const phase = (w.time * 2.2 + i * 0.37) % 1;
        const px = (i * 197 + 80) % W;
        const py = (i * 131 + 60) % H;
        ctx.beginPath();
        ctx.ellipse(px, py, 3 + phase * 12, 1.5 + phase * 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (w.lightningFlash > 0) {
        ctx.fillStyle = `rgba(220, 238, 255, ${w.lightningFlash * 0.42})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (w.weather === 'blizzard') {
      ctx.fillStyle = 'rgba(225, 242, 255, 0.72)';
      for (let i = 0; i < 130; i++) {
        const sx = (((i * 113 - w.time * (280 + (i % 5) * 35)) % (W + 80)) + W + 80) % (W + 80) - 40;
        const sy = ((i * 71 + w.time * (200 + (i % 4) * 28)) % (H + 80)) - 40;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 3) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCrispWorldOverlays(
    ctx: CanvasRenderingContext2D,
    w: WorldState,
    W: number,
    H: number,
    shakeX: number,
    shakeY: number
  ): void {
    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - this.smoothCamX) * this.zoom + W / 2 + shakeX,
      sy: (wy - this.smoothCamY) * this.zoom + H / 2 + shakeY,
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 13px "Inter", "PingFang SC", sans-serif';
    for (const fl of w.floats) {
      const { sx, sy } = toScreen(fl.x, fl.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, fl.life * 1.4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(fl.text, sx + 1, sy + 1.5);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, sx, sy);
      ctx.restore();
    }

    if (w.activeHint) {
      const h = w.activeHint;
      const { sx, sy } = toScreen(h.x, h.y);
      ctx.font = 'bold 12px "Inter", "PingFang SC", sans-serif';
      const tw = ctx.measureText(h.label).width + 22;
      ctx.fillStyle = 'rgba(16, 13, 10, 0.94)';
      ctx.strokeStyle = '#e7a043';
      ctx.lineWidth = 1.6;
      rrect(ctx, sx - tw / 2, sy - 14, tw, 28, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe8b6';
      ctx.fillText(h.label, sx, sy + 0.5);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
