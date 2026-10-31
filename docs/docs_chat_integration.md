# SkyMP Chat: Client-Anbindung und Runtime-Auslieferung

Wenn Chat und YACA auf dem Server geladen sind, im Spiel aber Enter/F8 nichts
anzeigen: [Runtime-Abgleich und nachgewiesene Clientfehler](docs_plugin_ui_troubleshooting.md).

## Aktueller Architekturstand: Plugin Runtime API 1

Seit der Quellvorbereitung vom **29. Oktober 2026** besitzt das separate
`SkyMP-Chat`-Repository seine Client-/CEF-Quellen und die Werkzeuge zur Erzeugung
des eigenen `Plugins/SkyMPChat/Runtime/`-Pakets. Der Core behält den gemeinsamen
Client-Bootstrap, den generischen Runtime-Loader und den CEF-Host. Der Launcher
lädt und prüft die vom aktiven Gameserver veröffentlichten, signierten
Plugin-Runtimes. Kompatible Änderungen am Chat-Plugin erfordern nach diesem
einmaligen Bootstrap-Update keinen neuen Launcher-EXE-Build.

Der verbindliche Vertrag, die Verzeichnisstruktur, Signaturen, Aktivierung und
Downloadgrenzen stehen im [Plugin-Runtime-Leitfaden](docs_plugin_runtime.md) und
unter [Runtime API 1](../misc/plugin-runtime/README.md). Native DLLs bleiben in
der zentralen, Skyrim-versionsabhängigen Basisruntime. Die Runtime-Umstellung
ist Quellvorbereitung; daraus entstehen in diesem Auftrag keine neuen
Releasepakete oder veröffentlichten Downloads.

## Historische Bootstrap-Auslieferung vom 27.–28. Oktober 2026

Die folgenden Abschnitte beschreiben die vorherige gemeinsame Chat-Integration
und ihre damals geprüften Pakete. Die zugehörigen Client-/CEF-Quellen und
Buildwerkzeuge lagen im Core; fertige Auslieferungspakete lagen im
Launcher-Repository `D:\GitHub\skymp-client-launcher` unter `local-builds/`.
Diese historischen Befehle und Testergebnisse dokumentieren die damalige
Bootstrap-Basis und ersetzen nicht den neuen Plugin-Runtime-Vertrag.

## Aufbau

- `skymp5-client/src/services/services/chatBridge.ts`: vorhandene zuverlässige
  CustomPackets ↔ vorhandener SkyrimPlatform-Browser. BrowserService verwaltet
  Enter/Escape/F6/F2 und die Menüsperren; KeyboardEventsService erkennt Tastenkanten.
- `skymp5-front/src/features/chat/bridge.js`, `reducer/` und
  `constructorComponents/chat/`: ein gemeinsamer Redux-Chat, Textdarstellung,
  Input-Fokus, begrenzter Verlauf und Plugin-Status. Keine zweite Chat-Webseite.
- `skymp5-front/scripts/build.cjs`: lokaler Produktionsbuild mit den bestehenden
  Webpack-Regeln und Gzip-Budget. `assets-manifest.json` nennt ausschließlich die
  tatsächlich gebauten Assets, damit alte Dateien in `dist` nicht veröffentlicht werden.
- `skymp5-front/CMakeLists.txt`: `BUILD_FRONT=ON` baut diese lokalen Quellen nach
  `build/dist/client/Data/Platform/UI`; kein Upstream-Download und kein Frontend-PAT.
- `misc/deploy/package_client_runtime.cjs`: neue vollständige Runtime aus einer
  bereits vorhandenen, hashgeprüften passenden Basis plus aktuellen Client-/CEF-
  Builds. Katalog v2, Runtime-Manifest v1 und ZIP bleiben mit dem vorhandenen
  Launcher kompatibel. Launcher-Quellcode wird nicht geändert.

Ein aktives SkyMP Chat verwendet den reparierten vorhandenen Chat. Ein ausdrücklich
von einem alten Gamemode bereitgestellter Widget-Callback bleibt als Legacy-
Fallback erhalten, falls das Plugin fehlt. Ein vollständig exklusiver Plugin-
Modus war nicht Teil dieser Repository-Trennung.

