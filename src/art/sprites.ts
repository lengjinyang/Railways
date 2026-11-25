import {
  GEAR_LABELS,
  HALF_H,
  LANTERN_HOOK_X,
  LANTERN_HOOK_Y,
  LOCO_H,
  LOCO_W,
  TILE,
  getZoneTierRoman,
  playerHasActiveLantern,
  type MonsterEntity,
  type PlacedBuilding,
  type WorldProp,
  type WorldState,
} from '../world';

/** Crisp rounded-rect path helper */
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

/** Soft contact drop shadow under top-down objects */
function contactShadow(ctx: CanvasRenderingContext2D, rx: number, ry: number, ox = 3, oy = 5, alpha = 0.42): void {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Hand-painted top-down Locomotive interior + machinery */
export function drawLocomotiveArt(
  ctx: CanvasRenderingContext2D,
  w: WorldState,
  locoDeckCanvas: HTMLCanvasElement
): void {
  const t = w.time;

  // Ground ambient occlusion shadow under locomotive
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  rrect(ctx, -6, -HALF_H + 8, LOCO_W + 28, LOCO_H + 6, 10);
  ctx.fill();
  ctx.restore();

  // Steel wheels & connecting rods peeking out along the rails
  const rodOff = Math.sin(w.worldScrollX * 0.08) * 5;
  ctx.fillStyle = '#25292e';
  for (const wx of [30, 88, 146]) {
    ctx.fillRect(wx - 11, -HALF_H - 5, 22, 6);
    ctx.fillRect(wx - 11, HALF_H - 1, 22, 6);
  }
  ctx.fillStyle = '#8b95a0';
  ctx.fillRect(24 + rodOff, -HALF_H - 4, 124, 3);
  ctx.fillRect(24 + rodOff, HALF_H + 1, 124, 3);

  // Heavy riveted steel frame
  const hullGrad = ctx.createLinearGradient(0, -HALF_H, 0, HALF_H);
  hullGrad.addColorStop(0, w.locoLevel === 2 ? '#5d4a3a' : '#4a3e35');
  hullGrad.addColorStop(0.5, w.locoLevel === 2 ? '#4a3b2e' : '#3a312a');
  hullGrad.addColorStop(1, '#2a231e');
  ctx.fillStyle = hullGrad;
  rrect(ctx, 0, -HALF_H, LOCO_W, LOCO_H, 4);
  ctx.fill();

  // Cab weathered oak floorboards inset (stamped with drawImage — zero tile swimming!)
  ctx.save();
  rrect(ctx, 6, -HALF_H + 6, LOCO_W - 12, LOCO_H - 12, 3);
  ctx.clip();
  ctx.drawImage(locoDeckCanvas, 6, -HALF_H + 6);
  // Subtle grime & oil stains near boiler
  const oil = ctx.createRadialGradient(54, -26, 6, 54, -26, 68);
  oil.addColorStop(0, 'rgba(12, 9, 7, 0.55)');
  oil.addColorStop(1, 'rgba(12, 9, 7, 0)');
  ctx.fillStyle = oil;
  ctx.fillRect(0, -HALF_H, LOCO_W, LOCO_H);
  ctx.restore();

  // Inner cab steel trim frame + corner rivets
  ctx.strokeStyle = w.locoLevel === 2 ? '#c9933c' : '#5e5248';
  ctx.lineWidth = 2.5;
  rrect(ctx, 5, -HALF_H + 5, LOCO_W - 10, LOCO_H - 10, 3);
  ctx.stroke();

  // --- Cast-Iron Steam Boiler Drum (center x=54, y=-28) ---
  ctx.save();
  ctx.translate(54, -28);
  // Boiler drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rrect(ctx, -30, -24, 64, 54, 12);
  ctx.fill();

  // Cylindrical shaded cast-iron barrel
  const bGrad = ctx.createLinearGradient(0, -26, 0, 26);
  bGrad.addColorStop(0, '#5a626b');
  bGrad.addColorStop(0.28, '#383e45');
  bGrad.addColorStop(0.7, '#22262b');
  bGrad.addColorStop(1, '#14171a');
  ctx.fillStyle = bGrad;
  rrect(ctx, -31, -26, 62, 52, 12);
  ctx.fill();
  ctx.strokeStyle = '#101214';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brass boiler straps & pressure rivets
  const strapGrad = ctx.createLinearGradient(0, -26, 0, 26);
  strapGrad.addColorStop(0, '#f2c166');
  strapGrad.addColorStop(0.45, '#c9882f');
  strapGrad.addColorStop(1, '#6e4512');
  ctx.fillStyle = strapGrad;
  for (const sx of [-19, 0, 19]) {
    ctx.fillRect(sx - 2.5, -26, 5, 52);
  }

  // Smokestack crown (offset right on boiler)
  ctx.fillStyle = '#181a1d';
  ctx.beginPath();
  ctx.arc(16, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d9963b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#090a0b';
  ctx.beginPath();
  ctx.arc(16, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  // Firebox: magic-crystal core grate (bottom edge facing cab)
  const lit = w.boilerFuel > 0;
  const flicker = lit ? 0.8 + Math.sin(t * 11) * 0.18 : 0.2;
  ctx.fillStyle = '#1a1420';
  rrect(ctx, -16, 15, 32, 14, 4);
  ctx.fill();
  if (lit) {
    const fg = ctx.createRadialGradient(0, 22, 2, 0, 22, 22);
    fg.addColorStop(0, `rgba(255, 236, 255, ${flicker})`);
    fg.addColorStop(0.45, `rgba(196, 92, 255, ${flicker * 0.92})`);
    fg.addColorStop(1, 'rgba(88, 28, 160, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 22, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d0a2ff';
    rrect(ctx, -12, 18, 24, 8, 2);
    ctx.fill();
    // Tiny crystal shard sitting in the grate
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(4, 21);
    ctx.lineTo(0, 26);
    ctx.lineTo(-4, 21);
    ctx.closePath();
    ctx.fill();
  }
  // Grate iron bars
  ctx.strokeStyle = '#1c1816';
  ctx.lineWidth = 1.8;
  for (let gx = -9; gx <= 9; gx += 4.5) {
    ctx.beginPath();
    ctx.moveTo(gx, 17);
    ctx.lineTo(gx, 27);
    ctx.stroke();
  }

  // Brass plaque showing magic-core charge
  ctx.fillStyle = 'rgba(18, 12, 24, 0.82)';
  rrect(ctx, -28, -42, 56, 15, 4);
  ctx.fill();
  ctx.fillStyle = lit ? '#e7d4ff' : '#ff8787';
  ctx.font = 'bold 10px "Inter", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`🔮 ${w.boilerFuel.toFixed(1)}`, 0, -31);
  ctx.restore();

  // --- Ornate Brass Throttle Console (x=136, y=0) ---
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
  ctx.strokeStyle = '#d9933c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pressure Gauge Dial
  ctx.fillStyle = '#f2e5cb';
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

  // Throttle Track Slot & Lever Handle
  ctx.fillStyle = '#0e1012';
  rrect(ctx, -4, -3, 8, 28, 3);
  ctx.fill();
  const leverY = 21 - w.gear * 7.5;
  ctx.fillStyle = w.gear === 3 ? '#ff5252' : w.gear > 0 ? '#59c973' : '#adb5bd';
  rrect(ctx, -12, leverY - 3.5, 24, 7, 3);
  ctx.fill();
  ctx.strokeStyle = '#141210';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffe8b6';
  ctx.font = 'bold 10px "Inter", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(GEAR_LABELS[w.gear], 0, -35);
  ctx.restore();

  // --- Hanging Brass Lantern Hook ---
  ctx.save();
  ctx.translate(LANTERN_HOOK_X, LANTERN_HOOK_Y);
  ctx.fillStyle = '#241e19';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a8844c';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (w.lanternHolder === 'train') {
    const pulse = 1 + Math.sin(t * 6) * 0.1;
    const lg = ctx.createRadialGradient(0, 0, 2, 0, 0, 24 * pulse);
    lg.addColorStop(0, 'rgba(255, 240, 175, 0.95)');
    lg.addColorStop(0.4, 'rgba(255, 196, 80, 0.45)');
    lg.addColorStop(1, 'rgba(255, 160, 40, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe89c';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a4f16';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();

  // --- Front Cowcatcher / Armored Ram Bumper ---
  ctx.save();
  ctx.translate(LOCO_W, 0);
  if (w.hasBumper) {
    // Heavy spiked brass-armored ram plow
    const ramG = ctx.createLinearGradient(0, -60, 42, 60);
    ramG.addColorStop(0, '#f2b84b');
    ramG.addColorStop(0.5, '#c47b24');
    ramG.addColorStop(1, '#7a4510');
    ctx.fillStyle = ramG;
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.lineTo(42, 0);
    ctx.lineTo(0, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffe59c';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Steel ribs
    ctx.strokeStyle = '#2d1c0a';
    ctx.lineWidth = 2.5;
    for (const ry of [-36, -18, 0, 18, 36]) {
      ctx.beginPath();
      ctx.moveTo(2, ry);
      ctx.lineTo(38 - Math.abs(ry) * 0.65, ry * 0.28);
      ctx.stroke();
    }
  } else {
    // Standard iron cowcatcher grille
    const cowG = ctx.createLinearGradient(0, -50, 26, 50);
    cowG.addColorStop(0, '#6c737c');
    cowG.addColorStop(1, '#32363b');
    ctx.fillStyle = cowG;
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(25, 0);
    ctx.lineTo(0, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#222528';
    ctx.lineWidth = 2;
    for (const ry of [-28, -14, 0, 14, 28]) {
      ctx.beginPath();
      ctx.moveTo(2, ry);
      ctx.lineTo(22 - Math.abs(ry) * 0.42, ry * 0.25);
      ctx.stroke();
    }
  }
  // Forward Headlight Housing
  ctx.fillStyle = '#b87d2e';
  rrect(ctx, -4, -9, 11, 18, 3);
  ctx.fill();
  ctx.fillStyle = w.boilerFuel > 0 ? '#f3e8ff' : '#4a453f';
  ctx.fillRect(6, -6, 3, 12);
  ctx.restore();

  // Subtle Locomotive Hull Integrity Bar
  const hpPct = Math.max(0, w.locoHp / w.locoMaxHp);
  if (hpPct < 0.995) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    rrect(ctx, 14, HALF_H - 18, LOCO_W - 28, 7, 3);
    ctx.fill();
    ctx.fillStyle = hpPct > 0.4 ? '#59c973' : '#ff5252';
    rrect(ctx, 15, HALF_H - 17, (LOCO_W - 30) * hpPct, 5, 2);
    ctx.fill();
  }
  ctx.textAlign = 'left';
}

/** Hand-painted top-down sprites for all 12 placeable train buildings */
export function drawBuildingArt(ctx: CanvasRenderingContext2D, w: WorldState, b: PlacedBuilding): void {
  const hs = TILE / 2 - 2;
  const flash = (b.hitFlash ?? 0) > 0;
  const t = w.time;

  // Soft contact shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  rrect(ctx, -hs + 2, -hs + 4, hs * 2, hs * 2, 5);
  ctx.fill();

  if (b.type === 'wood_wall') {
    const g = ctx.createLinearGradient(-hs, -hs, hs, hs);
    g.addColorStop(0, flash ? '#fff' : '#a87747');
    g.addColorStop(1, flash ? '#fff' : '#6c4827');
    ctx.fillStyle = g;
    rrect(ctx, -hs, -hs, hs * 2, hs * 2, 4);
    ctx.fill();
    ctx.strokeStyle = '#2d1c0e';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Timber planks & diagonal cross brace
    ctx.strokeStyle = 'rgba(30,18,8,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-hs, -6);
    ctx.lineTo(hs, -6);
    ctx.moveTo(-hs, 6);
    ctx.lineTo(hs, 6);
    ctx.moveTo(-hs + 4, -hs + 4);
    ctx.lineTo(hs - 4, hs - 4);
    ctx.stroke();
  } else if (b.type === 'iron_wall') {
    const g = ctx.createLinearGradient(-hs, -hs, hs, hs);
    g.addColorStop(0, flash ? '#fff' : '#8d9aa6');
    g.addColorStop(0.5, flash ? '#fff' : '#616d78');
    g.addColorStop(1, flash ? '#fff' : '#3d454d');
    ctx.fillStyle = g;
    rrect(ctx, -hs, -hs, hs * 2, hs * 2, 4);
    ctx.fill();
    ctx.strokeStyle = '#1c2126';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner chamfer & corner rivets
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    rrect(ctx, -hs + 4, -hs + 4, hs * 2 - 8, hs * 2 - 8, 2);
    ctx.stroke();
    ctx.fillStyle = '#22282e';
    for (const [rx, ry] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.type === 'door') {
    // Threshold rail
    ctx.fillStyle = '#33383e';
    ctx.fillRect(-hs, -4, hs * 2, 8);
    if (b.doorOpen) {
      ctx.fillStyle = '#c9933c';
      rrect(ctx, -hs, -hs + 1, 7, hs * 2 - 2, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(105, 219, 124, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(-hs + 10, 0);
      ctx.lineTo(hs - 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const dg = ctx.createLinearGradient(0, -8, 0, 8);
      dg.addColorStop(0, flash ? '#fff' : '#dfa145');
      dg.addColorStop(1, flash ? '#fff' : '#8c5c1f');
      ctx.fillStyle = dg;
      rrect(ctx, -hs, -7, hs * 2, 14, 3);
      ctx.fill();
      ctx.strokeStyle = '#2b1d0c';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Handle bar
      ctx.fillStyle = '#261b0e';
      ctx.fillRect(-7, -2, 14, 4);
    }
  } else if (b.type === 'workbench') {
    // Heavy oak engineer table
    const g = ctx.createLinearGradient(-hs, -hs, hs, hs);
    g.addColorStop(0, flash ? '#fff' : '#a87640');
    g.addColorStop(1, flash ? '#fff' : '#6c4923');
    ctx.fillStyle = g;
    rrect(ctx, -hs + 1, -hs + 2, hs * 2 - 2, hs * 2 - 4, 4);
    ctx.fill();
    ctx.strokeStyle = '#2b1b0c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Unrolled Cyan Blueprint Scroll
    ctx.fillStyle = '#2b6cb0';
    rrect(ctx, -14, -11, 17, 20, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 230, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-11, -7, 11, 12);
    // Brass Vise & Gears
    ctx.fillStyle = '#d99b3c';
    rrect(ctx, 5, -12, 10, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#33220c';
    ctx.stroke();
    ctx.fillStyle = '#ced4da';
    ctx.beginPath();
    ctx.arc(10, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#343a40';
    ctx.beginPath();
    ctx.arc(10, 8, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === 'chest') {
    // Iron-bound oak footlocker
    const g = ctx.createLinearGradient(-hs, -hs, hs, hs);
    g.addColorStop(0, flash ? '#fff' : '#9c6836');
    g.addColorStop(1, flash ? '#fff' : '#5e3b1b');
    ctx.fillStyle = g;
    rrect(ctx, -hs + 2, -hs + 4, hs * 2 - 4, hs * 2 - 8, 4);
    ctx.fill();
    ctx.strokeStyle = '#24170b';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Twin steel bands
    ctx.fillStyle = '#3c434a';
    ctx.fillRect(-11, -hs + 4, 5, hs * 2 - 8);
    ctx.fillRect(6, -hs + 4, 5, hs * 2 - 8);
    // Brass clasp lock
    ctx.fillStyle = '#ffd56b';
    rrect(ctx, -4, 4, 8, 8, 2);
    ctx.fill();
    ctx.strokeStyle = '#4d3510';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (b.type === 'campfire') {
    // Cast-iron Smelter Forge
    const ironG = ctx.createRadialGradient(-4, -4, 3, 0, 0, 18);
    ironG.addColorStop(0, flash ? '#fff' : '#545b63');
    ironG.addColorStop(1, flash ? '#fff' : '#23272b');
    ctx.fillStyle = ironG;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#121417';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing molten coal core
    const pulse = 1 + Math.sin(t * 13 + b.col) * 0.16;
    const fg = ctx.createRadialGradient(0, 0, 1, 0, 0, 13 * pulse);
    fg.addColorStop(0, '#fff4b8');
    fg.addColorStop(0.45, '#ff8529');
    fg.addColorStop(1, 'rgba(190, 40, 10, 0.2)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, 12 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Iron flue chimney nub
    ctx.fillStyle = '#1b1e21';
    ctx.beginPath();
    ctx.arc(-8, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6c757d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if ((b.smeltQueue ?? 0) > 0) {
      const pct = Math.min(1, (b.smeltProgress ?? 0) / 100);
      ctx.strokeStyle = '#ffae42';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else if (b.type === 'lantern') {
    const pulse = 1 + Math.sin(t * 5.5 + b.col) * 0.08;
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 22 * pulse);
    halo.addColorStop(0, 'rgba(255, 240, 175, 0.9)');
    halo.addColorStop(0.5, 'rgba(255, 195, 75, 0.32)');
    halo.addColorStop(1, 'rgba(255, 165, 40, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#32363b';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe694';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b57c28';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (b.type === 'planter') {
    // Timber garden frame
    ctx.fillStyle = '#734f2c';
    rrect(ctx, -hs, -hs, hs * 2, hs * 2, 4);
    ctx.fill();
    ctx.strokeStyle = (b.watered ?? 0) > 0 ? '#4dabf7' : '#3a2614';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Soil bed with furrows
    ctx.fillStyle = (b.watered ?? 0) > 0 ? '#2b1e14' : '#4a3726';
    rrect(ctx, -hs + 4, -hs + 4, hs * 2 - 8, hs * 2 - 8, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    for (const fy of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.moveTo(-hs + 6, fy);
      ctx.lineTo(hs - 6, fy);
      ctx.stroke();
    }
    if (b.planted) {
      const pct = Math.min(1, (b.growth ?? 0) / 100);
      const sway = Math.sin(t * 3.5 + b.col * 2) * (1.5 + pct * 2);
      const ripe = pct >= 1;
      for (const [cx, cy] of [[-7, -7], [7, -6], [-6, 7], [7, 7], [0, 0]]) {
        const r = 3.2 + pct * 4.5;
        ctx.fillStyle = ripe ? '#f5b82e' : '#3b9e4b';
        ctx.beginPath();
        ctx.arc(cx + sway * 0.5, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ripe ? '#ffe88a' : '#7ae582';
        ctx.beginPath();
        ctx.arc(cx + sway * 0.7 - 1, cy - 1, r * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (b.type === 'rain_collector') {
    // Iron-banded wooden catch cistern
    ctx.fillStyle = '#384e5e';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c96a8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const fill = Math.min(1, (b.storedWater ?? 0) / 6);
    const wg = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14);
    wg.addColorStop(0, fill > 0.05 ? '#74c0fc' : '#1f2b33');
    wg.addColorStop(1, fill > 0.05 ? '#1c6ea4' : '#141c22');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.fill();
    if (fill > 0.05) {
      // Shimmering water ripple
      const rip = ((t * 0.8 + b.col * 0.3) % 1) * 11;
      ctx.strokeStyle = `rgba(215, 240, 255, ${(1 - rip / 11) * 0.65})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, rip, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e7f5ff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(b.storedWater ?? 0)}`, 0, 4);
      ctx.textAlign = 'left';
    }
  } else if (b.type === 'bed') {
    // Timber cot frame
    ctx.fillStyle = '#6e4a29';
    rrect(ctx, -hs + 1, -hs + 3, hs * 2 - 2, hs * 2 - 6, 4);
    ctx.fill();
    ctx.strokeStyle = '#291a0d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Stitched cream pillow
    ctx.fillStyle = '#ede4d3';
    rrect(ctx, -hs + 4, -hs + 6, 11, hs * 2 - 12, 3);
    ctx.fill();
    // Quilted wool teal blanket
    const bg = ctx.createLinearGradient(-4, -hs + 6, hs - 3, hs - 6);
    bg.addColorStop(0, '#4a9194');
    bg.addColorStop(1, '#2d6163');
    ctx.fillStyle = bg;
    rrect(ctx, -4, -hs + 6, hs + 1, hs * 2 - 12, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -hs + 8);
    ctx.lineTo(0, hs - 8);
    ctx.stroke();
  } else if (b.type === 'turret') {
    // Octagonal bolted steel turret pedestal
    ctx.fillStyle = '#3b2e2e';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#994747';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(b.turretAngle ?? 0);
    // Twin gun barrels
    ctx.fillStyle = '#ced4da';
    ctx.fillRect(6, -5.5, 20, 3.5);
    ctx.fillRect(6, 2, 20, 3.5);
    ctx.fillStyle = '#2b3036';
    ctx.fillRect(22, -6, 4, 4.5);
    ctx.fillRect(22, 1.5, 4, 4.5);
    // Armored turret head + brass ammo drum
    const hg = ctx.createLinearGradient(-10, -10, 10, 10);
    hg.addColorStop(0, flash ? '#fff' : '#d65252');
    hg.addColorStop(1, flash ? '#fff' : '#7a2323');
    ctx.fillStyle = hg;
    rrect(ctx, -11, -10, 20, 20, 5);
    ctx.fill();
    ctx.strokeStyle = '#1f1414';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#d9933c';
    ctx.beginPath();
    ctx.arc(-5, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Burning fire overlay
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

  // Damage bar
  if (b.hp < b.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    rrect(ctx, -16, hs - 4, 32, 5, 2);
    ctx.fill();
    ctx.fillStyle = b.hp / b.maxHp > 0.35 ? '#59c973' : '#ff5252';
    rrect(ctx, -15, hs - 3, 30 * Math.max(0, b.hp / b.maxHp), 3, 1.5);
    ctx.fill();
  }
}

/** Articulated painterly top-down Survivor Player */
export function drawPlayerArt(ctx: CanvasRenderingContext2D, w: WorldState): void {
  const p = w.player;
  const t = w.time;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnTimer > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.55;

  contactShadow(ctx, 14, 10, 2, 5, 0.45);

  // Painterly crescent melee slash arc
  if (p.swingTimer > 0) {
    const prog = 1 - p.swingTimer / 0.2;
    ctx.save();
    ctx.rotate(p.swingAngle);
    const arcAlpha = (1 - prog) * 0.9;
    const startA = -1.05 + prog * 0.35;
    const endA = -1.05 + prog * 2.15;
    ctx.strokeStyle = p.toolLevel === 3 ? `rgba(255, 195, 75, ${arcAlpha})` : `rgba(255, 244, 200, ${arcAlpha})`;
    ctx.lineWidth = 10 * (1 - prog * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 34, startA, endA);
    ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(p.angle);

  // Expedition Leather Backpack + Rolled Bedroll
  ctx.fillStyle = '#5c3c22';
  rrect(ctx, -17, -10, 10, 20, 4);
  ctx.fill();
  ctx.strokeStyle = '#24160b';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#8b6844';
  rrect(ctx, -18, -7, 4, 14, 2);
  ctx.fill();

  // Left hand: Carried Brass Lantern (when picked up)
  if (w.lanternHolder === 'player') {
    const lit = playerHasActiveLantern(w);
    ctx.fillStyle = '#3b2c20';
    ctx.beginPath();
    ctx.arc(10, -11, 3.8, 0, Math.PI * 2);
    ctx.fill();
    if (lit) {
      const g = ctx.createRadialGradient(14, -12, 1, 14, -12, 16);
      g.addColorStop(0, 'rgba(255, 245, 190, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 195, 75, 0.4)');
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
    ctx.strokeStyle = '#9c6a22';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Right hand: Equipped Tool / Weapon
  const showBuild = w.buildMode || w.hotbar === 5;
  ctx.save();
  ctx.translate(8, 10);
  if (p.swingTimer > 0) {
    ctx.rotate(-0.8 + (1 - p.swingTimer / 0.2) * 1.9);
  }
  if (showBuild) {
    // Brass Engineer Hammer
    ctx.fillStyle = '#6c4926';
    ctx.fillRect(0, -1.8, 18, 3.6);
    ctx.fillStyle = '#e6ad47';
    rrect(ctx, 14, -6.5, 6, 13, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#3a250a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (w.hotbar === 1) {
    // Twin-barrel Shotgun
    ctx.fillStyle = '#6c4826';
    ctx.fillRect(-3, -2.5, 11, 5);
    ctx.fillStyle = '#495057';
    ctx.fillRect(7, -3.5, 18, 3);
    ctx.fillRect(7, 0.5, 18, 3);
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(22, -3.5, 3, 7);
  } else if (w.hotbar === 0) {
    if (p.toolLevel === 1) {
      // Forged Rusted Crowbar
      ctx.strokeStyle = '#d96846';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(19, 0);
      ctx.lineTo(22, -5);
      ctx.stroke();
    } else if (p.toolLevel === 2) {
      // Heavy Steel Pickaxe
      ctx.fillStyle = '#6c4926';
      ctx.fillRect(0, -1.8, 20, 3.6);
      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(15, 0, 10, -1.1, 1.1);
      ctx.stroke();
    } else {
      // Lv.3 Steam Buzzsaw with spinning toothed blade!
      ctx.fillStyle = '#d9933c';
      rrect(ctx, 0, -4, 15, 8, 2);
      ctx.fill();
      ctx.save();
      ctx.translate(20, 0);
      ctx.rotate(t * 20);
      ctx.fillStyle = '#dee2e6';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2.5, 2.5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  ctx.restore();

  // Trenchcoat Shoulders (layered painterly ellipse)
  const coatCol =
    p.hitFlash > 0
      ? '#ff6b6b'
      : p.bodyTemp < 25
        ? '#74c0fc'
        : p.wellFedTimer > 0
          ? '#4b8ec9'
          : '#336b8e';
  const coatDark = p.hitFlash > 0 ? '#b82525' : '#1b3b52';
  const sg = ctx.createLinearGradient(-10, -14, 10, 14);
  sg.addColorStop(0, coatCol);
  sg.addColorStop(1, coatDark);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 11, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#121c24';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hooded Head + Goggle/Visor highlight
  ctx.fillStyle = '#254c66';
  ctx.beginPath();
  ctx.arc(1, 0, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2e8d5';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Warm scarf / visor facing +X
  ctx.fillStyle = '#e7a043';
  rrect(ctx, 5, -5.5, 4.5, 11, 2);
  ctx.fill();

  ctx.restore();
}

/** Gardener Companion NPC */
export function drawCompanionArt(ctx: CanvasRenderingContext2D, w: WorldState): void {
  const c = w.companion;
  if (!c) return;
  ctx.save();
  ctx.translate(c.x, c.y);
  contactShadow(ctx, 13, 9, 2, 5, 0.38);

  // Green linen tunic shoulders
  ctx.fillStyle = '#3b8c4e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#152e1b';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Woven Straw Hat
  const hg = ctx.createRadialGradient(-2, -2, 2, 0, 0, 12);
  hg.addColorStop(0, '#f0ce7d');
  hg.addColorStop(1, '#a88132');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c4113';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = '#2f6b3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(14, 12, 10, 0.82)';
  const txt = `园丁·${c.status}`;
  ctx.font = 'bold 11px "Inter", "PingFang SC", sans-serif';
  const tw = ctx.measureText(txt).width + 12;
  rrect(ctx, -tw / 2, -29, tw, 17, 5);
  ctx.fill();
  ctx.fillStyle = '#b2f2bb';
  ctx.textAlign = 'center';
  ctx.fillText(txt, 0, -17);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** Hand-crafted painterly sprites for all 7 Monster Archetypes */
export function drawMonsterArt(ctx: CanvasRenderingContext2D, w: WorldState, m: MonsterEntity): void {
  const t = w.time;
  const ang = Math.atan2(w.player.y - m.y, w.player.x - m.x);
  const flash = m.hitFlash > 0;
  const stride = Math.sin(t * 11 + m.x * 0.08) * 3;
  const r = m.r;

  ctx.save();
  ctx.translate(m.x, m.y);
  contactShadow(ctx, r * 0.95, r * 0.72, 2, 5, 0.45);

  ctx.save();
  ctx.rotate(ang);

  if (m.kind === 'bandit') {
    // Tattered hooded marauder with cleaver
    ctx.fillStyle = flash ? '#fff' : '#6e2626';
    ctx.beginPath();
    ctx.ellipse(-1, 0, r * 0.78, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f0d0d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Jagged Cleaver
    ctx.fillStyle = '#ced4da';
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.lineTo(22, 6);
    ctx.lineTo(24, 13);
    ctx.lineTo(8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hood & brass shoulder pad
    ctx.fillStyle = flash ? '#fff' : '#8f332c';
    ctx.beginPath();
    ctx.arc(1, 0, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d98a36';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (m.kind === 'arcane_wraith') {
    // Floating translucent specter with orbiting rune ring
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, r + 14);
    halo.addColorStop(0, 'rgba(199, 125, 255, 0.42)');
    halo.addColorStop(1, 'rgba(120, 40, 210, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting arcane circle
    ctx.save();
    ctx.rotate(t * 2.5);
    ctx.strokeStyle = 'rgba(224, 170, 255, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Flowing robe tail
    ctx.fillStyle = flash ? '#fff' : '#7b2cbf';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.quadraticCurveTo(0, -r, -r * 1.25, -r * 0.45 + stride * 0.5);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(-r * 1.25, r * 0.45 - stride * 0.5);
    ctx.quadraticCurveTo(0, r, r, 0);
    ctx.fill();
    ctx.strokeStyle = '#e0aaff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (m.kind === 'ruin_golem') {
    // Broad stone & brass automaton
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, flash ? '#fff' : '#768899');
    g.addColorStop(1, flash ? '#fff' : '#3d4954');
    ctx.fillStyle = g;
    rrect(ctx, -r * 0.95, -r * 1.05, r * 1.9, r * 2.1, 6);
    ctx.fill();
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // Glowing cyan ancient core
    ctx.fillStyle = '#74c0fc';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e7f5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (m.kind === 'elite') {
    // Horned alpha juggernaut
    ctx.fillStyle = flash ? '#fff' : '#b8143d';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#29050f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Curved heavy horns
    ctx.strokeStyle = '#f2e5cb';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -r * 0.65);
    ctx.quadraticCurveTo(r * 1.15, -r * 0.9, r * 1.25, -r * 0.25);
    ctx.moveTo(4, r * 0.65);
    ctx.quadraticCurveTo(r * 1.15, r * 0.9, r * 1.25, r * 0.25);
    ctx.stroke();
    // Glowing fissure lines
    ctx.strokeStyle = '#ff922b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, 0);
    ctx.lineTo(r * 0.4, 0);
    ctx.stroke();
  } else if (m.kind === 'clinger') {
    // Six-legged amber scrap-crawler
    ctx.strokeStyle = '#472a0b';
    ctx.lineWidth = 2.5;
    for (const lx of [-5, 1, 7]) {
      ctx.beginPath();
      ctx.moveTo(lx, -r * 0.6);
      ctx.lineTo(lx + stride * 0.5, -r * 1.35);
      ctx.moveTo(lx, r * 0.6);
      ctx.lineTo(lx - stride * 0.5, r * 1.35);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#fff' : '#d98a1c';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b1a07';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (m.kind === 'burrower') {
    // Segmented armored subterranean worm/beetle
    ctx.fillStyle = flash ? '#fff' : '#8f2ea8';
    for (const [sx, sr] of [[-10, r * 0.65], [-3, r * 0.85], [5, r * 0.85]]) {
      ctx.beginPath();
      ctx.arc(sx, Math.sin(t * 9 + sx) * 1.8, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#230b2b';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  } else {
    // Stalker: feral wasteland hound
    ctx.strokeStyle = '#381212';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, -r * 0.5);
    ctx.lineTo(8 + stride, -r * 1.1);
    ctx.moveTo(4, r * 0.5);
    ctx.lineTo(8 - stride, r * 1.1);
    ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : '#c93838';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#240b0b';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Dorsal bone ridge
    ctx.fillStyle = '#f2e8d5';
    for (const sx of [-7, -2, 3]) {
      ctx.beginPath();
      ctx.arc(sx, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Luminous Eyes facing +X
  ctx.fillStyle = m.kind === 'arcane_wraith' ? '#f3d9fa' : m.kind === 'ruin_golem' ? '#a5d8ff' : '#fff3b0';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.28, 2.3, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.28, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // HP Bar & Tier Tag
  if (m.hp < m.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    rrect(ctx, -17, -r - 12, 34, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#ff5252';
    rrect(ctx, -16, -r - 11, 32 * Math.max(0, m.hp / m.maxHp), 3, 1.5);
    ctx.fill();
  }

  const labels: Record<string, string> = {
    bandit: '强盗',
    arcane_wraith: '秘法怨灵',
    ruin_golem: '远古构装',
    elite: '精英',
  };
  const tag = labels[m.kind] ?? (m.tier >= 2 ? `荒原怪·${getZoneTierRoman(m.tier)}` : '');
  if (tag) {
    ctx.fillStyle = m.kind === 'arcane_wraith' ? '#e0aaff' : m.kind === 'ruin_golem' ? '#a5d8ff' : '#ffd8a8';
    ctx.font = 'bold 10px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.tier >= 2 && labels[m.kind] ? `${tag} ${getZoneTierRoman(m.tier)}` : tag, 0, -r - 16);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Hand-painted sprites for all 15 World Props */
export function drawPropArt(ctx: CanvasRenderingContext2D, w: WorldState, pr: WorldProp): void {
  const ox = pr.hitOffX ?? 0;
  const oy = pr.hitOffY ?? 0;
  const scale = (pr.hitBounce ?? 0) > 0 ? 1 + (pr.hitBounce ?? 0) * 0.65 : 1;
  const flash = pr.hitFlash > 0;
  const t = w.time;

  ctx.save();
  ctx.translate(pr.x + ox, pr.y + oy);
  ctx.scale(scale, 2 - scale);

  contactShadow(ctx, pr.r * 1.05, pr.r * 0.78, 3, 6, 0.42);

  if (pr.kind === 'wood_crate' || pr.kind === 'bandit_crate') {
    const isBandit = pr.kind === 'bandit_crate';
    const g = ctx.createLinearGradient(-18, -18, 18, 18);
    g.addColorStop(0, flash ? '#fff' : isBandit ? '#8c3b32' : '#a8723e');
    g.addColorStop(1, flash ? '#fff' : isBandit ? '#4f1e19' : '#613e1e');
    ctx.fillStyle = g;
    rrect(ctx, -18, -17, 36, 34, 4);
    ctx.fill();
    ctx.strokeStyle = isBandit ? '#ff8787' : '#301d0e';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Slatted plank diagonal brace
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -14);
    ctx.lineTo(15, 14);
    ctx.moveTo(15, -14);
    ctx.lineTo(-15, 14);
    ctx.stroke();
    ctx.strokeRect(-14, -13, 28, 26);
  } else if (pr.kind === 'dry_tree') {
    // Gnarled roots & twisted bare branches
    ctx.strokeStyle = '#3b2818';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(16, 10);
    ctx.moveTo(-10, 16);
    ctx.lineTo(14, -14);
    ctx.moveTo(0, -18);
    ctx.lineTo(-4, 14);
    ctx.stroke();
    ctx.strokeStyle = flash ? '#fff' : '#85603e';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : '#5e4026';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#291a0e';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (pr.kind === 'scrap_pile') {
    ctx.fillStyle = flash ? '#fff' : '#58616b';
    ctx.beginPath();
    ctx.arc(0, 0, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22262b';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Corrugated steel plate + rusted I-beam + gear
    ctx.save();
    ctx.rotate(0.4);
    ctx.fillStyle = '#8b95a0';
    rrect(ctx, -14, -9, 24, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#a35d3b';
    rrect(ctx, -8, 1, 20, 7, 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ced4da';
    ctx.beginPath();
    ctx.arc(-6, 5, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (pr.kind === 'crystal_cluster') {
    const pulse = 1 + Math.sin(t * 4.2) * 0.08;
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, pr.r * 1.7 * pulse);
    halo.addColorStop(0, 'rgba(230, 190, 255, 0.75)');
    halo.addColorStop(1, 'rgba(120, 40, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, pr.r * 1.7 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const drawShard = (sx: number, sy: number, h: number, lean: number, fill: string) => {
      ctx.fillStyle = flash ? '#fff' : fill;
      ctx.beginPath();
      ctx.moveTo(sx, sy - h);
      ctx.lineTo(sx + 6 + lean, sy + 2);
      ctx.lineTo(sx + 2, sy + h * 0.55);
      ctx.lineTo(sx - 6, sy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f8f0ff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    };
    drawShard(-7, 2, 14, -1, '#9d4edd');
    drawShard(6, 4, 11, 2, '#c77dff');
    drawShard(0, -1, 18, 0, '#e0aaff');
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(3, -6);
    ctx.lineTo(-1, -5);
    ctx.closePath();
    ctx.fill();
  } else if (pr.kind === 'parts_box') {
    const g = ctx.createLinearGradient(-18, -14, 18, 14);
    g.addColorStop(0, flash ? '#fff' : '#577c96');
    g.addColorStop(1, flash ? '#fff' : '#2f4759');
    ctx.fillStyle = g;
    rrect(ctx, -18, -14, 36, 28, 4);
    ctx.fill();
    ctx.strokeStyle = '#ffd56b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd56b';
    ctx.fillRect(-10, -3, 20, 6);
  } else if (pr.kind === 'seed_cache') {
    ctx.fillStyle = flash ? '#fff' : '#366e3b';
    rrect(ctx, -22, -18, 44, 36, 5);
    ctx.fill();
    ctx.strokeStyle = '#9ef0a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Sprout leaf emblem
    ctx.fillStyle = '#b2f2bb';
    ctx.beginPath();
    ctx.ellipse(-4, 0, 7, 4, -0.5, 0, Math.PI * 2);
    ctx.ellipse(5, 0, 7, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (pr.kind === 'scrap_car') {
    // Rusted abandoned sedan top-down
    ctx.fillStyle = '#1b1d20';
    for (const [wx, wy] of [[-22, -21], [18, -21], [-22, 17], [18, 17]]) {
      rrect(ctx, wx, wy, 12, 5, 2);
      ctx.fill();
    }
    const cg = ctx.createLinearGradient(-34, -19, 34, 19);
    cg.addColorStop(0, flash ? '#fff' : '#7a5d4c');
    cg.addColorStop(1, flash ? '#fff' : '#423229');
    ctx.fillStyle = cg;
    rrect(ctx, -34, -19, 68, 38, 8);
    ctx.fill();
    ctx.strokeStyle = '#241a15';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Shattered windshield & roof
    ctx.fillStyle = '#222b33';
    rrect(ctx, -14, -14, 30, 28, 4);
    ctx.fill();
    ctx.fillStyle = '#614a3d';
    rrect(ctx, -10, -12, 18, 24, 3);
    ctx.fill();
  } else if (pr.kind === 'arcane_crystal') {
    const pulse = 1 + Math.sin(t * 5) * 0.12;
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 32 * pulse);
    halo.addColorStop(0, 'rgba(210, 140, 255, 0.7)');
    halo.addColorStop(1, 'rgba(130, 40, 220, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 32 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#9d4edd';
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(15, -3);
    ctx.lineTo(8, 20);
    ctx.lineTo(-10, 18);
    ctx.lineTo(-15, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f3d9fa';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facet highlight
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(6, -2);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
  } else if (pr.kind === 'ancient_vault') {
    const vg = ctx.createLinearGradient(-24, -18, 24, 18);
    vg.addColorStop(0, flash ? '#fff' : '#4a5a6e');
    vg.addColorStop(1, flash ? '#fff' : '#252e38');
    ctx.fillStyle = vg;
    rrect(ctx, -24, -18, 48, 36, 5);
    ctx.fill();
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // Vault wheel
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.stroke();
  } else if (pr.kind === 'flatbed_siding') {
    ctx.fillStyle = '#334652';
    rrect(ctx, -48, -28, 96, 56, 5);
    ctx.fill();
    ctx.strokeStyle = '#66d9e8';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(102, 217, 232, 0.35)';
    ctx.lineWidth = 1.2;
    for (let x = -32; x <= 32; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, -26);
      ctx.lineTo(x, 26);
      ctx.stroke();
    }
  } else if (pr.kind === 'water_tower') {
    // Riveted elevated steel tank
    const wg = ctx.createRadialGradient(-10, -10, 4, 0, 0, 36);
    wg.addColorStop(0, '#4fa0d4');
    wg.addColorStop(0.65, '#255e85');
    wg.addColorStop(1, '#153852');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a5d8ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (pr.kind === 'loco_crane') {
    // Industrial Yellow Gantry Crane
    ctx.fillStyle = '#8c621b';
    rrect(ctx, -32, -24, 64, 48, 5);
    ctx.fill();
    ctx.strokeStyle = '#ffd56b';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = '#241a0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, -20);
    ctx.lineTo(28, 20);
    ctx.moveTo(28, -20);
    ctx.lineTo(-28, 20);
    ctx.stroke();
  } else if (pr.kind === 'npc_keeper' || pr.kind === 'npc_gardener') {
    const isGardener = pr.kind === 'npc_gardener';
    ctx.fillStyle = isGardener ? '#3b8c4e' : '#c97b18';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff5d6';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isGardener ? '#e6c373' : '#f2e8d5';
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Damage bar
  if (!pr.interactOnly && pr.hp < pr.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    rrect(ctx, -20, pr.r + 5, 40, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#f5d36c';
    rrect(ctx, -19, pr.r + 6, 38 * Math.max(0, pr.hp / pr.maxHp), 3, 1.5);
    ctx.fill();
  }

  // Crisp subtle nameplate
  if (pr.interactOnly) {
    ctx.font = 'bold 11px "Inter", "PingFang SC", sans-serif';
    const tw = ctx.measureText(pr.label).width + 14;
    ctx.fillStyle = 'rgba(14, 12, 10, 0.85)';
    ctx.strokeStyle = 'rgba(231, 160, 67, 0.55)';
    ctx.lineWidth = 1.2;
    rrect(ctx, -tw / 2, -pr.r - 24, tw, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe49e';
    ctx.textAlign = 'center';
    ctx.fillText(pr.label, 0, -pr.r - 11);
  } else {
    ctx.fillStyle = 'rgba(242, 234, 220, 0.76)';
    ctx.font = '10px "Inter", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pr.label, 0, -pr.r - 7);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
