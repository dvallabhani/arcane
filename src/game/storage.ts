/*
 * Small conveniences remembered in this browser only (best score, mute).
 * Storage can be unavailable (private windows, blocked site data), so every
 * access is wrapped and the game works the same without it.
 */

export function loadNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    const value = raw === null ? NaN : Number(raw)
    return Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function saveNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // ignore: nothing important is lost
  }
}

export const KEYS = { best: 'arcane.best', muted: 'arcane.muted' }