## Anzeige und Serverregeln ab SkyMP Chat 1.1

Die Einstellungen stehen ausschließlich im Server-Plugin unter
`Plugins/SkyMPChat/config.json` (separates Chat-Repository). Die bestehende
Client-Bridge reicht sie im API-v1-Handshake an den vorhandenen Redux-Store weiter.
Der Server ist für Nachrichtenrouting und Command-only-Regeln autoritativ.

```json
{
  "hideAfterSeconds": 15,
  "showOnMessage": true,
  "showJoinMessages": true,
  "commandsOnly": false,
  "chatMode": "global",
  "proximityRadiusMeters": 30
}
```

- Enter/F6 öffnet den Chat mit Eingabe; währenddessen läuft kein Ausblendtimer.
  Nach Escape/F6/Menüöffnung wird nur das Chat-HUD nach 15 Sekunden verborgen,
  ohne andere CEF-Oberflächen oder Browser-Sichtbarkeit zu verändern. Entwurf und
  Verlauf bleiben erhalten. Wiederholtes Schließen verlängert die Frist nicht.
- `showOnMessage: true` zeigt frische Nachrichten kurz an und startet die Frist
  erneut, ohne Fokus zu nehmen. `false` sammelt sie im Verlauf und öffnet das HUD
  nur über die Tastatur. `hideAfterSeconds`: ganze Sekunden von 1 bis 300.
- `chatMode`: `global`, `cell` (gleiche Innenzelle bzw. dasselbe Außenraster
  derselben Welt) oder `proximity` (3D-Radius in Metern innerhalb derselben Welt
  oder Innenzelle). Außen sind benachbarte Zellraster im Radius erlaubt.
  Fehlende Raumdaten führen zu keinem globalen Fallback; keine Sichtlinienprüfung.
- `commandsOnly: true` sperrt normalen Text, Slash-Escape, alle Broadcasts und
  private Spieler-/System-API-Nachrichten. Private Command-/Fehlerantworten,
  `/help` und registrierte Fremd-Commands bleiben verfügbar. Keine neuen Rechte.
- `showJoinMessages: true` erzeugt eine globale Systemmeldung nach der ersten
  authentifizierten Chat-Bereitschaft mit Servernamen; UI-Reloads wiederholen sie
  nicht. `false` deaktiviert sie. Command-only unterdrückt diese Meldungen immer.

Nach Konfigurationsänderung den Gameserver vollständig neu starten. Für neue
Anzeigeoptionen müssen Spieler diesen neuen Frontend-Build erhalten und Skyrim
neu starten. Der vorhandene Client-Adapter benötigt dafür keine neue native DLL.
Ältere API-v1-Server ohne Anzeigeangaben verwenden 15 Sekunden, automatische
Nachrichtenanzeige und normalen Chat als Defaults.

## Build und Tests

PowerShell im Fork `D:\GitHub\skymp`:

```powershell
npm --prefix skymp5-client run build
npm --prefix skymp5-front run build
npm --prefix skymp5-client run test:chat
npm --prefix skymp5-front test
node --test misc/tests/test_client_runtime_package.cjs
node misc/tests/test_frontend_source_build.cjs
```

Der CMake-Test konfiguriert ein isoliertes Projekt ohne Frontend-PAT und baut den
tatsächlichen Frontend-Target. Der Chat-Client-Test benötigt kein Plugin-Checkout.
Für optionale Browser-Interop kann
`skymp5-front/scripts/chat-browser-host.cjs` mit `createHost({pluginRoot})` den
fertigen CEF-Build und den tatsächlichen gebündelten Plugin-Entry verbinden. Der
Pluginpfad wird ausdrücklich übergeben; der Fork enthält keine Kopie des Plugins.

## Neue Client-Runtime für den VPS vorbereiten

Eine zur Skyrim-Version passende vollständige Basis mit `runtime-manifest.json`
bereitstellen. Diese muss native Clientdateien, CEF-Abhängigkeiten, SKSE und die
passende Address Library bereits enthalten. Der Paketierer baut keine DLLs und
bestätigt keine neue native Skyrim-Kompatibilität.

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/reports/yaca-client-2026-10-27/client-runtime `
  --catalog build/client-delivery-2026-10-25-threadpool/client-runtime/catalog.json `
  --release client-2026-10-27-chat `
  --output build/client-delivery-2026-10-27-chat
pwsh -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-27-chat
```

