[Deutsch](docs_voice_api.md) · [English](../../en/docs/docs_voice_api.md) · [Русский](../../ru/docs/docs_voice_api.md)

<a id="voice-activity-detection-api"></a>

# API zur Sprecheraktivität

Mit den lokalen Quellen am **27. Oktober 2026** abgeglichen.

**Umsetzungsstand: teilweise.** Vertrag und Paketverarbeitung existieren, bilden aber noch keine vollständige, im Spiel geprüfte Lipsync-Lösung. Lies vor Aktivierung oder Erweiterung [Lipsync-Status, Blocker und benötigte Angaben](docs_voice_lipsync_status.md). Dort ist auch die getrennte lokale Bridge `SkyMP-YACA-TS` beschrieben.

<a id="scope"></a>

## Umfang

Voice Activity Detection (VAD) meldet, ob ein Actor spricht. Die API überträgt einen booleschen Zustand und eine Sprachreichweite, jedoch keine Audiosamples, Pegel, Phoneme oder Viseme. Eine Sprecheranzeige oder ein versuchtes Dialog-Idle belegt keine audiogesteuerte Lippensynchronisation.

Der Server enthält einen anbieterneutralen Adaptervertrag. YACA ist das vorhandene Gerüst; Discord, Mumble und weitere Anbieter sind mögliche Integrationen, keine fertigen Provider dieses Checkouts.

<a id="state-and-adapter-contracts"></a>

## Zustands- und Adapterverträge

Wesentliche Felder von `VoiceActivityState`:

```typescript
interface VoiceActivityState {
  actorId: string;      // Server actor ID, not a client-local Form ID
  isSpeaking: boolean;
  voiceRange: number;   // Metres
  providerId?: string;
  timestamp: number;    // Milliseconds since Unix epoch
  // Optional provider metadata is also supported.
}
```

Vollständige Typen mit Metadaten und Zustandsdiagnosen: [voiceActivityApi.ts](../../../../skymp5-server/ts/voiceActivityApi.ts).

Ein Provider implementiert `IVoiceProviderAdapter` mit `providerId`, `isReady`, `initialize()`, `shutdown()`, `onVoiceActivityUpdate(callback)` und optional `getHealthStatus()`. `VoiceActivityManager.registerAdapter(adapter)` initialisiert den Adapter und registriert die Callbacks beim Manager.

Callback-Updates durchlaufen Zustandsregister, konfigurierte Reichweitenprüfung, Inaktivitätstimer und Broadcastpfad. Das Register speichert aktuell den letzten Zustand je Actor; gleichzeitige Provider werden nicht deterministisch zusammengeführt.

<a id="actual-server-integration"></a>

## Tatsächliche Serverintegration

[Server index.ts](../../../../skymp5-server/ts/index.ts) erstellt den Manager nur bei `voiceActivity.enabled === true` in `server-settings.json`. Es installiert Empfängerauswahl und Broadcast-Callback mit `server.sendCustomPacket(userId, json)`. Enthält `providers` den Wert `yaca-ts`, wird `YacaTeamSpeakAdapter` registriert.

[YacaTeamSpeakAdapter.ts](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts) bietet `handleYacaVoiceEvent(actorId, isSpeaking, voiceRange)` zum Melden von Updates an Callbacks. `initialize()` verbindet jedoch weder TeamSpeak noch einen Transport. Ein gesunder/bereiter Status beweist daher keine echten Sprecherereignisse.

Der Callback `onVoiceActivity` der getrennten lokalen Bridge liefert `{ actorId, isSpeaking, voiceRange }` mit der Actor-ID ihrer nativen Ereignisquelle. Der Standard-Pluginentry übergibt keinen Callback, also besteht keine automatische Manageranbindung. Der neue Transport verwendet CEF und `_yacaClient`, keine Papyrus-`YacaBridgeQuest`.

<a id="existing-client-to-server-custom-packet-path"></a>

### Bestehender Client-zu-Server-Custom-Packet-Pfad

Der Server erkennt derzeit `customPacketType: "voiceActivity"` und Alias `"yaca:voiceActivity"`. Paketbeispiel:

```json
{
  "customPacketType": "voiceActivity",
  "isSpeaking": true,
  "voiceRange": 8,
  "providerId": "yaca-ts"
}
```

Dieser Handler ruft direkt `manager.broadcastVoiceActivity(state)` auf und **umgeht Zustandsregister, Reichweitenprüfung und Inaktivitätstimer des Managers**. Die neue Bridge ruft ihn nicht automatisch auf. Auch Typumwandlung der Nutzdaten und Akzeptanz einer Actor-ID aus dem Payload müssen korrigiert werden. Eine vollständige Integration muss die Identität vom authentifizierten Absender ableiten und Zustände vor dem gemeinsamen Lebenszyklus prüfen.

<a id="server-to-client-packet"></a>

### Server-zu-Client-Paket

Der Broadcast-Callback sendet dieses flache JSON-Objekt:

```json
{
  "customPacketType": "syncVoiceActivity",
  "actorId": "4278190081",
  "isSpeaking": true,
  "voiceRange": 8,
  "providerId": "yaca-ts",
  "timestamp": 1793090000000
}
```

`VoiceActivitySyncService` empfängt `customPacketMessage`, verarbeitet `contentJsonDump` mit `parseSyncVoiceActivityPacket` und gibt intern `{ eventName: "syncVoiceActivity", content }` weiter. `eventName` ist kein Paketdiskriminator auf dem Draht.

