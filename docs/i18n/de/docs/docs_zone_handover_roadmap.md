[Deutsch](docs_zone_handover_roadmap.md) · [English](../../en/docs/docs_zone_handover_roadmap.md) · [Русский](../../ru/docs/docs_zone_handover_roadmap.md)

<a id="zone-handover-and-instance-routing-roadmap"></a>

# Roadmap für Zonenübergabe und Instanzrouting

> Planungs-/Rechercheunterlage, geprüft am 22. Oktober 2026. Vorschläge und Beispiele externer Forks sind nicht automatisch in diesem Checkout implementiert. Bestätigte Fertigstellung steht im [aktuellen Projektstatus](docs_project_status.md) und der Haupt-Roadmap.

Dieses Dokument schlägt einen produktionsorientierten Übergabeablauf für Ortswechsel (Städte, Innenräume, Dungeons) während Skyrim-Ladebildschirmen vor.

Ziele:

- MMORPG-Gemeinschaft erhalten: Spieler begegnen sich standardmäßig an denselben Orten.
- Serverskalierung und Fehlerisolation verbessern.
- Optionale Ausweich-Shards für überfüllte Orte vorbereiten.

<a id="design-principles"></a>

## Entwurfsprinzipien

1. Standardmäßig gemeinsam

- Zonen bleiben standardmäßig gemeinsam: Gleiche Welt/Zelle bedeutet gleicher sozialer Raum.
- Keine privaten Instanzen pro Spieler als Standard einführen.

2. Technische Trennung für Leistung

- Zonensimulation kann auf separaten Workern/Prozessen laufen.
- Dies trennt die Laufzeit, nicht das gemeinsame Spielerlebnis.

3. Kontrollierte Ausweich-Shards

- Zusätzliche Zonenkopien erst bei überschrittener Kapazität erstellen.
- Gruppenmitglieder nach Möglichkeit im selben Shard halten.

<a id="why-loading-screen-is-the-right-handover-point"></a>

## Ladebildschirme als Übergabepunkt

Ein Ladebildschirm ist bereits ein harter Szenenwechsel. Er bietet ein sicheres, für Benutzer transparentes Zeitfenster für:

- Zustandssnapshot
- Eigentumsübertragung
- Initialisierung der Zielzone
- deterministische Abschlussbestätigung

Dies minimiert Bildfehler und Race Conditions während Bewegung und Kampf.

<a id="proposed-handover-workflow"></a>

## Vorgeschlagener Übergabeablauf

<a id="phase-1-pre-handover-source-zone"></a>

### Phase 1: Vorbereitung in der Quellzone

- Client fordert Ortswechsel an.
- Quellworker setzt den Actor in einen gesperrten Transferzustand.
- Er erstellt einen autoritativen Snapshot:
  - Transformation und worldOrCell
  - Actor-Werte und Todes-/Respawnzustand
  - Inventar-/Ausrüstungsänderungen
  - aktive Effekte und ausgewählte Laufzeitflags
- Quellworker veröffentlicht Transfertoken und Nutzdaten im Router/Zustandsspeicher.

<a id="phase-2-transfer-routing"></a>

### Phase 2: Transfer und Routing

- Zonenrouter wählt Zielworker/-shard anhand:
  - Zielortschlüssel
  - Belegung und Zustand des Shards
  - Gruppenbindungsregeln
- Zielworker prüft das Token und erstellt/lädt den Actor-Laufzeitzustand.
- Quellworker reserviert den Actor bis zur bestätigten Ziel-ACK.

<a id="phase-3-post-handover-target-zone"></a>

### Phase 3: Abschluss in der Zielzone

- Zielworker sendet Spawn-/Teleportdaten.
- Client verlässt den Ladebildschirm erst nach Bereitschafts-ACK.
- Quellworker räumt nach Commit-Bestätigung auf.

<a id="consistency-and-safety-requirements"></a>

## Konsistenz und Sicherheit

1. Idempotenz

- Doppelte Eintrittsanfragen erzeugen keine doppelten Actors.
- Transfertokens sind einmalig verwendbar.

2. Atomarer Eigentumswechsel

- Actor gehört entweder Quelle oder Ziel, niemals beiden.

3. Timeout und Rollback

- Ohne Ziel-ACK stellt die Quelle den Actor wieder her und bricht den Transfer ab.

4. Reihenfolgegarantien

- Veraltete Bewegungs-/Kampfpakete der vorherigen Eigentumsepoche verwerfen.

5. Beobachtbarkeit

- Übergabelatenz, Fehler, Wiederholungen und Rollbacks zählen.

<a id="integration-points-in-current-skymp-architecture"></a>

## Integrationspunkte der aktuellen Architektur

Die aktuelle Implementierung bietet folgende Ansatzpunkte:

- Ein Weltcontainer zur Laufzeit:
  - `skymp5-server/cpp/server_guest_lib/PartOne.h` (`WorldState worldState`)
- Haupttickschleife der Weltsimulation:
  - `skymp5-server/cpp/server_guest_lib/PartOne.cpp` (`worldState.Tick()`)
- Vorhandener Ortsgrenzenschlüssel im Protokoll:
  - `skymp5-server/cpp/messages/TeleportMessage.h` (`worldOrCell`)
- Clientbehandlung abweichender Welt/Zelle:
  - `skymp5-client/src/sync/movementApply.ts`

Diese Stellen eignen sich für die Einführung von Router/Worker bei erhaltenem Spielverhalten.

<a id="suggested-incremental-rollout"></a>

## Schrittweise Einführung

<a id="milestone-1-protocol-and-transfer-state"></a>

### Meilenstein 1: Protokoll und Transferzustand

- Transfertoken und Eigentumsepoche im Bewegungs-/Teleportpfad ergänzen.
- Transfersperre an der Quelle ergänzen.
- Grundlegendes Timeout/Rollback implementieren.

<a id="milestone-2-router-and-worker-abstraction"></a>

### Meilenstein 2: Router- und Workerabstraktion

- Zonenrouterschnittstelle einführen.
- Zunächst ein Prozess mit logischen Workern.
- Ende-zu-Ende-Invarianten der Übergabe testen.

<a id="milestone-3-multi-worker-deployment"></a>

### Meilenstein 3: Mehrere Worker

- Ausgewählte Zonen in getrennten Prozessen ausführen.
- Metrik-Dashboards und Fehleralarme ergänzen.
- Reconnect während laufender Übergabe prüfen.

<a id="milestone-4-optional-overflow-shards"></a>

### Meilenstein 4: Optionale Ausweich-Shards

- Adaptive Sharderstellung für überfüllte Orte aktivieren.
- Gruppenbindung und sozialen Zusammenhang erzwingen.
- Bei normaler Belegung gemeinsame Standard-Shards beibehalten.

<a id="non-goals-for-initial-implementation"></a>

## Nichtziele der ersten Implementierung

- Private Instanzen je Spieler als Standardmodell
- Shardübergreifender Kampf in Version 1
- Vollständige verteilte Neuentwicklung vor Nachweis korrekter Übergaben

<a id="acceptance-criteria-mvp"></a>

## Abnahmekriterien (MVP)

- Innenräume/Dungeons verwenden deterministisch abgeschlossene Transfers.
- Nach Übergängen kein doppeltes Actor-Eigentum.
- Fehlgeschlagene Transfers rollen ohne Spielerverlust zurück.
- p95-Übergabelatenz unter Last akzeptabel; Grenzwert im Betriebshandbuch definieren.
- Gemeinsames Sozialverhalten bleibt bei normaler Spielerzahl erhalten.
