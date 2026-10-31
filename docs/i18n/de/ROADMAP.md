<a id="roadmap"></a>
# Roadmap

[Deutsch](ROADMAP.md) · [English](../en/ROADMAP.md) · [Русский](../ru/ROADMAP.md)

Statusprüfung: **22. Oktober 2026**. Der [aktuelle Projektstatus](../../docs_project_status.md) trennt Implementierung, lokale Prüfnachweise und verbleibende Abnahme. Browser-Einrichtung, Launcher-Modsynchronisierung und versionierte Clientpakete sind implementiert; echter Skyrim-/CEF-Spielbetrieb und Live-Rollout bleiben offen.

Willkommen zur Projekt-Roadmap! Hier stehen Synchronisierungen; künftig können auch Aufgaben außerhalb von Synchronisierung oder Code hinzukommen.

<a id="build--release-automation"></a>
Stand **31. Oktober 2026**: Das [Sitzungsende](docs/docs_session_end.md) (Kick, Bann, Neustart, Verbindungsverlust) und die [Console-Security](docs/docs_console_security.md) sind umgesetzt und durch Quelltests abgedeckt. Die Abnahme im echten Skyrim/CEF steht noch aus.

# Build- und Release-Automatisierung

| Bereich | Status | Hinweise |
| --- | --- | --- |
| PR-Builds (Windows/VR/Emscripten) | Aktiv | PR-Workflows verwenden die wiederverwendbare Action .github/actions/pr_base/action.yml. |
| Semantische Serverversionierung | Aktiv | `.github/workflows/running_server_files.yml` ermittelt die nächste Releaseversion aus Commitmeldungen (`fix`/`feat`/`major`/`breaking`/`!`). |
| Release-Freigabe und Changelog | Aktiv | Ohne auslösenden Commit wird kein Serverrelease erstellt; Release Notes enthalten dennoch den gruppierten Verlauf seit dem letzten Releasetag. |
| Deployment-Benachrichtigungen | Aktiv | Deploy-Workflows melden Status über das Secret DEPLOY_STATUS_WEBHOOK an Discord. |
| Dauerhafter Discord-Spielmonitor | Implementiert | Das r4-Dashboard besitzt den Bot; Spiel-Lifecycle, Loginlogs, Warnungen und Ban-Rollen-IPC sind implementiert. Simulierte Discord-Integrationstests prüfen Prozesskontinuität; echte Zustellung bleibt offen. Siehe `docs/docs_discord_bot.md`. |
| Installer-Auslösung | Aktiv | Pushes nach main lösen über .github/workflows/trigger-installer.yml repository_dispatch im Installer-Repo aus. |
| Manuelle Installer-Auslösung | Aktiv | Der Workflow unterstützt `workflow_dispatch` aus der GitHub-Actions-Oberfläche. |
| Installer-Zielrepository | Konfigurierbar | Repositoryvariable INSTALLER_REPOSITORY im Format owner/repo bestimmt das Ziel. |
| Installer-Artefaktformat | Extern | Der Installer entsteht im Workflow des Installer-Repositories, nicht hier. |

<a id="admin--server-operations"></a>
# Administration und Serverbetrieb

| Bereich | Status | Hinweise |
| --- | --- | --- |
| Dedizierter Server unter Windows/Linux | Testpakete validiert | Beide nativen Testpakete bestanden Browser-Setup, HTTP/Adminlogin, UDP und Mod-Veröffentlichung. Produktions-/Lastabnahme und ein vorhandener Fehler der nativen Windows-Suite bleiben offen. |
| Linux-Server aus Quellen bauen | Aktiv | Linux-Builds, Startskripte und CI-Varianten existieren; Ubuntu/glibc ist am stärksten unterstützt. Standardisierter VPS-Produktionsbetrieb braucht weitere Härtung. |
| Windows-Server | Aktiv | Windows bleibt mit nativem Launcher und vorhandenen Betriebsabläufen unterstützt. |
| Plattformübergreifende Supervisor-Anbindung | Teilweise | Gemeinsames `supervisor`-Konfigurationsmodell vorhanden. Admin-Stop/-Restart nur mit ausdrücklich konfigurierten Befehlen. Offen: OS-spezifische Einrichtung und optionale Erkennung. |
| Produktionspakete und Dokumentation | Teilweise | Ubuntu-24.04-orientierte systemd-Vorlagen und Produktionshinweise vorhanden. Gleichwertige Windows-Dienstvorlagen und Betriebsanleitungen fehlen. |
| Dashboard-Authentifizierungsrouten | Aktiv | `/admin` liefert das React-Dashboard mit In-App-Login und Sitzungstimeout; `/admin/` normalisiert zu `/admin`, `/admin-app` leitet dorthin um. |
| Dashboard-Loginbedienung | Aktiv | Eigenes Formular statt HTTP-Basic-Popup (`/api/admin/session/login`, `/logout`, `/touch`); zehn Minuten Inaktivität anhand von Dashboard-Klicks. |
| Sicherer Windows-Launcher-Neustart | Aktiv | `launch_server.bat` erkennt und beendet alte `dist_back/skymp5-server.js`-Prozesse vor dem Neustart. |
| Runtime-Abhängigkeiten der Paketlauncher | Aktiv | r2-Testpakete installieren fehlendes/altes Node privat mit SHA-256-Prüfung, erhalten es bei Updatefehlern und prüfen native Voraussetzungen. Backend bündelt npm-Abhängigkeiten bereits. |
| Admin-Ressourceninventar | Aktiv | `GET /api/admin/resources` listet Skyrim-Ressourcen auf Serverdatenträger und im loadOrder-Kontext (`.esm`, `.pex`). |
| API für Servereinstellungen | Aktiv | `GET/POST /api/admin/cfg/server-settings` lädt/speichert im Admin-CFG-Panel. |
| Access-/Discord-Validierung | Aktiv | Das strukturierte CFG-Formular prüft Pflichtfelder und Discord-ID-Formate vor dem Speichern. |
| Sprachrouting der Servereinstellungen | Aktiv | `localeRouting.defaultLanguage` und `countryCodeToLanguage` in `server-settings.json`. |
| Sprachdefaults beim frischen Build | Aktiv | Erzeugt durch `cmake/scripts/generate_server_settings.cmake`. |
| Sprachauflösung | Aktiv | `GET /api/admin/locale/resolve?countryCode=XX` ermittelt den konfigurierten Fallback. |
| NPC-Parser und Klassenfilter | Aktiv | `npcSettings.default` korrigiert; `allowHumanoid`/`allowCreature` erlauben leere Städte bei Wildtier-/Monster-Spawns. |
| Weltgegenstände aufnehmen | Aktiv | `itemPickupMode`: `allow`, `minigame`, `block-all`. Im Modus `minigame` ruft der Server `mp.onItemPickupAttempt(...)` für eigene Regeln wie Diebstahl-Minispiele auf. |
| Laden von Weltgegenständen | Aktiv | `itemsEnabled` deaktiviert Instanziierung vollständig. `itemLoadFilter` (`skipOwned`/`skipUnowned`) filtert Eigentum: Laden-/NPC-Items, freie Dungeonbeute oder beides. |
| Pluginsystem | Aktiv | Lädt TS-/JS-Plugins beim Start aus `Plugins/`. Discovery: `pluginDiscovery.mode` (`safe`/`prompt`), Reihenfolge: `pluginsLoadOrder`, strikter Start: `abortOnPluginError`. |
| Seitenleistenaktionen: alle kicken / Ankündigung | Aktiv | `POST /api/admin/players/kick-all` und `POST /api/admin/announcement` in `skymp5-server/ts/ui.ts`. Ankündigung als Skyrim-HUD-Toast per CustomPacket: dunkles Metall, Goldrand, Einblenden von oben. Seitenleistenbuttons funktionieren. |
| Sichtbarer Ankündigungstoast | Aktiv | Clientseitiges Skyrim-HUD mit Einblenden und konfigurierter Ausblendzeit. `announcementToast`-Paket, CSS-Animation über SkyrimPlatform-Browser-API. |
| Charakternamen ein-/ausblenden | Aktiv | `showCharacterNicknames` in `server-settings.json` steuert Namen über Actors via `createText`. Admin-CFG → Allgemein; Übertragung bei Verbindung. F1 ist gesperrt, wenn der Server explizit vorgibt. |
| Zonenübergabe mit Ladebildschirm | Vorgeschlagen | Technischer Plan für Zonenwechsel, Worker-Routing und optionale Overflow-Shards in `docs/docs_zone_handover_roadmap.md`; gemeinsame MMORPG-Welt bleibt Standard. |
| Seitenleistenaktionen: Server starten/stoppen/neustarten | Aktiv | r3 betreibt das gesamte Dashboard separat: Einstellungen, Logs, Downloads, Sitzungen, WebSockets überleben Spielstop/Neustart/Crash. Nur eigene Spiel-PID ändert sich; Start auch bei gestopptem Spiel. Spieleraktionen benötigen laufendes Spiel. Direkte Backendstarts unterstützen weiterhin externe Supervisoren. |

