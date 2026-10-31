<a id="github-workflows---websocket-implementation-analysis"></a>
# GitHub-Workflows – Analyse der WebSocket-Implementierung

> Historischer Implementierungsvermerk. Am 22. Oktober 2026 geprüft: Die sechs Datenströme sowie Wiederverbindung und HTTP-Rückfall sind bereits in [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md) erfasst. Alte Checklisten und Messungen beschreiben die damalige Arbeit. Aktuelle Aufgaben und Prüfgrenzen stehen im [Projektstatus](docs/docs_project_status.md).

> **Damals dokumentierter Status: ✅ Geprüft — 2026-05-17**  
> Änderungen an Workflows waren nicht erforderlich. Die folgende Analyse bestätigte, dass alle neuen `.ts`-Dateien über die vorhandenen CMake-/npm-Abläufe kompiliert werden. Diese Datei bleibt als historische Referenz erhalten.

<a id="executive-summary"></a>
## Zusammenfassung
✅ **KEINE ÄNDERUNGEN ERFORDERLICH** für die WebSocket-Implementierung.

Die bestehenden GitHub-Workflows sind **unabhängig von der Backend-Implementierung** und müssen nicht angepasst werden:
- Frontend-Builds verwenden `npm ci` und `npm run build`. ✓
- Backend-Builds verwenden CMake mit der vorhandenen TypeScript-Kompilierung. ✓
- Die Workflows hängen nicht von bestimmten API-Endpunkten oder Polling-Verfahren ab. ✓

<a id="workflow-inventory--impact-analysis"></a>
## Bestandsaufnahme und Auswirkungen der Workflows

<a id="1-pr-linux-variantsyml"></a>
### 1. **pr-linux-variants.yml**
- **Aufgabe:** Linux-Builds für Pull Requests, Varianten Ubuntu, Arch und Fedora.
- **Frontend:** ✅ `npm ci` und `npm run build`, Zeilen 141–145.
- **Backend:** ✅ CMake-Konfiguration und Build.
- **WebSocket-Auswirkung:** keine.
  - Die neue `adminWebSocket.ts` gehört zum bestehenden TypeScript-Build.
  - Keine zusätzlichen Abhängigkeiten erforderlich.
  - Keine neuen Buildschritte erforderlich.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="2-running_server_filesyml"></a>
### 2. **running_server_files.yml**
- **Aufgabe:** Release-Builds des Hauptbranches für die Serververteilung.
- **Frontend:** ✅ `npm ci` und `npm run build`, Zeilen 265–266.
- **Backend:** ✅ CMake und Serverbuild.
- **WebSocket-Auswirkung:** keine.
  - Der WebSocket-Server wird in der vorhandenen `main()`-Funktion initialisiert.
  - Er wird wie der bisherige WebSocket mit dem Server ausgeliefert.
  - Testbuilds können WebSocket bei Bedarf auslassen.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="3-pr-windows-flatrimyml--pr-windows-skyrimvryml"></a>
### 3. **pr-windows-flatrim.yml** und **pr-windows-skyrimvr.yml**
- **Aufgabe:** Windows-PR-Builds für Skyrim AE, SE und VR.
- **Frontend:** ✅ Gemeinsame Action `.github/actions/pr_base`.
- **Backend:** ✅ CMake-Konfiguration.
- **WebSocket-Auswirkung:** keine.
  - Keine Änderung der Frontend-TypeScript-Buildkonfiguration.
  - Die neue `adminWebSocket.ts` wird im bestehenden Backend-Ablauf kompiliert.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="4-deployyml"></a>
### 4. **deploy.yml**
- **Aufgabe:** Manueller Deployment-Workflow für die Branches sweetpie und indev.
- **Frontend:** Kein direkter Build; vorhandene Artefakte werden verwendet.
- **Backend:** ✅ CMake-Build über `./build.sh`.
- **WebSocket-Auswirkung:** keine.
  - Der vorhandene Buildablauf wird genutzt.
  - Keine Anpassung der Deployment-Konfiguration erforderlich.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="5-pr-emscriptenyml"></a>
### 5. **pr-emscripten.yml**
- **Aufgabe:** Emscripten-/WebAssembly-Builds.
- **Frontend:** Nicht beteiligt, nur Backend.
- **WebSocket-Auswirkung:** keine.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="6-prettieryml--formattingyml"></a>
### 6. **prettier.yml** und **formatting.yml**
- **Aufgabe:** Prüfung des Codestils durch Prettier und Linting.
- **Auswirkung:** keine; neue `.ts`-Dateien werden automatisch geprüft.
- **Status:** ✅ Keine Änderung erforderlich.

<a id="7-other-workflows"></a>
### 7. **Weitere Workflows**
- `sp-release.yml`: Skyrim Platform, keine Auswirkung.
- `trigger-installer.yml`: Start des Installers, keine Auswirkung.
- `build-docker-images.yml`: Docker-Images, keine Auswirkung.
- `deploy_gamemode.yml`: Gamemode-Deployment, keine Auswirkung.
- Workflows für Repository-Metadaten: keine Auswirkung.

<a id="build-pipeline-impact-check"></a>
## Prüfung des Buildablaufs

<a id="current-build-flow-unchanged"></a>
### Bestehender Buildablauf (unverändert)
```
GitHub PR → pr-linux-variants.yml
  ├─ npm ci (frontend)
  ├─ npm run build (frontend)
  └─ CMake build (backend, includes ui.ts)
     └─ Compiles new adminWebSocket.ts automatically

GitHub main push → running_server_files.yml
  ├─ npm ci (frontend)
  ├─ npm run build (frontend)
  └─ CMake build (backend)
     └─ Includes WebSocket server
```

