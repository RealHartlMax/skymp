# Projektstand und offene Aufgaben

Quellstand-Ergänzung **29. Oktober 2026**: [v2.1.0-Vorbereitung und Plugin Runtime
Loader](docs_plugin_runtime.md). Inventar-Snapshot, Offline-Aktionen und das
Release-Repository sind korrigiert; die generischen Loader sowie Plugin-/Launcher-
Quellen sind ergänzt. Die Quelltests und No-Emit-Prüfungen sind vom späteren
vollständigen Build und der Skyrim-/CEF-/TeamSpeak-Abnahme getrennt. Für diese
Ergänzung wurden keine Builds, ZIPs, Commits oder Pushes erstellt. Die folgenden
älteren Versions- und Buildangaben bleiben historische Nachweise.

Stand: **26. Oktober 2026** für den Serverbuild; letzter Dokumentationsabgleich
des separaten Launchers am **24. Oktober 2026**. Betrachtet werden der lokale
Server-Fork `D:\GitHub\skymp` und der Launcher `D:\GitHub\skymp-client-launcher`.
Der Server basiert auf Commit `4372c37e`; darüber liegen lokale Änderungen an
Spielerprofilen sowie Dashboard-Übersicht, Navigation und Neustartplanung. Zum
separaten Launcher wurde für diesen Serverbuild kein neuer Quellabgleich
durchgeführt. Diese Übersicht beschreibt den
lokalen Quellstand und vorhandene Nachweise, keine erfolgte Veröffentlichung.

## Was als erledigt zählt

Mit r12 kommen die [Dashboard-Betriebsfunktionen](docs_dashboard_operations.md)
hinzu: direkter Zugang zu den gemeinsamen Einstellungsformularen, Übersicht mit
echten Prozess-/Tickwerten, dauerhafte Sechs-Stunden-Abbruchstatistik und tägliche
Gameserver-Neustarts mit Zeitzone, Vorwarnungen und gespeichertem Überspringen.
Der Neustartplan startet keine gestoppten Gameserver. Der Vergleich mit txAdmin
8.1.1 war lesend; der RedM-Server wurde nicht verändert. Reale Skyrim-/CEF- und
Discord-Abnahme bleiben von lokalen Browser-/Prozesstests getrennt.