<a id="synchronization"></a>
# Synchronisierung

| Funktion | Status / Aufgabe |
| --- | --- |
| **FERTIG:** | **Vollständig implementiert und gut geprüft; nahezu ideale Synchronisierung.** |
| _Aussehen_ | Fertig |
| _Attribute: Gesundheit, Magicka, Ausdauer_ | Fertig |
| _Tod_ | Fertig |
| _Inventar_ | Fertig |
| _Herstellen an Schmieden_ | Fertig |
| _Eigene Respawnsteuerung_ | `canRespawn` kann automatisches Wiedererscheinen für Heiler-/Arztsysteme verhindern. |
| _Spawnpunkt_ | `startSpawn` in server-settings.json für neue Spieler konfigurierbar. |
| _Startinventar_ | `starterInventory` mit vollständigen Einträgen (baseId, count, Verzauberung usw.) konfigurierbar. |
| _Zutateneffekte lernen_ | Wissen liegt pro Spieler in `private.learnedIngredientEffects`, Wiederherstellung bei Reconnect. Client prüft beim Schließen von Inventar/Favoriten `Ingredient.getIsNthEffectKnown`; Wiederherstellung mit `learnEffect`. |
| _Kartenmarkierungen_ | Entdeckte Marker werden serverseitig pro Spieler gespeichert (`private.discoveredMarkers`) und wiederhergestellt. C++-`locationDiscovery` um `markerFormId` erweitert, `showMapMarker` ergänzt. |
| _Verzauberungen lernen_ | Wissen in `private.knownEnchantments`, Wiederherstellung per `setPlayerKnows(true)`. Client merkt Inventar-Verzauberungs-IDs über `Weapon/Armor.getEnchantment()`; beim Schließen von 'Crafting Menu' prüft er `playerKnows()` und sendet neue Kenntnisse. |
| _Verbessern_ | Schleifstein/Rüstungstisch serverautoritativ in CraftService: Materialien werden verbraucht, `health` des Eintrags erhöht, ExtraData wie Verzauberung/Eigenname bleiben erhalten. |
| _Wetter_ | `WeatherSystem` steuert serverseitig. Gamemode sendet `setWeather`/`clearWeather`, Server verteilt `syncWeather`/`clearWeather`, stellt nach Reconnect wieder her. Client nutzt `Weather.setActive()`/`Weather.releaseOverride()`. |
| _Zeit_ | `TimeSystem`: UTC-Anker und konfigurierbare `timeScale` bei Verbindung; Client interpoliert Spielstunden anhand `serverAnchor`. Default 20 entspricht Skyrim; siehe `docs_server_configuration_reference.md`. |
| **TEILWEISE:** | **Implementierte Funktionen mit geplanten Verbesserungen oder Korrekturen.** |
| _Bewegung_ | Lagkompensation, Gehgeschwindigkeit und Details verbessern; Hilfe bei ST erfragen. |
| _Charaktererstellung_ | Serverseitige Validierung ergänzen. |
| _Animationsereignisse_ | Lokale Verzögerungen durch Warteschlange in Folgeframes entfernen; Kollision bei Möbeln wie Stühlen deaktivieren; ST fragen. |
| _Schaden_ | Falsche Reichweitenprüfung beim Schießen entfernen; Blutspritzer und Geräusche synchronisieren. |
| _Behälter_ | Falsche „leer“-Beschriftung; Öffnungsanimation und Geräusch für alle. Neue Plattform-API für Serialisierung/Deserialisierung wie ST erwägen, auch als Grundlage für Inventar. Gleichzeitige Beute für mindestens zwei Spieler ermöglichen. |
| _Ausrüstung_ | Ausrüstung der Hände muss Serverneustart überleben. |
| _Gegenstände aufnehmen_ | ExtraData (Verzauberung, Gift usw.) berücksichtigen; dafür muss Ablegen entsprechender Items möglich sein. Originalmeldung „Hinzugefügt…“, synchrones Geräusch; Bücher bei Aktivierung lesen statt sofort aufnehmen. |
| _Zutaten aufnehmen_ | Originalmeldung/-geräusch synchronisieren; kein Blinken oder Verschieben. |
| _Fackeln_ | Andere Spieler damit anzünden und synchronisieren; nach serverseitiger Zeit aus Inventar entfernen. Derzeit wie Pfeile unbegrenzt. |
| _Skripte_ | Variablen erhalten, Unterschiede der Events zum Original zumindest untersuchen und dokumentieren. |
| _Konsolenbefehle_ | Teilweise: Admin-Dispatcher mit Aliassen und Capability-Prüfung je Befehl (`help`, `players`, `kick`, `kick-all`, `ban`, `unban`, `mute`, `unmute`, `warn`, `message`, `announce`, `js`), weiterhin Admin-JS-Fallback. Offen: Vanilla-Syntax/-Ausgabe erweitern, stdin-Brücke/Selektoren, bessere Spieler-ID-Darstellung im Client. |
| _Favoriten_ | IDs in `private.favorites` gespeichert und beim Reconnect in Clientzustand geladen. Vollständige Anwendung im Spiel wartet auf Setter: `Game.isObjectFavorited` liest nur. |
| _ActorValues_ | Unterstützt `health/magicka/stamina`, `healRate/magickaRate/staminaRate`, zugehörige `*RateMult` via Papyrus `SetActorValue` oder `mp.set(..., 'actorValues', ...)`. Mehr Werte durchgängig in Server/Client ergänzen. |
| **GEPLANT:** | **Geplante Funktionen – eine spannende Reise!** |
| _Gegnerische Animationen_ | Meist PvP: Taumeln, zufälliges Ausweichen, Reaktion auf Sprintkollisionen. |
| _Levelabhängige Items aufnehmen_ | Im CK beginnen sie mit Dummy, etwa RandomPotion. Unklar, wie der Server sie derzeit verarbeitet. |
| _Kompass ein-/ausblenden_ | Serverseitiges Steuern je Spieler. Keine native API; möglicherweise `Ui.setBool('HUD Menu', '_root.HUDMovieBaseInstance.CompassShoutMeterHolder._visible', false)`. Undokumentierter Scaleform-Pfad muss an Spiel-SWF geprüft werden. Server-CustomPacket, Client `Ui.setBool`/`Ui.setFloat`. |
| _Interaktionshinweis für Spieler_ | `blockActivation(true)` in `movementApply.ts` unterdrückt absichtlich „Aktivieren [E]“ für Remote-Spieler. Serversteuerbares „Mit [Name] sprechen [E]“ benötigt bedingte Blockierung. Einfach freigeben erlaubt unbeabsichtigte Aktivierungen; separate reine Anzeige eventuell besser. Nach Umsetzung im Admin-Dashboard steuerbar. |
| _Gegenstände ablegen_ | Zuerst ohne Physik zu Füßen erzeugen, nach Physikimplementierung wie im Original. |
| _Physik_ | Objekte, bewegliche Statics und bestimmte Behälter treten können, etwa im Blauen Palast; Hostwechselmechanismus nötig. |
| _Gegenstände ziehen_ | Wie im Original Gegenstände ziehen können. |
| _Dungeons_ | Fallen, Rätsel usw. testen/reparieren; Originalverhalten und serverseitige Zustandsspeicherung. |
| _Alchemie_ | Tränke herstellen. |
| _Verzaubern_ | Gegenstände verzaubern/umbenennen, mit selbst gefülltem oder aus dem Editor stammendem Seelenstein ohne ExtraData. |
| _Aufladen_ | Waffen und Stäbe mit Seelensteinen wieder aufladen, Ladungszustand erhalten. |
| _Schlösserknacken_ | Türen/Truhen mit Lock-Level aus Spieldaten, auch Schlüssel. Bonus: erforderliche Dietrichposition zwischen Versuchen erhalten, Geräusche synchronisieren. |
| _Fertigkeiten_ | Originale Steigerungsformeln abschalten; Lernen für bestehende Synchronisierungen wie Kampf ergänzen. Jede neue Synchronisierung berücksichtigt ihre Fertigkeit. |
| _Perks und Stufenaufstieg_ | Attributsteigerung (Gesundheit/Magicka/Ausdauer) anwenden/speichern, Perks speichern und schrittweise funktionsfähig machen. |
| _Blocken_ | Angriffsabwehr könnte „Reverse Animation Events“ benötigen. |
| _Bogenschießen_ | Vielleicht Mod zur vertikalen Blickwinkelsynchronisierung. Pfeil muss richtige Geschwindigkeit/Ursprung haben. Später eventuell aufnehmbar; anfangs entbehrlich. Steckende Pfeile eventuell synchronisieren. Server entfernt je Schuss einen Pfeil. |
| _Taschendiebstahl_ | |
| _NPCs_ | Hostwechsel und Kampf/Objektaktivierung/Ausrüstung usw. prüfen. NPC-Templates serverseitig auswerten und clientseitig anwenden. Korrektes Spawnen/Verhalten nach Packages; später außerhalb von Spielersicht reisen. |
| _Beute_ | Tote NPCs und Spieler plündern. |
| _Leichenphysik und Leichen ziehen_ | |
| _Dialoge_ | Zufallssprüche von Banditen/NPCs und Questdialoge; wegen ST wohl keine Priorität. |
| _Pferde_ | Reiter muss Pferdehost sein. Kampf ermöglichen; berittenes Schießen eventuell separat. |
| _Quests_ | Questzustände serialisieren/deserialisieren oder nötigen Text anzeigen; wegen ST wohl keine Priorität. |
| _Drachen_ | Serverautoritative Entitäten mit Replikation, Flugphysik (Höhe/Kollisionsvermeidung), Kampf-KI (Ziele/Zauber), Schreien und Seelenaufnahme bei Tod. Entscheidung C++-Core oder TS-Plugin offen. Plugin-Health: Anzahl, letzter Kampf, Simulationslast; Erweiterungen über Plugins möglich. |
| _Schreie_ | Ausrüsten/Wirken, Worte lernen; begrenzen, wer Drachenblut ist. Iterativ weitere Schreie testen. |
| _Magieeffekte_ | Server muss Effekte wirken können. Trank wendet Effekt an statt sofort Attribute zu ändern. Shader beim Effekt; auch später eintreffende Beobachter sehen ihn. Häufige Angriffs-/Heil-Archetypen implementieren. |
| _Zauber_ | TODO: Synchronisierung beschreiben. |
| _Warten_ | Schlafen/warten, wenn alle Spieler zustimmen. |
| _Statische Objekte_ | Server soll sie bedarfsgesteuert erkennen, DB nicht unnötig belasten. Zustand vollständig zurücksetzbar, Bewegen mit SetPosition usw. |
| _Geräusche und Musik_ | Zellenmusik und Kampfmusik synchronisieren (derzeit auch PvP). Todesmusik überlagert andere Musik. Server soll räumlich Geräusche spielen können, vermutlich SpSnippet. Aktionen mit synchronisiertem Ton definieren. |
| _Lippensynchronisierung_ | Teilweise: VAD-Vertrag, Serververteilung und Client-Dialog-Idle-Versuch vorhanden. Lokale YACA-Brücke verbindet optionalen Callback nicht automatisch. Actor-Zuordnung, Koordinateneinheiten, Lifecycle und Reset offen; kein echter Skyrim/TeamSpeak-Test. [Status und benötigte Angaben](docs/docs_voice_lipsync_status.md). |
| _Verknüpfte Referenzen_ | Verknüpfung reicht nach Erinnerung Aktivierung weiter; wichtig etwa bei Hebel/Tür in Dungeons. |
| _Stäbe herstellen_ | |
| _Spielbare Monsterrassen_ | Spieler durch beliebige NPCs ersetzen, auch Tiere/Monster. |
| _Lykanthropie_ | |
| _Vampirismus_ | Perks, Extras und Vampirzauber aus DLC; persönliche Anmerkung des Originals: Der Sinn des Ganzen erschließt sich mir nicht ganz :) |