<a id="what-changed-transparency"></a>
### Was geändert wurde
✅ Neue Datei: `skymp5-server/ts/adminWebSocket.ts`
- Wird durch den vorhandenen CMake-Ablauf automatisch kompiliert.
- Keine neuen Buildregeln erforderlich.
- Verwendet das npm-Paket `ws`, das bereits als Abhängigkeit vorhanden ist.

✅ Neue Datei: `skymp5-front/src/hooks/useAdminWebSocket.ts`
- Gehört zum bestehenden TypeScript-Frontend-Build.
- Wird automatisch in das Webpack-Bundle aufgenommen.
- Keine neuen npm-Abhängigkeiten.

<a id="what-didnt-change"></a>
### Was unverändert blieb
- npm-Konfiguration. ✓
- CMake-Konfiguration. ✓
- Buildziele. ✓
- Deployment-Ablauf. ✓
- Umgebungsvariablen von CI/CD. ✓

<a id="dependency-check"></a>
## Prüfung der Abhängigkeiten

<a id="backend-dependencies"></a>
### Backend-Abhängigkeiten
```typescript
// adminWebSocket.ts uses:
import * as http from 'http';          // ✅ Node.js built-in
import { WebSocket, WebSocketServer } from 'ws';  // ✅ Already in package.json
```

**Geprüft:** `ws` steht bereits in `skymp5-server/package.json`.
```json
{
  "dependencies": {
    "ws": "^8.x.x"  // ✅ Already present
  }
}
```

<a id="frontend-dependencies"></a>
### Frontend-Abhängigkeiten
```typescript
// useAdminWebSocket.ts uses:
import { useEffect, useRef, useState, useCallback } from 'react';  // ✅ React 18 (already installed)
```

**Geprüft:** Keine neuen npm-Abhängigkeiten erforderlich.
- React-18-Hooks gehören zum Standard.
- Die WebSocket-API des Browsers ist nativ verfügbar; kein Polyfill erforderlich.

<a id="workflow-test-recommendations"></a>
## Empfehlungen für Workflow-Tests

Änderungen sind **nicht erforderlich**. Folgende Erweiterungen der Prüfungen sind optional:

<a id="optional-enhancement-1-add-websocket-health-check-to-workflows"></a>
### Optionale Erweiterung 1: WebSocket-Verbindungsprüfung in Workflows
```yaml
# In running_server_files.yml, after server build:
- name: Verify WebSocket infrastructure
  run: |
    docker run --rm \
      -v "${{ github.workspace }}:/src" \
      -w /src \
      node:22 \
      bash -c "grep -r 'setupAdminWebSocket\|/ws/admin-updates' skymp5-server/ts/"
```

<a id="optional-enhancement-2-frontend-lint-coverage"></a>
### Optionale Erweiterung 2: Lint-Abdeckung im Frontend
```yaml
# In pr-linux-variants.yml:
- name: Lint TypeScript frontend
  run: |
    cd ${{ github.workspace }}/skymp5-front
    npm run lint  # Already in package.json, includes .ts files
```

<a id="optional-enhancement-3-e2e-websocket-test"></a>
### Optionale Erweiterung 3: WebSocket-E2E-Test
```yaml
# In running_server_files.yml after frontend build:
- name: Add WebSocket E2E test
  run: |
    cd ${{ github.workspace }}/skymp5-front
    npm run test:e2e  # Uses test-e2e-smoke.js with WebSocket tests
```

<a id="risk-assessment"></a>
## Risikobewertung

| Risiko | Einstufung | Gegenmaßnahme |
|------|-------|-----------|
| Neue Datei verhindert Build | ❌ Keines | Beide Dateien werden im vorhandenen Ablauf kompiliert |
| Fehlende npm-Abhängigkeit | ❌ Keines | Alle Abhängigkeiten bereits vorhanden |
| Workflow-Anpassung nötig | ❌ Keines | Keine Workflow-Änderungen erforderlich |
| Inkompatible Verhaltensänderung | 🟡 Gering | WebSocket ist optional, HTTP-Rückfall bleibt |
| Leistungseinbuße | 🟡 Gering | Betrifft nur das Admin-Dashboard, nicht den Server-Core |

<a id="deployment-checklist"></a>
## Deployment-Checkliste

- ✅ Keine Workflow-Aktualisierung erforderlich.
- ✅ Keine Änderung an package.json erforderlich.
- ✅ Keine Änderung an CMakeLists.txt erforderlich.
- ✅ Keine GitHub-Secrets oder Variablen erforderlich.
- ✅ Abwärtskompatibel durch HTTP-Polling als Rückfall.
- ✅ Mit dem bestehenden CI/CD-Ablauf kompatibel.

<a id="implementation-status"></a>
## Implementierungsstatus

| Punkt | Status |
|------|--------|
| Codeänderungen werden automatisch kompiliert | ✅ Ja |
| Keine neuen externen Abhängigkeiten | ✅ Ja |
| Keine Workflow-Änderungen erforderlich | ✅ Ja |
| Für Merge und Deployment vorbereitet | ✅ Ja |

---

<a id="conclusion"></a>
## Ergebnis

**Die WebSocket-Implementierung erfordert KEINE Workflow-Änderungen.**

Die neuen TypeScript-Dateien `adminWebSocket.ts` und `useAdminWebSocket.ts` werden automatisch:
- Von den vorhandenen Buildsystemen gefunden.
- Mit den bestehenden TypeScript-Abläufen kompiliert.
- In die fertigen Backend- und Frontend-Bundles aufgenommen.
- Ohne zusätzliche Schritte ausgeliefert.

Die damalige Anleitung empfiehlt, die neuen Dateien zu committen; der bestehende CI/CD-Ablauf übernimmt die weiteren Schritte. ✅
