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
    rust_plains: {
      base: '#36271d',
      mid: '#443022',
      dark: '#261b13',
      light: '#5c412e',
      accent: '#7a512b',
      cracks: 'rgba(26,16,10,0.45)',
    },
    monster_wastes: {
      base: '#2c1c19',
      mid: '#3a241f',
      dark: '#1e1210',
      light: '#523029',
      accent: '#783226',
      cracks: 'rgba(18,8,8,0.55)',
    },
    ivy_city: {
      base: '#1b2620',
      mid: '#23332a',
      dark: '#121a16',
      light: '#354f40',
      accent: '#56a874',
      cracks: 'rgba(85, 195, 130, 0.24)',
    },
    sinking_belt: {
      base: '#1f2329',
      mid: '#292e36',
      dark: '#14171c',
      light: '#3e4652',
      accent: '#5a6b7d',
      cracks: 'rgba(8, 10, 14, 0.72)',
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

  if (zone === 'old_city') {
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
  } else if (zone === 'rust_plains') {
    // Half-buried corroded giant gear teeth arcs (W3)
    ctx.strokeStyle = 'rgba(130, 88, 48, 0.25)';
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.arc(190, 180, 74, 0.3, 2.3);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (zone === 'ivy_city') {
    // Flagstones overgrown with creeping luminous vines (W4)
    ctx.strokeStyle = 'rgba(10, 16, 12, 0.45)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        ctx.strokeRect(col * 64 + 2, r * 64 + 2, 60, 60);
      }
    }
    ctx.strokeStyle = t.cracks;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 10; i++) {
      const x = seeded(i * 19.3) * S;
      const y = seeded(i * 23.7) * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 28, y - 16, x + 52, y + 22);
      ctx.stroke();
    }
  } else {
    // Fractures / deep rifts for sinking_belt & monster_wastes
    ctx.strokeStyle = t.cracks;
    ctx.lineWidth = zone === 'sinking_belt' ? 2.4 : 1.3;
    for (let i = 0; i < 14; i++) {
      const x = seeded(i * 19.3) * S;
      const y = seeded(i * 23.7) * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (seeded(i * 29) - 0.5) * 48, y + (seeded(i * 31) - 0.5) * 42);
      ctx.lineTo(x + (seeded(i * 37) - 0.5) * 76, y + (seeded(i * 41) - 0.5) * 64);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 360; i++) {
    const x = seeded(i * 43.1 + 7) * S;
    const y = seeded(i * 59.3 + 11) * S;
    const r = 0.8 + seeded(i * 61.7) * 2.2;
    ctx.fillStyle = i % 14 === 0 ? t.accent : i % 3 === 0 ? t.light : t.dark;
    ctx.globalAlpha = i % 14 === 0 ? 0.52 : 0.34;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (zone === 'ivy_city') {
    for (let i = 0; i < 16; i++) {
      const fx = seeded(i * 71.1) * S;
      const fy = seeded(i * 89.3) * S;
      ctx.fillStyle = 'rgba(130, 235, 175, 0.42)';
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
    ctx.fillStyle = 'rgba(255, 220, 175, 0.08)';
    ctx.fillRect(0, y + 1, 128, 1.5);
    for (let g = 0; g < 6; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(20, 12, 6, 0.14)' : 'rgba(200, 155, 100, 0.06)';
      ctx.fillRect(0, y + 2 + g * 2.1, 128, 1);
    }
    ctx.fillStyle = '#1f160f';
    ctx.fillRect(0, y, 128, 1.5);
    const jx = Math.floor(20 + seeded(row * 31.7) * 88);
    ctx.fillRect(jx, y, 1.5, plankH);
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
    }
  }
  return c;
}

function bakePreTiledRect(tile: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = createCanvas(w, h);
  for (let y = 0; y < h; y += tile.height) {
    for (let x = 0; x < w; x += tile.width) {
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
      rust_plains: bakeGroundTile('rust_plains'),
      monster_wastes: bakeGroundTile('monster_wastes'),
      ivy_city: bakeGroundTile('ivy_city'),
      sinking_belt: bakeGroundTile('sinking_belt'),
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