<a id="partially---delivery-backlog-proposed"></a>
# Von „Teilweise“ zum Auslieferungs-Backlog (Vorschlag)

Dieser Backlog zerlegt `PARTIALLY` in planbare Tickets mit Umfang, Abnahmekriterien, Schätzung und Abhängigkeiten.

<a id="sprint-1-p0-stability--visible-ux"></a>
## Sprint 1 (P0: Stabilität und sichtbare Bedienung)

| ID | Roadmap-Punkt | Umsetzung | Abnahmekriterien | Schätzung | Abhängigkeiten |
| --- | --- | --- | --- | --- | --- |
| SYNC-CC-001 | Charaktererstellung | Serverseitige Prüfung von Erstellungs-/Änderungsdaten: Name/Rasse/Preset/Slidergrenzen/Pflichtfelder. | Ungültige Daten mit festen Fehlercodes abweisen, gültige speichern; Negativtests für Fehlformate, Überläufe und Grenzverletzungen. | 2–3 Tage | Keine |
| SYNC-EQ-001 | Ausrüstung | Handbelegung über Neustart/Reconnect speichern. | Lokale/entfernte Spieler sehen korrekte Ausrüstung; nach Inventarwiederherstellung keine Duplikate/Widersprüche. | 2–4 Tage | Inventarpersistenz |
| SYNC-DMG-001 | Schaden | Falsche Schussreichweitenprüfung entfernen; Schaden/Blut/Ton an dasselbe autoritative Trefferereignis binden. | Keine falschen Fehlschüsse; synchrones Blut/Ton für Beobachter; Nah-/Fern-/Hitscan-Regressionen bestehen. | 2–3 Tage | Trefferverarbeitung und Eventverteilung |
| SYNC-PICK-001 | Zutatenaufnahme | Vanilla-Meldung/Ton und kein Blinken/Verschieben. | Erwartetes Textformat, Ton für nahe Spieler, kein Blinken/Teleport im Mehrclienttest. | 1–2 Tage | Bestehende Pickup-Ereignisse |
| OPS-SUP-001 | Supervisor | Admin-Vorabprüfung für Start/Stop/Restart, umsetzbare Fehlermeldungen. | Nicht unterstützte UI-Aktionen mit Grund gesperrt; maschinenlesbares Backend-Ergebnis; fehlgeschlagene Prüfung führt keinen Befehl aus. | 1–2 Tage | Supervisor-Konfiguration |

