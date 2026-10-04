#requires -Version 5.1
<#
    Inspekt - hardware snapshot collector (Windows PowerShell 5.1 / CIM + Storage cmdlets)

    Writes a single UTF-8 JSON document to stdout:

        {
          "schema": "inspekt/snapshot",
          "collectedAt": "2026-09-26T10:00:00Z",
          "sections": {
            "system": { "ok": true, "ms": 12, "data": { ... } },
            ...
          }
        }

    Every section is collected independently, so a failing query (usually
    "you need to be an administrator") only degrades that one section.

    Usage:
        powershell -NoProfile -ExecutionPolicy Bypass -File collect.ps1
        powershell -NoProfile -ExecutionPolicy Bypass -File collect.ps1 -Section memory,storage
#>
[CmdletBinding()]
param(
    [string[]]$Section = @()
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
    $script:utf8 = New-Object System.Text.UTF8Encoding($false)
    [Console]::OutputEncoding = $script:utf8
    $OutputEncoding = $script:utf8
} catch { }

$script:wanted = @()
foreach ($s in $Section) {
    foreach ($part in ($s -split ',')) {
        $p = $part.Trim().ToLowerInvariant()
        if ($p) { $script:wanted += $p }
    }
}

function Test-Wanted([string]$name) {
    if ($script:wanted.Count -eq 0) { return $true }
    return $script:wanted -contains $name
}

function New-Section([string]$name, [scriptblock]$body) {
    if (-not (Test-Wanted $name)) { return $null }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $data = & $body
        return @{ ok = $true; ms = [int]$sw.ElapsedMilliseconds; data = $data }
    } catch {
        return @{ ok = $false; ms = [int]$sw.ElapsedMilliseconds; error = $_.Exception.Message }
    }
}

function New-Skipped([string]$name) {
    return @{ ok = $false; ms = 0; error = 'Section not requested'; skipped = $true }
}

function FStr($v) {
    if ($null -eq $v) { return $null }
    $s = [string]$v
    $s = $s.Trim().Trim([char]0)
    if ($s.Length -eq 0) { return $null }
    return $s
}

function FInt($v) {
    if ($null -eq $v) { return $null }
    try { return [int]$v } catch { return $null }
}

function FInt64($v) {
    if ($null -eq $v) { return $null }
    try { return [int64]$v } catch { return $null }
}

function FFloat($v) {
    if ($null -eq $v) { return $null }
    try { return [double]$v } catch { return $null }
}

