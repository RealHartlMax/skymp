[Deutsch](docs_server_ports_usage.md) · [English](../../en/docs/docs_server_ports_usage.md) · [Русский](../../ru/docs/docs_server_ports_usage.md)

<a id="server-ports-usage"></a>

# Verwendung der Serverports

Im Normalbetrieb gibt es einen UDP-Spiel- und einen separaten TCP-/HTTP-Listener. Die folgenden Webpack- und Chromium-Ports dienen der Entwicklung. Diese Seite beschreibt deren Aufgaben; konfigurierte HTTP- und UDP-Portnummern dürfen auch identisch sein.

Leite bei den aktuellen Testpaketen **7777/UDP** für das Spiel und **8080/TCP** für HTTP/WebSocket weiter. Der [VPS-Firewall- und Prozessleitfaden](docs_vps_ports_and_process_control.md) enthält HTTPS-Empfehlungen, konkrete Regeln und das vollständige unabhängige Dashboard bei gestopptem Spielbackend (ab r3).

<a id="main-port"></a>

## Hauptport

Für Synchronisierung und grundlegende Netzwerkkommunikation.

- Protokoll UDP
- Standard 7777
- Über [Konfigurationsdatei](docs_server_configuration_reference.md) oder [Kommandozeilen-API](docs_server_command_line_api.md) konfigurierbar

## UI-Port

Für eingebetteten Browser, Admin-Dashboard, Moddownloads und optionales Client-Runtime-Hosting. Hier liest der Launcher `/api/launcher/manifest`.

- Protokoll HTTP
- Über `uiPort` in `server-settings.json` konfigurierbar
- Ohne `uiPort` wird derselbe Wert wie `port` verwendet
- `uiListenHost` bestimmt die Bindeadresse dieses HTTP-Listeners
- Lokale Testpakete verwenden `uiPort: 8080`; prüfe die tatsächliche Serverkonfiguration
- Entfernte Launcher-Downloads benötigen neben dem UDP-Spielport eine extern erreichbare HTTP(S)-Basis-URL

## Webpack-Devserver-Port

Laufen Webpack-Devserver und skymp-Server auf demselben Rechner, leitet skymp UI-Anfragen an Webpack weiter. So kannst du Spielsysteme mit Frontend-Live-Reload testen.

- Entwicklungsprüfung: `http://localhost:1234`
- Falls erreichbar, werden `/ui/*`-Anfragen dorthin weitergeleitet
- Andere API-/Assetanfragen beantwortet die integrierte Serveranwendung

## Chromium DevTools

Dies ist kein serverseitiger Port. Der eingebettete Browser öffnet Port 9000 für entfernte DevTools. Öffne `localhost:9000` in deinem normalen Browser, um die Chromium-DevTools des Spielbrowsers aufzurufen.
