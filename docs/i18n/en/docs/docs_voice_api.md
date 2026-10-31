[Deutsch](../../de/docs/docs_voice_api.md) · [English](docs_voice_api.md) · [Русский](../../ru/docs/docs_voice_api.md)

# Voice Activity Detection API

Checked against the local sources on **27 October 2026**.

**Implementation status: partial.** This contract and its packet handlers exist,
but they do not yet provide a complete, game-validated lip-sync solution.
Read [Lipsync status, blockers and required information](docs_voice_lipsync_status.md)
before enabling or extending the path. That document also covers the separate
local `SkyMP-YACA-TS` bridge.

## Scope

Voice Activity Detection (VAD) reports whether an actor is speaking.
The current API carries a boolean state and a voice range. It does not carry
audio samples, amplitude, phonemes or visemes. A speaking indicator or an
attempted dialogue idle must not be treated as proven audio-driven lip sync.

The server contains a provider-neutral adapter contract. YACA is the existing
adapter skeleton; Discord, Mumble and other providers are possible integrations,
not completed providers in this checkout.

## State and adapter contracts

The relevant fields of `VoiceActivityState` are:

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

The complete types, including metadata and health diagnostics, are in
[voiceActivityApi.ts](../../../../skymp5-server/ts/voiceActivityApi.ts).

A provider implements `IVoiceProviderAdapter` with `providerId`, `isReady`,
`initialize()`, `shutdown()`, `onVoiceActivityUpdate(callback)` and an optional
`getHealthStatus()`. Registering it through
`VoiceActivityManager.registerAdapter(adapter)` initializes the adapter and
subscribes the manager to those callbacks.

Updates received through those callbacks pass through the manager's state
registry, configured range-tier validation, inactivity timer and broadcast path.
Its current registry stores one latest state per actor; deterministic merging
of simultaneous providers is not implemented.

## Actual server integration

[Server index.ts](../../../../skymp5-server/ts/index.ts) initializes the manager only when
`server-settings.json` contains `voiceActivity.enabled === true`.
It installs a recipient resolver and a broadcast callback that calls
`server.sendCustomPacket(userId, json)`. If `providers` includes `yaca-ts`,
it registers a `YacaTeamSpeakAdapter`.

[YacaTeamSpeakAdapter.ts](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts)
provides `handleYacaVoiceEvent(actorId, isSpeaking, voiceRange)`. That method
can emit updates to its subscribed callbacks, but `initialize()` itself
does not connect to TeamSpeak or register a transport. A ready/healthy status
therefore does not prove that any real voice events are arriving.

The separate local bridge's `onVoiceActivity` callback emits
`{ actorId, isSpeaking, voiceRange }` using the native event source's actor ID.
The bridge's standard plugin entry supplies no callback, so this is not
automatically connected to the manager. Its new transport uses CEF and
`_yacaClient`; it does not require a Papyrus `YacaBridgeQuest`.

### Existing client-to-server Custom Packet path

The server currently recognizes `customPacketType: "voiceActivity"` and the
alias `"yaca:voiceActivity"`. Example wire shape:

```json
{
  "customPacketType": "voiceActivity",
  "isSpeaking": true,
  "voiceRange": 8,
  "providerId": "yaca-ts"
}
```

This handler calls `manager.broadcastVoiceActivity(state)` directly. It
**bypasses the manager's state registry, range-tier validation and inactivity
timer**, and is not called by the new bridge automatically. Its current
payload coercion and acceptance of a payload actor ID also need correction.
A completed integration must derive identity from the authenticated sender
and validate the state before it enters the shared lifecycle.

### Server-to-client packet

The broadcast callback sends this flat JSON object:

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

`VoiceActivitySyncService` receives the `customPacketMessage`, parses its
`contentJsonDump` through `parseSyncVoiceActivityPacket`, and forwards an
internal `{ eventName: "syncVoiceActivity", content }` envelope to the handler.
`eventName` is not the wire discriminator.

