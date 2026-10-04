import { useSyncExternalStore } from 'react'
import type { PortOverride } from './ports.ts'

export type Theme = 'dark' | 'light'

export interface Settings {
  theme: Theme
  telemetry: boolean
  override: PortOverride
}

const KEY = 'inspekt.settings.v1'

const DEFAULTS: Settings = {
  theme: 'dark',
  telemetry: true,
  override: { m2: null, sata: null },
}

function read(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      telemetry: parsed.telemetry !== false,
      override: {
        m2: typeof parsed.override?.m2 === 'number' ? parsed.override.m2 : null,
        sata: typeof parsed.override?.sata === 'number' ? parsed.override.sata : null,
      },
    }
  } catch {
    return DEFAULTS
  }
}

let state: Settings = read()
const listeners = new Set<() => void>()

function emit(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage disabled — settings just will not persist */
  }
  for (const listener of listeners) listener()
}

export function getSettings(): Settings {
  return state
}

export function updateSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme !== 'light')
}
