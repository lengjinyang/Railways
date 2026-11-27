import type React from 'react';
import type { ResourceKey } from '../world';

/** Drag & drop between backpack, chest, scavenge container and the hotbar. */
export const DND_MIME = 'application/x-railways-item';

export type DragSource = 'backpack' | 'chest' | 'container' | 'hotbar';

export interface DragPayload {
  src: DragSource;
  idx: number;
  key?: ResourceKey;
}

export function startDrag(e: React.DragEvent, payload: DragPayload): void {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'move';
}

export function acceptsDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(DND_MIME);
}

export function readDrag(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DND_MIME);
    return raw ? (JSON.parse(raw) as DragPayload) : null;
  } catch {
    return null;
  }
}