<a id="sprint-2-p1-operations--shared-interactions"></a>
## Sprint 2 (P1: Betrieb und gemeinsame Interaktionen)

| ID | Roadmap-Punkt | Umsetzung | Abnahmekriterien | Schätzung | Abhängigkeiten |
| --- | --- | --- | --- | --- | --- |
| SYNC-CONT-001 | Behälter, Phase A | Öffnen/Schließen mit Animation/Ton an relevante Beobachter senden. | Zwei Clients sehen/hören gleiches Timing; wiederholtes Aktivieren erzeugt keine doppelten Pakete. | 2–4 Tage | Behälteraktivierung |
| OPS-WIN-001 | Produktionspakete/-docs | Windows-Dienstvorlagen und Betriebsanleitung auf Ubuntu-Niveau. | Auf sauberem Host prüfbare Vorlage, Installation/Update/Restart/Rollback/Logpfade/Fehlersuche dokumentiert. | 1–2 Tage | Ubuntu-Produktionsanleitung |
| ADM-SRV-001 | Seitenleisten-Serversteuerung | Assistent/Checkliste für Supervisor-Kommandos und Laufzeitprüfung. | Geführter Status, Prüfung vor Freigabe, konkrete Abhilfe zu jedem Fehler. | 2–3 Tage | OPS-SUP-001 |
| SYS-CMD-001 | Konsolen-MVP | Erste wichtige Befehle mit Rechtestufen und Auditlog. | 10–15 Befehle, soweit sinnvoll Vanilla-Syntax/-Ausgabe; Rollen durchgesetzt; jede Ausführung protokolliert. | 4–6 Tage | Auth-/Rollenmodell |
| DOC-SCR-001 | Skripte | Eventunterschiede zu Vanilla und Variablenpersistenz dokumentieren. | Vergleichstabelle/Persistenzregeln; mindestens ein automatisierter oder skriptbasierter Test je wichtigem Eventtyp. | 2–3 Tage | Skript-Events |

<a id="deferred-but-prepared-p2"></a>
## Zurückgestellt, aber vorbereitet (P2+)

