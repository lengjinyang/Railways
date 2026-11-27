import React from 'react';
import { ITEM_META, type ResourceKey } from '../world';

/** Embossed coin-style token for an item: its glyph in its own colour on a dark disc. */
export const ItemGlyph: React.FC<{ itemKey: ResourceKey; size?: number; dim?: boolean }> = ({
  itemKey,
  size = 22,
  dim = false,
}) => {
  const meta = ITEM_META[itemKey];
  const gear = meta.category === 'gear';
  return (
    <span
      className={`shrink-0 flex items-center justify-center font-bold leading-none ${gear ? 'rounded-[5px]' : 'rounded-full'}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        color: meta.color,
        opacity: dim ? 0.4 : 1,
        background: `radial-gradient(circle at 50% 35%, ${meta.color}38, ${meta.color}0d 70%)`,
        boxShadow: `inset 0 0 0 1px ${meta.color}${gear ? '99' : '66'}, 0 0 10px -4px ${meta.color}`,
      }}
    >
      {meta.glyph}
    </span>
  );
};
