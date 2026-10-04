const DE = 'de-DE'

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(DE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function int(value: number | null | undefined): string {
  return num(value, 0)
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** Windows convention: 1024 steps, but the familiar KB/MB/GB labels. */
export function bytes(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '0 B'
  let n = Math.abs(value)
  let unit = 0
  while (n >= 1024 && unit < UNITS.length - 1) {
    n /= 1024
    unit++
  }
  const d = unit === 0 ? 0 : digits
  const sign = value < 0 ? '-' : ''
  return `${sign}${num(n, d)} ${UNITS[unit]}`
}

export function mb(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return bytes(value * 1024 * 1024, digits)
}

export function kb(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return bytes(value * 1024, digits)
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${num(value, digits)} %`
}

export function mhz(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${num(value, 0)} MHz`
}

export function mt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${num(value, 0)} MT/s`
}

export function celsius(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${num(value, 0)} °C`
}

export function watt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${num(value, 1)} W`
}

export function rate(bitsOrBytes: number | null | undefined, unit: 'bit' | 'byte' = 'byte'): string {
  if (bitsOrBytes === null || bitsOrBytes === undefined || !Number.isFinite(bitsOrBytes)) return '—'
  const base = unit === 'bit' ? 1000 : 1024
  const suffix = unit === 'bit' ? ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'] : ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let n = Math.abs(bitsOrBytes)
  let i = 0
  while (n >= base && i < suffix.length - 1) {
    n /= base
    i++
  }
  return `${num(n, n < 10 && i > 0 ? 1 : 0)} ${suffix[i]}`
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.floor(seconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std.`
  if (hours > 0) return `${hours} Std. ${mins} Min.`
  if (mins > 0) return `${mins} Min.`
  return `${s} Sek.`
}

export function date(value: string | number | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(DE, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dateTime(value: string | number | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(DE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function clock(value: number | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString(DE, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function yesNo(value: boolean | null | undefined, yes = 'Ja', no = 'Nein'): string {
  if (value === null || value === undefined) return '—'
  return value ? yes : no
}

export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}
