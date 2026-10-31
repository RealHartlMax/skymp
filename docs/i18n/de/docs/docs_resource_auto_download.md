[Deutsch](docs_resource_auto_download.md) · [English](../../en/docs/docs_resource_auto_download.md) · [Русский](../../ru/docs/docs_resource_auto_download.md)

<a id="resource-auto-download--distribution"></a>

# Automatischer Ressourcendownload und Verteilung

Der eigenständige `skymp-client-launcher` installiert Servermods vor dem SKSE-Start. Den pfaderhaltenden v2-Vertrag, vollständige Betreibereinrichtung und Client-Runtime-Erkennung beschreibt [Launcher-Modpakete](docs_launcher_modpacks.md).

Die folgenden Endpunkte beschreiben die ältere v1-API für flache Dateilisten und bleiben für ältere Launcher verfügbar. Der Spielclient `skymp5-client` installiert keine Mods automatisch; dies übernimmt der eigenständige Launcher.

Geprüft am 22. Oktober 2026: Der aktuelle v1-Dateiscanner in `ui.ts` listet hauptsächlich `.esm` und `.pex`; vollständige neue Modpakete werden darüber nicht veröffentlicht. Verwende v2 für ESP/ESL/BSA und verschachtelte Client-Assets. Frühere Vorschlagslisten unten sind keine aktuelle Aufgabenliste des Desktop-Launchers.

<a id="overview"></a>

## Überblick

```
Client connects
      │
      ▼
GET /api/resources/manifest          ← fetch list of all resources + SHA256 hashes
      │
      ▼
Compare hashes against local cache   ← dataDir/cache/resources/
      │
      ├── up-to-date: skip
      │
      └── missing / changed:
              │
              ▼
          GET /api/resources/download/:name   ← stream file, validate X-Resource-Hash
              │
              ▼
          Save to cache, load resource
```

<a id="endpoints"></a>

## Endpunkte

### `GET /api/resources/manifest`

Öffentlich, ohne Authentifizierung. Liefert alle auf dem Server verfügbaren Ressourcen.

**Antwort (200 OK):**

```json
{
  "version": "1",
  "generatedAt": "2026-04-25T12:00:00.000Z",
  "resources": [
    {
      "name": "SweetPie.esm",
      "kind": "mod",
      "size": 204800,
      "hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "name": "SweetPieScript.pex",
      "kind": "script",
      "size": 1024,
      "hash": "sha256:abc123..."
    }
  ]
}
```

**Felder:**

| Feld | Typ | Beschreibung |
|-------|-----|--------------|
| `version` | string | Manifestschema-Version (`"1"`) |
| `generatedAt` | ISO 8601 | Serverzeit der Manifesterstellung |
| `resources[].name` | string | Dateiname, etwa `SweetPie.esp` |
| `resources[].kind` | `"mod"` \| `"script"` | Ressourcenart |
| `resources[].size` | number | Dateigröße in Byte |
| `resources[].hash` | string | `sha256:<hex>`; leer, falls unlesbar |

**Ressourcenarten:**

- `mod` – Elder-Scrolls-Plugins (`.esm`, `.esp`, `.esl`)
- `script` – kompilierte Papyrus-Skripte (`.pex`)

---

### `GET /api/resources/download/:name`

Öffentlich, ohne Authentifizierung. Überträgt die unveränderten Dateibytes der benannten Ressource.

**URL-Parameter:** `:name` – nur Dateiname, keine Pfadtrenner.

**Antwortheader:**

| Header | Wert |
|--------|------|
| `Content-Type` | `application/octet-stream` |
| `Content-Disposition` | `attachment; filename="<name>"` |
| `X-Resource-Hash` | `sha256:<hex>` – zur Downloadprüfung |

**Fehlerantworten:**

| Status | Grund |
|--------|-------|
| `400` | Name leer oder mit Pfadtrennern |
| `403` | Aufgelöster Pfad außerhalb erlaubter Wurzeln (Path Traversal) |
| `404` | Ressource nicht im Manifest oder Datei fehlt |

---

<a id="security"></a>

## Sicherheit

<a id="path-traversal-protection"></a>

### Schutz vor Path Traversal

Der Downloadendpunkt löst den Dateinamen gegen dieselben Wurzeln auf, die `listAdminResources` durchsucht. `../../../etc/passwd` wird mit `403` verweigert, da der aufgelöste Pfad nicht unter einer erlaubten Wurzel liegt.

Erlaubte Wurzeln:
- `dataDir` (Serverkonfiguration)
- `./` (Server-Arbeitsordner)
- `./scripts`
- `./data`
- `./skymp5-gamemode`

<a id="hash-verification"></a>

### Hashprüfung

Clients **sollten** den SHA256 aus `X-Resource-Hash` nach dem Download prüfen. Format: `sha256:<lowercase hex>`.

```ts
// Example client-side verification (TypeScript)
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function verifyResource(filePath: string, expectedHash: string): boolean {
  const content = readFileSync(filePath);
  const actual = 'sha256:' + createHash('sha256').update(content).digest('hex');
  return actual === expectedHash;
}
```

---

<a id="server-configuration"></a>

## Serverkonfiguration

Zusätzliche Konfiguration ist nicht nötig. Das Manifest entsteht automatisch aus den vom Admin-Dashboard gescannten Ressourcen (`listAdminResources`). Dieselben `npcSettings`-Ladereihenfolge- und `dataDir`-Einstellungen gelten.

Lege Ressourcen zum Download in einen der gescannten Ordner:

```
server/
├── data/           ← .esm / .esp / .esl plugins
├── scripts/        ← .pex compiled Papyrus scripts
├── skymp5-gamemode/
└── <dataDir>/      ← as configured in server-settings.json
```

---

<a id="legacy-in-game-client-proposal"></a>

## Früherer Vorschlag für den Spielclient

Dies war ein früherer Vorschlag für `skymp5-client`. Der implementierte eigenständige Launcher verwendet stattdessen vor dem Spielstart `/api/launcher/manifest`:

1. Beim Verbinden `/api/resources/manifest` abrufen.
2. Für jede Ressource:
   - Pfad `<cacheDir>/<serverHost>/<name>` berechnen.
   - Vorhandene Datei mit passendem Hash überspringen.
   - Sonst `GET /api/resources/download/<name>`, `X-Resource-Hash` prüfen und im Cache speichern.
3. Vor Welteintritt aus dem Cache laden.
4. Beim Trennen Cache für die nächste Verbindung erhalten.

**Cacheordner:** `<SkyrimDataDir>/SkyMP/cache/<serverHost_port>/`

---

<a id="implementation-details"></a>

## Implementierungsdetails

Manifest- und Downloadrouten werden in `skymp5-server/ts/ui.ts` registriert.

`computeResourceHash(filePath)` liest synchron und liefert `sha256:<hex>`. Für große Dateien über einige MB sollte Phase 2 einen Streaming-Hash verwenden.

`listAdminResources(settings, dataDir)` wird von `/api/admin/resources` und dem öffentlichen Manifest gemeinsam verwendet, damit Ressourcenerkennung zentral bleibt.

---

## Roadmap

Den Phasenplan enthält [ROADMAP_FIVEM_IDEAS.md](../ROADMAP_FIVEM_IDEAS.md):

| Phase | Status | Beschreibung |
|-------|--------|--------------|
| 1 | Fertig | Servermanifest und Downloads |
| 2 | Geplant | Ressourcendiagnose im Dashboard |
| 3 | Geplant | Clientmanifest, Cache, automatischer Download |
| 4 | Geplant | Abhängigkeiten und Ladereihenfolge im Manifest |