| Aufgabe | Status und Grenze | Nachweis |
| --- | --- | --- |
| Öffentliche Mod-Download-API | Erledigt: v2-Manifest mit Zielpfaden, Größen, SHA-256, Gesamtgröße, Ladereihenfolge und lokalen Spielanforderungen; Download mit HEAD/Range/ETag | `skymp5-server/ts/launcherResources.ts`, `misc/tests/test_launcher_resources.cjs` |
| Modvorbereitung im Desktop-Launcher | Erledigt: vor SKSE prüfen, herunterladen, zwischenspeichern und aktivieren; Unterordner bleiben erhalten; Fehler verhindern den Spielstart | Launcher `connection.rs`, Server/Rust-Vertragstest |
| Originale wiederherstellen und Server wechseln | Erledigt für verwaltete Dateien und Ladereihenfolge; extern geänderte Dateien werden erkannt | Launcher-Tests für Cache, Reparatur, Serverwechsel und Wiederherstellung |
| Versionsgebundene Clientpakete | Erledigt im Launcher: `catalog.json` wählt anhand der echten Skyrim-EXE-Version das passende Paket; SKSE/Address Library können mitgeliefert werden | Launcher `runtime_version.rs`, `create-runtime-manifest.mjs`, `create-runtime-catalog.mjs` |
| Server-Testpakete und Browser-Ersteinrichtung | Aktueller Testbuild r11 vom 25. Oktober; je zwei Windows-/Linux-ZIPs für Neuinstallation und Datenerhalt beim Update; Browser-PIN-Setup und eigene Admin-Konten; Backend und Dashboard in getrennten Prozessen | Server `build/releases/2026-10-25-server-r11/VALIDIERUNG.json`; historische native Qualifikation separat |
| Getrennte Voll- und Update-ZIPs | Programmdateien werden über eine feste Liste ausgewählt; Update-ZIP enthält keine Betreiberdateien, Skripte oder Datenverzeichnisse; Linux-Ausführungsrechte sind im ZIP hinterlegt | `package_server_distributions.cjs`, `test_server_distributions.cjs`, ZIP- und Upgrade-Nachweise beim Release |
| Steam-Pflicht und flexible Spieleranmeldung | Implementiert in r5: nativer Launcher-Ticketabruf ohne DLL-Austausch, serverseitige Valve-Prüfung, Gastzugang/Freigabe und Kontozugang mit Worlds/Legacy, Steam-Spielerliste, Kontobindung und Schutz vor parallelen Steam-Sitzungen; echte Valve-Key-/Skyrim-Abnahme offen | [Login-Anleitung](docs_ingame_login.md), `playerAccess.integration.mjs`, nativer Launcher-Probetest |
| Dashboard-Zugangsbereich und Speichern | Kartenlayout, größere Formulare, vereinfachte Werkzeugleiste und korrektes direktes JSON-Speichern; sechs UI-Sprachen | `AccessSettingsPanel.tsx`, `loginProviders.ts`, Browser-Nachweis des r5-Builds |
| Launcher-Anbindung im Server-Dashboard | Implementiert und geprüft: Online-/Offline-Modus, Master-URL, Server-ID, privater Schlüssel, Spieladresse, Modpfad und Katalog-URL; eigenes Browser-Setup und geschützte Admin-API | `misc/deploy/test-server/launcher-connection.cjs`, `misc/tests/test_launcher_connection.cjs`, aktueller Pakettest |
| Automatische Server-Laufzeit und Schnellaktionen | Revision r2 enthält private Node-22-LTS-Installation mit SHA-256, gezielte Systempaketprüfung und mitgelieferte Prozesssteuerung; Stop lässt die Verwaltung erreichbar, Start/Neustart erzeugen eigene Kindprozesse | `misc/deploy/test-server/bootstrap-runtime.*`, `server-supervisor.cjs`, `misc/tests/test_server_supervisor.cjs`, r2-Paketnachweise |
| Vollständiges Dashboard unabhängig vom Game-Prozess | Ab r3 erledigt: Einstellungen, Logs, Admin-Anmeldung und Moddownloads bei gestopptem Spiel; Start/Stop/Neustart und Game-Absturz behalten Dashboard-PID, Session und beide WebSockets bei | `skymp5-server/ts/dashboard.ts`, `misc/tests/test_dashboard_runtime.cjs`, [Ports und Prozesssteuerung](docs_vps_ports_and_process_control.md) |
| Serverleistungsansicht unter Metriken | In r10 enthalten: getrennte Game-/Dashboard-Prozesswerte, Tick-Verteilung, 1/6/24-h-Verlauf, historische Auswahl und private Speicherung im dauerhaften Dashboard; Voll- und Update-Pakete für beide Plattformen | [Metriken und Messgrenzen](docs_server_metrics.md), `serverPerformance.integration.mjs`, Dashboard-Lebenszyklustest |
| Unabhängiger Discord-Bot und Game-Statusmeldungen | Ab r4 implementiert: Bot im Webserver; Start-/Stopp-/Neustart-/Absturzmeldungen, Warnungskanal, Live-Konfiguration und Sperrrollen-IPC; reine Überwachung verändert Spielerzugang nicht | [Discord-Betrieb](docs_discord_bot.md), `discordBot.integration.mjs`, Dashboard-Test mit `--discord-fixture`; echter Discord-Nachweis separat offen |
| Eigener Discord-Einstellungsbereich | In r10 enthalten: separater Reiter mit `#discord`, maskiertem Token, Kanalhilfen, JSON-Editoren, Verwerfen/Standardwerten und Vorschau; optionale Embed-/Link-Vorlagen für Statusereignisse, gezieltes Live-Speichern ohne Änderung der übrigen Serverkonfiguration; Voll- und Update-Pakete für beide Plattformen | [Discord-Vorlagen](docs_discord_bot.md#status-embed-und-json-vorlagen), gemeinsamer Renderer, Bot- und Dashboard-Integrationstests |
| Mod-Ladereihenfolge und Launcher-Publikation | Ab r11: ESM/ESP/ESL-Erkennung, Aktivierung/Reihenfolge mit Master-Prüfung, gezieltes Speichern und aktiver Plugin-Filter; geprüfte Steam-Anzeigenamen für die Admin-Spieleransicht | [Mod-Anleitung](../skymp5-server/MOD_LOAD_ORDER.md), Mod-/Launcher-/Steam-Integrationstests, r11-Paketnachweise |
| Vollständige GitHub-Serverpaketierung | Workflow auf dieselben Browser-Setup-/Supervisor-Vorlagen umgestellt; Plattformquellen, Versionsmetadaten und Prüfsummen werden mitgeführt | `package_ci_server.cjs`, `test_ci_server_package.cjs`; echte GitHub-Actions-Ausführung erst nach einem späteren Push |
| Serverbrowser und Detailansichten im Desktop-Launcher | Implementiert und lokal geprüft: Suche, Favoriten, Verlauf, Direktverbindung und Servermetadaten | Launcher `ServerBrowser.tsx`, `ConnectionPanel.tsx`, aktuelle UI-Nachweise |
| PHP-Master und Konto-Verbindungsablauf | Implementiert und mit isolierten Tests geprüft; vorhandene Dashboard-Konten, Spiel-Freigabe, Heartbeat und öffentliche Server-ID | Launcher `web/manage.skymp-worlds.net/native-master.php`, `web/api.skymp-worlds.net/native.php`, PHP-Testnachweise |
| Betreiberhandbuch DE/EN/RU | Erledigt als vorhandene Dokumentation und statischer Webroot; Veröffentlichung bleibt eigener Schritt | Launcher `docs/SERVER_OWNER_GUIDE.*.md`, `web/docs.skymp-worlds.net/`, UI-Dokumentationsnachweis |
| Automatische Accessibility-Prüfungen | Erledigt als Testinfrastruktur: axe, Tastatur-, Dialog- und Formularprüfungen vorhanden | Frontend `scripts/accessibility-checks.js`, `admin-form-checks.js`, `admin-auth-checks.js` |
| Konfigurations- und Admin-Session-Dokumentation | Erledigt: `joinAccess`, Discord-Einstellungen, Namensanzeige, Launcher-API, Master-Identität und Session-Endpunkte dokumentiert | [Konfiguration](docs_server_configuration_reference.md), [Serverbetrieb](docs_running_a_server.md) |

„Erledigt“ gilt für den genannten Umfang. Ein bestandener Downloadtest belegt
beispielsweise noch keine funktionierende Spielsitzung.

## Was teilweise fertig ist oder offen bleibt

| Aufgabe | Aktueller Stand | Noch erforderlich |
| --- | --- | --- |
| Skyrim 1.7.104 / CEF / Multiplayer | CommonLib-Port im aktiven lokalen Quellstand; neue Release-DLLs und Adressdatenbank-Probes für Formate 1/2/5 vorhanden | Echte SKSE-Initialisierung, CEF, Anmeldung und Sitzung mit mehreren Spielern prüfen |
| Vollständige native Server-Testfreigabe | Früherer Linux-Lauf 264/264; Windows 263/264 mit offenem `Activate torch`-Fehler; für die neuesten Clientänderungen keine neue vollständige Suite | Ursache beheben und passende native Suiten erneut qualifizieren; keine Testzeiten zum Grünfärben ändern |
| Produktivbetrieb und öffentlicher Rollout | Lokale Pakete und Web-ZIPs vorhanden; aktueller Gesamtnachweis nennt `liveDeployed: false` | Tatsächliche VPS-/Webroot-Versionen, HTTPS, Registrierung, echte Anmeldung und Last prüfen |
| Echte Discord-Zustellung | Produktionscode mit simulierter Discord-SDK geprüft; keine echten Bot-Zugangsdaten verwendet | Bot einladen, Kanalrechte/Intents prüfen und Status-/Warnungsmeldungen im eigenen Discord abnehmen |
| Unterbrochene Downloads | Gültige fertige Cachedateien werden wiederverwendet; Server unterstützt Byte-Ranges | Launcher-seitiges Fortsetzen einer Teildatei und konfigurierbare automatische Retry-/Backoff-Regeln |
| Versionscache | Server- und Inhalts-Namespaces vorhanden | Sichere automatische Bereinigung/Platzlimits |
| Mod-Abhängigkeiten | Festgelegte `loadOrder`, Prüfsummen und Grundspielanforderungen vorhanden | `dependsOn`, Versionsgrenzen und graphbasierter Resolver |
| Ressourcen-Diagnose und Steuerung | Admin-Inventar vorhanden; Game-Server-Prozesssteuerung separat in r2 verfügbar | Veröffentlichungsspezifische Fehleranzeige, kompletter Hashvergleich und Start-/Stop-/Restart-Steuerung einzelner Ressourcen |
| Plugin-Härtung | Discovery und einfache Fehlerbehandlung vorhanden | Prozess-Allowlist, vollständiger Health-/Restart-Vertrag und nachgewiesene Zustandsreparatur |
| Barrierefreiheit / Responsive | Kernansichten und mehrere Breiten automatisiert geprüft | Weitere Formulare/Geräte, manuelle Screenreader-Prüfung und echte CEF-Prüfung |
| Frontend-Optimierung | Produktionsbuild, Größenmessung und Budgetprüfung vorhanden | Code-Splitting und 500-KiB-gzip-Ziel; dokumentierte frühere Basis: 813.004 Bytes |
| Automatische Launcher-EXE-Updates | Versions-/Downloadmetadaten vorhanden; Clientpaket-Updates funktionieren separat | Vollständiger signierter EXE-Updateablauf mit gültigen Plattformsignaturen |
| Voice-Lipsync (Quellabgleich 27. Oktober 2026) | VAD-Vertrag, Serververteilung und Client-Animationsversuch vorhanden; lokale YACA-Bridge aktiviert Lipsync nicht automatisch | Bridge-Anbindung, Actor-Mapping, Meterumrechnung, Stop/Failsafe und Zwei-Spieler-Abnahme; [Befund und benötigte Angaben](docs_voice_lipsync_status.md) |
| Gameplay und Skalierung | Teilimplementierungen vorhanden | Verbleibende Gameplay-TODOs, Scheduler, State Bags und Zone-Handover |

## Nachweise und ihre Gültigkeit

- r11 enthält die seit r10 hinzugekommene Ressourcenoberfläche, Mod-/Launcher-API
  und Steam-Spielernamen. Backends und Frontend werden gemeinsam neu kompiliert;
  Windows-/Linux-Voll- und Update-ZIPs verwenden den inhaltlich unveränderten
  nativen Serverkern. Eigene Konfigurationen, Daten, Mods und Bilder bleiben
  beim Update erhalten. Der separate Client-Runtime-Build von r10 bleibt bestehen.

- r10 baut beide Backends und das Frontend neu, einschließlich Metriken, Discord-Vorlagen und der neueren
  Zugangsformulare, Steam-Spieleransicht und sechs UI-Sprachen. Für den VPS
  werden vier Windows-/Linux-ZIPs getrennt erzeugt. ZIP-Inhalt, Ausführungsrechte und
  ein Update einer eingerichteten Testinstallation werden separat geprüft;
  Betriebskonfiguration, Admin-Zugang, Steam-Daten, Welt, Mods und eigener
  Gamemode bleiben erhalten. Der Launcher wird nicht neu gebaut. Die native
  Threadpool-Korrektur wird separat als neues Windows-Client-Runtime-Paket
  mit Versionskatalog ausgeliefert; ein Skyrim-/CEF-Spieltest bleibt offen. Aktuelle Nachweise stehen unter
  `build/releases/2026-10-25-server-r10/VALIDIERUNG.json`.

- r8 enthält Auth-Policy v2 mit kompakter servergebundener Steam-Ticket-Kennung,
  HTTP 409 bei veralteter Launcher-Kennung und eigener Diagnose für die passende
  Valve-Ablehnung mit Code 105. Tests prüfen auch unterschiedliche lange
  Serverkennungen, unveränderte serverseitige Prüfung und kompatible Anfragen
  ohne Kennungs-Echo. Backend, Dashboard und Frontend werden neu gebaut;
  native Module bleiben gegenüber r7 unverändert. Nachweise:
  `build/releases/2026-10-24-server-r8/VALIDIERUNG.json`.

- r7 baut Backend, Dashboard und Frontend aus dem aktuellen Quellstand neu.
  Die ergänzte Valve-Erklärung bei Ticketablehnung wird nur im Serverprotokoll
  ausgegeben, bereinigt und auf 160 Zeichen begrenzt; die öffentlichen Fehler
  bleiben fest klassifiziert. Regressionstests prüfen auch das Entfernen von
  Schlüsseln, Tickets, SteamIDs, URLs und Steuerzeichen. Launcher und native
  Plattformmodule werden nicht neu gebaut. Aktuelle Nachweise stehen unter
  `build/releases/2026-10-24-server-r7/VALIDIERUNG.json`.

- r6 baut den aktuellen Serverquellstand einschließlich der Steam-Fehlerklassifikation
  aus dem separaten Launcher-Befund neu. Key, Ticket, Limits, Erreichbarkeit,
  ungültige Antworten und Speicherfehler erhalten feste Codes; Diagnosewerte
  bleiben numerisch und enthalten keine privaten Inhalte. Die Patch-Prüfsumme
  und beide Backend-Source-Maps werden verglichen. Für das Update muss auch
  der Dashboard-Prozess neu starten. Eine echte erneute VPS-Anmeldung ist
  ein eigener Schritt; Launcher und Client-Runtime werden in r6 nicht neu gebaut.

- r5-Nachweise stehen beim aktuellen Build unter
  `build/releases/2026-10-24-server-r6/VALIDIERUNG.json`. Der native Launcher
  hat lokal mit laufendem Steam ein echtes Web-API-Ticket angefordert und
  freigegeben; Skyrim wurde dabei nicht gestartet und die Spiel-DLL nicht ersetzt.
  Die Serverprüfung verwendet simulierte Valve-Antworten. Ohne echten Betreiber-Key
  ist keine vollständige Steam-Anmeldung am Spielserver nachgewiesen.
  Zugangsänderungen benötigen einen Game-Neustart und aktualisierte Launcher-/Clientdateien.

- Am 23. Oktober neue Backend-/Dashboard-Builds und Frontend-Tests bestanden.
  Setup-, HTTP-Assistent-, Launcher-Anbindungs- und Mod-API-Prüfungen bestehen
  unter Windows und Linux; der Heartbeat-Vertrag wurde isoliert geprüft.
  Die fertigen Pakete starten mit fünf echten Masterdateien unter Windows,
  Ubuntu 24.04 / Node 24 und Ubuntu 26.04.1 / Node 22.22.1.
  Der native Serverkern wurde unverändert übernommen; Skyrim wurde nicht
  gestartet und der VPS nicht verändert. Releasehinweise und Prüfnachweise
  entstanden nach dem eingefrorenen Quell-Snapshot.
- Am 22. Oktober erneut geprüft: **25/25 Rust-Tests**, **6/6 Runtime-Paketprüfungen**,
  isolierter Heartbeat-Test mit fünf Prüfgruppen und TypeScript-Prüfung des Servers.
  Diese Läufe starten Skyrim nicht.
- Aktueller Launcher-Nachweis:
  `D:\GitHub\skymp-client-launcher\local-builds\current\VALIDATION.json`
  (22. Oktober), mit Frontend-/Releasebuild, 12 PHP-Prüfgruppen, UI-/Handbuchprüfungen,
  realem Paketdownload und eigenständigen nativen Adressdatenbank-Probes.
  Er nennt ausdrücklich `gameplayValidated: false`, `realGameStarted: false`
  und `liveDeployed: false`. Diese älteren Einzelprüfungen wurden beim heutigen
  Dokumentationsabgleich gelesen, nicht alle erneut ausgeführt.
- Frühere Buildverzeichnisse werden nach erfolgreicher r5-Prüfung entfernt;
  die native Basisqualifikation bleibt als JSON-Nachweis beim aktuellen Release erhalten.
  Der Modsync-Lauf vom 21. Oktober ist nur ein historischer Nachweis. Die damalige Launcher-EXE mit 18 Tests enthält
  die späteren Katalog-/Clientänderungen nicht. Für den neueren Launcher ist
  `local-builds/current/` im Launcher-Repository maßgeblich.
- Nach Änderungen an Quellcode oder Paketen gelten Nachweise nur für die dort
  aufgeführten Dateien/Prüfsummen. Ein `ok: true` mit begrenztem Prüfumfang hebt
  einen ausdrücklich ausgelassenen Spieltest nicht auf.

## Dokumentationsabgleich

Inventar vor dieser Aktualisierung: **109 Dokumente im Server-Repository und
27 im Launcher-Repository**. Relative Dateilinks wurden auf vorhandene Ziele
geprüft; Roadmaps, Installations-/Betriebsanleitungen, Konfiguration und
Launcher-Verträge zusätzlich mit Code und Nachweisen abgeglichen.

Release-Notizen, frühere WebSocket-Berichte und datierte Prüfprotokolle sind
historische Nachweise. Ihre damaligen Messergebnisse werden nicht als neue
Messung ausgegeben. Entwickler- und API-Referenzen sind weiterhin vorhanden;
dieser Abgleich ist keine vollständige Laufzeitprüfung jeder dokumentierten
Papyrus-/SkyrimPlatform-Funktion und kein Nachweis externer Webseiten/Dienste.

Aktive Aufgabenlisten:
[Projekt-Roadmap](../ROADMAP.md), [Frontend](../ROADMAP_FRONTEND.md),
[FiveM-Ideen](../ROADMAP_FIVEM_IDEAS.md). Einstieg:
[Linux-VPS](docs_linux_vps.md), [Modpakete](docs_launcher_modpacks.md),
[Clientpakete und Versionskatalog](docs_launcher_runtime_updates.md),
[SkyMP Worlds](docs_launcher_worlds.md).