| ID | Roadmap-Punkt | Umsetzung | Abnahmekriterien | Schätzung | Abhängigkeiten |
| --- | --- | --- | --- | --- | --- |
| SYNC-MOV-001 | Bewegung | Lagkompensation und Abgleich für Bewegung/Schießen. | Weniger sichtbarer Versatz bei hoher Latenz; messbare Korrekturraten-/Rollback-Telemetrie. | 1–2 Wochen | Bewegungs-/Schadensmetriken |
| SYNC-ANIM-001 | Animation | Queue-Verzögerungen entfernen, Möbelkollisionszustände umschalten. | Deterministische Eventreihenfolge unter Last; keine Stuhl-/Möbelkollisionsfehler. | 1 Woche | Animationsqueue-Refactoring |
| SYNC-CONT-002 | Behälter | Gleichzeitige Beute mit serverseitiger Versionierung/Konfliktauflösung. | Mindestens zwei Spieler sicher; deterministisch, keine verlorenen/duplizierten Items. | 1–2 Wochen | SYNC-CONT-001, Behälter-API |
| SYNC-AV-001 | ActorValues | Werte schrittweise ausbauen, Kampf zuerst, Server-/Client-Parität. | Neue freigegebene Werte konsistent setzen/lesen und im Spiel replizieren; Tests je Ausbaustufe. | 1–2 Wochen | Mapping und Tests |
| SYNC-FAV-001 | Favoriten | Serverpersistenz erhalten; volle Wiederanwendung sobald Setter verfügbar. | Reconnect stellt Favoriten im Spiel statt nur Cache wieder her; Fallback bis dahin stabil. | Blockiert | Externe SkyrimPlatform-API |

<a id="suggested-initial-command-set-for-sys-cmd-001"></a>
## Vorgeschlagene erste Befehle für SYS-CMD-001

`help`, `players`, `tp`, `tgm` (beschränkt), `tcl` (beschränkt), `setav`, `modav`, `heal`, `kill`, `resurrect`, `time`, `weather`, `announce`, `kick`, `ban`.

<a id="notes"></a>
## Hinweise

- Vollständige Favoritenwiederherstellung wartet auf fehlenden SkyrimPlatform-Setter; `Game.isObjectFavorited` existiert nur zum Lesen.
- Schätzungen bleiben bewusst breit, bis die ersten ein bis zwei Tickets erledigt sind und Teamgeschwindigkeit bekannt ist.

<a id="repository-audit---action-backlog-proposed"></a>
# Repository-Audit zum Maßnahmen-Backlog (Vorschlag)

Aus einem repositoryweiten Audit für Runtime-Stubs/Platzhalter und undokumentierte vorhandene Funktionen abgeleitet.

<a id="bucket-a-blockers--safety-net-p0"></a>
## Gruppe A: Blocker und Absicherung (P0)

| ID | Typ | Umfang | Bedeutung | Code | Abnahme |
| --- | --- | --- | --- | --- | --- |
| AUD-BLK-001 — Offen | Runtime-Stub entfernen | Papyrus-Zellen-Stub durch Implementierung oder sicheren expliziten Fehler ersetzen. | Stille Abweichung von Spiellogik. | `skymp5-server/cpp/server_guest_lib/script_classes/PapyrusCell.cpp` | Kein bedingungsloser `// stub`-Rückgabepfad; Unit-/Integrationstest der Native-Funktion. |
| AUD-BLK-002 — Offen | Property-Bindings vervollständigen | Fehlende `mp.get/mp.set`-Bindings implementieren oder durch Capability-Prüfung begrenzen. | Harter `not implemented`-Fehler kann Produktion brechen. | `skymp5-server/cpp/addon/property_bindings/PropertyBinding.cpp`, `skymp5-server/cpp/addon/property_bindings/PosBinding.cpp`, `skymp5-server/cpp/addon/property_bindings/AngleBinding.cpp` | Deterministische Fehler für nicht unterstützte Properties; unterstützte durchgängig geprüft. |
| AUD-BLK-003 — Offen | WorldState-Assertions härten | `assert(false)` durch expliziten Fallback/Fehler ersetzen. | Reale Daten/Anfragen können Prozess beenden. | `skymp5-server/cpp/server_guest_lib/WorldState.cpp` | Keine bedingungslose Assertion im nutzererreichbaren Pfad; protokollierter, nicht fataler Fehler. |
| AUD-BLK-004 — Offen | Verzögertes Laden | Tote/deaktivierte Referenzen laden oder ausdrücklich mit dokumentiertem Flag ausschalten. | Sonst inkonsistente Welt nach Laden/Neustart. | `skymp5-server/cpp/server_guest_lib/WorldState.cpp` | Deterministisches dokumentiertes Verhalten, Regressionstest. |

<a id="bucket-b-production-risk--technical-debt-in-live-paths-p1"></a>
## Gruppe B: Produktionsrisiko und technische Schulden (P1)

| ID | Typ | Umfang | Bedeutung | Code | Abnahme |
| --- | --- | --- | --- | --- | --- |
| AUD-RSK-001 — Offen | Login überarbeiten | Bekannten Login-Hack durch expliziten prüfbaren Ablauf ersetzen. | Kritischer Authpfad bezeichnet sich selbst als Übergangshack. | `skymp5-server/ts/systems/login.ts` | Hackpfad entfernt, Erfolgs-/Fehler-/Randfälle automatisch getestet. |
| AUD-RSK-002 — Offen | ObjectReference-Regeln | Feste Skriptfilter-Hacks durch konfigurierbare Serverpolicy ersetzen. | Verstecktes Verhalten und fragile Modkompatibilität. | `skymp5-server/cpp/server_guest_lib/MpObjectReference.cpp` | Settings/API und Dokumentation, rückwärtskompatibler Default. |
| AUD-RSK-003 — Offen | Legacy-Bewegung bereinigen | Alten Kompatibilitätshack entfernen, sobald Mindestversion durchgesetzt wird. | Fallback erschwert Sync/Debugging und verschleiert Protokollfehler. | `skymp5-client/src/sync/movementApply.ts` | Versionierte Kompatibilitätsprüfung, alter Pfad entfernt oder Featureflag. |
| AUD-RSK-004 — Offen | Fehlende Eventpfade | Handler mit `Not implemented` vervollständigen. | Inkonsistenter Betrieb. | `skymp5-server/cpp/server_guest_lib/gamemode_events/UpdateAppearanceAttemptEvent.cpp`, `skymp5-server/cpp/server_guest_lib/gamemode_events/UpdateEquipmentAttemptEvent.cpp` | Implementiert oder explizit deaktiviert mit verständlicher Diagnose. |

