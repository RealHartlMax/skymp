# skymp5-front

Dieses Repository enthält die GUI-Demo für Skyrim Multiplayer. Die ursprüngliche Chatoberfläche von **davinchi59** wurde portiert.

- `npm run build`: minimierter Produktionsbuild mit JavaScript-gzip-Budget.
- `npm run build:dev`: Entwicklungsbundle zum Debuggen ohne Devserver.
- `npm run watch`: Live-Reload mit automatisch freiem Port.
- `npm run watch:fixed`: Live-Reload auf `1234`.
- `npm run dev:lan`: LAN-/Browsertest auf `0.0.0.0` mit freiem Port.
- `npm run test:api`: Integrationsprüfung des Serverlisten-Endpunkts.
- `npm run test:bundle`: Produktionsbudget einschließlich später geladener Chunks und Entwicklungsmodus prüfen.
- `npm run test:e2e`: optionaler Playwright-Smoke-Test, sofern installiert.
- `npm run test:a11y`: zusätzlich Mobilansicht, axe-WCAG, Dialogfokus und Tastaturnavigation.

Laufen Live-Reload und Skyrim-Multiplayer-Server auf demselben Rechner, funktioniert Live-Reload im Spiel.

## Mobile Bedienung und Tastaturzugänglichkeit

Launcher-Bedienelemente stehen bei schmalen Fenstern untereinander; Inhalte scrollen statt Aktionen abzuschneiden. Breite Tabellen scrollen im eigenen Container. Das Admin-Dashboard scrollt bei Telefonbreiten vertikal. Spielerprofile öffnen über den Namen in der vorhandenen Liste; keine doppelte Tabelle im Kopfbereich.

Launcher-, Dashboard-, Update-, Warn-, Profil-, Adminnutzer- und Whitelist-Dialoge teilen die Fokussteuerung: Tab/Umschalt+Tab bleiben im aktiven Dialog, Escape schließt den obersten und stellt den Fokus am Auslöser wieder her. Der Hintergrund ist bei Modals inaktiv. Profil-/Dashboard-/Konfigurationstabs unterstützen Links/Rechts und Home/End. Schließen und Felder haben zugängliche Namen in allen sechs Sprachen. Konfigurationsergebnisse werden live angekündigt, auch der Inventar-Scrollbereich ist per Tastatur erreichbar.

Adminnutzerformulare unterstützen Enter zum Speichern und Escape zum Abbrechen. Während des Speicherns sind Felder/Schließen gesperrt. API-Fehler bleiben mit den Eingaben sichtbar. Dialoge scrollen bei geringer Höhe. Whitelist-Freigaben verwenden dasselbe Verhalten und prüfen `type:value` vor dem Schreiben. Suche ist beschriftet, Tabelle per Tastatur scrollbar.

Serverseitige `/admin`-Anmeldung, Einrichtung und Migration haben sichtbaren Fokus, angekündigte Fehler und Scrolllayout. Laufende Anfragen sperren Felder und konkurrierende Aktionen. Setup nennt Passwortregeln, Migration bezeichnet altes/neues Passwort getrennt. Die deutsche Dokumentsprache entspricht dem Servertemplate.

Die Ingame-Anmeldung verwendet das `AuthService`-OAuth-Widget über `components/WidgetForm`. Unbenutzte E-Mail-/Passwort-Demos wurden entfernt. Beim Start wird `localStorage.password` gelöscht; native OAuth-Sitzungen bleiben erhalten. Gemeinsame Bedienelemente behalten ihre Callbacks, echte deaktivierte Buttons, zugeordnete Labels und native Checkboxen. Spielformulare scrollen auf niedrigen Displays, brechen lange Servernamen um und behalten Fokus bei Statusupdates. Login-Kommentare verwenden eine Live-Statusregion. Der gemeinsame Skin liegt nun in `components/WidgetForm/legacyControls.scss`.

Starte `npm run watch` und verwende den ausgegebenen Port für die Prüfungen in einem zweiten Terminal, alternativ eine bereitgestellte Produktionsausgabe:

```powershell
$env:PLAYWRIGHT_E2E_URL = 'http://127.0.0.1:1234/?devUi=1'
npm run test:a11y
```

Der Test simuliert API/WebSocket. Er prüft hellen/dunklen Launcher, Spieler, Respawn, Events, Warnung, drei Profiltabs, Admin-Erstellen/Bearbeiten/Fehler, vier Konfigurationstabs, Whitelist-Panel/Dialog/Fehler/Einträge, Adminlogin/Fehler/Setup/Migration und drei Ingame-Widgetzustände bei **360 und 1280 Pixeln**: 54 axe-Prüfungen sowie Fokuszyklus/-rückgabe, verschachteltes Escape und Tabtasten. Der normale Smoke prüft außerdem Nutzeranlage, Rollen, ungültige Discord-IDs, abgewiesenes Speichern, Abbruch ohne Schreibzugriff und Erhalt fremder JSON-Felder. Dazu kommen Whitelist-Validierung/Wiederholung/Abbruch/Aktualisierung, Anmeldung, doppelte laufende Anfragen, Setup, Migrationsdaten und Discord-Einstiegsweiterleitung. Bei 360 × 480 bleiben Aktionen erreichbar.

`scripts/game-widget-checks.js` extrahiert die echte Widget-Factory aus dem Client und prüft OAuth/Play/Serverwahl, Fokus bei Aktualisierung, alte Passwortbereinigung, Input-Callbacks und Tastatur-Checkboxen. Die native Brücke wird simuliert, kein echtes Konto angemeldet. Fehlendes Playwright führt zum Fehler statt erfolgreichem Überspringen. JSON/Screenshots landen in `.cache/accessibility/`, von Git ignoriert. axe-`incomplete` bleibt für manuelle Prüfung erhalten. Die Tests ersetzen weder Screenreader, übrige Formulare, echten Discord-Callback noch Skyrim/CEF. `scripts/admin-form-checks.js` und `scripts/admin-auth-checks.js` fangen Schreibzugriffe ab; keine echten Konten/Einstellungen werden verändert. Auth-Tests rendern dasselbe `skymp5-server/ts/adminLoginPage.ts` wie `/admin` und fangen API-Aufrufe ab.

