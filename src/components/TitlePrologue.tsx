import React from 'react';
import { ArrowRight, FastForward, Play } from 'lucide-react';
import type { SaveSummary } from '../world';

interface TitlePrologueProps {
  step: number;
  saveSummary: SaveSummary | null;
  onContinueSave: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const PROLOGUE_BEATS = [
  {
    numeral: 'I',
    title: '无声的神谕',
    subtitle: 'The Silent Oracle',
    body: [
      '主教在没有经文的礼拜堂里叫住了你——一名常年在锈铁堆间翻找旧零件的无名拾荒者。',
      '他没有提起过往，也没有称你为救世主，只是把一串冰冷的黄铜钥匙放进你的掌心：“神谕落在了你的名字上。沿着铁轨往前走。”',
    ],
    btn: '继续',
  },
  {
    numeral: 'II',
    title: '没有历史的世界',
    subtitle: 'A World Without History',
    body: [
      '没有人记得世界是在哪一年破败的。留存下来的书都只剩前半本，荒原上的石碑被人逐块凿平，连站台上的墙历都停在同一张没有年份的纸页。',
      '雾气尽头，一列炉膛里燃着冷蓝火焰的旧蒸汽机车正发出低沉的鸣响。站台之外，再也见不到正常的人类。',
    ],
    btn: '登上列车',
  },
  {
    numeral: 'III',
    title: '启程',
    subtitle: 'Departure',
    body: [
      '每次到站都会自动记录站点存档。你可以按自己的节奏在站内搜刮、清剿巢穴、改造车厢——但每座站点的物资终有尽头。',
      '翻开行囊、搜刮箱子或站在工作台前制作时，世界不会停下脚步。备足干粮、净水与晶石，再扳动车头的拉杆。',
    ],
    btn: '进入荒原',
  },
];

const CONTROLS: Array<[string, string]> = [
  ['WASD', '移动 · Shift 冲刺'],
  ['左键', '挥击 · 射击 · 建造'],
  ['E', '交互 · 长按搜刮/存箱'],
  ['Tab', '行囊 · 笔记 · 图鉴'],
  ['B / M', '建造 · 航线图'],
  ['1–6', '快捷栏 · Esc 菜单'],
];

function formatSavedAgo(savedAt: number): string {
  const min = Math.floor((Date.now() - savedAt) / 60000);
  if (min < 1) return '刚刚保存';
  if (min < 60) return `${min} 分钟前保存`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前保存`;
  return `${Math.floor(h / 24)} 天前保存`;
}

export const TitlePrologue: React.FC<TitlePrologueProps> = ({ step, saveSummary, onContinueSave, onNext, onSkip }) => {
  const beat = PROLOGUE_BEATS[Math.min(step, PROLOGUE_BEATS.length - 1)];
  const isLast = step >= PROLOGUE_BEATS.length - 1;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden anim-fade-in">
      {/* Atmosphere: darken the left reading column, let the train breathe on the right */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_7_6/0.94)_0%,rgb(8_7_6/0.82)_38%,rgb(8_7_6/0.35)_70%,rgb(8_7_6/0.55)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_50%,transparent_0%,transparent_35%,rgb(0_0_0/0.55)_100%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/3 w-[640px] h-[420px] rounded-full bg-rune/[0.07] blur-[110px]" />

      {/* Letterbox — top */}
      <div className="absolute inset-x-0 top-0 h-[9vh] min-h-14 bg-black flex items-end">
        <div className="w-full flex items-center justify-between px-[6vw] pb-3">
          <div className="flex items-center gap-3">
            <span className="display text-[13px] tracking-[0.5em] text-brass-hi/90">RAILWAYS</span>
            <span className="h-3 w-px bg-brass/30" />
            <span className="text-[11px] tracking-[0.18em] text-ash">第一幕 · 荒原</span>
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              className="btn-ghost px-2.5 py-1 text-[11px] tracking-wider relative z-10"
            >
              跳过序章
              <FastForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Story column */}
      <div className="absolute inset-y-[9vh] left-0 w-full max-w-[720px] flex items-center px-[6vw]">
        <div key={step} className="w-full">
          <div className="anim-rise-in flex items-baseline gap-4 mb-5">
            <span className="display text-[64px] leading-none text-brass/25 tracking-normal select-none">
              {beat.numeral}
            </span>
            <span className="eyebrow">{beat.subtitle}</span>
          </div>

          <h1
            className="anim-rise-in display text-[40px] md:text-[46px] leading-[1.1] text-parchment text-engraved tracking-[0.12em]"
            style={{ animationDelay: '60ms' }}
          >
            {beat.title}
          </h1>

          <div className="anim-rise-in mt-6 mb-7 flex items-center gap-2" style={{ animationDelay: '120ms' }}>
            <span className="h-px w-16 bg-gradient-to-r from-brass to-brass/0" />
            <span className="w-1 h-1 rotate-45 bg-brass/70" />
          </div>

          <div className="space-y-4 max-w-[34em]">
            {beat.body.map((para, i) => (
              <p
                key={i}
                className="anim-rise-in text-[15px] leading-[1.95] text-parchment-dim"
                style={{ animationDelay: `${180 + i * 90}ms` }}
              >
                {para}
              </p>
            ))}
          </div>

          {isLast && (
            <div
              className="anim-rise-in mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5 max-w-[30em]"
              style={{ animationDelay: '380ms' }}
            >
              {CONTROLS.map(([k, d]) => (
                <div key={k} className="flex items-center gap-2.5 text-[12px] text-ash">
                  <span className="kbd w-14">{k}</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          )}

          <div
            className="anim-rise-in mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: isLast ? '460ms' : '360ms' }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="btn-primary group px-6 py-2.5 text-sm tracking-[0.12em] relative z-10"
            >
              {beat.btn}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            {saveSummary && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onContinueSave();
                }}
                className="btn px-4 py-2 text-left relative z-10"
              >
                <Play className="w-3.5 h-3.5 text-brass-hi" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12.5px] text-parchment font-semibold">继续旅程 · {saveSummary.stationName}</span>
                  <span className="text-[10.5px] text-ash font-mono">
                    第 {saveSummary.dayCount} 天 · {saveSummary.totalDistance}m · {saveSummary.flatbedCount} 节车厢 · {formatSavedAgo(saveSummary.savedAt)}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Letterbox — bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[9vh] min-h-14 bg-black flex items-start">
        <div className="w-full flex items-center justify-between px-[6vw] pt-3.5">
          <div className="flex items-center gap-2.5">
            {PROLOGUE_BEATS.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span
                    className={`h-px w-10 transition-colors duration-500 ${idx <= step ? 'bg-brass/70' : 'bg-white/10'}`}
                  />
                )}
                <span
                  className={`display text-[11px] tracking-widest transition-colors duration-500 ${
                    idx === step ? 'text-brass-hi' : idx < step ? 'text-brass/60' : 'text-ash-dim'
                  }`}
                >
                  {b.numeral}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ash-dim">
            <span className="kbd">Space</span>
            <span>或</span>
            <span className="kbd">Enter</span>
            <span>继续</span>
          </div>
        </div>
      </div>
    </div>
  );
};