Der Service ist in [Client index.ts](../../../../skymp5-client/src/index.ts) registriert. Der [Animationshandler](../../../../skymp5-client/src/sync/voiceActivitySync.ts) verwendet die Server-Actor-ID direkt mit `Game.getFormEx`, versucht `playIdle(0x0005B1B0)`, wiederholt alle zwei Sekunden und ruft zum Stoppen `stopTranslation()` auf. Korrekte Zuordnung, sichtbare Mundbewegung, Reset und clientseitiger Ablauf bleiben offen.

<a id="configuration"></a>

## Konfiguration

Dieses vollständige Beispiel zeigt aktuell gelesene Startfelder und lässt den unvollständigen Pfad deaktiviert:

```json
{
  "voiceActivity": {
    "enabled": false,
    "providers": ["yaca-ts"],
    "voiceRangeTiers": [1, 3, 8, 15, 20, 25, 30, 40],
    "defaultVoiceRange": 8,
    "proximityDistance": 100,
    "inactivityTimeoutMs": 1000,
    "allowedProviders": ["yaca-ts"]
  }
}
```

`enabled: true` erstellt den Manager und registriert das Adaptergerüst, vervollständigt aber weder Bridge noch Animation.

| Einstellung | Bedeutung und aktuelle Grenze |
| --- | --- |
| `enabled` | Ausdrückliche Aktivierung beim Gameserver-Start; API-Standard false. |
| `providers` | Startauswahl; implementiert ist `yaca-ts`. |
| `voiceRangeTiers` | Numerisches Array beim Start. Der Typvertrag erlaubt auch `null`, das der Start derzeit nicht weiterreicht. Gilt für Adapterupdates, nicht direkte Custom Packets. |
| `defaultVoiceRange` | Vertragsstandard 8 Meter. Bis zur Korrektur der Startdefaults ausdrücklich angeben. |
| `proximityDistance` | Vertragsstandard 100 Meter. Resolver vergleicht derzeit rohe Spielkoordinaten ohne Umrechnung damit und mit der Sprecherreichweite. |
| `inactivityTimeoutMs` | Vertragsstandard 1000 ms für Adapterzustand. Muss zum etwa zweisekündigen Meldetakt der Bridge passen. |
| `allowedProviders` | Bei Adapterregistrierung angewandt, nicht bei direktem Custom-Packet-Broadcast. |

`maxConcurrentSpeakersPerCell` wird vom Manager nicht erzwungen und beim Start nicht weitergereicht; es ist kein aktives Limit. Der Start übergibt einige fehlende Optionen als `undefined` und überschreibt damit Spread-Defaults des Managers. Teilkonfigurationen erben daher nicht zuverlässig alle Standards.

Die Empfängerauswahl schließt normalerweise den Sprecher aus und vergleicht Raum/Welt und Entfernung pro Benutzer. Bei bestimmten ungelösten Positionen werden alle Benutzer verwendet. Empfängerauswahl und Stopmeldungen an frühere Empfänger benötigen nach der Einheitenkorrektur Abnahmetests.

<a id="implemented-admin-diagnostics"></a>

## Implementierte Admindiagnose

Beide Routen benötigen Admin-Anmeldung mit `canViewLogs`:

| Route | Aktuelles Ergebnis |
| --- | --- |
| `GET /api/admin/voice/status` | Managerzustand, registrierte Adapter, aktive Sprecherzahl, letzter Broadcast und Initialisierungsfehler; deaktiviert/leer ohne Manager. |
| `GET /api/admin/voice/speakers` | Sprecherzustände aus dem Managerregister oder leeres Array ohne Manager. |

Routen stehen in [ui.ts](../../../../skymp5-server/ts/ui.ts). Das dauerhafte Dashboard leitet sie zum Spielprozess; bei gestopptem Spiel folgt `409 GAME_NOT_RUNNING`.

Eine eigene Voice-Diagnoseansicht und `POST /api/admin/voice/range` sind nicht implementiert. Adaptergesundheit beweist keine Transportgesundheit. Direkte Custom-Packet-Broadcasts füllen die Sprecherliste nicht; `lastBroadcastTime` kann auch ohne Empfänger steigen. Der eigene Sprecherzähler des YACA-Adapters benötigt Deduplizierung pro Actor.

<a id="verification-and-next-steps"></a>

## Prüfung und nächste Schritte

Am 27. Oktober 2026 bestand `npm run test:voice-sync` in `skymp5-client`: korrekter Paketdiskriminator, fremde Typen ignoriert, ungültiges JSON verweigert. Dies ist ein Parsertest, kein Sprach-/Animationstest.

Offene Umsetzung, Zielversionen, gewünschte Animationsqualität und Zwei-Spieler-Abnahme stehen im [Lipsync-Status](docs_voice_lipsync_status.md). Zusätzliche Adapter müssen wirkliche Sprecheraktivität melden; Kanalmitgliedschaft allein reicht nicht.

<a id="sources"></a>

## Quellen

- [API-Typen und Standards](../../../../skymp5-server/ts/voiceActivityApi.ts)
- [Manager](../../../../skymp5-server/ts/voiceActivityManager.ts)
- [YACA-Adaptergerüst](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts)
- [Clientservice](../../../../skymp5-client/src/services/services/voiceActivitySyncService.ts)
- [Parser und Test](../../../../skymp5-client/tests/voiceActivitySyncPacket.test.ts)
- [Pluginintegration](../../../../README-plugins.md#voice-activity-adapters-für-lipsync--proximity-chat)
- [Voice-Backlog](../ROADMAP.md#voice--proximity-chat-sync-backlog-proposed)