function FDate($v) {
    if ($null -eq $v) { return $null }
    if ($v -is [datetime]) {
        if ($v -eq [datetime]::MinValue) { return $null }
        return $v.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
    return FStr $v
}

function U16ToString($arr) {
    if ($null -eq $arr) { return $null }
    $chars = New-Object System.Collections.Generic.List[char]
    foreach ($n in @($arr)) {
        if ($null -eq $n) { break }
        $i = 0
        try { $i = [int]$n } catch { break }
        if ($i -eq 0) { break }
        if ($i -gt 0 -and $i -lt 65536) { $chars.Add([char]$i) }
    }
    if ($chars.Count -eq 0) { return $null }
    return -join $chars
}

# ===========================================================================
# system
# ===========================================================================
function Get-SystemData {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    $csp = Get-CimInstance -ClassName Win32_ComputerSystemProduct
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $bios = $null
    $bb = $null
    $enc = $null
    $reg = $null
    try { $bios = Get-CimInstance -ClassName Win32_BIOS } catch { }
    try { $bb = Get-CimInstance -ClassName Win32_BaseBoard } catch { }
    try { $enc = Get-CimInstance -ClassName Win32_SystemEnclosure } catch { }
    try { $reg = Get-ItemProperty -Path 'HKLM:\HARDWARE\DESCRIPTION\System\BIOS' } catch { }

    $boot = $null
    try { $boot = FDate $os.LastBootUpTime } catch { }
    $uptime = $null
    if ($os.LastBootUpTime) {
        $uptime = [int64]([datetime]::Now.ToUniversalTime() - $os.LastBootUpTime.ToUniversalTime()).TotalSeconds
        if ($uptime -lt 0) { $uptime = 0 }
    }

    $license = $null
    try {
        $lp = Get-CimInstance -ClassName SoftwareLicensingProduct -ErrorAction SilentlyContinue |
            Where-Object { $_.PartialProductKey -and $_.LicenseStatus -eq 1 } |
            Select-Object -First 1
        if ($lp) {
            $license = @{ name = FStr $lp.Name; partialKey = FStr $lp.PartialProductKey }
        }
    } catch { }

    $encTypes = @()
    if ($enc -and $enc.ChassisTypes) { $encTypes = @($enc.ChassisTypes | ForEach-Object { [int]$_ }) }

    return @{
        manufacturer   = FStr $cs.Manufacturer
        model          = FStr $cs.Model
        product        = FStr $reg.SystemProductName
        family         = FStr $reg.SystemFamily
        sku            = FStr $cs.SystemSKU
        systemType     = FStr $cs.SystemType
        pcSystemType   = FInt $cs.PCSystemType
        chassisTypes   = $encTypes
        chassisSerial  = FStr $enc.SerialNumber
        chassisMfr     = FStr $enc.Manufacturer
        hostname       = FStr $env:COMPUTERNAME
        user           = FStr $env:USERNAME
        domain         = FStr $cs.Domain
        totalMemory    = FInt64 $cs.TotalPhysicalMemory
        logicalCpus    = FInt $cs.NumberOfLogicalProcessors
        sockets        = FInt $cs.NumberOfProcessors
        primaryOwner   = FStr $cs.PrimaryOwnerName

        osCaption      = FStr $os.Caption
        osVersion      = FStr $os.Version
        osBuild        = FStr $os.BuildNumber
        osArchitecture = FStr $os.OSArchitecture
        osInstallDate  = FDate $os.InstallDate
        lastBoot       = $boot
        uptimeSec      = $uptime
        windowsDir     = FStr $os.WindowsDirectory
        serialNumber   = FStr $bios.SerialNumber
        uuid           = FStr $csp.UUID
        identifying    = FStr $csp.IdentifyingNumber
        productVersion = FStr $csp.Version

        biosVendor     = FStr $bios.Manufacturer
        biosVersion    = FStr $bios.SMBIOSBIOSVersion
        biosDate       = FDate $bios.ReleaseDate
        smbiosVersion  = FStr $bios.SMBIOSVersion

        boardMfr       = FStr $bb.Manufacturer
        boardProduct   = FStr $bb.Product
        boardVersion   = FStr $bb.Version
        boardSerial    = FStr $bb.SerialNumber

        firmwareType   = FStr $env:firmware_type
        license        = $license
    }
}

# ===========================================================================
# cpu
# ===========================================================================
function Get-CpuData {
    $cpus = @(Get-CimInstance -ClassName Win32_Processor)
    if ($cpus.Count -eq 0) { throw 'No processor information available' }
    $first = $cpus[0]

    $list = @()
    foreach ($c in $cpus) {
        $list += @{
            name             = FStr $c.Name
            manufacturer     = FStr $c.Manufacturer
            description      = FStr $c.Description
            socket           = FStr $c.SocketDesignation
            cores            = FInt $c.NumberOfCores
            threads          = FInt $c.NumberOfLogicalProcessors
            arch             = FStr $c.Architecture
            maxClockMHz      = FInt $c.MaxClockSpeed
            currentClockMHz  = FInt $c.CurrentClockSpeed
            loadPercent      = FInt $c.LoadPercentage
            l2CacheKB        = FInt $c.L2CacheSize
            l3CacheKB        = FInt $c.L3CacheSize
            stepping         = FStr $c.Stepping
            processorId      = FStr $c.ProcessorId
            revision         = FInt $c.Revision
            virtualization   = [bool]$c.VirtualizationFirmwareEnabled
            slat             = [bool]$c.SecondLevelAddressTranslationExtensions
            coresEnabled     = FInt $c.NumberOfEnabledCore
            cores189         = FInt $c.NumberOfCores189
            status           = FStr $c.Status
        }
    }

    return @{
        count     = $cpus.Count
        name      = FStr $first.Name
        cores     = FInt $first.NumberOfCores
        threads   = FInt $first.NumberOfLogicalProcessors
        items     = $list
    }
}

# ===========================================================================
# memory (RAM) - raw SMBIOS codes, labels are derived in the renderer
# ===========================================================================
function Get-MemoryData {
    $array = $null
    try { $array = Get-CimInstance -ClassName Win32_PhysicalMemoryArray | Select-Object -First 1 } catch { }
    $mods = @(Get-CimInstance -ClassName Win32_PhysicalMemory)
    $os = Get-CimInstance -ClassName Win32_OperatingSystem

    $slotsTotal = $null
    $maxCapacityKB = $null
    if ($array) {
        $slotsTotal = FInt $array.MemoryDevices
        $cap = FInt64 $array.MaxCapacityEx
        if (-not $cap -or $cap -le 0) { $cap = FInt64 $array.MaxCapacity }
        if ($cap -gt 0) { $maxCapacityKB = $cap }
    }

    $list = @()
    foreach ($m in $mods) {
        $list += @{
            locator        = FStr $m.DeviceLocator
            bank           = FStr $m.BankLabel
            tag            = FStr $m.Tag
            capacity       = FInt64 $m.Capacity
            speed          = FInt $m.Speed
            configuredSpeed= FInt $m.ConfiguredClockSpeed
            voltageMv      = FInt $m.ConfiguredVoltage
            minVoltageMv   = FInt $m.MinVoltage
            maxVoltageMv   = FInt $m.MaxVoltage
            smbiosType     = FInt $m.SMBIOSMemoryType
            memoryType     = FInt $m.MemoryType
            formFactor     = FInt $m.FormFactor
            typeDetail     = FInt $m.TypeDetail
            dataWidth      = FInt $m.DataWidth
            totalWidth     = FInt $m.TotalWidth
            manufacturer   = FStr $m.Manufacturer
            partNumber     = FStr $m.PartNumber
            serialNumber   = FStr $m.SerialNumber
            sku            = FStr $m.SKU
            replaceable    = if ($null -ne $m.Replaceable) { [bool]$m.Replaceable } else { $null }
            hotSwappable   = if ($null -ne $m.HotSwappable) { [bool]$m.HotSwappable } else { $null }
            interleave     = FInt $m.InterleavePosition
            positionInRow  = FInt $m.PositionInRow
            attributes     = FInt $m.Attributes
        }
    }

    $errCorr = $null
    $location = $null
    $use = $null
    if ($array) { $errCorr = FInt $array.MemoryErrorCorrection; $location = FInt $array.Location; $use = FInt $array.Use }

    return @{
        slotsTotal      = $slotsTotal
        slotsUsed       = $mods.Count
        maxCapacityKB   = $maxCapacityKB
        errorCorrection = $errCorr
        arrayLocation   = $location
        arrayUse        = $use
        totalVisibleKB  = FInt64 $os.TotalVisibleMemorySize
        freePhysicalKB  = FInt64 $os.FreePhysicalMemory
        modules         = $list
    }
}

# ===========================================================================
# storage
# ===========================================================================
function Get-StorageData {
    $disks = @()
    $physical = @()
    $partitions = @()
    $volumes = @()
    $logical = @()
    $enclosures = @()
    $controllers = @()
    $reliability = $null

    try { $disks = @(Get-Disk) } catch { }
    try { $physical = @(Get-PhysicalDisk) } catch { }
    try { $partitions = @(Get-Partition) } catch { }
    try { $volumes = @(Get-Volume) } catch { }
    try { $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk) } catch { }
    try { $enclosures = @(Get-StorageEnclosure -ErrorAction SilentlyContinue) } catch { }
    try { $controllers = @(Get-CimInstance -ClassName Win32_SCSIController) } catch { }
    try {
        $reliability = @($physical | Where-Object { $_ } | ForEach-Object {
                try { Get-StorageReliabilityCounter -PhysicalDisk $_ -ErrorAction Stop } catch { $null }
            })
        $reliability = @($reliability | Where-Object { $_ })
    } catch { $reliability = $null }

    $relById = @{}
    foreach ($r in $reliability) {
        try { $relById[[string]$r.DeviceId] = $r } catch { }
    }

    $physByNumber = @{}
    foreach ($p in $physical) { $physByNumber[[int]$p.DeviceId] = $p }

    $partsByDisk = @{}
    foreach ($pt in $partitions) {
        $n = [int]$pt.DiskNumber
        if (-not $partsByDisk.ContainsKey($n)) { $partsByDisk[$n] = @() }
        $partsByDisk[$n] += $pt
    }

    $volByLetter = @{}
    foreach ($v in $volumes) {
        if ($v.DriveLetter) { $volByLetter[[string]$v.DriveLetter] = $v }
    }

    $diskOut = @()
    foreach ($d in $disks) {
        $num = [int]$d.Number
        $p = $null
        if ($physByNumber.ContainsKey($num)) { $p = $physByNumber[$num] }

        $ptList = @()
        if ($partsByDisk.ContainsKey($num)) {
            foreach ($pt in $partsByDisk[$num]) {
                $vol = $null
                $letter = FStr $pt.DriveLetter
                if ($letter -and $volByLetter.ContainsKey($letter)) { $vol = $volByLetter[$letter] }
                $ptList += @{
                    number    = FInt $pt.PartitionNumber
                    type      = FStr $pt.Type
                    size      = FInt64 $pt.Size
                    offset    = FInt64 $pt.Offset
                    letter    = $letter
                    isActive  = if ($null -ne $pt.IsActive) { [bool]$pt.IsActive } else { $null }
                    isBoot    = if ($null -ne $pt.IsBoot) { [bool]$pt.IsBoot } else { $null }
                    isSystem  = if ($null -ne $pt.IsSystem) { [bool]$pt.IsSystem } else { $null }
                    isHidden  = if ($null -ne $pt.IsHidden) { [bool]$pt.IsHidden } else { $null }
                    isOffline = if ($null -ne $pt.IsOffline) { [bool]$pt.IsOffline } else { $null }
                    label     = if ($vol) { FStr $vol.FileSystemLabel } else { $null }
                    fs        = if ($vol) { FStr $vol.FileSystem } else { $null }
                    fsType    = if ($vol) { FStr $vol.FileSystemType } else { $null }
                    free      = if ($vol) { FInt64 $vol.SizeRemaining } else { $null }
                    health    = if ($vol) { FStr $vol.HealthStatus } else { $null }
                    driveType = if ($vol) { FStr $vol.DriveType } else { $null }
                }
            }
        }

        $rel = $null
        if ($p) {
            $key = [string]$p.DeviceId
            if ($relById.ContainsKey($key)) { $rel = $relById[$key] }
        }

        $relData = $null
        if ($rel) {
            $relData = @{
                temperature      = FInt $rel.Temperature
                temperatureMax   = FInt $rel.TemperatureMax
                wear             = FInt $rel.Wear
                powerOnHours     = FInt64 $rel.PowerOnHours
                startStopCycles  = FInt64 $rel.StartStopCycleCount
                readErrors       = FInt64 $rel.ReadErrorsTotal
                writeErrors      = FInt64 $rel.WriteErrorsTotal
                readUncorrected  = FInt64 $rel.ReadErrorsUncorrected
                writeUncorrected = FInt64 $rel.WriteErrorsUncorrected
            }
        }

        $diskOut += @{
            number        = $num
            model         = FStr $d.FriendlyName
            serial        = FStr $d.SerialNumber
            busType       = if ($p) { FStr $p.BusType } else { $null }
            mediaType     = if ($p) { FStr $p.MediaType } else { FStr $d.MediaType }
            size          = FInt64 $d.Size
            partitionStyle= FStr $d.PartitionStyle
            health        = FStr $d.HealthStatus
            status        = FStr $d.OperationalStatus
            usage         = if ($p) { FStr $p.Usage } else { $null }
            firmware      = FStr $d.FirmwareVersion
            isBoot        = if ($null -ne $d.IsBoot) { [bool]$d.IsBoot } else { $null }
            isSystem      = if ($null -ne $d.IsSystem) { [bool]$d.IsSystem } else { $null }
            isOffline     = if ($null -ne $d.IsOffline) { [bool]$d.IsOffline } else { $null }
            isReadOnly    = if ($null -ne $d.IsReadOnly) { [bool]$d.IsReadOnly } else { $null }
            uniqueId      = FStr $d.UniqueId
            partitions    = $ptList
            reliability   = $relData
        }
    }

    $wmiDisks = @()
    foreach ($dd in @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)) {
        $wmiDisks += @{
            index     = FInt $dd.Index
            model     = FStr $dd.Model
            interface = FStr $dd.InterfaceType
            media     = FStr $dd.MediaType
            size      = FInt64 $dd.Size
            serial    = FStr $dd.SerialNumber
            partitions= FInt $dd.Partitions
            pnpId     = FStr $dd.PNPDeviceID
            status    = FStr $dd.Status
            scsiBus   = FInt $dd.SCSIBus
            scsiPort  = FInt $dd.SCSIPort
            scsiTarget= FInt $dd.SCSITargetId
            scsiLun   = FInt $dd.SCSILogicalUnit
            revision  = FStr $dd.FirmwareRevision
        }
    }

    $ctrlOut = @()
    foreach ($c in $controllers) {
        $ctrlOut += @{
            name      = FStr $c.Name
            manufacturer = FStr $c.Manufacturer
            protocol  = FStr $c.ProtocolSupported
            status    = FStr $c.Status
            scsiBus   = FInt $c.SCSIBus
            maxSpeed  = FInt64 $c.MaxNumberedTargets
            pnpId     = FStr $c.PNPDeviceID
        }
    }

    $encOut = @()
    foreach ($e in $enclosures) {
        $encOut += @{
            name = FStr $e.Name
            model = FStr $e.Model
            serial = FStr $e.SerialNumber
            firmware = FStr $e.FirmwareVersion
            health = FStr $e.HealthStatus
            slotCount = FInt $e.SlotCount
            state = FStr $e.State
        }
    }

    $logOut = @()
    foreach ($l in $logical) {
        $logOut += @{
            letter = FStr $l.DeviceID
            label  = FStr $l.VolumeName
            fs     = FStr $l.FileSystem
            size   = FInt64 $l.Size
            free   = FInt64 $l.FreeSpace
            type   = FInt $l.DriveType
            status = FStr $l.Status
        }
    }

    return @{
        disks      = $diskOut
        wmiDisks   = $wmiDisks
        logical    = $logOut
        controllers= $ctrlOut
        enclosures = $encOut
        reliabilityAvailable = ($reliability.Count -gt 0)
    }
}

