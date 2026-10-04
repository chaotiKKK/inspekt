## Was ändert sich

<!-- kurze Beschreibung, ggf. mit Verweis auf Issue -->

## Warum

## Wie geprüft

- [ ] `npm run typecheck`
- [ ] `npm run collect:smoke`
- [ ] `npm run export:smoke`
- [ ] `npm run bench:smoke`
- [ ] `npm run ui:smoke`
- [ ] bei Änderungen am Collector: `collect.ps1` bleibt ASCII, Ausgabe UTF-8 ohne BOM

## Hinweise

- neue Felder in `shared/schema.ts` mit `zod` beschrieben
- neue Seiten oder Bereiche in `src/lib/nav.ts` **und** `src/App.tsx` eingetragen
- deutsche Texte, keine Webfonts, Zahlen mit tabularen Ziffern
- nichts committen, was Seriennummern oder IPs des Testrechners enthält