<a id="bucket-c-documentation--roadmap-gaps-p1"></a>
## Gruppe C: Dokumentationslücken (P1)

| ID | Typ | Umfang | Bedeutung | Code | Abnahme |
| --- | --- | --- | --- | --- | --- |
| AUD-DOC-001 — Fertig | Konfigurationsparität | Alle joinAccess-Modi, Identifierlisten, Beispiele und Ablehnungen dokumentiert. | Implementierter Auth-/Adminpfad war schwer auffindbar. | `skymp5-server/ts/systems/login.ts`, `skymp5-server/ts/ui.ts`, `cmake/scripts/generate_server_settings.cmake` | Vollständiges Schema/Beispiele/Fehler in `docs/docs_server_configuration_reference.md`. |
| AUD-DOC-002 — Fertig | Discord-Bot-Konfiguration | Felder, Dashboard, Unterschied zu discordAuth.guilds, Startup und Grenzen dokumentiert. | Aktive Einstellungen brauchten Betreiberanleitung. | `skymp5-server/ts/ui.ts`, `cmake/scripts/generate_server_settings.cmake` | Pflicht-/optionale Felder, Sicherheit, UI-Zuordnung. |
| AUD-DOC-003 — Fertig | Namenumschalter | Default, CFG-Broadcast und Servervorrang für showCharacterNicknames dokumentiert. | Fehlte in Hauptreferenz. | `skymp5-server/ts/index.ts`, `skymp5-server/ts/ui.ts` | Semantik, Defaults und Clientfolgen enthalten. |
| AUD-DOC-004 — Fertig | Admin-Sitzungs-API | Login/logout/session/touch, HttpOnly-Cookie, zehn Minuten Idle, Neustartverhalten dokumentiert. | Besserer Betrieb hinter Reverse-Proxys und Support. | `skymp5-server/ts/ui.ts` | Serveranleitung erklärt `/api/admin/session/login`, `/logout`, `/touch`, Cookies/Timeout. |

<a id="suggested-execution-order"></a>
## Vorgeschlagene Reihenfolge

1. `AUD-BLK-003`, `AUD-BLK-002`, `AUD-BLK-001`, `AUD-BLK-004`
2. `AUD-RSK-001`, `AUD-RSK-002`, `AUD-RSK-004`, `AUD-RSK-003`
3. `AUD-DOC-001`–`AUD-DOC-004` seit 22. Oktober abgeschlossen; bei Änderungen aktuell halten.

<a id="notes-1"></a>
## Hinweise

- Zuerst Laufzeitrisiken, dann Stabilität/Wartbarkeit, dann Betreiberverständlichkeit.
- Tickets möglichst auf eine PR begrenzen, um Rollbackrisiko zu senken.

<a id="mods--plugins-completion-backlog-proposed"></a>
# Backlog zur Vervollständigung von Mods und Plugins (Vorschlag)

Ziel ist ein vollständiger Betreiber-/Clientablauf auf Basis der heutigen Mod-/Plugin-Unterstützung.

<a id="p0---hardening-current-plugin-runtime"></a>
## P0: Aktuelle Plugin-Runtime härten

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| MODPLUG-001 — Offen | Prozessplugin-Ausführung | Explizite Befehlsfreigabe, optionaler CWD-Schutz und bereinigte Umgebung. | Beliebige Hostbefehle sind Produktionsrisiko. | Nicht erlaubte Befehle mit klarem Startfehler abweisen und dokumentieren. |
| MODPLUG-002 — Offen | Pluginzustand und Abstürze | `starting/running/failed/stopped`, Restart `never/on-failure`. | Logs allein liefern keinen deterministischen Lifecycle. | Admin-API zeigt jeden Zustand und Fehlerübergang, Tests vorhanden. |
| MODPLUG-003 — Offen | Discovery-State-Integrität | `Plugins/.discovery-state.json` beim Start prüfen/reparieren. | Beschädigung kann Aktivierung/Reihenfolge blockieren. | Deterministische Reparatur mit Warnung, keine stillen Aktivierungsänderungen. |

<a id="p1---mod-distribution-end-to-end-server---client"></a>
## P1: Modverteilung vom Server zum Client

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| MODPLUG-004 — Fertig (Launcher-Vorbereitung) | Clientmanifest-Sync | Standalone-Launcher lädt v2, prüft Pfade/Größen/SHA-256, cached/installiert vor SKSE; v1-Fallback. | In skymp-client-launcher/launcher/src-tauri/src/connection.rs implementiert; Spielstart getrennt abzunehmen. | Vorbereitung/Cache/Reparatur/Update/Restore geprüft; Weltbeitritt offen. |
| MODPLUG-005 — Teilweise | Fortsetzen/Wiederholen | Geprüfte vollständige Cachedateien werden genutzt, Server bietet Range. Partial-Resume und konfigurierbarer Retry/Backoff offen. | Große Mods bei instabiler Verbindung. | Unterbrechungen ohne korrupten Cache beheben, Max-Retries konfigurierbar. |
| MODPLUG-006 — Teilweise | Versionierter Cache | Namespace nach Server/Ressourcenhash; Bereinigung und Speicherlimits offen. | Veraltete oder serverübergreifende Vermischung verhindern. | Deterministische Treffer/Fehler, nur ungültige Altressourcen löschen. |

<a id="p1---dependency--load-order-guarantees"></a>
## P1: Abhängigkeiten und Ladereihenfolge

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| MODPLUG-007 — Offen | Ressourcenabhängigkeiten | Manifest um Abhängigkeiten/optionale Bedingungen erweitern. | Vorhersehbares Laden zwischen Servern. | `dependsOn`/`version`, verständliche Resolverfehler. |
| MODPLUG-008 — Offen | Clientresolver | Topologische Reihenfolge aus Metadaten durchsetzen. | Hashprüfung allein genügt bei Reihenfolgevorgaben nicht. | Deterministische Reihenfolge oder verständlicher Fehler. |
| MODPLUG-009 — Offen | Pluginabhängigkeiten | `dependsOn` und Versionsgrenzen in `plugin.json`. | Manuelle Reihenfolge/Drift können Start brechen. | Inkompatiblen Graph genau begründet blockieren; kompatiblen deterministisch starten. |

