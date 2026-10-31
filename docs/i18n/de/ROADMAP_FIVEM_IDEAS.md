# Von FiveM inspirierte SkyMP-Roadmap

Diese Roadmap überträgt zentrale Architekturideen und bewährte Verfahren aus FiveM (`citizenfx/fivem`) in konkrete SkyMP-Aufgaben zu Stabilität, Leistung, Spielersynchronisierung und automatischen Ressourcen-/Moddownloads.

Stand geprüft am **22. Oktober 2026**. Implementierungs- und Testnachweise stehen im [Projektstatus](docs/docs_project_status.md). Dateisynchronisierung vor dem Spielstart ist im separaten Desktop-Launcher implementiert; echte Skyrim-/CEF-/Spielabnahme bleibt offen.

## Umgesetzte Muster

### Property-Bindings

- **Implementierung:** `canRespawn` für eigene serverseitige Steuerung.
- **Muster:** Les-/schreibbare Properties über `mp.set()`/`mp.get()` aus TypeScript.
- **Vorteil:** Klare Zuständigkeiten und erweiterte Mechaniken wie Heiler-Wiederbelebung ohne C++-Monolith.
- **Erkenntnis:** Flexible FiveM-artige Properties erlauben komplexes Gameplay ohne aufgeblähte Architektur.
- **Dateien:** CanRespawnBinding.h/cpp, IsDeadBinding.cpp, SpawnDelayBinding.cpp als Referenz.

### Konfigurierbares Gameplay

- **Implementierung:** `startSpawn`, `starterInventory` in server-settings.json.
- **Muster:** Settings-Interface → CMake-Generierung → Runtime-Property-Binding.
- **Vorteil:** Betreiber können Spawnpunkte und Ausrüstung ohne Code anpassen.
- **Dateien:** settings.ts, spawn.ts, generate_server_settings.cmake.

### Stabiler Startablauf

- **Implementierung:** Windows-Starter beenden vor dem Start alte `dist_back/skymp5-server.js`-Prozesse.
- **Muster:** Supervisorartige Vorprüfung und Prozessbereinigung in Startskripten.
- **Vorteil:** Keine Startkollisionen/Peer-Initialisierungsfehler durch verwaiste Node-Prozesse.
- **Dateien:** `skymp5-server/CMakeLists.txt`, `build/dist/server/launch_server.bat`.

### Unabhängige Webverwaltung r3

- **Implementierung:** Paketstarter verwalten getrennte Dashboard-/Spielprozesse.
- **Verhalten:** Spielstopp, Neustart und Absturz erhalten Dashboard, Einstellungen, Logs, Downloads, Anmeldung und WebSockets. Das Dashboard kann das Spiel wieder starten.
- **Grenze:** Live-Spieleraktionen brauchen ein laufendes Spiel. Beenden des gesamten Dienstes beendet beide eigenen Prozesse. Öffentliche Ports bleiben UDP 7777 und ein HTTP(S)-TCP-Listener.
- **Nachweise:** `misc/tests/test_dashboard_runtime.cjs`, Plattform-Paketberichte und sichtbarer Browserbericht des r3-Releases.

## 1. Ressourcen-API – Phase 1 erledigt

**Ziel:** Öffentliche HTTP-Endpunkte für Manifest und einzelne Downloads als Grundlage automatischer FiveM-artiger Verteilung.

- **Status:** Erledigt. `GET /api/launcher/manifest` und `GET|HEAD /api/launcher/files/:id` sind in `launcherResources.ts` implementiert und durch `ui.ts` registriert. Flache v1-Endpunkte bleiben für alte Launcher.
- **Manifest:** Vollständige Zielpfade, Größen, SHA-256, Gesamtgröße, Revision, Ladereihenfolge, lokale Spielvoraussetzungen und optionale Runtime-Quelle.
- **Download:** Undurchsichtige IDs, Streaming, ETag, Hash-/Größenheader und einzelne Byte-Bereiche.
- **Veröffentlichung:** Explizite `client-resources/Data/` und eigene Plugins/Archive. Private Dateien, Bethesda-Master, Runtime-Code und unsichere Pfade sind bei Modveröffentlichung ausgeschlossen.
- **Referenzen:** [Modpakete](docs/docs_launcher_modpacks.md), [alte v1-API](docs/docs_resource_auto_download.md).

