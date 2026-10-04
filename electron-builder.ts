/**
 * Konfiguration für electron-builder.
 *
 * Zwei Ziele: die portable EXE (keine Installation) und ein NSIS-Installer
 * mit Startmenüeintrag. `requestedExecutionLevel: asInvoker` bleibt bewusst so –
 * eine automatische Erhöhung würde bei jedem Start ein Anmeldefenster zeigen.
 * Die Rechte holt sich die App nur auf ausdrücklichen Wunsch.
 *
 * Bewusst ohne Typ-Importe aus electron-builder: die Datei wird auch von
 * Electron-Builder selbst geladen, das ist CommonJS und kennt benannte
 * Exporte zur Laufzeit nicht.
 */
const build = {
  appId: 'de.inspekt.app',
  productName: 'Inspekt',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/**',
    'dist-electron/**',
    'package.json',
  ],
  extraResources: [
    {
      from: 'electron/collector/collect.ps1',
      to: 'collector/collect.ps1',
    },
    {
      from: 'electron/collector/telemetry.ps1',
      to: 'collector/telemetry.ps1',
    },
  ],
  // Optionales Update gegen GitHub-Releases. Läuft nur, wenn die App es
  // ausdrücklich anstößt – niemals beim Start.
  publish: {
    provider: 'github',
    owner: 'chaotiKKK',
    repo: 'inspekt',
    releaseType: 'release',
  },
  win: {
    icon: 'build/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    target: [
      { target: 'portable', arch: ['x64'] },
      { target: 'nsis', arch: ['x64'] },
    ],
    artifactName: 'Inspekt-${version}-portable.exe',
  },
  portable: {
    artifactName: 'Inspekt-${version}-portable.exe',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Inspekt',
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    installerHeaderIcon: 'build/icon.ico',
    deleteAppDataOnUninstall: false,
    artifactName: 'Inspekt-${version}-Setup.exe',
  },
}

export default build