# ===========================================================================
# gpu
# ===========================================================================
function Get-GpuData {
    $vcs = @(Get-CimInstance -ClassName Win32_VideoController)

    $memMap = @{}
    $classRoot = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    try {
        foreach ($key in @(Get-ChildItem -Path $classRoot -ErrorAction SilentlyContinue)) {
            $props = $null
            try { $props = Get-ItemProperty -Path $key.PSPath -ErrorAction Stop } catch { continue }
            if (-not $props) { continue }
            $mdid = FStr $props.'MatchingDeviceId'
            if (-not $mdid) { continue }
            $bytes = $null
            if ($null -ne $props.'HardwareInformation.qwMemorySize') { $bytes = FInt64 $props.'HardwareInformation.qwMemorySize' }
            $memMap[$mdid.ToLowerInvariant()] = @{
                bytes        = $bytes
                memoryType   = FInt $props.'HardwareInformation.MemoryType'
                biosString   = FStr $props.'HardwareInformation.BiosString'
                dacType      = FStr $props.'HardwareInformation.DacType'
            }
        }
    } catch { }

    $list = @()
    foreach ($v in $vcs) {
        $pnp = FStr $v.PNPDeviceID
        $memInfo = $null
        if ($pnp -and $pnp -match '(?i)ven_[0-9a-f]+&dev_[0-9a-f]+') {
            $needle = $matches[0].ToLowerInvariant()
            foreach ($k in $memMap.Keys) {
                if ($k.Contains($needle)) { $memInfo = $memMap[$k]; break }
            }
        }

        $vram = $null
        if ($memInfo -and $memInfo.bytes) { $vram = $memInfo.bytes }
        elseif ($v.AdapterRAM) { $vram = FInt64 $v.AdapterRAM }

        $list += @{
            name        = FStr $v.Name
            processor   = FStr $v.VideoProcessor
            adapterRam  = $vram
            vramSource  = if ($vram -and $memInfo -and $memInfo.bytes) { 'registry' } elseif ($vram) { 'wmi32' } else { $null }
            driver      = FStr $v.DriverVersion
            driverDate  = FDate $v.DriverDate
            driverStore = FStr $v.DriverStoreVersion
            resolutionH = FInt $v.CurrentHorizontalResolution
            resolutionV = FInt $v.CurrentVerticalResolution
            refreshHz   = FInt $v.CurrentRefreshRate
            modeDesc    = FStr $v.VideoModeDescription
            status      = FStr $v.Status
            pnpId       = $pnp
            dacType     = if ($memInfo) { $memInfo.dacType } else { FStr $v.AdapterDACType }
            videoMemoryType = if ($memInfo) { $memInfo.memoryType } else { $null }
            installed   = FStr $v.InstalledDisplayDrivers
        }
    }

    return @{ adapters = $list }
}

