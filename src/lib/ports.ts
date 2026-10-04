import { isLaptop } from './labels.ts'
import type { MemoryData, StorageData, SystemData } from '../../shared/schema.ts'

export type PortKind = 'dimm' | 'm2' | 'sata'

export interface PortSlot {
  designator: string
  kind: PortKind
  occupiedBy: string | null
  occupied: boolean
  estimated: boolean
  detail?: string | null
}

export interface PortCounts {
  total: number
  used: number
  free: number
}

export interface PortReport {
  slots: PortSlot[]
  dimm: PortCounts
  m2: PortCounts
  sata: PortCounts
  basis: 'manual' | 'chassis' | 'unknown'
  note: string
}

export interface PortOverride {
  m2: number | null
  sata: number | null
}

const GAMING = /(omen|victus|legion|rog|strix|alienware|predator|nitro|tuf|razer|msi|ge\d|hp gaming|acer nitro)/i

function counts(total: number, used: number): PortCounts {
  return { total, used, free: Math.max(0, total - used) }
}

function estimate(
  system: SystemData | null | undefined,
  storage: StorageData | null | undefined,
): { m2: number; sata: number; basis: PortReport['basis']; note: string } {
  const disks = storage?.disks ?? []
  const m2Used = disks.filter((d) => /nvme|nvm express/i.test(d.busType ?? '')).length
  const sataUsed = disks.filter((d) => /^(sata|ata|sas)/i.test(d.busType ?? '')).length

  const model = [system?.manufacturer, system?.model, system?.product].filter(Boolean).join(' ')
  const laptop = isLaptop(system?.chassisTypes, system?.pcSystemType)
  const gaming = GAMING.test(model)

  if (laptop) {
    const m2 = gaming ? Math.max(2, m2Used) : Math.max(1, m2Used)
    const sata = sataUsed > 0 ? sataUsed : 0
    return {
      m2,
      sata,
      basis: 'chassis',
      note: gaming
        ? 'Chassistyp Notebook, Gaming-Modell erkannt: 2× M.2 geschätzt. Windows meldet keine Anschlusszahl.'
        : 'Chassistyp Notebook: 1× M.2 geschätzt. Windows meldet keine Anschlusszahl.',
    }
  }

  const tower = /tower|desktop/i.test(system?.chassisTypes?.join(',') ?? '')
  const m2 = tower ? 2 : 1
  const sata = tower ? 6 : 4
  return {
    m2: Math.max(m2, m2Used),
    sata: Math.max(sata, sataUsed),
    basis: 'chassis',
    note: `Chassistyp ${tower ? 'Desktop/Tower' : 'Desktop'}: ${tower ? '2× M.2 und 6× SATA' : '1× M.2 und 4× SATA'} geschätzt. Windows meldet keine Anschlusszahl.`,
  }
}

/**
 * Storage port counts are not exposed by any Windows API. Used ports are an
 * exact read from the disk list; totals come from a chassis heuristic or from
 * the user's own override in the settings.
 */
export function buildPortReport(
  system: SystemData | null | undefined,
  storage: StorageData | null | undefined,
  memory: MemoryData | null | undefined,
  override: PortOverride | null | undefined,
): PortReport {
  const disks = storage?.disks ?? []
  const m2Disks = disks.filter((d) => /nvme|nvm express/i.test(d.busType ?? ''))
  const sataDisks = disks.filter((d) => /^(sata|ata|sas)/i.test(d.busType ?? ''))

  const guessed = estimate(system, storage)
  const hasOverride = Boolean(override && (override.m2 !== null || override.sata !== null))
  const m2Total = override?.m2 ?? guessed.m2
  const sataTotal = override?.sata ?? guessed.sata

  const slots: PortSlot[] = []

  const slotCount = memory?.slotsTotal ?? 0
  const modules = memory?.modules ?? []
  for (let i = 0; i < slotCount; i++) {
    const module = modules[i] ?? null
    slots.push({
      designator: `DIMM_${i + 1}`,
      kind: 'dimm',
      occupied: Boolean(module),
      occupiedBy: module ? `${module.capacity ? Math.round(module.capacity / 1024 ** 3) : '?'} GB · ${module.partNumber ?? module.manufacturer ?? 'Modul'}` : null,
      estimated: false,
      detail: module?.locator ?? null,
    })
  }

  for (let i = 0; i < m2Total; i++) {
    const disk = m2Disks[i] ?? null
    slots.push({
      designator: `M2_${i + 1}`,
      kind: 'm2',
      occupied: Boolean(disk),
      occupiedBy: disk ? `${disk.model ?? 'SSD'} · ${disk.busType ?? 'NVMe'}` : null,
      estimated: !hasOverride,
      detail: disk?.serial ?? null,
    })
  }

  for (let i = 0; i < sataTotal; i++) {
    const disk = sataDisks[i] ?? null
    slots.push({
      designator: `SATA${i + 1}`,
      kind: 'sata',
      occupied: Boolean(disk),
      occupiedBy: disk ? `${disk.model ?? 'Laufwerk'} · ${disk.mediaType ?? disk.busType ?? ''}` : null,
      estimated: !hasOverride,
      detail: disk?.serial ?? null,
    })
  }

  const m2Used = m2Disks.length
  const sataUsed = sataDisks.length

  return {
    slots,
    dimm: counts(slotCount, modules.filter(Boolean).length),
    m2: counts(m2Total, m2Used),
    sata: counts(sataTotal, sataUsed),
    basis: hasOverride ? 'manual' : guessed.basis,
    note: hasOverride ? 'Anschlusszahl aus den Einstellungen übernommen.' : guessed.note,
  }
}

export function freeStorageSlots(report: PortReport): number {
  return report.m2.free + report.sata.free
}
