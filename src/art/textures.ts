import { CAR_H, CAR_W, LOCO_H, LOCO_W, type ZoneKind } from '../world';

export interface ArtPatterns {
  ground: Record<ZoneKind | 'snow', HTMLCanvasElement>;
  ballast: HTMLCanvasElement;
  woodDeck: HTMLCanvasElement;
  flatbedDeck: HTMLCanvasElement;
  locoDeck: HTMLCanvasElement;
  asphalt: HTMLCanvasElement;
  platform: HTMLCanvasElement;
  masonry: HTMLCanvasElement;
}

let cachedPatterns: ArtPatterns | null = null;

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function bakeGroundTile(zone: ZoneKind | 'snow'): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = createCanvas(S, S);

  const themes: Record<
    ZoneKind | 'snow',
    { base: string; mid: string; dark: string; light: string; accent: string; cracks: string }
  > = {
    fallen_city: {
      base: '#211d1e',
      mid: '#2a2426',
      dark: '#161314',
      light: '#3a3234',
      accent: '#5c3120',
      cracks: 'rgba(10,8,9,0.55)',
    },
    exile: {
      base: '#34291f',
      mid: '#413224',
      dark: '#251c14',
      light: '#574431',
      accent: '#54502f',
      cracks: 'rgba(26,18,12,0.45)',
    },
    monster: {
      base: '#2d1c19',
      mid: '#3b231e',
      dark: '#1f1210',
      light: '#523029',
      accent: '#7a2b20',
      cracks: 'rgba(18,8,8,0.55)',
    },
    fantasy: {
      base: '#1d172e',
      mid: '#281f42',
      dark: '#130e20',
      light: '#3e3066',
      accent: '#9d4edd',
      cracks: 'rgba(165,105,255,0.22)',
    },
    old_city: {
      base: '#262c34',
      mid: '#313944',
      dark: '#1a1f26',
      light: '#475261',
      accent: '#6c7c8e',
      cracks: 'rgba(14,18,22,0.5)',
    },
    snow: {
      base: '#4b5a69',
      mid: '#5e7082',
      dark: '#394654',
      light: '#869bb0',
      accent: '#b7cde0',
      cracks: 'rgba(215,232,248,0.22)',
    },
  };

  const t = themes[zone];
  ctx.fillStyle = t.base;
  ctx.fillRect(0, 0, S, S);

  // Soft painterly terrain patches (tiled seamlessly by drawing wrapped copies)
  for (let i = 0; i < 48; i++) {
    const x = seeded(i * 3.1 + 1) * S;
    const y = seeded(i * 5.7 + 2) * S;
    const rx = 18 + seeded(i * 7.3) * 34;
    const ry = 12 + seeded(i * 11.1) * 24;
    const rot = seeded(i * 13.7) * Math.PI;
    ctx.fillStyle = i % 3 === 0 ? t.dark : t.mid;
    ctx.globalAlpha = 0.34;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // Zone-specific structural motifs
  if (zone === 'old_city') {
    // Ancient worn flagstones
    const step = 64;
    ctx.strokeStyle = t.cracks;
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * 32;
      for (let col = -1; col < 5; col++) {
        const bx = col * step + off;
        const by = row * step;
        ctx.strokeRect(bx + 2, by + 2, step - 4, step - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(bx + 4, by + 4, step - 8, 5);
      }
    }
  } else {
    // Organic ground fractures / ley veins
    ctx.strokeStyle = t.cracks;
    ctx.lineWidth = zone === 'fantasy' ? 1.8 : 1.3;
    for (let i = 0; i < 12; i++) {
      const x = seeded(i * 19.3) * S;
      const y = seeded(i * 23.7) * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (seeded(i * 29) - 0.5) * 44, y + (seeded(i * 31) - 0.5) * 38);
      ctx.lineTo(x + (seeded(i * 37) - 0.5) * 72, y + (seeded(i * 41) - 0.5) * 62);
      ctx.stroke();
    }
  }

  // Fine pebbles, ash flecks & dry grass tufts
  for (let i = 0; i < 380; i++) {
    const x = seeded(i * 43.1 + 7) * S;
    const y = seeded(i * 59.3 + 11) * S;
    const r = 0.8 + seeded(i * 61.7) * 2.2;
    ctx.fillStyle = i % 14 === 0 ? t.accent : i % 3 === 0 ? t.light : t.dark;
    ctx.globalAlpha = i % 14 === 0 ? 0.52 : 0.36;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse dry scrub / glowing crystal specks
  if (zone === 'exile' || zone === 'monster') {
    ctx.strokeStyle = zone === 'exile' ? 'rgba(110, 102, 58, 0.52)' : 'rgba(115, 58, 42, 0.45)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const gx = 12 + seeded(i * 83.1) * (S - 24);
      const gy = 12 + seeded(i * 97.7) * (S - 24);
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + b * 5 + (seeded(i + b) - 0.5) * 3, gy - 6 - seeded(i * 3 + b) * 4);
        ctx.stroke();
      }
    }
  } else if (zone === 'fantasy') {
    for (let i = 0; i < 18; i++) {
      const fx = seeded(i * 71.1) * S;
      const fy = seeded(i * 89.3) * S;
      ctx.fillStyle = 'rgba(210, 145, 255, 0.48)';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  return c;
}

function bakeBallastTile(): HTMLCanvasElement {
  const [c, ctx] = createCanvas(256, 224);
  // Soft embankment bevel gradient top-to-bottom
  const g = ctx.createLinearGradient(0, 0, 0, 224);
  g.addColorStop(0, 'rgba(26, 22, 18, 0)');
  g.addColorStop(0.1, '#26211c');
  g.addColorStop(0.22, '#3a332c');
  g.addColorStop(0.5, '#332d27');
  g.addColorStop(0.78, '#3a332c');
  g.addColorStop(0.9, '#26211c');
  g.addColorStop(1, 'rgba(26, 22, 18, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 224);

  // Crushed gravel stones
  for (let i = 0; i < 900; i++) {
    const x = seeded(i * 19.1) * 256;
    const y = 18 + seeded(i * 37.3) * 188;
    const w = 2 + seeded(i * 53.7) * 4;
    const h = 1.5 + seeded(i * 67.9) * 3;
    const v = 42 + Math.floor(seeded(i * 71.3) * 44);
    ctx.fillStyle = `rgb(${v + 8}, ${v + 3}, ${v - 2})`;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  return c;
}

function bakeWoodDeckTile(): HTMLCanvasElement {
  const [c, ctx] = createCanvas(128, 128);
  ctx.fillStyle = '#473628';
  ctx.fillRect(0, 0, 128, 128);

  const plankH = 16;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const tone = 68 + Math.floor(seeded(row * 17.3) * 18);
    ctx.fillStyle = `rgb(${tone + 18}, ${tone + 2}, ${tone - 16})`;
    ctx.fillRect(0, y + 1, 128, plankH - 2);

    // Highlight edge
    ctx.fillStyle = 'rgba(255, 220, 175, 0.08)';
    ctx.fillRect(0, y + 1, 128, 1.5);

    // Fine wood grain
    for (let g = 0; g < 6; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(20, 12, 6, 0.14)' : 'rgba(200, 155, 100, 0.06)';
      ctx.fillRect(0, y + 2 + g * 2.1, 128, 1);
    }

    // Plank seam
    ctx.fillStyle = '#1f160f';
    ctx.fillRect(0, y, 128, 1.5);

    // Cross joint + rusted nails
    const jx = Math.floor(20 + seeded(row * 31.7) * 88);
    ctx.fillRect(jx, y, 1.5, plankH);
    ctx.fillStyle = '#18130f';
    ctx.fillRect(jx - 5, y + 3, 2, 2);
    ctx.fillRect(jx - 5, y + plankH - 5, 2, 2);
    ctx.fillRect(jx + 4, y + 3, 2, 2);
    ctx.fillRect(jx + 4, y + plankH - 5, 2, 2);
  }
  return c;
}

function bakeAsphaltTile(): HTMLCanvasElement {
  const [c, ctx] = createCanvas(128, 128);
  ctx.fillStyle = '#2d2a2b';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 420; i++) {
    const x = seeded(i * 17.1) * 128;
    const y = seeded(i * 29.3) * 128;
    const v = 35 + Math.floor(seeded(i * 41.7) * 26);
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(12, 10, 11, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, 24);
  ctx.lineTo(52, 42);
  ctx.lineTo(86, 36);
  ctx.stroke();
  return c;
}

function bakePlatformTile(): HTMLCanvasElement {
  const [c, ctx] = createCanvas(128, 128);
  ctx.fillStyle = '#403b36';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(20, 18, 16, 0.42)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 128; x += 32) {
    for (let y = 0; y < 128; y += 32) {
      ctx.strokeRect(x + 0.5, y + 0.5, 31, 31);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + 2, y + 2, 28, 3);
    }
  }
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.09)' : 'rgba(255,245,230,0.04)';
    ctx.fillRect(seeded(i * 11.3) * 128, seeded(i * 23.1) * 128, 2, 2);
  }
  return c;
}