# ===========================================================================
# monitors (EDID via root\wmi)
# ===========================================================================
function Get-MonitorData {
    $ids = @()
    $basic = @()
    $conn = @()
    try { $ids = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID) } catch { }
    try { $basic = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBasicDisplayParams) } catch { }
    try { $conn = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorConnectionParams) } catch { }

    $basicByInstance = @{}
    foreach ($b in $basic) { $basicByInstance[[string]$b.InstanceName] = $b }
    $connByInstance = @{}
    foreach ($c in $conn) { $connByInstance[[string]$c.InstanceName] = $c }

    $list = @()
    foreach ($i in $ids) {
        $inst = [string]$i.InstanceName
        $b = $null
        if ($basicByInstance.ContainsKey($inst)) { $b = $basicByInstance[$inst] }
        $c = $null
        if ($connByInstance.ContainsKey($inst)) { $c = $connByInstance[$inst] }

        $w = $null
        $h = $null
        if ($b) { $w = FInt $b.MaxHorizontalImageSize; $h = FInt $b.MaxVerticalImageSize }

        $diagonalIn = $null
        if ($w -and $h) {
            $cm = [math]::Sqrt([double]($w * $w) + [double]($h * $h))
            $diagonalIn = [math]::Round($cm / 2.54, 1)
        }

        $list += @{
            instance     = $inst
            manufacturer = U16ToString $i.ManufacturerName
            productCode  = U16ToString $i.ProductCodeID
            name         = U16ToString $i.UserFriendlyName
            serial       = U16ToString $i.SerialNumberID
            year         = FInt $i.YearOfManufacture
            week         = FInt $i.WeekOfManufacture
            userSerial   = FInt $i.UserSerialNumber
            active       = if ($b) { [bool]$b.Active } else { $null }
            widthCm      = $w
            heightCm     = $h
            diagonalIn   = $diagonalIn
            videoInput   = if ($b) { FInt $b.VideoInputType } else { $null }
            outputTech   = if ($c) { FInt64 $c.VideoOutputTechnology } else { $null }
            transferChar = if ($b) { FInt $b.DisplayTransferCharacteristic } else { $null }
        }
    }

    return @{ monitors = $list }
}

