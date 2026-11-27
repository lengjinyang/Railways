import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Play, RotateCcw } from 'lucide-react';
import type { SaveSummary } from '../world';

interface ConfirmNewGameProps {
  /** The save that would be lost, if any. */
  save: SaveSummary | null;
  /** 'title' = starting fresh from the prologue; 'restart' = abandoning the run in progress. */
  reason: 'title' | 'restart';
  onConfirm: () => void;
  onCancel: () => void;
}

function formatSavedAgo(savedAt: number): string {
  const min = Math.floor((Date.now() - savedAt) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

/**
 * Guard before anything that would overwrite or erase the single save slot.
 * Space/Enter deliberately do nothing here, so tapping through the prologue can't wipe a run.
 */
export const ConfirmNewGame: React.FC<ConfirmNewGameProps> = ({ save, reason, onConfirm, onCancel }) => {
  // Focus the dialog itself, not a button: a stray Space/Enter (tapping through the prologue)
  // must neither confirm nor dismiss it. Esc cancels (handled in App).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    rootRef.current?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in outline-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-new-game-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[5px]" onClick={onCancel} />
      <div className="relative plate-strong riveted anim-pop-in w-full max-w-[420px] overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <AlertTriangle className="w-4.5 h-4.5 text-rust" strokeWidth={1.8} />
            <h2 id="confirm-new-game-title" className="display text-[19px] text-parchment tracking-[0.12em]">
              {reason === 'restart' ? '放弃当前旅程？' : '覆盖已有存档？'}
            </h2>
          </div>
          <p className="text-[12.5px] text-parchment-dim leading-relaxed">
            {reason === 'restart'
              ? '重开会清除存档，当前列车、车厢与背包都会丢失，无法恢复。'
              : '只有一个存档位。开始新旅程后，下一次保存会覆盖下面这段进度，无法恢复。'}
          </p>

          {save && (
            <div className="mt-4 rounded-md border border-brass/25 bg-black/30 px-3.5 py-2.5">
              <div className="text-[12.5px] text-parchment font-semibold">{save.stationName}</div>
              <div className="mt-0.5 text-[10.5px] text-ash font-mono">
                第 {save.dayCount} 天 · {save.totalDistance}m · {save.flatbedCount} 节车厢 · {formatSavedAgo(save.savedAt)}保存
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="btn px-4 py-2 text-[12px]"
          >
            <Play className="w-3.5 h-3.5 text-brass-hi" />
            {reason === 'restart' ? '继续当前旅程' : '返回'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn px-4 py-2 text-[12px] !border-rust/60 !text-[#f0a69b] hover:!bg-rust/15"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rust" />
            {reason === 'restart' ? '清除并重开' : '覆盖并开始'}
          </button>
        </div>
      </div>
    </div>
  );
};
