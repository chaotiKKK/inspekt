#requires -Version 5.1
<#
    Inspekt - persistent telemetry stream.

    Starts once, keeps the WMI repository warm and writes one JSON object
    per line to stdout (UTF-8, no BOM). Everything else (nvidia-smi) is
    collected by the Electron main process, this file only does WMI.

    { "type":"ready" }
    { "at":..., "cpuLoadPercent":..., "memoryFreeMB":..., "disk":{...}, "network":{...} }
#>
[CmdletBinding()]
param(
    [int]$IntervalMs = 250,
    [int]$DiskEvery = 2,
    [int]$NetEvery = 2
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

try {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [Console]::OutputEncoding = $enc
    $OutputEncoding = $enc
} catch { }

$stream = [Console]::OpenStandardOutput()
$writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
$writer.AutoFlush = $true

$writer.WriteLine('{"type":"ready"}')

$tick = 0
$disk = $null
$net = $null
$elevated = $false
try {
    $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch { }

while ($true) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $cpu = $null
    $memFree = $null
    $memTotal = $null
    $err = $null

    try {
        $p = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1
        if ($p) { $cpu = $p.LoadPercentage }
    } catch { $err = $_.Exception.Message }

    try {
        $o = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        $memTotal = [math]::Round([double]$o.TotalVisibleMemorySize / 1024, 1)
        $memFree = [math]::Round([double]$o.FreePhysicalMemory / 1024, 1)
    } catch { }

    if (($tick % $DiskEvery) -eq 0) {
        $disk = $null
        try {
            $d = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction Stop |
                Where-Object { $_.Name -eq '_Total' } | Select-Object -First 1
            if ($d) {
                $disk = @{
                    percent    = $d.PercentDiskTime
                    queue      = $d.CurrentDiskQueueLength
                    readQueue  = $d.CurrentDiskReadQueueLength
                    writeQueue = $d.CurrentDiskWriteQueueLength
                }
            }
        } catch { }
    }

    if (($tick % $NetEvery) -eq 0) {
        $net = $null
        try {
            $ifs = @(Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction Stop)
            $rx = [int64]0
            $tx = [int64]0
            foreach ($i in $ifs) {
                if ($i.Name -and $i.Name -like '*Loopback*') { continue }
                $rx += [int64]$i.BytesReceivedPersec
                $tx += [int64]$i.BytesSentPersec
            }
            $net = @{ rxBps = $rx; txBps = $tx }
        } catch { }
    }

    $payload = @{
        type           = 'tick'
        at             = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        tick           = $tick
        cpuLoadPercent = $cpu
        memoryFreeMB   = $memFree
        memoryTotalMB  = $memTotal
        disk           = $disk
        network        = $net
        elevated       = $elevated
        error          = $err
        elapsedMs      = [int]$sw.ElapsedMilliseconds
    }

    try {
        $writer.WriteLine(($payload | ConvertTo-Json -Depth 5 -Compress))
    } catch {
        # stdout gone (parent exited) - stop streaming
        break
    }

    $sw.Stop()
    $sleep = $IntervalMs
    if ($sw.ElapsedMilliseconds -gt $IntervalMs) { $sleep = 0 }
    if ($sleep -gt 0) { Start-Sleep -Milliseconds $sleep }
    $tick++
}