# ===========================================================================
# network
# ===========================================================================
function Get-NetworkData {
    $adapters = @()
    $ips = @()
    $gateways = @()
    $dns = @()

    try { $adapters = @(Get-NetAdapter -ErrorAction Stop) } catch { }
    try { $ips = @(Get-NetIPAddress -AddressFamily IPv4, IPv6 -ErrorAction SilentlyContinue) } catch { }
    try { $gateways = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0', '::/0' -ErrorAction SilentlyContinue) } catch { }
    try { $dns = @(Get-DnsClientServerAddress -ErrorAction SilentlyContinue) } catch { }

    $ipByIndex = @{}
    foreach ($i in $ips) {
        $idx = [int]$i.InterfaceIndex
        if (-not $ipByIndex.ContainsKey($idx)) { $ipByIndex[$idx] = @() }
        $ipByIndex[$idx] += @{
            address = FStr $i.IPAddress
            prefix  = FInt $i.PrefixLength
            family  = FStr $i.AddressFamily
            type    = FStr $i.PrefixOrigin
        }
    }

    $gwByIndex = @{}
    foreach ($g in $gateways) {
        $idx = [int]$g.InterfaceIndex
        if (-not $gwByIndex.ContainsKey($idx)) { $gwByIndex[$idx] = @() }
        $gwByIndex[$idx] += FStr $g.NextHop
    }

    $dnsByIndex = @{}
    foreach ($d in $dns) {
        $idx = [int]$d.InterfaceIndex
        if (-not $dnsByIndex.ContainsKey($idx)) { $dnsByIndex[$idx] = @() }
        foreach ($s in @($d.ServerAddresses)) { $dnsByIndex[$idx] += (FStr $s) }
    }

    $list = @()
    foreach ($a in $adapters) {
        $idx = [int]$a.ifIndex
        $myIps = @()
        if ($ipByIndex.ContainsKey($idx)) { $myIps = @($ipByIndex[$idx]) }
        $myGw = @()
        if ($gwByIndex.ContainsKey($idx)) { $myGw = @($gwByIndex[$idx]) }
        $myDns = @()
        if ($dnsByIndex.ContainsKey($idx)) { $myDns = @($dnsByIndex[$idx]) }

        $present = $true
        if ($a.Status -eq 'Not Present') { $present = $false }

        $list += @{
            name          = FStr $a.Name
            alias         = FStr $a.InterfaceAlias
            description   = FStr $a.InterfaceDescription
            ifIndex       = $idx
            status        = FStr $a.Status
            present       = $present
            linkSpeed     = FStr $a.LinkSpeed
            speedBps      = FInt64 $a.Speed
            receiveBps    = FInt64 $a.ReceiveLinkSpeed
            transmitBps   = FInt64 $a.TransmitLinkSpeed
            mac           = FStr $a.MacAddress
            permanentMac  = FStr $a.PermanentAddress
            mediaType     = FStr $a.MediaType
            physicalMedia = FStr $a.PhysicalMediaType
            virtual       = if ($null -ne $a.Virtual) { [bool]$a.Virtual } else { $null }
            hardware      = if ($null -ne $a.HardwareInterface) { [bool]$a.HardwareInterface } else { $null }
            connector     = if ($null -ne $a.ConnectorPresent) { [bool]$a.ConnectorPresent } else { $null }
            mtu           = FInt $a.ActiveMaximumTransmissionUnit
            driver        = FStr $a.DriverVersionString
            driverDate    = FDate $a.DriverDate
            pnpId         = FStr $a.PnPDeviceID
            fullDuplex    = if ($null -ne $a.FullDuplex) { [bool]$a.FullDuplex } else { $null }
            addresses     = $myIps
            gateways      = $myGw
            dnsServers    = $myDns
        }
    }

    return @{ adapters = $list }
}

# ===========================================================================
# devices (USB / PCI / everything present)
# ===========================================================================
function Get-DeviceData {
    $devices = @()
    try {
        $devices = @(Get-PnpDevice -PresentOnly -ErrorAction Stop)
    } catch {
        try { $devices = @(Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.Present -eq $true }) } catch { }
    }

    $list = @()
    foreach ($d in $devices) {
        $pnpId = FStr $d.PNPDeviceID
        $class = FStr $d.PNPClass
        if (-not $class) { $class = FStr $d.Class }
        if (-not $pnpId) { $pnpId = FStr $d.DeviceID }

        $bus = $null
        if ($pnpId) {
            $bus = ($pnpId -split '\\')[0]
        }

        $list += @{
            name    = FStr $d.FriendlyName
            class   = $class
            pnpId   = $pnpId
            bus     = $bus
            status  = FStr $d.Status
            problem = FInt $d.ConfigManagerErrorCode
            service = FStr $d.Service
            mfr     = FStr $d.Manufacturer
            present = if ($null -ne $d.Present) { [bool]$d.Present } else { $true }
        }
    }

    $byClass = @{}
    foreach ($d in $list) {
        $c = if ($d.class) { $d.class } else { 'Sonstige' }
        if (-not $byClass.ContainsKey($c)) { $byClass[$c] = 0 }
        $byClass[$c] = $byClass[$c] + 1
    }

    return @{ count = $list.Count; byClass = $byClass; items = $list }
}

