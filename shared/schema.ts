import { z } from 'zod'

/**
 * Runtime contract between the PowerShell collector and the renderer.
 *
 * Every field is nullable because Windows happily reports "not available"
 * for a large part of the SMBIOS/WMI surface depending on vendor, driver
 * and elevation level. The renderer must degrade gracefully, never guess.
 */

const s = z.string().nullish()
const n = z.number().nullish()
const b = z.boolean().nullish()
const arr = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish()

const section = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    ok: z.boolean(),
    ms: n,
    error: s,
    skipped: z.boolean().nullish(),
    data: data.nullish(),
  })

// ---------------------------------------------------------------------------
// system
// ---------------------------------------------------------------------------
export const LicenseSchema = z.object({
  name: s,
  partialKey: s,
})

export const SystemDataSchema = z.object({
  manufacturer: s,
  model: z.string().nullish(),
  product: s,
  family: s,
  sku: s,
  systemType: s,
  pcSystemType: n,
  chassisTypes: arr(z.number()),
  chassisSerial: s,
  chassisMfr: s,
  hostname: s,
  user: s,
  domain: s,
  totalMemory: n,
  logicalCpus: n,
  sockets: n,
  primaryOwner: s,
  osCaption: s,
  osVersion: s,
  osBuild: s,
  osArchitecture: s,
  osInstallDate: s,
  lastBoot: s,
  uptimeSec: n,
  windowsDir: s,
  serialNumber: s,
  uuid: s,
  identifying: s,
  productVersion: s,
  biosVendor: s,
  biosVersion: s,
  biosDate: s,
  smbiosVersion: s,
  boardMfr: s,
  boardProduct: s,
  boardVersion: s,
  boardSerial: s,
  firmwareType: s,
  license: LicenseSchema.nullish(),
})

// ---------------------------------------------------------------------------
// cpu
// ---------------------------------------------------------------------------
export const CpuItemSchema = z.object({
  name: s,
  manufacturer: s,
  description: s,
  socket: s,
  cores: n,
  threads: n,
  arch: s,
  maxClockMHz: n,
  currentClockMHz: n,
  loadPercent: n,
  l2CacheKB: n,
  l3CacheKB: n,
  stepping: s,
  processorId: s,
  revision: n,
  virtualization: b,
  slat: b,
  coresEnabled: n,
  cores189: n,
  status: s,
})

export const CpuDataSchema = z.object({
  count: n,
  name: s,
  cores: n,
  threads: n,
  items: arr(CpuItemSchema),
})

// ---------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------
export const MemoryModuleSchema = z.object({
  locator: s,
  bank: s,
  tag: s,
  capacity: n,
  speed: n,
  configuredSpeed: n,
  voltageMv: n,
  minVoltageMv: n,
  maxVoltageMv: n,
  smbiosType: n,
  memoryType: n,
  formFactor: n,
  typeDetail: n,
  dataWidth: n,
  totalWidth: n,
  manufacturer: s,
  partNumber: s,
  serialNumber: s,
  sku: s,
  replaceable: b,
  hotSwappable: b,
  interleave: n,
  positionInRow: n,
  attributes: n,
})

export const MemoryDataSchema = z.object({
  slotsTotal: n,
  slotsUsed: n,
  maxCapacityKB: n,
  errorCorrection: n,
  arrayLocation: n,
  arrayUse: n,
  totalVisibleKB: n,
  freePhysicalKB: n,
  modules: arr(MemoryModuleSchema),
})

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------
export const PartitionSchema = z.object({
  number: n,
  type: s,
  size: n,
  offset: n,
  letter: s,
  isActive: b,
  isBoot: b,
  isSystem: b,
  isHidden: b,
  isOffline: b,
  label: s,
  fs: s,
  fsType: s,
  free: n,
  health: s,
  driveType: s,
})

export const ReliabilitySchema = z.object({
  temperature: n,
  temperatureMax: n,
  wear: n,
  powerOnHours: n,
  startStopCycles: n,
  readErrors: n,
  writeErrors: n,
  readUncorrected: n,
  writeUncorrected: n,
})

export const DiskSchema = z.object({
  number: n,
  model: s,
  serial: s,
  busType: s,
  mediaType: s,
  size: n,
  partitionStyle: s,
  health: s,
  status: s,
  usage: s,
  firmware: s,
  isBoot: b,
  isSystem: b,
  isOffline: b,
  isReadOnly: b,
  uniqueId: s,
  partitions: arr(PartitionSchema),
  reliability: ReliabilitySchema.nullish(),
})

