import { createSignal, onCleanup } from 'solid-js'

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

type Dim = {
  vp: { w: number; h: number }
  min: { w: number; h: number }
  gap: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))

export const useViewport = () => {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [vp, setVp] = createSignal(read())
  const onResize = () => setVp(read())
  window.addEventListener('resize', onResize)
  onCleanup(() => window.removeEventListener('resize', onResize))
  return vp
}

export const defaultRect = (vp: { w: number; h: number }): Rect => {
  const w = 360
  const h = Math.min(480, vp.h - 32)
  return { w, h, x: vp.w - w - 16, y: vp.h - h - 16 }
}

/** Keep the rect fully on screen. */
export const clampRect = (r: Rect, dim: Dim): Rect => {
  const w = clamp(r.w, dim.min.w, dim.vp.w - dim.gap * 2)
  const h = clamp(r.h, dim.min.h, dim.vp.h - dim.gap * 2)
  return {
    w,
    h,
    x: clamp(r.x, dim.gap, dim.vp.w - w - dim.gap),
    y: clamp(r.y, dim.gap, dim.vp.h - h - dim.gap),
  }
}

/** Apply a drag delta; resizing keeps the opposite edges fixed. */
const resize = (mode: DragMode, r: Rect, dx: number, dy: number, dim: Dim): Rect => {
  if (mode === 'move') return { ...r, x: r.x + dx, y: r.y + dy }
  const h = clamp(r.h + dy, dim.min.h, dim.vp.h - r.y - dim.gap)
  if (mode === 'resize-br') return { ...r, h, w: clamp(r.w + dx, dim.min.w, dim.vp.w - r.x - dim.gap) }
  // bottom-left: the right edge stays put, so x moves with the width
  const right = r.x + r.w
  const w = clamp(r.w - dx, dim.min.w, right - dim.gap)
  return { ...r, h, w, x: right - w }
}

/**
 * Pointer-drag that moves or resizes `rect`. Updates go to `onDraft` while
 * dragging and `onCommit` once on release.
 */
export type DragMode = 'move' | 'resize-br' | 'resize-bl'

export const startDrag = (
  e: PointerEvent,
  p: {
    mode: DragMode
    rect: Rect
    onDraft: (r: Rect) => void
    onCommit: (r: Rect) => void
  } & Dim,
) => {
  if (e.button !== 0) return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const sx = e.clientX
  const sy = e.clientY
  let last = p.rect

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - sx
    const dy = ev.clientY - sy
    last = clampRect(resize(p.mode, p.rect, dx, dy, p), p)
    p.onDraft(last)
  }
  const end = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
    p.onCommit(last)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}
