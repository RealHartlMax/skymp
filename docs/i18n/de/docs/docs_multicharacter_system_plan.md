[Deutsch](docs_multicharacter_system_plan.md) · [English](../../en/docs/docs_multicharacter_system_plan.md) · [Русский](../../ru/docs/docs_multicharacter_system_plan.md)

<a id="multi-character-system-implementation-plan"></a>

# Implementierungsplan: Mehrcharaktersystem

> Planungs-/Rechercheunterlage, geprüft am 22. Oktober 2026. Vorschläge und Beispiele externer Forks sind nicht automatisch in diesem Checkout implementiert. Bestätigte Fertigstellung steht im [aktuellen Projektstatus](docs_project_status.md) und der Haupt-Roadmap.

<a id="goal"></a>

## Ziel

Ein produktionsreifer Ablauf mit mehreren Charakteren, in dem ein Spieler:

1. Sich einmal mit seinem Konto anmeldet.
2. Eine Charakterauswahl sieht.
3. Einen bestehenden Charakter auswählt oder einen neuen erstellt.
4. Mit dem gewählten Charakter in der Welt erscheint.

Das System bleibt serverautoritativ und gegen Clientmanipulation geschützt.

<a id="current-baseline"></a>

## Aktuelle Grundlage

- Die Anmeldung existiert und sendet `spawnAllowed` mit `profile.id`.
- Der Spawn wählt derzeit automatisch nur den ersten Actor des Profils.
- Existiert kein Actor, erfolgt die Charaktererstellung implizit.
- Der Client-Anmeldeablauf unterstützt bereits eigene Pakete und Browser-UI.

<a id="scope"></a>

## Umfang

<a id="in-scope"></a>

### Enthalten

- Charakterliste abrufen und anzeigen.
- Auswahlpaket und Validierung.
- Erstellungspaket und serverseitige Erstellung.
- Spawnpfad für ausdrücklich gewählten Charakter anpassen.
- Konfigurierbares Charakterlimit pro Profil.
- Minimale Admin-/Telemetrieprotokolle für Aktionen.

<a id="out-of-scope-initial-version"></a>

### Nicht enthalten (erste Version)

- Oberfläche zum Löschen von Charakteren.
- Charaktertransfer zwischen Konten.
- Namensänderungswerkzeuge.
- Bezahlte Slot-Erweiterungen.
- Umfangreiche kosmetische Vorschau in der Auswahl.

<a id="architecture"></a>

## Architektur

<a id="data-model"></a>

## Datenmodell

Charaktermetadaten an Actor-Datensätzen speichern (`mp.set(...)`), beispielsweise:

- `private.charName: string`
- `private.charSlot: number`
- `private.createdAt: number` (unix ms)
- `private.lastPlayedAt: number` (unix ms)

Client-Metadaten wird nicht vertraut. Der Server berechnet die kanonische Liste aus den mit `profileId` verknüpften Actors.

<a id="server-events-and-packets"></a>

## Serverereignisse und Pakete

<a id="server---client"></a>

### Server → Client

- `characterList`
  - `characters: Array<{ actorId: number; name: string; level: number; slot: number; lastPlayedAt?: number }>`
  - `canCreateNew: boolean`
  - `maxCharacters: number`

- `characterSelectRejected`
  - `reason: string`

- `characterCreateRejected`
  - `reason: string`

<a id="client---server"></a>

### Client → Server

- `selectCharacter`
  - `actorId: number`

- `createCharacter`
  - `name: string`

<a id="security-rules-must-have"></a>

## Verbindliche Sicherheitsregeln

1. Bei `selectCharacter` muss `actorId` zu `ctx.svr.getActorsByProfileId(profileId)` gehören.
2. Deaktivierte, gelöschte oder ungültige Actors verweigern.
3. Bei `createCharacter` serverseitig prüfen:
   - maximale Charakterzahl
   - Namensformat und -länge
   - Namenseindeutigkeit, falls aktiviert
4. Keine clientseitigen Werte für `profileId`, Stufe oder Inventar akzeptieren.
5. Vor dem endgültigen Spawn Verbindung/Benutzer erneut prüfen (`ctx.svr.isConnected(userId)`).

<a id="integration-plan"></a>

## Integrationsplan

<a id="phase-1---server-core"></a>

### Phase 1 – Serverkern

Zieldateien:

- `skymp5-server/ts/systems/spawn.ts`
- Neu: `skymp5-server/ts/systems/characterSelect.ts`

Aufgaben:

1. Spawnlistener so ändern, dass bei mehreren Charakteren nicht automatisch `[0]` gewählt wird.
2. Bei `actors.length > 0` `characterList` senden.
3. Direkte Erstellung ohne Actors erhalten.
4. System `characterSelect.ts` für `selectCharacter` und `createCharacter` ergänzen.
5. Nach der Anmeldung und vor der endgültigen Spawnübergabe initialisieren.

Abnahmekriterien:

- Profil mit mindestens zwei Actors erhält eine Liste statt sofortigem Spawn.
- Gültiges `selectCharacter` spawnt den gewählten Actor.
- Ungültige Auswahl wird mit konkretem Grund verweigert.