export const WmiDiskSchema = z.object({
  index: n,
  model: s,
  interface: s,
  media: s,
  size: n,
  serial: s,
  partitions: n,
  pnpId: s,
  status: s,
  scsiBus: n,
  scsiPort: n,
  scsiTarget: n,
  scsiLun: n,
  revision: s,
})

export const LogicalDiskSchema = z.object({
  letter: s,
  label: s,
  fs: s,
  size: n,
  free: n,
  type: n,
  status: s,
})

export const ControllerSchema = z.object({
  name: s,
  manufacturer: s,
  protocol: s,
  status: s,
  scsiBus: n,
  maxSpeed: n,
  pnpId: s,
})

export const EnclosureSchema = z.object({
  name: s,
  model: s,
  serial: s,
  firmware: s,
  health: s,
  slotCount: n,
  state: s,
})

export const StorageDataSchema = z.object({
  disks: arr(DiskSchema),
  wmiDisks: arr(WmiDiskSchema),
  logical: arr(LogicalDiskSchema),
  controllers: arr(ControllerSchema),
  enclosures: arr(EnclosureSchema),
  reliabilityAvailable: b,
})

// ---------------------------------------------------------------------------
// gpu
// ---------------------------------------------------------------------------
export const NvidiaGpuSchema = z.object({
  index: z.number(),
  name: z.string(),
  uuid: s,
  tempC: n,
  utilPct: n,
  memUtilPct: n,
  memUsedMb: n,
  memTotalMb: n,
  clockSmMhz: n,
  clockMaxSmMhz: n,
  clockMemMhz: n,
  fanPct: n,
  powerW: n,
  powerLimitW: n,
  driverVersion: s,
})

export const GpuAdapterSchema = z.object({
  name: s,
  processor: s,
  adapterRam: n,
  vramSource: s,
  driver: s,
  driverDate: s,
  driverStore: s,
  resolutionH: n,
  resolutionV: n,
  refreshHz: n,
  modeDesc: s,
  status: s,
  pnpId: s,
  dacType: s,
  videoMemoryType: n,
  installed: s,
})

export const GpuDataSchema = z.object({
  adapters: arr(GpuAdapterSchema),
  nvidia: NvidiaGpuSchema.nullish(),
  nvidiaError: s,
})

// ---------------------------------------------------------------------------
// monitors
// ---------------------------------------------------------------------------
export const MonitorSchema = z.object({
  instance: s,
  manufacturer: s,
  productCode: s,
  name: s,
  serial: s,
  year: n,
  week: n,
  userSerial: n,
  active: b,
  widthCm: n,
  heightCm: n,
  diagonalIn: n,
  videoInput: n,
  outputTech: n,
  transferChar: n,
})

export const MonitorDataSchema = z.object({
  monitors: arr(MonitorSchema),
})

// ---------------------------------------------------------------------------
// network
// ---------------------------------------------------------------------------
export const IpAddressSchema = z.object({
  address: s,
  prefix: n,
  family: s,
  type: s,
})

export const NetAdapterSchema = z.object({
  name: s,
  alias: s,
  description: s,
  ifIndex: n,
  status: s,
  present: b,
  linkSpeed: s,
  speedBps: n,
  receiveBps: n,
  transmitBps: n,
  mac: s,
  permanentMac: s,
  mediaType: s,
  physicalMedia: s,
  virtual: b,
  hardware: b,
  connector: b,
  mtu: n,
  driver: s,
  driverDate: s,
  pnpId: s,
  fullDuplex: b,
  addresses: arr(IpAddressSchema),
  gateways: arr(z.string()),
  dnsServers: arr(z.string()),
})

export const NetworkDataSchema = z.object({
  adapters: arr(NetAdapterSchema),
})

// ---------------------------------------------------------------------------
// devices
// ---------------------------------------------------------------------------
export const DeviceSchema = z.object({
  name: s,
  class: s,
  pnpId: s,
  bus: s,
  status: s,
  problem: n,
  service: s,
  mfr: s,
  present: b,
})

export const DeviceDataSchema = z.object({
  count: n,
  byClass: z.record(z.string(), z.number()).nullish(),
  items: arr(DeviceSchema),
})

// ---------------------------------------------------------------------------
// battery
// ---------------------------------------------------------------------------
export const BatterySchema = z.object({
  name: s,
  caption: s,
  status: s,
  statusCode: n,
  chargePercent: n,
  designCapacity: n,
  fullCapacity: n,
  designVoltage: n,
  chemistry: n,
  estimatedRunTimeMin: n,
  timeToFullMin: n,
  rechargeable: b,
})

export const BatteryStateSchema = z.object({
  powerOnline: b,
  charging: b,
  discharging: b,
  critical: b,
  remainingMwh: n,
  designMwh: n,
  chargeRateMw: n,
  dischargeRateMw: n,
  voltageMv: n,
  active: b,
})

