import { useEffect, type RefObject } from 'react'
import type { PointerInput } from './input'

/**
 * Mouse (and touch) mode. Writes the pointer position as NDC and the button
 * state as `grip` into the same PointerInput the webcam uses, so the game
 * logic can't tell the two apart.
 */
export function useMouseControls(enabled: boolean, elementRef: RefObject<HTMLElement | null>, input: PointerInput): void {
  useEffect(() => {
    const el = elementRef.current
    if (!enabled || !el) return

    const toNdc = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const ndc = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      }
      input.ndc = ndc
      return ndc
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      input.grip = true
      input.edges.push({ ndc: toNdc(event), grip: true })
      // Keep receiving moves even if the pointer leaves the canvas mid-drag.
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // Not every pointer can be captured (e.g. synthetic events); dragging still works.
      }
    }
    const onMove = (event: PointerEvent) => {
      toNdc(event)
    }
    const onUp = (event: PointerEvent) => {
      input.grip = false
      input.edges.push({ ndc: toNdc(event), grip: false })
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      if (event.pointerType === 'touch') input.ndc = null // a lifted finger leaves no cursor behind
    }
    const onLeave = (event: PointerEvent) => {
      if (!el.hasPointerCapture(event.pointerId)) input.ndc = null
    }
    const onCancel = () => {
      input.grip = false
      input.ndc = null
      input.edges.length = 0
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onCancel)
      onCancel()
    }
  }, [enabled, elementRef, input])
}
