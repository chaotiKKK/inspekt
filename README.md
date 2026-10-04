# Inspekt

Hardware-Inventar für Windows: eine portable Desktop-Anwendung, die alle
Komponenten eines Rechners ausliest, freie RAM-Slots und Anschlüsse darstellt
und die Rechenkraft mit echten Messwerten zeigt.

Alles läuft lokal. Die App sendet keine Daten nach außen, ruft keine
Webdienste ab und lädt nichts nach.

![Electron](https://img.shields.io/badge/Electron-44-47848F) ![Vite](https://img.shields.io/badge/Vite-8-646CFF) ![React](https://img.shields.io/badge/React-19-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)

## Inhalt

- [Funktionen](#funktionen)
- [Rechenkraft](#rechenkraft)
- [Installation](#installation)
- [Skripte](#skripte)
- [Wie die Daten ausgelesen werden](#wie-die-daten-ausgelesen-werden)
- [Projektstruktur](#projektstruktur)
- [Datenschutz](#datenschutz)

## Funktionen

13 Bereiche, jeweils mit eigener Kennung wie auf einer Platine (SYS, DIMM,
STG, CPU, GPU, FLO, MB, LCD, NIC, PNP, BAT, TMP, EXP):

| Seite | Inhalt |
| --- | --- |
| Übersicht | System, Belegung als PCB-Schema, Live-Werte |
| Arbeitsspeicher | DIMM-Belegung, SlotMap, Module im Detail,ECC-Profil |
| Speicher | Laufwerke, Partitionen, Volumen, SMART-Werte, Controller |
| Prozessor | Kerne, Threads, Caches, Auslastung |
| Grafik | Adapter, `nvidia-smi`-Livewerte, VRAM, Auflösung |
| **Rechenkraft** | **Messsuite und Vergleich mit 34 historischen Rechnern** |
| Mainboard & BIOS | BIOS, TPM, Secure Boot, Slots |
| Monitore | EDID-Daten, Diagonale, Fertigungsjahr |
| Netzwerk | Adapter, IPs, Link-Geschwindigkeit, Live-Durchsatz |
| Geräte | Win32_PnPEntity, Fehlerfilter, Verteilung nach Klasse |
| Akku | Ladung, Kapazität, Zyklen, Lade-/Entladestrom |
| Sensoren | Temperaturen, Last, Speicher, Netzwerk, Live-Verlauf |
| System & Export | App-Info, Export als JSON, CSV und HTML |

Weitere Eigenschaften:

- Dark- und Light-Theme, keine Webfonts, vollständig offline lauffähig
- Zwei-Akku-Optik mit Monospace-Ziffern, `[data-accent]`-Farbe pro Bereich
- Telemetrie als dauerhafter PowerShell-Prozess, alle 1,5 s ein Messpunkt
- Ein Klick auf „Aktualisieren" lietet Einzelbereiche an
- Diagrammbibliothek selbst geschrieben (SVG), keine Chart-Abhängigkeit
- `prefers-reduced-motion` wird respektiert

### Details, die über „welche Hardware steckt drin" hinausgehen

- **PCIe-Link** statt Schätzung: Generation und Lane-Breite kommen aus den
  PNP-Eigenschaften (`DEVPKEY_PciDevice_CurrentLinkSpeed`), beim Datenträger
  über den Elternknoten des Controllers – also „Gen4 x4" statt „vermutlich
  modern"
- **Sektorgroßen und 4Kn**: logische und physische Blockgröße aus
  `MSFT_PhysicalDisk`, inklusive Firmwarestand aus den NVMe-Firmwaredaten
- **Speicherkanäle und Profile**: Kanalbestückung aus Gesamt- gegen
  Datenbreite, Takt über JEDEC plus erhöhte Spannung wird als übertaktetes
  Profil (XMP/EXPO) erkannt und benannt
- **Anzeigemodi** über `user32!EnumDisplaySettings`: höchste Auflösung,
  Bildrate, Farbtiefe und Pixeldichte, HDR aus dem EDID-Transfermerkmal
- **Geräte im lokalen Netz**: Ping-Sweep über das eigene /24 mit ARP-Tabelle,
  MAC-Adressen und Herstellerzuordnung aus kuratierten OUI-Präfixen –
  abgeschaltet, nie automatisch, verläuft vollständig lokal
- **Diagnoseblock** kopierfertig für Fehlerberichte (Seite „System & Export")

## Rechenkraft

Die Seite „Rechenkraft" misst den Rechner und stellt das Ergebnis in
Diagrammen gegenüber. Die Messsuite läuft in einem eigenen Worker-Thread,
sodass die Oberfläche bedienbar bleibt, und dauert rund fünf Sekunden:

1. **Gleitkomma** – Float64-Arithmetik auf einem Kern
2. **Ganzzahl** – 64-Bit-Multiplikation und Verkettung
3. **SHA-256** – 1 MiB Datensatz pro Durchlauf
4. **Bandbreite** – Lesen, Schreiben und Kopieren von 48 MiB, getrennt gemessen
5. **Latenz** – Zufallssprung über 4 KiB, 256 KiB, 8 MiB und 64 MiB, zeigt
   L1, L2, L3 und Arbeitsspeicher getrennt
6. **Parallel** – Gleitkomma auf allen Kernen gleichzeitig

Daraus wird der **Inspekt-Score** als geometrisches Mittel der Einzelwerte
relativ zu festen Baselines, mal 100:

```
score = 100 × ( F/F₀ · I/I₀ · H/H₀ · M/M₀ )^(1/4)

F₀ = 1 GFLOPS   I₀ = 1 GOPS/s
H₀ = 1.000 /s   M₀ = 10 GB/s
```

Der geometrische Mittelwert bestraft Extreme: eine einzelne schnelle Kennzahl
rettet den Score nicht, eine sehr langsame drückt ihn.

Jeder abgeschlossene Lauf landet in `bench-history.json` im Benutzerprofil
(maximal 60 Einträge) und erscheint als Kurve auf derselben Seite. Damit
lässt sich später sagen, ob ein Treiberupdate oder ein Temperaturschutz die
Leistung verändert hat – die Daten bleiben lokal.

Ist ein Akku verbaut und meldet Windows eine Lade- oder Entladeleistung,
notiert die Suite zusätzlich **GFLOPS pro Watt**. Viele Notebooks liefern
diese Rate nicht; dann steht dort „nicht messbar", statt eine Zahl zu
erfinden.

Zum Vergleich dienen 46 Referenzrechner von der Zuse Z1 (1938) bis zum
schnellsten Rechner des TOP500 (2022) – vom Intel 4004 über Amiga, SNES und
Dreamcast bis Raspberry Pi 5, PlayStation 5 und RTX 4090. Veröffentlichte
Herstellerwerte sind als solche gekennzeichnet, grob aus Taktrate oder MIPS
abgeleitete Werte tragen ein `≈` und werden im Diagramm gestrichelt gezeichnet.
Jeder Wert lässt sich über den Quellen-Button in der Originalangabe prüfen.

Hinweis zur Einordnung: Die Suite misst JavaScript in V8 auf diesem Rechner.
Vergleiche mit C-Benchmarks anderer Werkzeuge sind deshalb nur grob gültig.

## Installation

Voraussetzung ist nur Node.js 20 oder neuer (entwickelt mit Node 24).

```bash
npm ci
npm run build:win          # erzeugt release/Inspekt-1.0.0-portable.exe
```

Die portable `.exe` enthält Electron und alle Skripte, braucht keine
Installation und legt nur seine Collector-Skripte unter
`%APPDATA%\Inspekt\collector` ab.

Für die Entwicklung:

```bash
npm ci
npm run dev                # Vite-Devserver, Electron startet mit
```

## Skripte

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsmodus |
| `npm run build` | Renderer, Main und Preload bauen |
| `npm run typecheck` | beide TypeScript-Projekte prüfen |
| `npm run collect` | `fixtures/snapshot.json` erzeugen |
| `npm run collect:redact` | anonymisierten `fixtures/snapshot.redacted.json` erzeugen |
| `npm run collect:smoke` | Collector gegen die echte Hardware prüfen |
| `npm run export:smoke` | JSON-, CSV- und HTML-Export prüfen |
| `npm run bench:smoke` | Messsuite und Referenzdaten prüfen |
| `npm run ui:smoke` | App starten und über CDP durchklicken |
| `npm run build:win` | portable Windows-Datei bauen |
| `npm run icon` | Icon-Satz aus `tools/make-icon.mjs` neu erzeugen |

Der UI-Smoke-Test startet die App, besucht jeden Bereich, startet die
Telemetrie, führt den Benchmark über die Oberfläche aus und legt
Screenshots unter `build/` ab. Ein optionaler Pfad prüft statt der
Development-Version die gepackte EXE:

```bash
node tools/ui-smoke.ts release/Inspekt-1.0.0-portable.exe
```

### Anonymisierte Snapshots

Ein roher Snapshot enthält Hostname, Seriennummern, MAC- und IP-Adressen und
darf nicht ins Repository. `npm run collect:redact` erzeugt eine bereinigte
Kopie: Seriennummern, UUIDs, Host- und Gerätenamen, MAC- und IP-Adressen
werden ersetzt, Baureihen, Modellnamen, Slot- und Kapazitätswerte bleiben
lesbar. Der Collector-Smoke-Test prüft, dass nach der Anonymisierung keine
Identifier mehr auftauchen.

## Wie die Daten ausgelesen werden

Windows liefert die Daten über WMI/CIM. Die Erfassung läuft als
PowerShell-5.1-Skript in fünf parallelen Gruppen, braucht auf einem
Laptop etwa vier Sekunden und wird angezeigt, statt im Hintergrund zu
blockieren:

| Quelle | Bereich |
| --- | --- |
| `Win32_ComputerSystem`, `Win32_BIOS`, `Win32_BaseBoard` | System |
| `Win32_PhysicalMemory`, `Win32_PhysicalMemoryArray` | Arbeitsspeicher |
| `MSFT_PhysicalDisk`, `Win32_DiskDrive`, `Win32_Volume` | Speicher |
| `Win32_Processor`, `Win32_VideoController`, `nvidia-smi` | CPU, GPU |
| `WmiMonitorID`, `WmiMonitorConnectionParams` | Monitore (EDID) |
| `Win32_NetworkAdapter`, `Win32_PnPEntity` | Netzwerk, Geräte |
| `Win32_Battery`, `Win32_Tpm`, `Win32_DeviceGuard` | Akku, Sicherheit |
| `MSAcpi_ThermalZoneTemperature` | Thermozonen |

Ohne Administratorrechte fehlen Thermosensoren, einige SMART-Zähler und der
TPM-Status. Die App startet deshalb nicht automatisch erhöht – ein
Credential-Fenster bei jedem Start wäre die schlechteste Variante. Der
Wunsch nach mehr Daten lässt sich im Hauptfenster über „Als Administrator
starten" jederzeit erfüllen; die Werte werden in der Oberfläche als
Hinweis gekennzeichnet statt zu fehlen.

Anzeigenamen werden übersetzt und nach humanen Regeln formatiert
(Thermal Zone 1/ACPI Thermal Zone → TZ1, Größen in binären Einheiten,
deutsche Zahlformate). Die Übersetzungen liegen in `src/lib/labels.ts`,
die Anschlusszählung in `src/lib/ports.ts`.

## Projektstruktur

```
electron/          Hauptprozess, Preload-Bridge, Collector-Skripte
node/              Erfassung, Telemetrie, nvidia-smi, Benchmark-Suite
shared/            Schema (zod), Typen, Referenzdaten, Score-Formel
src/               React-Oberfläche, Seiten, Diagramme, Formatierung
tools/             Smoke-Tests und Icon-Generator
build/             Icon-Satz und Smoke-Screenshots
fixtures/          erzeugter Snapshot (nicht im Repo, siehe .gitignore)
release/           portable EXE (nicht im Repo)
```

## Continuous Integration

Drei Jobs unter `.github/workflows/ci.yml`, alle auf `windows-latest`:

1. **Prüfungen** – Typecheck, Export-, Benchmark- und Collector-Smokes,
   danach wird ein anonymisierter Snapshot als Artefakt hochgeladen
2. **Oberfläche** – baut die App und fährt den UI-Smoke-Test über CDP
   (`continue-on-error`, weil Electron eine interaktive Sitzung braucht)
3. **Paketierung** – baut die portable EXE und lädt sie hoch

## Beitragen

Issue- und PR-Vorlagen liegen unter `.github/`. Für Fehlerberichte ist der
Diagnoseblock auf der Seite „System & Export" gedacht – er enthält
App-Version, Rechtezustand, Skriptpfade und die letzten Protokollzeilen.

## Datenschutz

- Keine Netzwerkverbindungen, keine Telemetrie an Server, keine Updates
- Keine Webfonts und keine externen Bilder, alle Assets liegen bei
- Die App liest nur Systemdaten und schreibt nichts außer ihren
  Collector-Skripten und dem gewählten Export
- Der Benchmark belastet den Rechner kurzzeitig und lässt sich jederzeit
  abbrechen

## Lizenz

MIT – siehe [LICENSE](LICENSE).