<a id="phase-2---client-flow"></a>

### Phase 2 – Clientablauf

Zieldateien:

- `skymp5-client/src/services/services/authService.ts`
- Frontend-Auswahlmodul: neue Komponente in `skymp5-front` oder bestehender Login-Webview-Ablauf

Aufgaben:

1. `characterList` behandeln und Auswahl anzeigen.
2. Bei Klick `selectCharacter` senden.
3. Über „Erstellen“ `createCharacter` senden.
4. Doppelte Übermittlungen während ausstehender Anfrage blockieren.
5. Ablehnungsgründe anzeigen.

Abnahmekriterien:

- Bestehender Charakter in der UI auswählbar.
- Neuer Charakter unterhalb des Limits erstellbar.
- UI erholt sich von Ablehnung/Timeout.

<a id="phase-3---character-metadata-and-ux"></a>

### Phase 3 – Metadaten und Bedienung

Aufgaben:

1. `private.lastPlayedAt` bei erfolgreichem Spawn speichern/aktualisieren.
2. Nach Slot oder letzter Spielzeit sortiert anzeigen.
3. Optional günstige Kurzinformationen wie Stufe/Ort ergänzen.

Abnahmekriterien:

- Deterministische Reihenfolge der Charakterliste.
- Letzte Spielzeit wird beim Beitritt aktualisiert.

<a id="phase-4---hardening-and-observability"></a>

### Phase 4 – Absicherung und Beobachtbarkeit

Aufgaben:

1. Strukturierte Protokolle für Auswahl-/Erstellungserfolg und Ablehnungsgründe.
2. Anfragerate von `createCharacter` pro Benutzer begrenzen.
3. Metrikzähler ergänzen:
   - list_shown
   - select_success
   - select_reject
   - create_success
   - create_reject

Abnahmekriterien:

- Übliche Missbrauchsversuche werden verweigert und protokolliert.
- Betriebsmetriken für die Einführung vorhanden.

<a id="server-settings"></a>

## Servereinstellungen

Einstellungsblock in `server-settings.json` ergänzen:

```json
{
  "characterSystem": {
    "maxCharactersPerProfile": 5,
    "nameMinLength": 3,
    "nameMaxLength": 24,
    "namePattern": "^[A-Za-z0-9 _'-]+$",
    "enforceUniqueNames": false,
    "createCooldownMs": 3000
  }
}
```

Standards müssen sicher und abwärtskompatibel sein.

<a id="backward-compatibility-strategy"></a>

## Abwärtskompatibilität

1. Ohne `characterSystem`-Einstellungen Standards verwenden.
2. Bei genau einem Actor optional automatisch spawnen, bis die UI vollständig ausgerollt ist (Featureflag).
3. Offline-Verhalten erhalten, sofern dort nicht ausdrücklich aktiviert.

Vorgeschlagenes Flag:

- `characterSystem.enabled: boolean` (Standard `false` für schrittweise Einführung)

<a id="test-plan"></a>

## Testplan

<a id="unitintegration"></a>

### Unit-/Integrationstests

1. `selectCharacter` akzeptiert eigene Actor-ID.
2. Fremde Actor-ID wird verweigert.
3. `createCharacter` verweigert Erstellen am Limit.
4. Ungültiger Name wird verweigert.
5. Erstellung gelingt und Actor erscheint in neuer Liste.
6. Verbindungsabbruch zwischen Liste und Auswahl verursacht keinen Absturz.

<a id="manual-qa"></a>

### Manuelle Qualitätssicherung

1. Erste Anmeldung ohne Charakter: Erstellung funktioniert.
2. Rückkehrer mit drei Charakteren: Auswahlliste erscheint.
3. Fremde `actorId` im Paket: verweigert.
4. Schnelles Erstellen-Spamming: Anfragelimit verweigert Überschüsse.

<a id="rollout"></a>

## Einführung

1. Mit `characterSystem.enabled=false` ausliefern.
2. In Staging aktivieren.
3. Logs, Metriken und Persistenz prüfen.
4. Schrittweise auf Produktionsservern aktivieren.
5. Temporären Kompatibilitätszweig nach stabiler Phase entfernen.

<a id="risks-and-mitigations"></a>

## Risiken und Gegenmaßnahmen

- Race Conditions bei asynchroner Auswahl/Erstellung.
  - Gegenmaßnahme: Verbindung und Eigentum vor endgültiger Bindung erneut prüfen.

- Inkonsistente Alt-Actors ohne Metadaten.
  - Gegenmaßnahme: Ersatzwerte berechnen (`name="Unknown"`, `slot=actorId`).

- UI-Zustand weicht vom Paketzustand ab.
  - Gegenmaßnahme: Server bleibt autoritativ; Client fragt bei Abweichung erneut an.

<a id="definition-of-done"></a>

## Fertigstellungskriterien

1. Spieler kann mehrere Charaktere eines Profils auswählen.
2. Unberechtigte Auswahl ist serverseitig ausgeschlossen.
3. Limits und Validierung werden erzwungen.
4. Automatisierte Tests und manuelle Prüfliste decken den Ablauf ab.
5. Dokumentation und Einstellungsreferenz sind aktuell.