## 2. Diagnose und Validierung von Ressourcen

**Ziel:** Ein eigenes Dashboard-Panel zeigt je Ressource Hash, Größe und Typ, markiert fehlende/beschädigte Dateien und erlaubt Aktualisierung.

- **Status:** Teilweise. Inventar und Aktualisierung existieren; vollständige veröffentlichungsbezogene Hash-/Fehlerdiagnose im Panel ist offen. API-Validierungsfehler ersetzen diese Ansicht nicht.
- **Aufwand:** Mittel.
- **Risiko:** Niedrig, da isoliert.
- **Dateien:** Admin-Dashboard in skymp5-front, `ui.ts`.

## 3. Ressourcenabgleich im Launcher – Phase 2 für Vorbereitung erledigt

**Implementiert:** Vor SKSE liest der eigenständige Launcher v2, prüft Größen/SHA-256/lokale Spieldateien, lädt Änderungen in einen Servercache und installiert vollständige Pakete mit Sicherung/Wiederherstellung. Texturen, Modelle, Skripte und Assets behalten Unterpfade. Fehler verhindern Aktivierung/Start. Kataloge liefern passende Client-/SKSE-/Address-Library-Pakete.

- **Code:** `skymp-client-launcher/launcher/src-tauri/src/connection.rs`, `runtime_version.rs`.
- **Nachweise:** 25 aktuelle Rust-Tests, sechs Runtime-Veröffentlichungsprüfungen und der bestehende echte Node-/Rust-Vertragstest für Installation/Cache/Reparatur/Update/Restore.
- **Offen:** Echte Skyrim-/CEF-/Weltbeitrittsabnahme, Fortsetzen von Teildateien, konfigurierbare Wiederholungen/Backoff. Ein Ingame-Modinstaller ist dafür nicht erforderlich.

## 4. Manifest und Abhängigkeiten – Phase 3

**Ziel:** Deklarative Abhängigkeiten, semantische Versionen und Reihenfolgeregeln, etwa `"requires": ["Skyrim.esm"]`.

- **Status:** Teilweise. Explizite Reihenfolge, lokale Basisspielprüfungen, Inhaltsrevisionen und Paketvalidierung existieren. Abhängigkeitsgraphen, SemVer-Regeln für Mods und automatische Auflösung fehlen.
- **Aufwand/Risiko:** Mittel; berührt Ressourcenladen.
- **Dateien:** `launcherResources.ts`, `data/manifest.json`, Launcher `connection.rs`, späterer Resolver.

## 5. State Bags – Schlüssel-Wert-Synchronisierung

**Ziel:** Leichtgewichtiges erweiterbares System je Entität, Spieler und global, inspiriert von FiveM. Granulare Übertragung reduziert aufwendige Entitätsreplikation.

- **Aufwand:** Hoch.
- **Risiko:** Mittel bis hoch wegen Core-Synchronisierung.
- **Dateien:** skymp5-server, skymp5-client, Entitätssynchronisierung.

## 6. Entitätsrelevanz und Ownership-Migration

**Ziel:** Relevanzfilter/Culling und explizite Ownership-Migration für effiziente Übertragung und Serverautorität, nach FiveMs Scoping-/Migrationsmuster.

- **Aufwand:** Hoch.
- **Risiko:** Hoch wegen zentraler Sync-/Ownership-Logik.
- **Dateien:** skymp5-server, skymp5-client, Entitätssynchronisierung.

## Prioritäten und nächste Schritte

1. **Erledigt:** Phase-1-API und Phase-2-Vorbereitung/Installation.
2. **Nächste Abnahme:** Kompatibler nativer Client, echter Skyrim-/CEF-Beitritt und Betreiberpaket auf dem VPS.
3. **Offen:** Diagnose-UI, fortsetzbare Downloads und Cache-Verdrängung.
4. **Phase 3 teilweise:** Bestehende Reihenfolge erhalten; Abhängigkeiten/Versionen und Resolver ergänzen.
5. **Später:** State Bags sowie Relevanz-/Ownership-Verbesserungen.

Diese Roadmap beruht auf einer eingehenden Analyse der FiveM-Architektur und berücksichtigt SkyMPs aktuelle Probleme und Ziele. Aufgaben können bei Bedarf weiter aufgeteilt werden.