# ===========================================================================
# battery
# ===========================================================================
function Get-BatteryData {
    $bats = @()
    try { $bats = @(Get-CimInstance -ClassName Win32_Battery) } catch { }
    if ($bats.Count -eq 0) { return @{ present = $false; batteries = @() } }

    $status = $null
    $fullCap = $null
    $cycle = $null
    try { $status = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object -First 1 } catch { }
    try { $fullCap = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1 } catch { }
    try { $cycle = Get-CimInstance -Namespace root/wmi -ClassName BatteryCycleCount | Select-Object -First 1 } catch { }

    $list = @()
    foreach ($b in $bats) {
        $designCap = $null
        if ($b.DesignCapacity -gt 0) { $designCap = [int64]$b.DesignCapacity }
        elseif ($status -and $status.DesignCapacity -gt 0) { $designCap = [int64]$status.DesignCapacity }

        $full = $null
        if ($fullCap -and $fullCap.FullChargedCapacity -gt 0) { $full = [int64]$fullCap.FullChargedCapacity }
        elseif ($b.FullChargeCapacity -gt 0) { $full = [int64]$b.FullChargeCapacity }

        $list += @{
            name        = FStr $b.Name
            caption     = FStr $b.Caption
            status      = FStr $b.Status
            statusCode  = FInt $b.BatteryStatus
            chargePercent = FInt $b.EstimatedChargeRemaining
            designCapacity = $designCap
            fullCapacity   = $full
            designVoltage  = FInt $b.DesignVoltage
            chemistry      = FInt $b.Chemistry
            estimatedRunTimeMin = FInt $b.EstimatedRunTime
            timeToFullMin  = FInt $b.TimeToFullCharge
            rechargeable   = if ($null -ne $b.BatteryRechargeable) { [bool]$b.BatteryRechargeable } else { $null }
        }
    }

    $st = $null
    if ($status) {
        $st = @{
            powerOnline     = [bool]$status.PowerOnline
            charging        = [bool]$status.Charging
            discharging     = [bool]$status.Discharging
            critical        = [bool]$status.Critical
            remainingMwh    = FInt64 $status.RemainingCapacity
            designMwh       = FInt64 $status.DesignCapacity
            chargeRateMw    = FInt $status.ChargeRate
            dischargeRateMw = FInt $status.DischargeRate
            voltageMv       = FInt $status.Voltage
            active          = if ($null -ne $status.Active) { [bool]$status.Active } else { $null }
        }
    }

    return @{
        present      = $true
        batteries    = $list
        state        = $st
        cycleCount   = if ($cycle) { FInt $cycle.CycleCount } else { $null }
    }
}