Neue Modals mit `ModalDialog`, zugänglichem Namen und `onClose` erstellen, nicht mit globalem Escape-Listener. Breite Inhalte in Scrollcontainer und vertikales Schrumpfen erlauben.

Für den geplanten Linux-VPS mit 12 vCores/24 GB siehe [Linux-Build und Betrieb](../docs/docs_linux_vps.md). Native Serverdateien müssen für Linux gebaut werden; Frontendassets sind portabel, Windows-`scam_native.node` nicht. Windows-Spielclients erhalten ihr Plugin separat. Testpakete vom 19.10.2026 enthalten auf beiden OS dieselbe Produktions-UI. Native Ergebnisse: [Prüfbericht](../docs/docs_native_validation_2026_10_19.md). VPS-Deployment und Skyrim/CEF bleiben eigene Schritte.

## Produktionsbuild und Bundlebudget

`npm run build` verwendet Webpack-Produktion. Alle watch/dev:lan-Befehle setzen Entwicklung für Hot Reload/Diagnose. Ein einzelner `build.js`-Einstieg bleibt mit Server-HTML/UI-Paketierung kompatibel, ohne neue Runtime-Chunkdownloads.

Jeder erfolgreiche Build schreibt `bundle-size.json` neben `build.js` am konfigurierten `outputPath`: Roh-/gzip-Größe je JavaScript, Initialkennzeichen, Summen, Modus und Budgetstatus. Alte Reste zählen nicht. Bilder, Audio, Lizenzen und Sourcemaps gehören nicht zum JS-Budget. gzip beschreibt Übertragungsgröße mit Kompression und behauptet weder Serverkompression noch Laden von gzip im Spiel.

Produktion scheitert über **850 KiB gzip** für alle ausgegebenen JavaScript-Dateien einschließlich zukünftiger Lazy-Chunks. Das gilt auch in bestehenden CI-Vorprüfungen. CMake kopiert den Bericht mit vorgebauten Assets. Entwicklung meldet nur Größen. Erste Basis: **813.004 Bytes gzip** statt **1.153.515 Bytes** des alten Entwicklungsbundles. Das Ziel **500 KiB** bleibt offen; Aufteilung/Lazy Loading folgen später. Guard: `scripts/bundle-budget-plugin.js`. Bei Fehlern werden Größen genannt; vorhandene Ausgaben können vom vorherigen erfolgreichen Build stammen und sind kein neuer Bericht.

## Verwendung

`config.js` mit Ausgabeordner erstellen:

```js
module.exports = {
  /* TIP: Change to '<your_server_path>/data/ui' */
  outputPath: './dist',
};
```

## Devserver im Browser und LAN

Webpack hört auf allen Interfaces.

1. Devserver starten:

```bash
npm run watch
```

Ist `1234` belegt, wird automatisch ein freier Port gewählt. Fester Port:

```bash
npm run watch:fixed
```

Expliziter LAN-/Browsertest mit freiem Port:

```bash
npm run dev:lan
```

2. Lokal im Browser:

```text
http://127.0.0.1:<printed-port>/
```

3. Auf einem anderen LAN-Gerät:

```text
http://<your-lan-ip>:<printed-port>/
```

Ohne Spielclient angemeldeten Overlaymodus erzwingen:

```text
http://127.0.0.1:1234/?devUi=1&devOverlay=serverList
http://127.0.0.1:1234/?devUi=1&devOverlay=admin
```

`devOverlay` akzeptiert `serverList`, `admin` oder beide mit Komma.

Bei `?devUi=1` zeigt das Devbanner UI-URL und `/api`-Proxyziel. Ein kleiner `/api/servers`-Erreichbarkeitstest meldet `reachable`, `timeout`, `network error` oder HTTP-Status. Dazu Retry, Zeit seit Erfolg und Countdown. Pause/Resume bleibt in localStorage gespeichert, Reset warnings löscht Warnungen; wiederholte Fehler erzeugen eine Warnung.

Stabile `data-testid`-Selektoren:

- `dev-banner-health-controls`
- `dev-banner-health-status`
- `dev-banner-retry-btn`
- `dev-banner-pause-btn`
- `dev-banner-reset-warnings-btn`
- `dev-banner-health-meta`
- `dev-banner-health-warning`, nur bei sichtbarer Warnung.

Host, Port, Backendziel und Prüfintervall überschreiben:

```bash
SKYMP_FRONT_HOST=0.0.0.0 SKYMP_FRONT_PORT=1234 SKYMP_FRONT_API_TARGET=http://127.0.0.1:7777 npm run watch
```

```bash
SKYMP_FRONT_HEALTH_MS=5000 npm run watch
```

Playwright-Smoke mit anderem Ziel:

```bash
PLAYWRIGHT_E2E_URL=http://127.0.0.1:1234/ npm run test:e2e
```

Im reinen Browsermodus `?devUi=1` werden Metrik-Posts ohne expliziten Endpunkt unterdrückt, damit ein fehlendes Backend auf `7777` keine Proxyfehler wiederholt. Für Ingestiontests ein Backend starten und vor dem Laden den Endpunkt setzen:

```js
window.SKYMP_METRICS_ENDPOINT = 'http://127.0.0.1:7777/api/frontend/metrics';
```
