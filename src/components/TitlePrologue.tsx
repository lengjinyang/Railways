import React from 'react';
import { Flame, TrainFront, Compass, ChevronRight, FastForward } from 'lucide-react';

interface TitlePrologueProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

const PROLOGUE_BEATS = [
  {
    tag: '序章 · 01 / 03',
    title: '神父的预言',
    subtitle: 'THE PRIEST’S PROPHECY',
    body: [
      '潮湿阴冷的教堂里，年迈的神父一次次按着你的肩膀，絮絮叨叨地说着同样的话：“孩子，记住你的血脉……旧日的灾难正在苏醒，唯有你是这个世界的救世主。”',
      '你原本只当那是老人日复一日的呓语。',
    ],
    btn: '继续阅读',
  },
  {
    tag: '序章 · 02 / 03',
    title: '陷落之夜与破旧蒸汽列车',
    subtitle: 'NIGHT OF THE FALL',
    body: [
      '直到那个血月当空的夜晚，城墙在嘶吼声中轰然倒塌，整座城市一夜之间被怪物撕碎。',
      '钟楼废墟下，弥留之际的神父将一把沾满煤灰的钥匙塞进你的掌心，指向站台尽头那辆破旧的蒸汽列车：“快上车逃出去……整个世界都已被怪物侵占，活下来！”',
    ],
    btn: '拉响汽笛，冲出火海',
  },
  {
    tag: '序章 · 03 / 03',
    title: '驶离大城，奔向流放之地',
    subtitle: 'ESCAPE INTO THE WASTELAND',
    body: [
      '蒸汽机车已启动，正缓缓驶离燃烧的大城市郊区——穿过这段破败的城区铁道后，你将正式踏入【流放之地 · 危险等级 I】，直面失去人性的强盗与怪物。',
      '车头挂着一盏手提灯（按 E 取下，L 开关），夜晚仅能照亮短距锥形视野；若没带提灯且离列车越远，暗处怪物会越多且越强！每站资源有限，升级铁镐与切割锯以破开深处金库；发车前务必选定下一站并备足燃料。',
    ],
    btn: '驾驶蒸汽列车，驶入荒原',
  },
];

export const TitlePrologue: React.FC<TitlePrologueProps> = ({ step, onNext, onSkip }) => {
  const beat = PROLOGUE_BEATS[Math.min(step, PROLOGUE_BEATS.length - 1)];
  const isLast = step >= PROLOGUE_BEATS.length - 1;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-gradient-to-b from-black/75 via-black/45 to-black/80 backdrop-blur-[2px]">
      <div className="brass-panel-strong relative w-full max-w-2xl rounded-2xl p-7 md:p-8 overflow-hidden">
        {/* Decorative ember top glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full bg-amber-500/20 blur-3xl" />

        {/* Header Row */}
        <div className="relative flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300">
              {step === 0 ? <Compass className="w-4 h-4" /> : step === 1 ? <Flame className="w-4 h-4" /> : <TrainFront className="w-4 h-4" />}
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80 font-semibold">
                《第一幕·荒原》 RAILWAYS
              </div>
              <div className="text-xs text-stone-400">{beat.tag}</div>
            </div>
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              className="brass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-stone-300 cursor-pointer relative z-10"
            >
              <FastForward className="w-3.5 h-3.5" />
              跳过序章
            </button>
          )}
        </div>

        {/* Title */}
        <div className="relative mb-5">
          <div className="text-[10px] tracking-[0.26em] text-amber-400/70 font-mono mb-1">
            {beat.subtitle}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-amber-100">
            {beat.title}
          </h1>
        </div>

        {/* Narrative Body */}
        <div className="relative space-y-3.5 text-sm md:text-[15px] leading-relaxed text-stone-200/95 mb-6">
          {beat.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Keybinding Strip on final beat */}
        {isLast && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-black/45 border border-amber-500/20 text-xs text-stone-300">
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">WASD</kbd> 移动/冲刺</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">E</kbd> 交互/开关门</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">B</kbd> 车厢建造</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">I / Tab</kbd> 背包/合成</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">Q / F</kbd> 刹车/升档</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">L</kbd> 开关提灯</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">V</kbd> 重置视野</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-600 text-amber-300 font-mono">滚轮</kbd> 视野缩放</div>
          </div>
        )}

        {/* Progress Dots + Action CTA */}
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {PROLOGUE_BEATS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? 'w-8 bg-amber-400' : idx < step ? 'w-3 bg-amber-600/80' : 'w-2 bg-stone-700'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="brass-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer relative z-10"
          >
            {beat.btn}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