# ===========================================================================
# security (secure boot, TPM, VBS) - mostly needs elevation
# ===========================================================================
function Get-SecurityData {
    $secureBoot = $null
    $secureBootError = $null
    try { $secureBoot = [bool](Confirm-SecureBootUEFI) } catch { $secureBootError = $_.Exception.Message }

    if ($null -eq $secureBoot) {
        try {
            $sb = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' -Name UEFISecureBootEnabled -ErrorAction Stop
            $secureBoot = [int]$sb.UEFISecureBootEnabled -eq 1
            $secureBootError = $null
        } catch {
            if (-not $secureBootError) { $secureBootError = $_.Exception.Message }
        }
    }

    $tpm = $null
    $tpmError = $null
    try {
        $t = Get-Tpm -ErrorAction Stop
        $tpm = @{
            present      = [bool]$t.TpmPresent
            ready        = [bool]$t.TpmReady
            enabled      = [bool]$t.TpmEnabled
            activated    = [bool]$t.TpmActivated
            owned        = [bool]$t.TpmOwned
            lockedOut    = [bool]$t.LockedOut
            manufacturer = FStr $t.ManufacturerIdTxt
            specVersion  = FStr $t.SpecVersion
            ownerClear   = if ($null -ne $t.OwnerClearDisabled) { [bool]$t.OwnerClearDisabled } else { $null }
        }
    } catch { $tpmError = $_.Exception.Message }

    $vbs = $null
    try {
        $dg = Get-CimInstance -Namespace root/Microsoft/Windows/DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop
        $run = 0
        if ($dg.SecurityServicesRunning) { $run = [int]@($dg.SecurityServicesRunning)[0] }
        $cfg = 0
        if ($dg.SecurityServicesConfigured) { $cfg = [int]@($dg.SecurityServicesConfigured)[0] }
        $vbs = @{
            vbsStatus   = FInt $dg.VirtualizationBasedSecurityStatus
            credentialGuard = [bool](($run -band 1) -ne 0)
            hvci        = [bool](($run -band 2) -ne 0)
            configured  = $cfg
            running     = $run
        }
    } catch { $vbs = $null }

    $bootMode = $null
    try { $bootMode = FStr $env:firmware_type } catch { }

    return @{
        secureBoot      = $secureBoot
        secureBootError = $secureBootError
        tpm             = $tpm
        tpmError        = $tpmError
        deviceGuard     = $vbs
        bootMode        = $bootMode
    }
}

