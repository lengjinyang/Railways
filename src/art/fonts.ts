// Canvas typography — mirrors the CSS tokens in styles/index.css so world text and HUD text match.
const SANS = '"Inter", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
const MONO = '"JetBrains Mono", "Cascadia Mono", "SF Mono", Consolas, "Microsoft YaHei UI", monospace';

export const uiFont = (size: number, weight: number | 'normal' | 'bold' = 600): string => `${weight} ${size}px ${SANS}`;
export const monoFont = (size: number, weight: number | 'normal' | 'bold' = 600): string => `${weight} ${size}px ${MONO}`;

export const INK = 'rgba(14, 12, 10, 0.88)';
export const BRASS = '#c9954d';
export const BRASS_HI = '#edc47c';
export const PARCHMENT = '#ece3d1';