<a id="p2---operator-ux-and-observability"></a>
## P2: Betreiberbedienung und Beobachtbarkeit

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| MODPLUG-010 — Teilweise | Ressourcendiagnose | Inventar vorhanden; Veröffentlichungsdiagnose, vollständiger Hashvergleich und Fehlend-/Korrupt-UI offen. | Weniger SSH/Logs für Routinebetrieb. | Status je Ressource, Aktualisieren per Klick, Fehlerdetails. |
| MODPLUG-011 — Offen | Pluginsteuerungs-API | Enable/disable/restart mit Capabilities/Auditlog. | Sicherer Betrieb ohne Dateiedits/Neustarts. | Rechtegeprüft, protokolliert, im Livezustand sichtbar. |
| MODPLUG-012 — Offen | Verteilungsmetriken | Manifestlatenz, Downloaderfolg/-fehler, Bytes, Cachetrefferrate. | Rollout optimieren, Regressionen erkennen. | Vorhandene Telemetrie und Admin/Prometheus. |

<a id="recommended-rollout-order"></a>
## Empfohlener Rollout

1. `MODPLUG-001`, `MODPLUG-002`, `MODPLUG-003`
2. `MODPLUG-004`, `MODPLUG-006`, `MODPLUG-005`
3. `MODPLUG-007`, `MODPLUG-008`, `MODPLUG-009`
4. `MODPLUG-010`, `MODPLUG-011`, `MODPLUG-012`

<a id="mapping-to-existing-roadmap-docs"></a>
## Zuordnung zur vorhandenen Roadmap

- Ressourcen-API-Basis: `docs/docs_resource_auto_download.md`
- Richtung für Phase 2/3: `ROADMAP_FIVEM_IDEAS.md`
- Runtime-Basis und Anleitung: `README-plugins.md`

<a id="voice--proximity-chat-sync-backlog-proposed"></a>
# Backlog für Voice- und Umkreischat-Synchronisierung (Vorschlag)

Dieser Backlog beschreibt die Integration von Sprachaktivitätserkennung (VAD) und Lippenanimation. Die Architektur ist **anbieterunabhängig**: YACA-TS, Discord, Mumble, eigenes 3D-VoIP usw. können die standardisierte Voice Activity API implementieren.

**Quellaudit vom 27. Oktober 2026:** Die durchgängige Funktion bleibt teilweise umgesetzt. Das lokale YACA-Plugin besitzt einen optionalen Sprachcallback, verbindet ihn im Standardentry jedoch nicht mit der Animation. Aktuelle Blocker, fehlende Zielinformationen und der Zweispieler-Abnahmeplan stehen im [Lipsync-Status](docs/docs_voice_lipsync_status.md). Die Tabellen beschreiben Ziele und sind kein Spielabnahmeprotokoll.

<a id="context"></a>
## Kontext

- **Voice-Anbieter:** Mehrere Lösungen möglich, etwa YACA TeamSpeak, Discord-Bots oder selbst gehostetes VoIP.
- **Gemeinsamer Vertrag:** Alle Anbieter liefern eine gemeinsame VAD-Schnittstelle für den Server.
- **Client:** `VoiceActivitySyncService` empfängt `syncVoiceActivity` und ruft den Animationshandler auf. Die neue YACA-Brücke verwendet CEF und `_yacaClient`; ihr optionaler Callback muss noch angeschlossen werden. Eine Papyrusquest gehört nicht zu ihrem aktuellen Transport.
- **Server:** Voice Activity Manager abstrahiert Anbieter und verteilt „Spieler X spricht“ an Clients im Umkreis.
- **Animationsversuch:** Handler ruft `playIdle(0x0005B1B0)` auf, im Code IdleDialogueLock genannt. Sichtbare Mundbewegung und geeigneter Reset brauchen Spieltest; kein erweiterter Animationspool implementiert.

<a id="voice-activity-api-specification-design-first"></a>
## Voice Activity API: zuerst den Vertrag festlegen

Vor der Umsetzung Schnittstellen vereinbaren:

| Komponente | Schnittstelle | Hinweise |
| --- | --- | --- |
| **Server Voice Activity Manager** | `IVoiceProviderAdapter.onVoiceActivityUpdate(callback)` liefert `VoiceActivityState` an registrierten Manager. | Bestehender Adaptercallback. Registry speichert derzeit einen neuesten Zustand je Actor; Zusammenführung/Konfliktauflösung bleibt Ziel. |
| **Server→Client** | CustomPacket `syncVoiceActivity(actorId, isSpeaking, voiceRange)` | Client wählt Animation nach Zustand, unabhängig vom Anbieter. |
| **Clientadapter** | Script/Plugin empfängt Paket und wendet lokalen Zustand, Animationen/Effekte an; anbieterspezifische Verbindung. | YACA-`onVoiceActivity` muss an vollständigen Zustand-/Animationspfad. Weitere Anbieter brauchen echte Sprachereignisse. |
| **Anbieteridentität** | Optionales `providerId`, etwa "yaca-ts", "discord-bot", "custom-voip". | Diagnose zeigt Quelle jeder Aktualisierung. |
| **Reichweitenmodell** | Stufen (1.0, 3.0, 8.0, 15.0, 20.0, 25.0, 30.0, 40.0 Meter) oder kontinuierlich 0–100 m. | Betreiber wählt, Server filtert Umkreis. |

---

<a id="p0---voice-activity-api--core-lipsync"></a>
## P0: Voice Activity API und Core-Lipsync

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| VOICE-API-SPEC-001 — Fertig (TS-Vertrag/Dokumentation) | VAD-Spezifikation | TypeScript-Vertrag und aktuelle Grenzen formalisieren. | Klare Integration mehrerer Anbieter statt Sonderlösungen. | Typen in `voiceActivityApi.ts`, Referenz `docs/docs_voice_api.md`; YACA-Adapter bleibt Transportgerüst. Kein zusätzliches OpenAPI-Artefakt behauptet. |
| VOICE-VAD-MNG-001 — Teilweise | Servermanager | Abstrahierten VAD-Empfänger im Gamemode (C++/TS-Plugin) umsetzen; beliebige Anbieter an umkreisbezogene Verteilung anbinden. | Vom Anbieter entkoppelter Core ermöglicht weitere Systeme ohne Serveränderung. | Anbieterneutrale Zustände, nur Umkreisempfänger, deterministische Zusammenführung/Konfliktauflösung. |

**Vorhandene Quellen (27. Oktober 2026 geprüft; Spielabnahme offen):**

