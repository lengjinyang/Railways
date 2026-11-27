import {
  MELEE_META,
  GEAR_LABELS,
  HALF_H,
  LOCO_H,
  LOCO_W,
  TILE,
  getActiveBinding,
  getZoneTierRoman,
  playerHasActiveLantern,
  type MonsterEntity,
  type PlacedBuilding,
  type WorldProp,
  type WorldState,
} from '../world';
import { monoFont, uiFont } from './fonts';

export function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function contactShadow(ctx: CanvasRenderingContext2D, rx: number, ry: number, ox = 3, oy = 5, alpha = 0.42): void {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Diegetic Steampunk × Blue-Fire Locomotive (fuel brightness + pressure dial drawn directly on engine, A/U8!) */
export function drawLocomotiveArt(
  ctx: CanvasRenderingContext2D,
  w: WorldState,
  locoDeckCanvas: HTMLCanvasElement
): void {
  const t = w.time;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  rrect(ctx, -6, -HALF_H + 8, LOCO_W + 28, LOCO_H + 6, 10);
  ctx.fill();
  ctx.restore();

  const rodOff = Math.sin(w.worldScrollX * 0.08) * 5;
  ctx.fillStyle = '#25292e';
  for (const wx of [30, 88, 146]) {
    ctx.fillRect(wx - 11, -HALF_H - 5, 22, 6);
    ctx.fillRect(wx - 11, HALF_H - 1, 22, 6);
  }
  ctx.fillStyle = '#8b95a0';
  ctx.fillRect(24 + rodOff, -HALF_H - 4, 124, 3);
  ctx.fillRect(24 + rodOff, HALF_H + 1, 124, 3);

  const hullGrad = ctx.createLinearGradient(0, -HALF_H, 0, HALF_H);
  hullGrad.addColorStop(0, w.locoLevel === 2 ? '#5d4a3a' : '#4a3e35');
  hullGrad.addColorStop(0.5, w.locoLevel === 2 ? '#4a3b2e' : '#3a312a');
  hullGrad.addColorStop(1, '#2a231e');
  ctx.fillStyle = hullGrad;
  rrect(ctx, 0, -HALF_H, LOCO_W, LOCO_H, 4);
  ctx.fill();

  ctx.save();
  rrect(ctx, 6, -HALF_H + 6, LOCO_W - 12, LOCO_H - 12, 3);
  ctx.clip();
  ctx.drawImage(locoDeckCanvas, 6, -HALF_H + 6);
  ctx.restore();

  ctx.strokeStyle = w.locoLevel === 2 ? '#c9933c' : '#5e5248';
  ctx.lineWidth = 2.5;
  rrect(ctx, 5, -HALF_H + 5, LOCO_W - 10, LOCO_H - 10, 3);
  ctx.stroke();

  // --- Cast-Iron Blue-Fire Boiler Drum (x=54, y=-28) ---
  ctx.save();
  ctx.translate(54, -28);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rrect(ctx, -30, -24, 64, 54, 12);
  ctx.fill();

  const bGrad = ctx.createLinearGradient(0, -26, 0, 26);
  bGrad.addColorStop(0, '#5a626b');
  bGrad.addColorStop(0.3, '#383e45');
  bGrad.addColorStop(0.7, '#22262b');
  bGrad.addColorStop(1, '#14171a');
  ctx.fillStyle = bGrad;
  rrect(ctx, -31, -26, 62, 52, 12);
  ctx.fill();
  ctx.strokeStyle = '#101214';
  ctx.lineWidth = 2;
  ctx.stroke();

  const strapGrad = ctx.createLinearGradient(0, -26, 0, 26);
  strapGrad.addColorStop(0, '#e8bc66');
  strapGrad.addColorStop(0.5, '#b87b28');
  strapGrad.addColorStop(1, '#613c0e');
  ctx.fillStyle = strapGrad;
  for (const sx of [-19, 0, 19]) ctx.fillRect(sx - 2.5, -26, 5, 52);

  // Smokestack crown
  ctx.fillStyle = '#181a1d';
  ctx.beginPath();
  ctx.arc(16, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c98a36';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#090a0b';
  ctx.beginPath();
  ctx.arc(16, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  // Diegetic Blue-Fire Grate: brightness & radius directly show remaining boilerFuel (A/U8)!
  const fuelRatio = Math.max(0, Math.min(1, w.boilerFuel / Math.max(1, w.boilerMax)));
  ctx.fillStyle = '#11161f';
  rrect(ctx, -16, 15, 32, 14, 4);
  ctx.fill();
  if (fuelRatio > 0.01) {
    const flicker = (0.55 + fuelRatio * 0.45) + Math.sin(t * 11) * 0.12;
    const rad = 10 + fuelRatio * 18;
    const fg = ctx.createRadialGradient(0, 22, 2, 0, 22, rad);
    fg.addColorStop(0, `rgba(220, 244, 255, ${flicker})`);
    fg.addColorStop(0.5, `rgba(92, 180, 255, ${flicker * 0.88})`);
    fg.addColorStop(1, 'rgba(30, 85, 175, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 22, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fuelRatio < 0.2 ? '#4d7aa8' : '#7cc4ff';
    rrect(ctx, -12 * Math.max(0.35, fuelRatio), 18, 24 * Math.max(0.35, fuelRatio), 8, 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1c1824';
  ctx.lineWidth = 1.8;
  for (let gx = -9; gx <= 9; gx += 4.5) {
    ctx.beginPath();
    ctx.moveTo(gx, 17);
    ctx.lineTo(gx, 27);
    ctx.stroke();
  }

  // Diegetic Boiler Pressure Dial right on the boiler top-left (red zone >80%)
  ctx.fillStyle = '#efe2c8';
  ctx.beginPath();
  ctx.arc(-18, -8, 8.5, 0, Math.PI * 2);
  ctx.fill();
  // Red danger zone arc
  ctx.strokeStyle = '#c9382a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(-18, -8, 6.2, 0.25, 0.9);
  ctx.stroke();
  ctx.strokeStyle = '#8c5a1a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-18, -8, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  const pAng = -Math.PI * 0.78 + (w.boilerPressure / 100) * Math.PI * 1.45;
  ctx.strokeStyle = w.boilerPressure > 80 ? '#e03131' : '#1b1d20';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-18, -8);
  ctx.lineTo(-18 + Math.cos(pAng) * 6.5, -8 + Math.sin(pAng) * 6.5);
  ctx.stroke();

  // Compact brass fuel bar on boiler
  ctx.fillStyle = 'rgba(14, 12, 10, 0.85)';
  rrect(ctx, -26, -39, 52, 11, 3);
  ctx.fill();
  ctx.fillStyle = fuelRatio < 0.2 ? '#e07a7a' : '#7cc4ff';
  rrect(ctx, -24, -37, 48 * fuelRatio, 7, 2);
  ctx.fill();
  ctx.restore();

  // --- Brass Throttle Console (x=136, y=0) ---
  ctx.save();
  ctx.translate(136, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rrect(ctx, -17, -27, 38, 60, 6);
  ctx.fill();
  const cGrad = ctx.createLinearGradient(-18, -30, 18, 30);
  cGrad.addColorStop(0, '#32373d');
  cGrad.addColorStop(1, '#1a1d21');
  ctx.fillStyle = cGrad;
  rrect(ctx, -18, -30, 36, 60, 6);
  ctx.fill();
  ctx.strokeStyle = '#c98a36';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Speedometer dial
  ctx.fillStyle = '#efe2c8';
  ctx.beginPath();
  ctx.arc(0, -16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8c5a1a';
  ctx.lineWidth = 2;
  ctx.stroke();
  const needleAng = -Math.PI * 0.75 + (w.trainSpeed / 205) * Math.PI * 1.4;
  ctx.strokeStyle = '#c92a2a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(Math.cos(needleAng) * 6, -16 + Math.sin(needleAng) * 6);
  ctx.stroke();

  // Lever handle
  ctx.fillStyle = '#0e1012';
  rrect(ctx, -4, -3, 8, 28, 3);
  ctx.fill();
  const leverY = 21 - w.gear * 7.5;
  ctx.fillStyle = w.gear === 3 ? '#d9534f' : w.gear > 0 ? '#68b874' : '#adb5bd';
  rrect(ctx, -12, leverY - 3.5, 24, 7, 3);
  ctx.fill();
  ctx.strokeStyle = '#141210';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#e8d7b8';
  ctx.font = uiFont(10, 700);
  ctx.textAlign = 'center';
  ctx.fillText(GEAR_LABELS[w.gear], 0, -35);
  ctx.restore();

  // --- Cowcatcher / Ram Bumper ---
  ctx.save();
  ctx.translate(LOCO_W, 0);
  if (w.hasBumper) {
    const ramG = ctx.createLinearGradient(0, -60, 42, 60);
    ramG.addColorStop(0, w.bumperTier >= 2 ? '#d0d8e0' : '#d9a441');
    ramG.addColorStop(1, w.bumperTier >= 2 ? '#4a5562' : '#7a4510');
    ctx.fillStyle = ramG;
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.lineTo(42, 0);
    ctx.lineTo(0, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8d7b8';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#4c5259';
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(25, 0);
    ctx.lineTo(0, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = '#b87d2e';
  rrect(ctx, -4, -9, 11, 18, 3);
  ctx.fill();
  ctx.fillStyle = w.boilerFuel > 0 ? '#fff3c4' : '#4a453f';
  ctx.fillRect(6, -6, 3, 12);
  ctx.restore();

  // Ivy City creeping vines around engine wheels (W4)
  if (w.vineSnare > 8) {
    ctx.save();
    ctx.strokeStyle = '#56b877';
    ctx.lineWidth = 3;
    const wraps = Math.min(6, Math.ceil(w.vineSnare / 18));
    for (let i = 0; i < wraps; i++) {
      const vx = 18 + i * 26;
      ctx.beginPath();
      ctx.moveTo(vx, -HALF_H - 8);
      ctx.quadraticCurveTo(vx + 10, -HALF_H + 14, vx - 6, -HALF_H + 28);
      ctx.moveTo(vx, HALF_H + 8);
      ctx.quadraticCurveTo(vx - 10, HALF_H - 14, vx + 6, HALF_H - 28);
      ctx.stroke();
    }
    ctx.restore();
  }

  const hpPct = Math.max(0, w.locoHp / w.locoMaxHp);
  if (hpPct < 0.995) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    rrect(ctx, 14, HALF_H - 18, LOCO_W - 28, 7, 3);
    ctx.fill();
    ctx.fillStyle = hpPct > 0.4 ? '#68b874' : '#d9534f';
    rrect(ctx, 15, HALF_H - 17, (LOCO_W - 30) * hpPct, 5, 2);
    ctx.fill();
  }
  ctx.textAlign = 'left';
}

/** Top-down sprites for all placeable buildings with T1 vs T2 visual distinctions */
export function drawBuildingArt(ctx: CanvasRenderingContext2D, w: WorldState, b: PlacedBuilding): void {
  const hs = TILE / 2 - 2;
  const flash = (b.hitFlash ?? 0) > 0;
  const t = w.time;
  const t2 = b.tier >= 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  rrect(ctx, -hs + 2, -hs + 4, hs * 2, hs * 2, 5);
  ctx.fill();

  if (b.type === 'wood_wall') {
    const g = ctx.createLinearGradient(-hs, -hs, hs, hs);
    g.addColorStop(0, flash ? '#fff' : t2 ? '#8d9aa6' : '#a87747');
    g.addColorStop(1, flash ? '#fff' : t2 ? '#3d454d' : '#6c4827');
    ctx.fillStyle = g;
    rrect(ctx, -hs, -hs, hs * 2, hs * 2, 4);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#1c2126' : '#2d1c0e';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (b.type === 'door') {
    ctx.fillStyle = '#33383e';
    ctx.fillRect(-hs, -4, hs * 2, 8);
    if (b.doorOpen) {
      ctx.fillStyle = t2 ? '#8d9aa6' : '#c9933c';
      rrect(ctx, -hs, -hs + 1, 7, hs * 2 - 2, 2);
      ctx.fill();
    } else {
      ctx.fillStyle = flash ? '#fff' : t2 ? '#6f7c87' : '#c78c3a';
      rrect(ctx, -hs, -7, hs * 2, 14, 3);
      ctx.fill();
      ctx.strokeStyle = '#241a0d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (b.type === 'workbench') {
    ctx.fillStyle = flash ? '#fff' : t2 ? '#4d565e' : '#9c6e3b';
    rrect(ctx, -hs + 1, -hs + 2, hs * 2 - 2, hs * 2 - 4, 4);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#d9a441' : '#2b1b0c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2d5c8a';
    rrect(ctx, -14, -11, 17, 20, 2);
    ctx.fill();
    ctx.fillStyle = '#d99b3c';
    rrect(ctx, 5, -11, 10, 10, 2);
    ctx.fill();
  } else if (b.type === 'chest') {
    ctx.fillStyle = flash ? '#fff' : t2 ? '#4e5964' : '#916031';
    rrect(ctx, -hs + 2, -hs + 4, hs * 2 - 4, hs * 2 - 8, 4);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#c9933c' : '#24170b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3c434a';
    ctx.fillRect(-11, -hs + 4, 5, hs * 2 - 8);
    ctx.fillRect(6, -hs + 4, 5, hs * 2 - 8);
    ctx.fillStyle = '#d9b15f';
    rrect(ctx, -4, 4, 8, 8, 2);
    ctx.fill();
  } else if (b.type === 'campfire') {
    ctx.fillStyle = flash ? '#fff' : t2 ? '#343b42' : '#4a433d';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#c98a36' : '#181412';
    ctx.lineWidth = 2;
    ctx.stroke();
    const pulse = 1 + Math.sin(t * 13 + b.col) * 0.14;
    const fg = ctx.createRadialGradient(0, 0, 1, 0, 0, 12 * pulse);
    fg.addColorStop(0, '#fff2b2');
    fg.addColorStop(0.5, '#e67e29');
    fg.addColorStop(1, 'rgba(180, 40, 10, 0.2)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === 'lantern') {
    const pulse = 1 + Math.sin(t * 5.5 + b.col) * 0.08;
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, (t2 ? 26 : 20) * pulse);
    halo.addColorStop(0, t2 ? 'rgba(130, 215, 255, 0.9)' : 'rgba(255, 235, 165, 0.85)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, (t2 ? 26 : 20) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#32363b';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t2 ? '#8ce0ff' : '#ffe694';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === 'planter') {
    ctx.fillStyle = t2 ? '#4d5863' : '#734f2c';
    rrect(ctx, -hs, -hs, hs * 2, hs * 2, 4);
    ctx.fill();
    ctx.strokeStyle = (b.watered ?? 0) > 0 ? '#5fa8e6' : '#3a2614';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = (b.watered ?? 0) > 0 ? '#261b12' : '#4a3726';
    rrect(ctx, -hs + 4, -hs + 4, hs * 2 - 8, hs * 2 - 8, 2);
    ctx.fill();
    if (b.planted) {
      const pct = Math.min(1, (b.growth ?? 0) / 100);
      const ripe = pct >= 1;
      for (const [cx, cy] of [[-7, -7], [7, -6], [-6, 7], [7, 7], [0, 0]]) {
        const r = 3 + pct * 4.5;
        ctx.fillStyle = b.pestInfested ? '#9c6b9c' : ripe ? '#e6b83c' : '#3d994c';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (b.type === 'rain_collector') {
    ctx.fillStyle = t2 ? '#344c5c' : '#42515c';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#7cc4ff' : '#7c96a8';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const fill = Math.min(1, (b.storedWater ?? 0) / 6);
    ctx.fillStyle = fill > 0.05 ? (t2 ? '#5fa8e6' : '#58786e') : '#1c252b';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    if (fill > 0.05) {
      ctx.fillStyle = '#e7f5ff';
      ctx.font = monoFont(10, 700);
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(b.storedWater ?? 0)}`, 0, 4);
      ctx.textAlign = 'left';
    }
  } else if (b.type === 'bed') {
    ctx.fillStyle = t2 ? '#6e4a29' : '#4d463f';
    rrect(ctx, -hs + 1, -hs + 3, hs * 2 - 2, hs * 2 - 6, 4);
    ctx.fill();
    ctx.fillStyle = '#e5dac7';
    rrect(ctx, -hs + 4, -hs + 6, 10, hs * 2 - 12, 3);
    ctx.fill();
    ctx.fillStyle = t2 ? '#4a8a8e' : '#5c6659';
    rrect(ctx, -4, -hs + 6, hs + 1, hs * 2 - 12, 3);
    ctx.fill();
  } else if (b.type === 'crystal_pylon') {
    const pulse = 0.85 + Math.sin(t * 4.5) * 0.15;
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 22);
    halo.addColorStop(0, `rgba(124, 196, 255, ${0.5 * pulse})`);
    halo.addColorStop(1, 'rgba(30, 85, 175, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#252c36';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t2 ? '#8ce0ff' : '#c9933c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : '#7cc4ff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
  } else if (b.type === 'turret') {
    ctx.fillStyle = '#3b2e2e';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.turretOutOfAmmo ? '#666' : t2 ? '#b85046' : '#a8844c';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.save();
    ctx.rotate(b.turretAngle ?? 0);
    if (t2) {
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(6, -5.5, 20, 3.5);
      ctx.fillRect(6, 2, 20, 3.5);
      ctx.fillStyle = flash ? '#fff' : '#a6443d';
      rrect(ctx, -11, -10, 20, 20, 5);
      ctx.fill();
    } else {
      // Crossbow turret T1
      ctx.strokeStyle = '#9c6e3b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, -13);
      ctx.quadraticCurveTo(14, 0, 6, 13);
      ctx.stroke();
      ctx.fillStyle = '#755331';
      ctx.fillRect(-8, -3, 24, 6);
    }
    ctx.restore();
    if (b.turretOutOfAmmo) {
      ctx.fillStyle = 'rgba(180,180,180,0.65)';
      ctx.font = uiFont(9, 700);
      ctx.textAlign = 'center';
      ctx.fillText('空弹', 0, -19);
      ctx.textAlign = 'left';
    }
  }

  // Processing progress ring on campfire/filter
  if (b.processRecipeId && (b.processProgress ?? 0) > 0) {
    const pct = Math.min(1, (b.processProgress ?? 0) / 100);
    ctx.strokeStyle = '#d9b15f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }

  if (b.onFire) {
    const f = 1 + Math.sin(t * 17) * 0.2;
    const fg = ctx.createRadialGradient(0, -2, 2, 0, -2, 16 * f);
    fg.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
    fg.addColorStop(0.5, 'rgba(255, 90, 25, 0.85)');
    fg.addColorStop(1, 'rgba(200, 30, 10, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, -2, 16 * f, 0, Math.PI * 2);
    ctx.fill();
  }

  if (b.hp < b.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    rrect(ctx, -16, hs - 4, 32, 5, 2);
    ctx.fill();
    ctx.fillStyle = b.hp / b.maxHp > 0.35 ? '#68b874' : '#d9534f';
    rrect(ctx, -15, hs - 3, 30 * Math.max(0, b.hp / b.maxHp), 3, 1.5);
    ctx.fill();
  }
}

export function drawPlayerArt(ctx: CanvasRenderingContext2D, w: WorldState): void {
  const p = w.player;
  const t = w.time;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnTimer > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.55;

  contactShadow(ctx, 14, 10, 2, 5, 0.45);

  if (p.swingTimer > 0) {
    const prog = 1 - p.swingTimer / 0.2;
    ctx.save();
    ctx.rotate(p.swingAngle);
    const arcAlpha = (1 - prog) * 0.85;
    ctx.strokeStyle = `rgba(240, 228, 195, ${arcAlpha})`;
    ctx.lineWidth = 9 * (1 - prog * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 34, -1.05 + prog * 0.35, -1.05 + prog * 2.15);
    ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(p.angle);

  ctx.fillStyle = '#5c3c22';
  rrect(ctx, -17, -10, 10, 20, 4);
  ctx.fill();
  ctx.strokeStyle = '#24160b';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  if (w.lanternHolder === 'player') {
    const lit = playerHasActiveLantern(w);
    if (lit) {
      const g = ctx.createRadialGradient(14, -12, 1, 14, -12, 16);
      g.addColorStop(0, 'rgba(255, 245, 190, 0.95)');
      g.addColorStop(1, 'rgba(255, 160, 40, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(14, -12, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = lit ? '#ffe694' : '#555';
    ctx.beginPath();
    ctx.arc(14, -12, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const showBuild = w.buildMode;
  const held = getActiveBinding(w);
  ctx.save();
  ctx.translate(8, 10);
  if (p.swingTimer > 0) ctx.rotate(-0.8 + (1 - p.swingTimer / 0.2) * 1.9);
  if (showBuild) {
    ctx.fillStyle = '#6c4926';
    ctx.fillRect(0, -1.8, 18, 3.6);
    ctx.fillStyle = '#d9a441';
    rrect(ctx, 14, -6.5, 6, 13, 1.5);
    ctx.fill();
  } else if (held?.kind === 'ranged' && p.rangedWeapon !== 'none') {
    if (p.rangedWeapon === 'crossbow') {
      ctx.fillStyle = '#755331';
      ctx.fillRect(0, -2, 18, 4);
      ctx.strokeStyle = '#c49b6c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(12, -10);
      ctx.quadraticCurveTo(18, 0, 12, 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#6c4826';
      ctx.fillRect(-3, -2.5, 11, 5);
      ctx.fillStyle = '#495057';
      ctx.fillRect(7, -3, 19, 6);
    }
  } else if (!held || held.kind === 'tool') {
    if (p.toolLevel === 3) {
      ctx.fillStyle = '#c98a36';
      rrect(ctx, 0, -4, 15, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#dee2e6';
      ctx.beginPath();
      ctx.arc(20, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.toolLevel === 2 || p.meleeWeapon === 'axe') {
      ctx.fillStyle = '#6c4926';
      ctx.fillRect(0, -1.8, 20, 3.6);
      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(15, 0, 9, -1.1, 1.1);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#b86446';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(19, 0);
      ctx.lineTo(22, -5);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Body armor tint
  const coatCol =
    p.hitFlash > 0
      ? '#e07a7a'
      : p.bodyArmor === 'iron_vest'
        ? '#6a7580'
        : p.bodyArmor === 'fur_coat'
          ? '#7a5c46'
          : p.bodyArmor === 'leather_coat'
            ? '#614835'
            : '#3b6178';
  ctx.fillStyle = coatCol;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 11, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#14181c';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = p.headArmor === 'weld_mask' ? '#49525c' : p.headArmor === 'fur_cap' ? '#70523c' : '#254357';
  ctx.beginPath();
  ctx.arc(1, 0, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8dfd1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = p.headArmor === 'weld_mask' ? '#7cc4ff' : '#d9933c';
  rrect(ctx, 5, -5.5, 4.5, 11, 2);
  ctx.fill();

  ctx.restore();

  // Stamina arc beside the player, only while it isn't full
  if (p.alive && p.stamina < p.maxStamina - 0.5) {
    const k = Math.max(0, p.stamina / p.maxStamina);
    const low = p.stamina < MELEE_META[p.meleeWeapon].stamina;
    const a0 = Math.PI * 0.62;
    const a1 = Math.PI * 1.38;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(8, 6, 5, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, a0, a1);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    const waiting = (p.staminaDelay ?? 0) > 0;
    ctx.strokeStyle = low ? `rgba(224, 122, 92, ${0.7 + 0.3 * Math.sin(w.time * 12)})` : waiting ? '#c9a659' : '#e8cf86';
    ctx.beginPath();
    ctx.arc(0, 0, 22, a1 - (a1 - a0) * k, a1);
    ctx.stroke();
    ctx.restore();
  }
}

/** Painterly sprites for all 8 differentiated monster archetypes (H2) */
export function drawMonsterArt(ctx: CanvasRenderingContext2D, w: WorldState, m: MonsterEntity): void {
  const t = w.time;
  const ang = m.aiState === 'charge' ? Math.atan2(m.chargeDirY ?? 0, m.chargeDirX ?? 1) : Math.atan2(w.player.y - m.y, w.player.x - m.x);
  const flash = m.hitFlash > 0;
  const stride = Math.sin(t * 11 + m.x * 0.08) * 3;
  const r = m.r;

  ctx.save();
  ctx.translate(m.x, m.y);

  // Sandworm underground rumble telegraph
  if (m.aiState === 'emerge') {
    ctx.strokeStyle = '#a89172';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 10 + Math.sin(t * 20) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  contactShadow(ctx, r * 0.95, r * 0.72, 2, 5, 0.45);

  if (m.elite) {
    // Guardian: smouldering ring under its feet so it reads as dangerous at a glance
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + m.x * 0.01);
    const g = ctx.createRadialGradient(0, 2, r * 0.6, 0, 2, r * 1.75);
    g.addColorStop(0, `rgba(220, 96, 52, ${0.26 + pulse * 0.14})`);
    g.addColorStop(1, 'rgba(220, 96, 52, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 1.75, r * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(243, 196, 110, ${0.45 + pulse * 0.35})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 1.32, r * 1.02, t * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Readable windup telegraph
  if (m.windupTimer > 0 && m.windupMax > 0) {
    const pct = 1 - m.windupTimer / m.windupMax;
    ctx.save();
    if (m.kind === 'charger') {
      ctx.rotate(m.windupAngle);
      ctx.fillStyle = `rgba(220, 80, 70, ${0.15 + pct * 0.25})`;
      ctx.fillRect(0, -r * 0.9, m.windupRange, r * 1.8);
      ctx.strokeStyle = '#f28b82';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -r * 0.9, m.windupRange, r * 1.8);
    } else {
      const tr = Math.max(r + 16, m.windupRange);
      ctx.fillStyle = `rgba(220, 72, 72, ${0.12 + pct * 0.24})`;
      ctx.beginPath();
      ctx.arc(0, 0, tr * (0.45 + 0.55 * pct), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pct > 0.7 ? '#fff5f5' : '#e07a7a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, tr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(ang);

  if (m.kind === 'mutant_raider') {
    ctx.fillStyle = flash ? '#fff' : '#5e3c38';
    ctx.beginPath();
    ctx.ellipse(-1, 0, r * 0.82, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f1210';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#495057';
    ctx.fillRect(5, 4, 18, 4);
    ctx.fillStyle = flash ? '#fff' : '#7a5248';
    ctx.beginPath();
    ctx.arc(1, 0, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.kind === 'nightwalker') {
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 10);
    grad.addColorStop(0, flash ? '#fff' : 'rgba(18, 22, 32, 0.95)');
    grad.addColorStop(1, 'rgba(10, 12, 18, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.kind === 'charger') {
    ctx.fillStyle = flash ? '#fff' : '#6e2828';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.1, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#240b0b';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = '#e8dfd1';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(4, -r * 0.6);
    ctx.quadraticCurveTo(r * 1.2, -r * 0.8, r * 1.25, -r * 0.2);
    ctx.moveTo(4, r * 0.6);
    ctx.quadraticCurveTo(r * 1.2, r * 0.8, r * 1.25, r * 0.2);
    ctx.stroke();
  } else if (m.kind === 'sandworm') {
    ctx.fillStyle = flash ? '#fff' : '#78624e';
    for (const [sx, sr] of [[-12, r * 0.62], [-3, r * 0.85], [6, r * 0.9]]) {
      ctx.beginPath();
      ctx.arc(sx, Math.sin(t * 9 + sx) * 2, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#261e17';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (m.kind === 'clinger') {
    ctx.strokeStyle = '#472a0b';
    ctx.lineWidth = 2.4;
    for (const lx of [-5, 1, 7]) {
      ctx.beginPath();
      ctx.moveTo(lx, -r * 0.6);
      ctx.lineTo(lx + stride * 0.5, -r * 1.3);
      ctx.moveTo(lx, r * 0.6);
      ctx.lineTo(lx - stride * 0.5, r * 1.3);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#fff' : '#b87624';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.kind === 'burrower') {
    ctx.fillStyle = flash ? '#fff' : '#6c4778';
    for (const [sx, sr] of [[-9, r * 0.6], [-2, r * 0.8], [5, r * 0.8]]) {
      ctx.beginPath();
      ctx.arc(sx, Math.sin(t * 9 + sx) * 1.6, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // hound / stalker
    ctx.fillStyle = flash ? '#fff' : m.kind === 'hound' ? '#8c4a38' : '#a83636';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#240e0b';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  ctx.fillStyle = m.kind === 'nightwalker' ? '#a5d8ff' : '#fff0b3';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.28, 2.2, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.28, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (m.aiState === 'stunned') {
    ctx.fillStyle = '#e0c078';
    ctx.font = uiFont(10, 700);
    ctx.textAlign = 'center';
    ctx.fillText('晕眩', 0, -r - 12);
    ctx.textAlign = 'left';
  }

  if (m.elite) {
    const barW = m.boss ? Math.max(70, r * 2.6) : 44;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    rrect(ctx, -barW / 2, -r - 12, barW, 5, 2);
    ctx.fill();
    ctx.fillStyle = m.boss ? '#d9634a' : '#e2a24f';
    rrect(ctx, -barW / 2 + 1, -r - 11, (barW - 2) * Math.max(0, m.hp / m.maxHp), 3, 1.5);
    ctx.fill();
    const label = m.guard?.asleep ? `${m.title ?? '巢穴守卫'} · 沉睡` : m.title ?? '巢穴守卫';
    ctx.font = uiFont(m.boss ? 11 : 9.5, 700);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,8,6,0.75)';
    ctx.fillText(label, 0.8, -r - 16.2);
    ctx.fillStyle = m.guard?.asleep ? '#b9ad94' : '#f3d58f';
    ctx.fillText(label, 0, -r - 17);
    if (m.guard?.asleep) {
      // slow breathing "z" drifting up — reads as asleep without a popup
      const z = (t * 0.6 + m.x * 0.001) % 1;
      ctx.globalAlpha = 0.7 * (1 - z);
      ctx.font = uiFont(10 + z * 4, 700);
      ctx.fillText('z', r * 0.6 + z * 8, -r - 24 - z * 16);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  } else if (m.hp < m.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    rrect(ctx, -16, -r - 10, 32, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#d9534f';
    rrect(ctx, -15, -r - 9, 30 * Math.max(0, m.hp / m.maxHp), 2, 1);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPropArt(ctx: CanvasRenderingContext2D, w: WorldState, pr: WorldProp): void {
  const ox = pr.hitOffX ?? 0;
  const oy = pr.hitOffY ?? 0;
  const scale = (pr.hitBounce ?? 0) > 0 ? 1 + (pr.hitBounce ?? 0) * 0.65 : 1;
  const flash = pr.hitFlash > 0;
  const t = w.time;

  ctx.save();
  ctx.translate(pr.x + ox, pr.y + oy);
  ctx.scale(scale, 2 - scale);
  contactShadow(ctx, pr.r * 1.05, pr.r * 0.75, 3, 6, 0.4);

  if (pr.kind === 'wood_crate' || pr.kind === 'bandit_crate') {
    ctx.fillStyle = flash ? '#fff' : pr.kind === 'bandit_crate' ? '#7a3d35' : '#966638';
    rrect(ctx, -18, -16, 36, 32, 4);
    ctx.fill();
    ctx.strokeStyle = pr.searched ? '#555' : '#2e1d0e';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pr.kind === 'dry_tree') {
    ctx.strokeStyle = flash ? '#fff' : '#785536';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(16, 10);
    ctx.moveTo(-10, 16);
    ctx.lineTo(14, -14);
    ctx.stroke();
    ctx.fillStyle = '#573c24';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (pr.kind === 'ivy_cluster') {
    ctx.fillStyle = flash ? '#fff' : '#2e6b44';
    ctx.beginPath();
    ctx.arc(0, 0, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#73d997';
    for (const [ix, iy] of [[-7, -5], [6, -6], [0, 7], [8, 4]]) {
      ctx.beginPath();
      ctx.arc(ix, iy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pr.kind === 'bone_pile') {
    ctx.strokeStyle = flash ? '#fff' : '#ded6c8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(12, 9);
    ctx.moveTo(-10, 10);
    ctx.lineTo(11, -9);
    ctx.stroke();
  } else if (pr.kind === 'monster_nest') {
    ctx.fillStyle = flash ? '#fff' : '#4a2525';
    ctx.beginPath();
    ctx.arc(0, 0, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8c3b3b';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#1f0c0c';
    ctx.beginPath();
    ctx.arc(0, 0, pr.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  } else if (pr.kind === 'scrap_pile') {
    ctx.fillStyle = flash ? '#fff' : '#58616b';
    ctx.beginPath();
    ctx.arc(0, 0, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b95a0';
    rrect(ctx, -13, -8, 22, 8, 2);
    ctx.fill();
  } else if (pr.kind === 'parts_box') {
    ctx.fillStyle = flash ? '#fff' : '#4a6b82';
    rrect(ctx, -18, -14, 36, 28, 4);
    ctx.fill();
    ctx.strokeStyle = '#d9b15f';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pr.kind === 'seed_cache') {
    ctx.fillStyle = flash ? '#fff' : '#36693a';
    rrect(ctx, -20, -16, 40, 32, 5);
    ctx.fill();
    ctx.strokeStyle = '#88cf92';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pr.kind === 'scrap_car' || pr.kind === 'roadside_wreck') {
    ctx.fillStyle = flash ? '#fff' : '#6b5344';
    rrect(ctx, -32, -18, 64, 36, 7);
    ctx.fill();
    ctx.strokeStyle = '#241a15';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#222b33';
    rrect(ctx, -12, -13, 26, 26, 3);
    ctx.fill();
  } else if (pr.kind === 'predecessor_loco') {
    // Derailed twin black-iron steam locomotive lying tilted beside the tracks!
    ctx.save();
    ctx.rotate(-0.22);
    ctx.fillStyle = '#36302b';
    rrect(ctx, -78, -38, 156, 76, 6);
    ctx.fill();
    ctx.strokeStyle = '#8a6838';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#1f2326';
    rrect(ctx, -28, -22, 60, 44, 10);
    ctx.fill();
    // Faint cold ember in dead firebox
    ctx.fillStyle = 'rgba(124, 196, 255, 0.38)';
    ctx.beginPath();
    ctx.arc(-6, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (pr.kind === 'arcane_crystal' || pr.kind === 'fuel_barrel') {
    const pulse = 1 + Math.sin(t * 4.5) * 0.1;
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 28 * pulse);
    halo.addColorStop(0, 'rgba(124, 196, 255, 0.65)');
    halo.addColorStop(1, 'rgba(40, 100, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 28 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#5fa8e6';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(13, -2);
    ctx.lineTo(7, 18);
    ctx.lineTo(-9, 16);
    ctx.lineTo(-13, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d0ebff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (pr.kind === 'ancient_vault') {
    ctx.fillStyle = flash ? '#fff' : '#3a4654';
    rrect(ctx, -22, -17, 44, 34, 5);
    ctx.fill();
    ctx.strokeStyle = '#d9b15f';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (pr.kind === 'oracle_altar') {
    ctx.fillStyle = '#47433e';
    rrect(ctx, -20, -16, 40, 32, 4);
    ctx.fill();
    ctx.strokeStyle = '#7cc4ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    g.addColorStop(0, 'rgba(124, 196, 255, 0.7)');
    g.addColorStop(1, 'rgba(124, 196, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
  } else if (pr.kind === 'special_diary') {
    ctx.fillStyle = '#d9ccb2';
    rrect(ctx, -11, -14, 22, 28, 3);
    ctx.fill();
    ctx.strokeStyle = '#5c462b';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pr.kind === 'nameless_graves') {
    ctx.fillStyle = '#595550';
    for (const gx of [-22, 0, 22]) {
      rrect(ctx, gx - 7, -14, 14, 24, 4);
      ctx.fill();
    }
  } else if (pr.kind === 'flatbed_siding') {
    ctx.fillStyle = '#334652';
    rrect(ctx, -48, -28, 96, 56, 5);
    ctx.fill();
    ctx.strokeStyle = '#6ec4d4';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else if (pr.kind === 'water_tower') {
    ctx.fillStyle = '#2c648a';
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9ac8e6';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  } else if (pr.kind === 'loco_crane') {
    ctx.fillStyle = '#7d591d';
    rrect(ctx, -30, -22, 60, 44, 5);
    ctx.fill();
    ctx.strokeStyle = '#d9b15f';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else if (pr.kind === 'npc_keeper' || pr.kind === 'npc_elder' || pr.kind === 'roadside_waver') {
    // Rational mutant silhouettes (P2/P3)
    ctx.fillStyle = pr.kind === 'npc_elder' ? '#4f5d66' : pr.kind === 'roadside_waver' ? '#6b5c49' : '#966122';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e5dcc8';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#b8c4b0';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!pr.interactOnly && pr.hp < pr.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    rrect(ctx, -18, pr.r + 5, 36, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#d9b15f';
    rrect(ctx, -17, pr.r + 6, 34 * Math.max(0, pr.hp / pr.maxHp), 2, 1);
    ctx.fill();
  }

  // Subtle understated label (only when player is reasonably close!)
  if (Math.hypot(pr.x - w.player.x, pr.y - w.player.y) < 260) {
    ctx.fillStyle = 'rgba(235, 226, 210, 0.72)';
    ctx.font = uiFont(10, 500);
    ctx.textAlign = 'center';
    ctx.fillText(pr.label, 0, -pr.r - 8);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

export { getZoneTierRoman };

/** A hand lantern set down on the deck or the ground: brass cage, warm flame, soft halo. */
export function drawPlacedLantern(ctx: CanvasRenderingContext2D, w: WorldState): void {
  const lp = w.lanternPos;
  if (w.lanternHolder !== 'placed' || !lp) return;
  const t = w.time;
  ctx.save();
  ctx.translate(lp.x, lp.y);
  const pulse = 1 + Math.sin(t * 7.3) * 0.06;
  const halo = ctx.createRadialGradient(0, -4, 2, 0, -4, 30 * pulse);
  halo.addColorStop(0, 'rgba(255, 236, 170, 0.75)');
  halo.addColorStop(0.45, 'rgba(255, 190, 80, 0.28)');
  halo.addColorStop(1, 'rgba(255, 160, 40, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, -4, 30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // cage
  ctx.fillStyle = '#2a211a';
  ctx.fillRect(-6, -11, 12, 16);
  ctx.fillStyle = `rgba(255, 226, 140, ${0.85 + Math.sin(t * 11) * 0.1})`;
  ctx.fillRect(-4, -9, 8, 12);
  ctx.strokeStyle = '#b8873e';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-6, -11, 12, 16);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(0, 5);
  ctx.stroke();
  ctx.fillStyle = '#b8873e';
  ctx.fillRect(-7, -13, 14, 2.5);
  ctx.fillRect(-7, 4.5, 14, 2.5);
  ctx.beginPath();
  ctx.arc(0, -15, 3.5, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}