Die Pfade sind der tatsächlich lokal verwendete Stand; bei einem anderen Checkout
explizit dessen passende Basis und bisherigen Katalog einsetzen. Bereits bestehende
Ausgabeordner werden abgewiesen. Alle Basisdateien werden vor dem Kopieren gegen
ihre deklarierte Größe und SHA-256 geprüft. Native Dateien bleiben bytegleich;
ersetzt werden der gebaute Client und die gebauten CEF-Assets. Private Einstellungen,
Auth-Dateien, Logs, Links und Bethesda-Spieldateien werden nicht paketiert.

Ausgabe:

```text
build/client-delivery-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
      runtime-manifest.json
      Data/…
      skse64_loader.exe
      skse64_1_7_104.dll
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

Der Katalog enthält den SHA-256 der neuen Manifestdatei; das Manifest enthält
Größe und SHA-256 jeder installierten Datei. Weitere Skyrim-Versionen im
übergebenen Katalog werden erhalten. Deren vorhandene Dateien bleiben auf dem
VPS liegen und werden vom neuen ZIP nicht gelöscht oder ersetzt.

### Upload-Reihenfolge

1. Den **neuen Versionsordner** aus `upload/client-runtime/` in den bestehenden
   Runtime-Webroot des VPS kopieren, etwa unter der bereits konfigurierten
   Runtime-Quelle `…/client-runtime/`. Vorhandene Versionsordner erhalten.
2. Erst nach vollständigem Upload `client-runtime/catalog.json` austauschen.
   Bei einem inzwischen geänderten Live-Katalog zuerst dessen weitere Versionen
   als `--catalog`-Eingabe verwenden und lokal neu paketieren.
3. Das Server-Plugin getrennt als `Plugins/SkyMPChat/` im Arbeitsverzeichnis des
   Gameservers installieren, erkennen lassen, im Dashboard aktivieren und
   Gameserver vollständig neu starten. Kein VPS-/Rechner-Neustart erforderlich.
4. Spieler erhalten die neue Runtime über den bestehenden Launcher und starten
   Skyrim nach dem Dateiaustausch neu.

Das Runtime-ZIP gehört zum Runtime-Webroot, nicht in den Gameserver-Plugin-Ordner.
Ein bloßer Server-Plugin-Upload aktualisiert keine Clientdateien.

## Prüfgrenzen

Paketierung/HTTP-Dateiauslieferung, Hash-/Katalogkette, Client-Adapter, Frontend-Build
und Browser-Interop sind lokal prüfbar. Zwei Chromium-Kontexte oder native
Mock-Verbindungen ersetzen keine zwei Skyrim-Clients. Tatsächlicher Skyrim-/CEF-
Fokus, native Tastaturunterdrückung, Steam-Spielstart und Zwei-Spieler-Ingame-
Verhalten bleiben ein manueller Smoke-Test. Es wurde nichts auf einen VPS geladen.

Linux-Entsprechung: dieselben Node-/npm-Befehle mit `/`-Pfaden und Shell-
Zeilenfortsetzung `\`; ZIP-Erzeugung benötigt das übliche `zip`-Programm.
Diese Repository-Trennung wurde auf Windows geprüft; Linux wurde nicht ausgeführt.

## Geprüftes lokales Paket vom 28.10.2026

Ausgeführt im Fork:

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat `
  --catalog build/client-delivery-2026-10-27-chat/upload/client-runtime/catalog.json `
  --release client-2026-10-28-chat-1.1 `
  --output build/client-delivery-2026-10-28-chat-1.1
