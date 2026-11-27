import React from 'react';
import { Navigation } from 'lucide-react';
import type { WorldState } from '../world';

interface WorldOverlayProps {
  world: WorldState;
  onDismissCard: () => void;
}

const vignette = (rgb: string, alpha: number, clear: number) =>
  `radial-gradient(ellipse at center, transparent ${clear}%, rgba(${rgb}, ${alpha}) 100%)`;

export const WorldOverlay: React.FC<WorldOverlayProps> = ({ world, onDismissCard }) => {
  const trainDist = Math.hypot(world.player.x, world.player.y);
  const showHeartbeat =
    world.player.hp <= Math.max(28, world.player.maxHp * 0.28) || world.player.hunger <= 0 || world.player.thirst <= 0;
  const frostIntensity = world.player.bodyTemp < 65 ? Math.min(0.62, ((65 - world.player.bodyTemp) / 65) * 0.62) : 0;
  const sporeIntensity =
    world.player.sporeExposure > 15 ? Math.min(0.45, ((world.player.sporeExposure - 15) / 85) * 0.45) : 0;
  const thirstHaze = world.player.thirst < 25 ? Math.min(0.32, ((25 - world.player.thirst) / 25) * 0.32) : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {/* Permanent lens vignette — frames the world and lifts the HUD off the ground */}
      <div className="absolute inset-0" style={{ background: vignette('6, 5, 4', 0.32, 58) }} />

      {/* Hypothermia frost */}
      {frostIntensity > 0.02 && (
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ background: vignette('120, 200, 255', frostIntensity, 42) }}
        />
      )}

      {/* Ivy City spores */}
      {sporeIntensity > 0.02 && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: vignette('76, 168, 108', sporeIntensity, 48) }}
        />
      )}

      {/* Dehydration haze */}
      {thirstHaze > 0.02 && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: vignette('168, 132, 76', thirstHaze, 52) }}
        />
      )}

      {/* Critical heartbeat */}
      {showHeartbeat && (
        <div className="absolute inset-0 anim-heartbeat" style={{ background: vignette('170, 20, 24', 0.5, 44) }} />
      )}

      {/* Darkness without lantern */}
      {world.darkThreatLevel > 0.05 && (
        <div
          className="absolute inset-0"
          style={{ background: vignette('10, 8, 16', Math.min(0.68, world.darkThreatLevel * 0.62), 36) }}
        />
      )}

      {/* Region title — engraved, unboxed, fades in and out */}
      {world.zoneBanner &&
        world.zoneBanner.timer > 0 &&
        (() => {
          const b = world.zoneBanner;
          const alpha = Math.max(0, Math.min(1, Math.min(b.timer, (5.0 - b.timer) * 2.2)));
          const spread = 0.42 + 0.06 * alpha;
          return (
            <div
              className="absolute top-[9vh] left-1/2 -translate-x-1/2 flex flex-col items-center text-center"
              style={{ opacity: alpha }}
            >
              <div className="absolute -inset-x-24 -inset-y-10 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.55),transparent_70%)]" />
              <div className="relative flex items-center gap-5">
                <span className="h-px w-20 bg-gradient-to-l from-current to-transparent opacity-60" style={{ color: b.color }} />
                <span className="w-1.5 h-1.5 rotate-45 border opacity-70" style={{ borderColor: b.color }} />
                <h2
                  className="display text-[30px] leading-none text-engraved whitespace-nowrap"
                  style={{ color: b.color, letterSpacing: `${spread}em`, marginRight: `-${spread}em` }}
                >
                  {b.title}
                </h2>
                <span className="w-1.5 h-1.5 rotate-45 border opacity-70" style={{ borderColor: b.color }} />
                <span className="h-px w-20 bg-gradient-to-r from-current to-transparent opacity-60" style={{ color: b.color }} />
              </div>
              <p className="relative mt-3 text-[12.5px] tracking-[0.08em] text-parchment-dim text-engraved max-w-md">
                {b.subtitle}
              </p>
            </div>
          );
        })()}

      {/* Wave omen — a whisper, not a notification */}
      {world.wavePhase === 'omen' && world.omenLabel && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-10 py-2 bg-[radial-gradient(ellipse_at_center,rgb(40_8_6/0.55),transparent_72%)]">
          <span className="anim-whisper block text-[12px] text-[#e8b3a6] text-engraved whitespace-nowrap">
            {world.omenLabel}
          </span>
        </div>
      )}

      {/* Lore card — a torn journal page */}
      {world.activeCard && (
        <button
          type="button"
          onClick={onDismissCard}
          className="pointer-events-auto group absolute top-6 right-6 w-[340px] max-w-[90vw] text-left plate-strong riveted anim-panel-in p-5 cursor-pointer"
        >
          <div className="absolute left-0 top-5 bottom-5 w-[2px] bg-gradient-to-b from-brass/0 via-brass/70 to-brass/0" />
          <div className="eyebrow mb-2">{world.activeCard.subtitle ?? '拾获记录'}</div>
          <div className="display text-[17px] text-parchment mb-2.5 tracking-[0.08em]">{world.activeCard.title}</div>
          <p className="text-[12.5px] leading-[1.85] text-parchment-dim">{world.activeCard.body}</p>
          <div className="mt-3.5 text-[10px] text-ash-dim tracking-wider group-hover:text-ash transition-colors">
            点击收起
          </div>
        </button>
      )}

      {/* Way back to the train when deep in the ruins */}
      {trainDist > 680 &&
        (() => {
          const ang = Math.atan2(-world.player.y, -world.player.x);
          const deg = (ang * 180) / Math.PI;
          const distM = Math.round(trainDist / 18);
          return (
            <div className="absolute bottom-5 right-5 plate px-3.5 py-2 flex items-center gap-2.5 anim-fade-in">
              <span className="w-6 h-6 rounded-full border border-brass/30 bg-black/40 flex items-center justify-center">
                <Navigation
                  className="w-3 h-3 text-brass-hi fill-brass-hi/30"
                  style={{ transform: `rotate(${deg + 45}deg)` }}
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[9.5px] tracking-[0.18em] text-ash-dim">列车</span>
                <span className="font-mono text-[12px] text-parchment">{distM}m</span>
              </span>
            </div>
          );
        })()}
    </div>
  );
};