- `skymp5-server/ts/voiceActivityApi.ts`: vollständige TS-Schnittstellen (VoiceActivityState, IVoiceProviderAdapter, IVoiceActivityManager, VoiceActivityConfig).
- `skymp5-server/ts/voiceActivityManager.ts`: Zustandsregistry, Inaktivitätstimer, Verteilung.
- `skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts`: YACA-Referenzgerüst.
- `skymp5-client/src/sync/voiceActivitySync.ts`: Client-Lipsynchandler mit IdleDialogueLock.
- `docs/docs_voice_api.md`: Vertrag, tatsächliche Paketformate, Konfiguration, Diagnosegrenzen.
- `docs/docs_voice_lipsync_status.md`: Befunde, benötigte Angaben, Zweispieler-Abnahme.
- `README-plugins.md`: Integrationsgrenzen und Links.

**Als Nächstes (VOICE-VAD-MNG-001 und VOICE-LIP-001):** Brücke verbinden, authentifizierte Zustandseingänge vereinheitlichen, Koordinaten-/Actor-IDs umrechnen, Stop/Ablauf umsetzen und Animation wirklich in Skyrim prüfen.

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| VOICE-LIP-001 — Teilweise | Clientanimation | Bei `isSpeaking=true` IdleDialogueLock, bei false zu Idle/Bewegung zurück. | Sichtbare Rückmeldung synchroner Kommunikation. | Umkreisclients sehen passenden Lock/Unlock bei Remote-Spielern, ohne Animationsrennen. |
| VOICE-PROX-001 — Teilweise | Umkreisgrenze | Reichweitenstufen/-distanz serverseitig durchsetzen und VAD nur im Bereich verteilen. | Bandbreite und Privatsphäre, visuelle/akustische Reichweite angleichen. | Außerhalb keine VAD-Daten, bei Bewegung neu berechnen, keine Broadcastflut. |

<a id="p1---provider-implementations--adapters"></a>
## P1: Anbieter und Adapter

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| VOICE-YACA-IMPL-001 — Offen | YACA-TS | Lokalen `onVoiceActivity` an vollständigen Zustand-/Animationspfad anschließen; Brücke nutzt CEF/native Eventquellen. | Erster Anbieter prüft API, ermöglicht YACA-Server. | Echte TALK/SOUND-Ereignisse steuern richtigen Remote-Actor, Dauersprache und Stop/Cleanup funktionieren, Zweispieler-Skyrim/TeamSpeak-Test besteht. |
| VOICE-DISCORD-IMPL-001 — Offen | Optionaler Discord-Bot | Echte Sprachaktivität mit authentifizierter Actor-Zuordnung, Kanalpräsenz allein reicht nicht. | Discord-Server und Nachweis der Anbieterunabhängigkeit. | Start/Stop am Server, richtige Clientanimation, keine YACA-Abhängigkeit. |
| VOICE-CUSTOM-IMPL-001 — Offen | Eigene VoIP-Vorlage | Adaptergerüst/Anleitung für eigene Backends veröffentlichen. | Drittanbieter ohne Coreänderung. | Beispiel, Prüfliste und Diagnosewerkzeuge. |

<a id="p1---admin--diagnostics"></a>
## P1: Administration und Diagnose

| ID | Bereich | Umfang | Grund | Abnahme |
| --- | --- | --- | --- | --- |
| VOICE-MON-001 — Teilweise | Metriken/Health | Pluginmonitor um Relay-Verfügbarkeit, Sprecherzahl, Reichweiten- und Anbieterverteilung erweitern. | Pipelinezustand und anbieterbezogene Fehlersuche. | Admin-API `voiceActivity.runtimeStatus`, aktive Sprecher, Anbieter und letzter Eventzeitpunkt je Anbieter. |
| VOICE-ADM-001 — Offen | Voice-Dashboard | Aktive Sprecher, Reichweitenhistogramm, Latenz, Anbieterzustand und Relaydiagnose. | Schnelle Einrichtungskontrolle ohne SSH/Logs. | Echtzeitpanel, Reichweitenkalibrierung per Klick und Diagnoseumschalter je Anbieter. |

<a id="p2---advanced-features-post-mvp"></a>
## P2: Erweiterte Funktionen nach MVP

| ID | Bereich | Umfang | Grund | Abnahme |

<a id="recommended-rollout-order-1"></a>
## Empfohlene Reihenfolge

1. **Entwurf/Vertrag:** `VOICE-API-SPEC-001`.
2. **Anbieterneutraler Core:** `VOICE-VAD-MNG-001`, `VOICE-PROX-001`, `VOICE-LIP-001` (Servermanager und Clientsync).
3. **Erster Anbieter:** `VOICE-YACA-IMPL-001`, Vertrag mit YACA-TS prüfen.
4. **Administration/Diagnose:** `VOICE-MON-001`, `VOICE-ADM-001`.
5. **Weitere Anbieter/Erweiterungen:** `VOICE-DISCORD-IMPL-001`, `VOICE-CUSTOM-IMPL-001`, `VOICE-DYN-001`, `VOICE-EFFECT-001` nach MVP.

<a id="notes-2"></a>
## Hinweise

- **Anbieterabstraktion:** API ist unabhängig. YACA besitzt Adaptergerüst und separate lokale Brücke, deren vollständige Verbindung noch offen ist. Discord, Mumble und eigenes VoIP können dieselbe Schnittstelle implementieren.
- **Adapterprinzip:** Jeder Serveradapter übersetzt Anbieterzustand in VAD; neue Anbieter benötigen keine Coreänderung.
- **Inaktivität:** Adapterupdates haben Managertimer; direkter CustomPacket-Pfad umgeht ihn. Timeout, Heartbeat, frühere Empfänger und Clientablauf abstimmen, bevor zuverlässiges Aufräumen behauptet wird.
- **Multiplayer-Lifecycle:** Reihenfolge, Despawn/Neuerstellung, fehlende Stop-Pakete und andere Animationen brauchen echte Mehrspieler-Abnahme.
- **Erweiterbarkeit:** Native Audiostreams können später die Effektpipeline erweitern, ohne VAD-API zu ändern.
- **Dokumentation:** `voiceActivityApi.ts` und `docs/docs_voice_api.md` definieren bereits TS-Vertrag/Adapteranleitung. Anbieter-/Spielabnahme und ein zusätzliches OpenAPI-Artefakt sind getrennte Arbeit.