pwsh -NoProfile -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-28-chat-1.1
```

PASS: 213 installierte Dateien, 38 binäre Text-Downloads, 73 unveränderte native
Dateien; 253 ZIP-Einträge separat mit .NET geprüft. Das bestehende Client-JavaScript
ist bytegleich; diese Erweiterung benötigt den neuen Frontend-Build und das neue
Server-Plugin. Der vorhandene Launcher-Validator
`D:/GitHub/skymp-client-launcher/launcher/scripts/validate-runtime-package.mjs
--root D:/GitHub/skymp/build/client-delivery-2026-10-28-chat-1.1/upload/client-runtime`
prüfte die vollständige Katalog-/Manifest-/Dateikette ebenfalls erfolgreich.

Den ganzen neuen Versionsordner **einschließlich `payloads/`** im binären Modus
übertragen und den Katalog zuletzt austauschen. Vorhandene Live-Versionen erhalten;
bei abweichendem Live-Katalog vor Veröffentlichung dessen andere Einträge erhalten.
Es wurde nichts hochgeladen oder an einer Spielinstallation verändert. Neue
Anzeige-/Reichweiten-/Join-Einstellungen bleiben in Skyrim noch manuell abzunehmen.

## Konfigurierbare Sprachdateien ab SkyMP Chat 1.2

`locale` in der Server-Plugin-Konfiguration wählt `locales/de.json` oder
`locales/en.json`; eigene Dateien sind möglich. Die drei Gruppen `server`,
`validation` und `ui` gehören zum Server-Plugin im separaten Chat-Repository.
Dateien/fehlende Schlüssel bekannter Sprachen haben eingebettete Defaults.
Ungültiges JSON, unbekannte Schlüssel oder Platzhalter erzeugen einen Startfehler.

Der vorhandene API-v1-Handshake reicht `localization: {locale, ui}` durch den
Client an den bestehenden Redux-Chat weiter. Chat-Beschriftungen und Zeitformat
verwenden diese Sprache, ohne die globale Sprache anderer Menüs zu ändern.
Disconnect/Serverwechsel verwirft die vorherigen Texte; ältere Server ohne
Metadaten behalten den bisherigen Client-Fallback. Texte werden als Text gerendert.

Einmal den neuen Frontend-Build verteilen. Spätere JSON-/Sprachänderungen benötigen
nur einen vollständigen Gameserver-Neustart. Native DLLs und Launcher-Code werden
dafür nicht geändert. Fremd-Plugins erhalten `ctx.locale` für eigene Texte.

Geprüfte Auslieferung für 1.2: `D:/GitHub/skymp-client-launcher/local-builds/releases/v0.2.1/client-runtime-chat-1.2.0-2026-10-28`.
213 Installationsdateien, 38 binäre Text-Downloads und 253 ZIP-Dateieinträge
wurden geprüft. Das Client-JavaScript und alle 73 nativen Dateien sind bytegleich
zur angegebenen 1.1-Basis; nur der Frontend-Build wird ersetzt.
41 Plugintests, 15 Clienttests, elf bisherige Browsergruppen und vier Sprachgruppen
sind grün. Neue Sprach-/JSON-Funktionen sind noch nicht in Skyrim geprüft.

## Geprüfte Kompatibilität mit der Console-Security

Geprüft am 31.10.2026 gegen den tatsächlichen Stand von `SkyMP-Chat` (`Plugins/SkyMPChat/api.d.ts`, `src/registry.cjs`, `src/runtime.cjs`):

- Der Chat bleibt die einzige Command-Registry. Andere Plugins registrieren `/`-Commands über `globalThis.skympChat.registerCommand`. Der Core parst keine `/`-Commands.
- Native Konsolenbefehle (`MsgType.ConsoleCommand`, Handshake `consoleSecurity:*`) und Chat-Commands (CustomPackets `skympChat:*`) laufen getrennt. `ConsoleSecurity::ValidateRequest` lehnt `/`-Commands ab.
- Der Chat fasst keine Konsolenbefehle an und braucht `consoleCommandsService` nicht. Die Console-Security ändert keine Chat-Tasten und keine Chat-Pakete.
- Beide Systeme haben getrennte Berechtigungs-Resolver. Eine optionale Rollen-Brücke steht in [SkyMP Console Security](docs_console_security.md).
- Der Core funktioniert ohne Chat-Plugin. Das Chat-Repository brauchte für die Console-Security keine Codeänderung.