# ===========================================================================
# sensors (temperature / load probes) - most need elevation
# ===========================================================================
function Get-SensorsData {
    $thermal = @()
    $thermalError = $null
    try {
        $t = @(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop)
        foreach ($z in $t) {
            $dec = $null
            if ($null -ne $z.CurrentTemperature) {
                $dec = [math]::Round(([double]$z.CurrentTemperature / 10.0) - 273.15, 1)
            }
            $thermal += @{ instance = FStr $z.InstanceName; celsius = $dec }
        }
    } catch { $thermalError = $_.Exception.Message }

    $procLoad = $null
    try { $procLoad = FInt (Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1).LoadPercentage } catch { }

    $os = $null
    try { $os = Get-CimInstance -ClassName Win32_OperatingSystem } catch { }

    $memAvail = $null
    $memTotal = $null
    if ($os) {
        $memTotal = [math]::Round([double]$os.TotalVisibleMemorySize / 1024, 1)
        $memAvail = [math]::Round([double]$os.FreePhysicalMemory / 1024, 1)
    }

    $uptime = $null
    try {
        $boot = (Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime
        if ($boot) { $uptime = [int64]([datetime]::Now.ToUniversalTime() - $boot.ToUniversalTime()).TotalSeconds }
    } catch { }

    $diskLoad = $null
    try {
        $p = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction Stop |
            Where-Object { $_.Name -eq '_Total' } | Select-Object -First 1
        if ($p) {
            $diskLoad = @{
                percent    = FInt $p.PercentDiskTime
                queue      = FInt $p.CurrentDiskQueueLength
                readQueue  = FInt $p.CurrentDiskReadQueueLength
                writeQueue = FInt $p.CurrentDiskWriteQueueLength
            }
        }
    } catch { }

    $netRate = $null
    try {
        $ifs = @(Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction Stop)
        $rx = [int64]0
        $tx = [int64]0
        foreach ($n in $ifs) {
            if ($n.Name -and $n.Name -like '*Loopback*') { continue }
            $rx += [int64]$n.BytesReceivedPersec
            $tx += [int64]$n.BytesSentPersec
        }
        $netRate = @{ rxBps = $rx; txBps = $tx }
    } catch { }

    return @{
        cpuLoadPercent = $procLoad
        memoryTotalMB   = $memTotal
        memoryFreeMB    = $memAvail
        uptimeSec       = $uptime
        thermalZones    = $thermal
        thermalError    = $thermalError
        disk            = $diskLoad
        network         = $netRate
        elevated        = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
}

# ===========================================================================
# collect
# ===========================================================================
$sections = [ordered]@{}

$map = @{
    system   = ${function:Get-SystemData}
    cpu      = ${function:Get-CpuData}
    memory   = ${function:Get-MemoryData}
    storage  = ${function:Get-StorageData}
    gpu      = ${function:Get-GpuData}
    monitors = ${function:Get-MonitorData}
    network  = ${function:Get-NetworkData}
    devices  = ${function:Get-DeviceData}
    battery  = ${function:Get-BatteryData}
    security = ${function:Get-SecurityData}
    sensors  = ${function:Get-SensorsData}
}

foreach ($name in $map.Keys) {
    if (Test-Wanted $name) {
        $sections[$name] = New-Section $name $map[$name]
    }
}

$elevated = $false
try {
    $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch { }

$totalSw = 0
foreach ($k in $sections.Keys) { if ($sections[$k] -and $sections[$k].ms) { $totalSw += [int]$sections[$k].ms } }

$result = [ordered]@{
    schema       = 'inspekt/snapshot'
    collectedAt  = [datetime]::Now.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    elevated     = $elevated
    psVersion    = $PSVersionTable.PSVersion.ToString()
    totalMs      = $totalSw
    sections     = $sections
}

$json = $result | ConvertTo-Json -Depth 12 -Compress
Write-Output $json
