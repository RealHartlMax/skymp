<a id="roadmap-update-instructions"></a>
# Anleitung zur Aktualisierung der ROADMAP

> Historischer Implementierungsvermerk. Am 22. Oktober 2026 geprüft: Die sechs Datenströme sowie Wiederverbindung und HTTP-Rückfall sind bereits in [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md) erfasst. Die alten Checklisten und Messungen beschreiben die damalige Arbeit. Aktuelle Aufgaben und Prüfgrenzen stehen im [Projektstatus](docs/docs_project_status.md).

> **Damals dokumentierter Status: ✅ Übernommen — 2026-05-17**  
> Alle Anweisungen dieser Datei wurden in `ROADMAP_FRONTEND.md` übernommen. Die WebSocket-Zeile der txAdmin-Vergleichstabelle steht auf `✅ Done`; der Abschnitt „WebSocket Observability Checkpoint (2026-05-17)“ wurde ergänzt.  
> Diese Datei bleibt ausschließlich als historische Referenz erhalten.

**Position in ROADMAP_FRONTEND.md:** ungefähr Zeile 95 in der Tabelle „txAdmin Parity Snapshot“.

<a id="update-to-make"></a>
### Vorgesehene Änderung

Diese Zeile suchen:
```
| WebSocket-first real-time updates                 | 🔄 In progress       | Polling is primary, but live-console WebSocket stream exists; broader push updates are still planned            | Needed for txAdmin-like live feel at scale                                  |
```

Durch diese Zeile ersetzen:
```
| WebSocket-first real-time updates                 | 🔄 In progress       | Backend WebSocket server (`/ws/admin-updates`) infrastructure created; frontend `useAdminWebSocket` hook implemented with auto-reconnect + exponential backoff; integration guide + patches ready; migration path documented (Status/Players → Logs/Events → History → Respawn)              | Status + Players phase starting (est. 1-2 weeks for full rollout)            |
```

---

<a id="update-recommended-next-adoption-steps-section"></a>
## Abschnitt „Recommended Next Adoption Steps“ aktualisieren

**Position:** ungefähr Zeile 101 nach der txAdmin-Vergleichstabelle.

<a id="old-text"></a>
### Alter Text:
```
1. Extend guarded server control with richer operator diagnostics (which supervisor is active, last action result, command health checks).
2. Expand Players into a txAdmin-style player profile modal (notes/history/identifiers/warn templates).
3. Add a first scheduler page for planned restarts and warning announcements.
4. Introduce WebSocket push for dashboard status/player/events to reduce polling lag and API load.
```

<a id="new-text"></a>
### Neuer Text:
```
1. **WebSocket Status + Players phase** (this week): Migrate status/players polling to WebSocket; measure latency improvement (target: 1000ms → 50ms); deploy with HTTP fallback.
2. **WebSocket Logs + Events phase** (next week): Add broadcast calls to log/event handlers; migrate Logs/Events panels to WebSocket streams; add append-only pattern for history.
3. **WebSocket History + Respawn phase** (week 3): Complete real-time updates for all admin dashboard data; measure total polling elimination.
4. **Server control enhancements** (parallel): Richer operator diagnostics (which supervisor is active, last action result, command health checks).
5. **Scheduler page** (week 4): First-class page for planned restarts, warning announcements, scheduled maintenance.
6. **RBAC policy editor** (week 5): Full role-based access control UI + audit model.
```

---

<a id="summary-of-changes"></a>
## Zusammenfassung der Änderungen

✅ **Abgeschlossen:**
- Backend-WebSocket-Infrastruktur (`skymp5-server/ts/adminWebSocket.ts`).
- Frontend-Hook für WebSocket (`skymp5-front/src/hooks/useAdminWebSocket.ts`).
- Integrationsanleitung mit konkreten Codeänderungen (`WEBSOCKET_INTEGRATION_GUIDE.md`).
- Detaillierte Patchdatei (`WEBSOCKET_PATCHES.md`).
- Sitzungsplan (`/memories/session/websocket-plan.md`).

🔄 **Zur Umsetzung vorbereitet:**
- Patches 1–2: WebSocket im Backend initialisieren.
- Patches 4–5: Polling für Status und Spieler migrieren.
- Mit einem Entwicklungsserver testen.

📋 **Nächste Phasen:**
- Woche 2: Logs und Ereignisse.
- Woche 3: Verlauf und Respawn.
- Wochen 4–5: Zeitplanung und RBAC.

---

<a id="files-reference"></a>
## Dateiverweise

1. **Neue Backend-Datei:** `skymp5-server/ts/adminWebSocket.ts`
   - Einrichtung des WebSocket-Servers.
   - Broadcast-Funktionen für jeden Ereignistyp.
   - Erfassung verbundener Clients und Aufräumen.

2. **Neue Frontend-Datei:** `skymp5-front/src/hooks/useAdminWebSocket.ts`
   - Haupthook: `useAdminWebSocket(onMessage, enabled)`.
   - Hilfshook: `useAdminWebSocketMessages(type, onMessage, enabled)`.
   - Automatische Wiederverbindung mit exponentiell wachsenden Wartezeiten.
   - Vollständige Typsicherheit durch TypeScript.

3. **Integrationsanleitungen:**
   - `WEBSOCKET_INTEGRATION_GUIDE.md`: Überblick und Vorgehen.
   - `WEBSOCKET_PATCHES.md`: konkrete Codeänderungen je Datei.

---

<a id="quick-start"></a>
## Schnellstart

<a id="to-test-websocket-infrastructure-without-full-integration"></a>
### WebSocket-Infrastruktur ohne vollständige Integration testen:

1. Patches 1 und 2 in `ui.ts` übernehmen: Imports und Initialisierung.
2. Backend mit `npm run build` in `skymp5-server` bauen.
3. Server im Entwicklungsmodus starten.
4. Browserkonsole öffnen und testen:
```javascript
const ws = new WebSocket('ws://localhost:7777/ws/admin-updates');
ws.onmessage = (e) => console.log('Update:', JSON.parse(e.data));
```

Erwartete Ausgabe:
```
Update: { type: 'connected', ts: 1234567890, data: { clientCount: 1 } }
Update: { type: 'status', ts: 1234567891, data: { ... } }
Update: { type: 'players', ts: 1234567891, data: { ... } }
```

---

<a id="performance-expectations"></a>
## Erwartete Leistung

Nach der WebSocket-Migration:

| Messgröße | Polling vorher | WebSocket nachher |
|--------|-----------------|------------------|
| Latenz der Statusanzeige | ~1000 ms | ~50 ms |
| API-Aufrufe/Sekunde | 1–2 | 0,1 (nur zu Beginn) |
| Bandbreite (Status/Spieler) | 2–3 KB/s | 0,3–0,5 KB/s |
| CPU für Admin-Polling | ~2 % | ~0,3 % |
| Speicher je Client | 10 KB | 50 KB |

---

<a id="implementation-checklist"></a>
## Checkliste für die Umsetzung

- [ ] Erstellte WebSocket-Dateien prüfen.
- [ ] Patches 1–2 in ui.ts übernehmen.
- [ ] WebSocket-Verbindung testen.
- [ ] Patches 4–5 für Status und Spieler in index.tsx übernehmen.
- [ ] E2E-Test für WebSocket und Rückfall durchführen.
- [ ] ROADMAP aktualisieren.
- [ ] GitHub-Issue für die Phase Logs/Ereignisse erstellen.
- [ ] Leistung gegenüber Polling messen.