The service is registered in
[client index.ts](../../../../skymp5-client/src/index.ts).
The [animation handler](../../../../skymp5-client/src/sync/voiceActivitySync.ts) currently
uses the server actor ID directly with `Game.getFormEx`, attempts
`playIdle(0x0005B1B0)`, refreshes it every two seconds and calls
`stopTranslation()` on stop. Correct actor mapping, visible mouth motion,
reset behavior and a client expiry mechanism remain open.

## Configuration

This complete example documents the currently read startup fields and keeps
the incomplete path disabled:

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

Changing `enabled` to `true` creates the manager and registers the selected
adapter skeleton; it does not finish the bridge or animation integration.

| Setting | Meaning and current limit |
| --- | --- |
| `enabled` | Explicit opt-in at game-server startup; false in the API defaults. |
| `providers` | Startup selection; the implemented selection recognizes `yaca-ts`. |
| `voiceRangeTiers` | Numeric array read by startup. The type contract also permits `null`, but startup currently does not forward that value. Validation applies to adapter updates, not the direct Custom Packet path. |
| `defaultVoiceRange` | Contract fallback: 8 metres. Keep explicit while startup default handling is corrected. |
| `proximityDistance` | Contract default: 100 metres. The resolver currently compares raw game-coordinate distances to this value and the speaker's range without unit conversion. |
| `inactivityTimeoutMs` | Contract default: 1000 ms for adapter-driven state. Must be coordinated with the bridge's approximately two-second status reports. |
| `allowedProviders` | Applied during adapter registration; not enforced by the direct Custom Packet broadcast path. |

The contract's `maxConcurrentSpeakersPerCell` field is not enforced by the
manager and is not forwarded by startup. Do not rely on it as an active limit.
Startup currently passes some absent options as `undefined`, overwriting the
manager's spread defaults; partial configurations therefore do not reliably
inherit all contract defaults.

The recipient resolver normally excludes the speaker and compares cell/world
and distance for each connected user. Some unresolved-position cases fall back
to all connected users. Recipient selection and the delivery of stop updates to
previous recipients need acceptance tests alongside the unit correction.

## Implemented admin diagnostics

Both routes require an authenticated admin with `canViewLogs`:

| Route | Current result |
| --- | --- |
| `GET /api/admin/voice/status` | Manager health, registered adapters, active-speaker count, last broadcast time and initialization errors; disabled/empty status if no manager exists. |
| `GET /api/admin/voice/speakers` | Speaking states from the manager registry, or an empty array if no manager exists. |

The routes are defined in [ui.ts](../../../../skymp5-server/ts/ui.ts).
The persistent dashboard proxies them to the game process; with that process
stopped the proxy returns `409 GAME_NOT_RUNNING`.

A dedicated voice diagnostics panel and `POST /api/admin/voice/range` are
not implemented in this checkout. Adapter health does not prove transport
health. Direct Custom Packet broadcasts do not populate the manager's speaker
list, and `lastBroadcastTime` can advance even when there are no recipients.
The YACA adapter's own speaker counter also needs per-actor deduplication.

## Verification and next steps

On 27 October 2026, `npm run test:voice-sync` in `skymp5-client` passed:
it recognizes the packet discriminator, ignores unrelated types and rejects
invalid JSON. This is a parser test, not a voice or animation test.

For missing implementation work, target-version information, desired animation
quality and a two-player acceptance procedure, use the
[Lipsync status document](docs_voice_lipsync_status.md).
Additional provider adapters must report actual speaking activity; voice
channel membership alone is insufficient.

## Sources

- [API types and defaults](../../../../skymp5-server/ts/voiceActivityApi.ts)
- [Manager implementation](../../../../skymp5-server/ts/voiceActivityManager.ts)
- [YACA adapter skeleton](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts)
- [Client service](../../../../skymp5-client/src/services/services/voiceActivitySyncService.ts)
- [Packet parser and test](../../../../skymp5-client/tests/voiceActivitySyncPacket.test.ts)
- [Plugin integration guide](../README-plugins.md#voice-activity-adapters-für-lipsync--proximity-chat)
- [Voice backlog](../ROADMAP.md#voice--proximity-chat-sync-backlog-proposed)