function bakeMasonryTile(): HTMLCanvasElement {
  const [c, ctx] = createCanvas(64, 64);
  ctx.fillStyle = '#3b3530';
  ctx.fillRect(0, 0, 64, 64);
  const bh = 16;
  const bw = 32;
  for (let r = 0; r < 4; r++) {
    const off = (r % 2) * 16;
    for (let col = -1; col < 3; col++) {
      const bx = col * bw + off;
      const by = r * bh;
      const v = 72 + Math.floor(seeded(r * 13 + col * 29) * 18);
      ctx.fillStyle = `rgb(${v + 6}, ${v}, ${v - 6})`;
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.fillStyle = 'rgba(255,240,220,0.08)';
      ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
    }
  }
  return c;
}

function bakePreTiledRect(tile: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = createCanvas(w, h);
  const tw = tile.width;
  const th = tile.height;
  for (let y = 0; y < h; y += th) {
    for (let x = 0; x < w; x += tw) {
      ctx.drawImage(tile, x, y);
    }
  }
  return c;
}

export function getArtPatterns(): ArtPatterns {
  if (cachedPatterns) return cachedPatterns;
  const woodDeck = bakeWoodDeckTile();
  cachedPatterns = {
    ground: {
      fallen_city: bakeGroundTile('fallen_city'),
      exile: bakeGroundTile('exile'),
      monster: bakeGroundTile('monster'),
      fantasy: bakeGroundTile('fantasy'),
      old_city: bakeGroundTile('old_city'),
      snow: bakeGroundTile('snow'),
    },
    ballast: bakeBallastTile(),
    woodDeck,
    flatbedDeck: bakePreTiledRect(woodDeck, CAR_W, CAR_H),
    locoDeck: bakePreTiledRect(woodDeck, LOCO_W - 12, LOCO_H - 12),
    asphalt: bakeAsphaltTile(),
    platform: bakePlatformTile(),
    masonry: bakeMasonryTile(),
  };
  return cachedPatterns;
}