export const BatteryDataSchema = z.object({
  present: b,
  batteries: arr(BatterySchema),
  state: BatteryStateSchema.nullish(),
  cycleCount: n,
})

// ---------------------------------------------------------------------------
// security
// ---------------------------------------------------------------------------
export const TpmSchema = z.object({
  present: b,
  ready: b,
  enabled: b,
  activated: b,
  owned: b,
  lockedOut: b,
  manufacturer: s,
  specVersion: s,
  ownerClear: b,
})

export const DeviceGuardSchema = z.object({
  vbsStatus: n,
  credentialGuard: b,
  hvci: b,
  configured: n,
  running: n,
})

export const SecurityDataSchema = z.object({
  secureBoot: b,
  secureBootError: s,
  tpm: TpmSchema.nullish(),
  tpmError: s,
  deviceGuard: DeviceGuardSchema.nullish(),
  bootMode: s,
})

// ---------------------------------------------------------------------------
// sensors
// ---------------------------------------------------------------------------
export const ThermalZoneSchema = z.object({
  instance: s,
  celsius: n,
})

export const DiskLoadSchema = z.object({
  percent: n,
  queue: n,
  readQueue: n,
  writeQueue: n,
})

export const NetRateSchema = z.object({
  rxBps: n,
  txBps: n,
})

export const SensorsDataSchema = z.object({
  cpuLoadPercent: n,
  memoryTotalMB: n,
  memoryFreeMB: n,
  uptimeSec: n,
  thermalZones: arr(ThermalZoneSchema),
  thermalError: s,
  disk: DiskLoadSchema.nullish(),
  network: NetRateSchema.nullish(),
  elevated: b,
})

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------
export const SnapshotSchema = z.object({
  schema: z.string(),
  collectedAt: z.string(),
  elevated: b,
  psVersion: s,
  totalMs: n,
  sections: z.object({
    system: section(SystemDataSchema),
    cpu: section(CpuDataSchema),
    memory: section(MemoryDataSchema),
    storage: section(StorageDataSchema),
    gpu: section(GpuDataSchema),
    monitors: section(MonitorDataSchema),
    network: section(NetworkDataSchema),
    devices: section(DeviceDataSchema),
    battery: section(BatteryDataSchema),
    security: section(SecurityDataSchema),
    sensors: section(SensorsDataSchema),
  }),
})

export type Snapshot = z.infer<typeof SnapshotSchema>
export type SystemData = z.infer<typeof SystemDataSchema>
export type CpuData = z.infer<typeof CpuDataSchema>
export type CpuItem = z.infer<typeof CpuItemSchema>
export type MemoryData = z.infer<typeof MemoryDataSchema>
export type MemoryModule = z.infer<typeof MemoryModuleSchema>
export type StorageData = z.infer<typeof StorageDataSchema>
export type Disk = z.infer<typeof DiskSchema>
export type Partition = z.infer<typeof PartitionSchema>
export type Reliability = z.infer<typeof ReliabilitySchema>
export type WmiDisk = z.infer<typeof WmiDiskSchema>
export type GpuData = z.infer<typeof GpuDataSchema>
export type GpuAdapter = z.infer<typeof GpuAdapterSchema>
export type NvidiaGpu = z.infer<typeof NvidiaGpuSchema>
export type MonitorInfo = z.infer<typeof MonitorSchema>
export type MonitorData = z.infer<typeof MonitorDataSchema>
export type NetAdapter = z.infer<typeof NetAdapterSchema>
export type NetworkData = z.infer<typeof NetworkDataSchema>
export type DeviceInfo = z.infer<typeof DeviceSchema>
export type DeviceData = z.infer<typeof DeviceDataSchema>
export type BatteryData = z.infer<typeof BatteryDataSchema>
export type SecurityData = z.infer<typeof SecurityDataSchema>
export type SensorsData = z.infer<typeof SensorsDataSchema>
export type SectionOf<T> = {
  ok: boolean
  ms?: number | null
  error?: string | null
  skipped?: boolean | null
  data?: T | null
}

// ---------------------------------------------------------------------------
// live telemetry (poll every ~1.5s)
// ---------------------------------------------------------------------------
export const TelemetrySchema = z.object({
  at: z.number(),
  cpuLoadPercent: n,
  memoryFreeMB: n,
  memoryTotalMB: n,
  diskPercent: n,
  diskQueue: n,
  rxBps: n,
  txBps: n,
  gpuTempC: n,
  gpuUtilPct: n,
  gpuMemUsedMb: n,
  gpuMemTotalMb: n,
  gpuPowerW: n,
  gpuFanPct: n,
})

export type Telemetry = z.infer<typeof TelemetrySchema>
