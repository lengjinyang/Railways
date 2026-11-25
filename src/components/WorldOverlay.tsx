import React from 'react';
import { AlertTriangle, Compass, Siren, Sparkles } from 'lucide-react';
import {
  LOCO_W,
  ZONE_META,
  getVitalWarnings,
  getZoneTierRoman,
  type WorldState,
} from '../world';

interface WorldOverlayProps {
  world: WorldState;
}

export const WorldOverlay: React.FC<WorldOverlayProps> = ({ world }) => {
  const upcoming = world.trackHazards
    .filter((h) => !h.repaired && h.x > LOCO_W && h.x < 1200)
    .sort((a, b) => a.x - b.x)[0];

  const trainDist = Math.hypot(world.player.x, world.player.y);
  const vitalWarns = getVitalWarnings(world);
  const showHeartbeat = world.player.hp <= 30 || world.player.hunger <= 0 || world.player.thirst <= 0;
  const frostIntensity = world.player.bodyTemp < 65 ? Math.min(0.65, ((65 - world.player.bodyTemp) / 65) * 0.65) : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {/* Hypothermia Frost Vignette */}
      {frostIntensity > 0.02 && (
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle at center, transparent 42%, rgba(100, 195, 255, ${frostIntensity}) 100%)`,
          }}
        />
      )}

      {/* Critical Low-HP / Starvation Heartbeat Vignette */}
      {showHeartbeat && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'radial-gradient(circle at center, transparent 46%, rgba(210, 20, 24, 0.45) 100%)',
          }}
        />
      )}

      {/* Darkness No-Lantern Terror Vignette */}
      {world.darkThreatLevel > 0.05 && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: `radial-gradient(circle at center, transparent 36%, rgba(165, 10, 25, ${Math.min(0.6, world.darkThreatLevel * 0.55)}) 100%)`,
          }}
        />
      )}

      {/* Non-Blocking Ceremonial Lost World Disembarkation Title Card! */}
      {world.lostWorldBanner && world.lostWorldBanner.timer > 0 && (() => {
        const b = world.lostWorldBanner;
        const zm = ZONE_META[b.zone];
        const fadeIn = Math.min(1, (6.5 - b.timer) * 1.4);
        const fadeOut = Math.min(1, b.timer * 0.9);
        const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
        return (
          <div
            className="absolute top-[140px] left-1/2 -translate-x-1/2 w-[560px] max-w-[92vw] text-center transition-opacity"
            style={{ opacity: alpha }}
          >
            <div className="brass-panel-strong rounded-2xl px-8 py-5 relative overflow-hidden" style={{ borderColor: zm.color }}>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-25 blur-2xl"
                style={{ backgroundColor: zm.color }}
              />
              <div className="relative flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.28em] text-amber-300/90 font-semibold mb-1.5">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-400/80" />
                <span>踏入失落的世界 · 第 {world.stationIdx + 1} 站 · {zm.name} {getZoneTierRoman(b.tier)}</span>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-400/80" />
              </div>
              <div
                className="relative text-2xl sm:text-3xl font-bold tracking-wide mb-2 drop-shadow"
                style={{ color: zm.color }}
              >
                {b.worldTitle}
              </div>
              <p className="relative text-xs sm:text-[13px] italic text-stone-200/90 leading-relaxed mb-3.5">
                “{b.epigraph}”
              </p>
              {b.rumors.length > 0 && (
                <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-white/10">
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/90 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" /> 秘宝传闻：
                  </span>
                  {b.rumors.map((rm, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-full text-[11px] bg-black/55 border border-amber-400/35 text-amber-100"
                    >
                      {rm}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Standard Zone Entry Banner (suppressed while Lost World Ceremony card is displayed) */}
      {!world.lostWorldBanner && world.zoneBanner && world.zoneBanner.timer > 0 && (() => {
        const zm = ZONE_META[world.zoneBanner.kind];
        const roman = getZoneTierRoman(world.zoneBanner.tier);
        const alpha = Math.max(0, Math.min(1, Math.min(world.zoneBanner.timer, (4.5 - world.zoneBanner.timer) * 3.5 + 0.15)));
        return (
          <div
            className="absolute top-[134px] left-1/2 -translate-x-1/2 brass-panel-strong rounded-2xl px-7 py-3 text-center transition-opacity"
            style={{ opacity: alpha, borderColor: zm.color }}
          >
            <div className="text-lg font-bold tracking-wide" style={{ color: zm.color }}>
              {world.zoneBanner.kind === 'fallen_city'
                ? `${zm.icon} ${zm.name} · 正在逃离`
                : `${zm.icon} ${zm.name} · 危险等级 ${roman}`}
            </div>
            <div className="text-xs text-stone-300 mt-0.5">{zm.desc}</div>
          </div>
        );
      })()}

      {/* Wasteland Stop Siege Warning */}
      {world.mode === 'wasteland' && world.wastelandStopTimer > 3.5 && (
        <div className="absolute top-[212px] left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/90 border-2 border-amber-300 text-white text-xs font-bold shadow-2xl animate-pulse">
          <Siren className="w-4 h-4 text-amber-300 shrink-0" />
          荒野停车极危！强化怪物正大批围攻列车，请尽快发车！
        </div>
      )}

      {/* Track Hazard Radar (Right Edge) */}
      {upcoming && (() => {
        const distM = Math.max(0, Math.round((upcoming.x - LOCO_W) / 18));
        const isBroken = upcoming.kind === 'broken';
        return (
          <div
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-[236px] rounded-xl p-3 border-2 shadow-2xl ${
              isBroken
                ? 'bg-red-950/92 border-red-400 animate-danger-glow'
                : 'bg-amber-950/92 border-amber-400'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${isBroken ? 'text-red-300' : 'text-amber-300'}`} />
              <span>{isBroken ? `前方断裂地裂！${distM}m` : `前方松动铁轨 ${distM}m`}</span>
            </div>
            <div className="text-xs text-stone-200 mt-1">
              {isBroken ? '立即拉刹车(Q)停稳 → 车头铺轨(E)' : '请减速至【常速】以下安全通过'}
            </div>
          </div>
        );
      })()}

      {/* Return-to-Train Compass when exploring deep into the unbounded Lost World */}
      {trainDist > 420 && (() => {
        const ang = Math.atan2(-world.player.y, -world.player.x);
        const deg = (ang * 180) / Math.PI;
        const distM = Math.round(trainDist / 18);
        return (
          <div className="absolute top-[122px] left-1/2 -translate-x-1/2 brass-panel rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-bold text-amber-300 border-amber-400/70">
            <Compass className="w-3.5 h-3.5" style={{ transform: `rotate(${deg + 90}deg)` }} />
            <span>列车方向 · {distM}m</span>
          </div>
        );
      })()}

      {/* Critical Low-Vital Alert Stack (above hotbar) */}
      {vitalWarns.length > 0 && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 ${
            world.buildMode || world.hotbar === 5 ? 'bottom-[198px]' : 'bottom-[96px]'
          }`}
        >
          {vitalWarns.map((txt, idx) => {
            const isCrit = txt.startsWith('🩸') || txt.includes('正在掉血');
            return (
              <div
                key={idx}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white border shadow-lg ${
                  isCrit
                    ? 'bg-red-900/95 border-red-400 animate-pulse'
                    : 'bg-amber-900/92 border-amber-400'
                }`}
              >
                {txt}
              </div>
            );
          })}
        </div>
      )}

      {/* Unbounded Lost World Discovery Radar (Bottom-Right, centered dynamically so you can explore infinitely!) */}
      {world.mode === 'station' && (() => {
        const mw = 200;
        const mh = 150;
        const spanX = 2000;
        const spanY = 1500;
        const cx = world.player.x;
        const cy = world.player.y;
        const toX = (wx: number) => ((wx - cx) / (spanX * 2) + 0.5) * mw;
        const toY = (wy: number) => ((wy - cy) / (spanY * 2) + 0.5) * mh;
        const sx = mw / (spanX * 2);
        const sy = mh / (spanY * 2);

        return (
          <div className="absolute right-3 bottom-3 brass-panel rounded-xl p-2 shadow-2xl">
            <div className="flex items-center justify-between text-[10px] text-amber-300 font-semibold mb-1 px-0.5">
              <span>🧭 失落世界探索图</span>
              <span className="text-stone-400 font-mono">
                已探 {world.exploredFog.size} · 遗迹 {world.discoveredLandmarks}
              </span>
            </div>
            <svg width={mw} height={mh} className="rounded-lg bg-[#0d0b09] border border-white/10 block overflow-hidden">
              {/* Roads */}
              {world.stationRoads.map((rd, i) => (
                <rect
                  key={`rd_${i}`}
                  x={toX(rd.x)}
                  y={toY(rd.y)}
                  width={Math.max(1, rd.w * sx)}
                  height={Math.max(1, rd.h * sy)}
                  fill="rgba(120, 112, 102, 0.38)"
                />
              ))}
              {/* Railway Line */}
              <rect x={0} y={toY(-16)} width={mw} height={2.5} fill="rgba(180, 190, 200, 0.55)" />
              {/* Inner City Buildings */}
              {world.stationRooms.map((rm, i) => (
                <rect
                  key={`rm_${i}`}
                  x={toX(rm.x)}
                  y={toY(rm.y)}
                  width={Math.max(3.5, rm.w * sx)}
                  height={Math.max(3.5, rm.h * sy)}
                  rx={1.5}
                  fill={rm.reqTool === 3 ? '#ffd43b' : rm.reqTool === 2 ? '#ff922b' : '#74b816'}
                  opacity={0.85}
                />
              ))}
              {/* Rare Treasures (Ancient Vaults & Arcane Crystals) */}
              {world.props
                .filter((pr) => !pr.used && (pr.kind === 'ancient_vault' || pr.kind === 'arcane_crystal'))
                .map((pr) => (
                  <circle
                    key={pr.uid}
                    cx={toX(pr.x)}
                    cy={toY(pr.y)}
                    r={3}
                    fill={pr.kind === 'ancient_vault' ? '#ffd43b' : '#c77dff'}
                  />
                ))}
              {/* Train Home Beacon */}
              <rect
                x={toX(-180)}
                y={toY(-44)}
                width={Math.max(12, 360 * sx)}
                height={Math.max(4.5, 88 * sy)}
                rx={1.5}
                fill="#f8f9fa"
                stroke="#e7a043"
                strokeWidth={0.8}
              />
              {/* Player Center Marker */}
              <circle cx={mw / 2} cy={mh / 2} r={3.8} fill="#38bdf8" stroke="#fff" strokeWidth={1.2} />
            </svg>
          </div>
        );
      })()}
    </div>
  );
};
