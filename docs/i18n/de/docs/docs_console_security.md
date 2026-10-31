[Deutsch](docs_console_security.md) · [English](../../en/docs/docs_console_security.md) · [Русский](../../ru/docs/docs_console_security.md)

# SkyMP Console Security

## Verifizierte Ausgangslage und Eingriffspunkte

Analyse vom 29.10.2026, vor der Implementierung:

- Native Konsolenpakete laufen über `ConsoleCommandsService` → `MsgType.ConsoleCommand` → `ActionListener::OnConsoleCommand` → `ConsoleCommands::Execute`. Der Server bestimmt den Actor bereits anhand der Verbindung; der alte `enableConsoleCommandsForAll`-Schalter umgeht jedoch `EnsureAdmin` vollständig.
- Die fünf bestehenden Serveroperationen besitzen bislang keine vollständige Vorabprüfung von Argumentanzahl, Integer-Bereichen und unbekannten `mp`-Unterbefehlen. Die vorhandene serverseitige Actor-Berechtigung ist `consoleCommandsAllowed`; nur die vertrauenswürdige Server-API setzt dieses Flag.
- `MovementValidation::Validate` schützt Zell-/Weltwechsel und Positionssprünge ab 4096 Einheiten. Eine zeitbasierte Analyse und eine Prüfung auf nichtendliche Koordinaten fehlen. `OnUpdateMovement` sendet derzeit vor der Validierung an Nachbarn; diese Reihenfolge muss korrigiert werden.
- `findConsoleCommand` findet Kurz- und Langnamen. SkyrimPlatform führt bei `execute`-Rückgabe `false` den ursprünglichen Befehl nicht aus. Der ursprüngliche Callback ist über die bestehende API verkettbar; SkyrimPlatform entfernt die Hooks beim Script-Reload.
- `Settings` und das native `ScampServer` erhalten dieselbe `server-settings.json`. Das Dashboard besitzt authentifizierte Routen, `canConsole`, eine bestehende Einstellungsnavigation sowie Gameserver-/Dashboard-IPC. Gespeicherte und tatsächlich im nativen Prozess aktive Richtlinien müssen getrennt angezeigt werden.
- Das separate `D:/GitHub/SkyMP-Chat` verwendet `skympChat:*`-CustomPackets, eine funktionierende `CommandRegistry` und einen synchronen Permission-Resolver. Diese Pfade haben keine Verbindung zum nativen ConsoleCommand-Paket. Das Chat-Repository wird für dieses Feature nur gelesen; es entsteht keine zweite Registry und kein Chat-Dispatcher.
- Inventar-, Actor-Hosting-, Treffer- und Attributnachrichten haben eigene native Verarbeitungswege. Konsolensicherheit ersetzt deren Prüfungen nicht und darf diese nicht abschalten. Die vorhandene Attributregeneration und die Actor-/Host-Zuordnung bleiben erhalten.

## Umsetzungsgrenzen

Der Server entscheidet über privilegierte Zustandsänderungen. Client-Hooks sind zusätzliche Schutzmaßnahmen und keine Vertrauensgrundlage. Ohne Geometrie-/Kollisionsabfragen ist eine vollständige Noclip-Erkennung nicht möglich. Bewegungsheuristiken dienen zunächst der Beobachtung; automatische Bans sind nicht vorgesehen. Gezielte C++-Testbuilds sind autorisiert, Release-Builds und ZIPs bleiben ausgeschlossen.

## Konfiguration und Migration

```json
{
  "consoleSecurity": {
    "mode": "restricted",
    "blockVanillaCheats": true,
    "blockUnauthorizedServerCommands": true,
    "monitorMovement": true,
    "movementEnforcement": "monitor",
    "logViolations": true,
    "logAllowedAdminCommands": true
  }
}
```

Dies sind auch die Defaults bei fehlender Konfiguration. Ungültige Werte werden beim Start mit Diagnose und sicheren Ersatzwerten behandelt; das Dashboard lehnt sie beim Speichern ab. Unbekannte Felder innerhalb von `consoleSecurity` werden diagnostiziert beziehungsweise beim API-Schreiben abgelehnt. Andere Servereinstellungen bleiben erhalten.

`restricted` erzwingt `blockVanillaCheats:true`. Im Modus `development` kann der Betreiber diesen Clientschutz ausdrücklich abschalten. **Beide Modi erzwingen weiterhin die Serverautorisierung.** `blockUnauthorizedServerCommands:false` ist keine unterstützte Abschaltung; beim Start wird der Wert ignoriert und diagnostiziert, beim Speichern abgelehnt.

`enableConsoleCommandsForAll:true` und ungültige Legacy-Werte ergeben `LEGACY_CONSOLE_BYPASS_IGNORED`. Die neue Richtlinie hat immer Vorrang. Der Schalter bleibt in bestehenden Dateien sichtbar, verleiht aber keine Rechte mehr. Wer bisher darüber Administratorbefehle für alle Spieler freigegeben hat, muss die Berechtigungen bewusst serverseitig vergeben:

```js
// Nur im vertrauenswürdigen Server-/Gamemode-Code, nach eigener Autorisierung:
mp.set(actorId, 'consoleCommandsAllowed', true);
```

Das Flag ist keine vom Client übertragbare Rollenangabe. Dashboard-Administratoren und Charakterrechte sind getrennte Berechtigungen; der Entwicklermodus verleiht keines davon. Es werden keine bestehenden Charakter- oder Benutzerdaten gelöscht oder automatisch umgeschrieben. Änderungen an der Richtlinie gelten nach einem Gameserver-Neustart. Zum erstmaligen Ausrollen müssen auch das native Servermodul, die gemeinsame Client-JS-Runtime und die korrigierte SkyrimPlatform-Konsolenbindung aktualisiert werden.

## Native Befehle und bestehende Handler

Der reguläre Client sperrt unterstützte Befehle für `tcl`, `tgm`, `tim`, `modav`, `setav`, `forceav`, `setlevel`, `coc`, `moveto`, `kill`, `resurrect`, `enable` und `unlock`. Kurz- und Langnamen werden über die tatsächliche Befehlstabelle aufgelöst. Referenz-/`player.`-Syntax landet beim selben nativen Befehl. Fehlende Einträge werden als nicht unterstützt gemeldet, nicht als geschützt ausgegeben. Harmlose Befehle wie `help` werden nicht überschrieben.

Die vorhandenen Serveroperationen `additem`, `equipitem`, `placeatme`, `disable` und der Alias `mp disable` bleiben getrennte, autorisierte Serverrequests; ihre ursprüngliche lokale Vanilla-Ausführung wird nicht freigegeben. Der Client erhält dafür die aktuell zulässigen Selbst-Operationen über einen verbindungsbezogenen Core-Handshake. Der Server prüft jede tatsächliche Anfrage erneut einschließlich ihres Ziels. Clientseitige Freigaben sind keine Autorisierung.

Der Server prüft bekannte Namen, exakte Argumentanzahl, Integer-Typen, positive 32-Bit-Form-IDs und Mengen von 1 bis 1.000.000 vor der Ausführung. Unbekannte Unterbefehle, Überläufe und negative Mengen werden abgewiesen. Nicht vorhandene Basisdatensätze werden vor Papyrus-Aufrufen zurückgewiesen. Die Identität stammt ausschließlich aus der Verbindung/Actor-Zuordnung. Unbekannte oder nicht angemeldete Verbindungen erhalten keine privilegierten Seiteneffekte.

Bestehende native JS-Handler werden verkettet. SkyrimPlatform liefert bei wiederholter Suche oder einem Alias dieselbe interne Befehlserfassung, ohne den bisherigen Handler oder die ursprüngliche native Funktion zu ersetzen. Diese Korrektur verhindert außerdem eine Rekursion durch einen als Original gespeicherten Trampolin-Einstieg.

## Bewegungsanalyse und Grenzen

Bestehende Zell-/Weltwechsel- und 4096-Einheiten-Schrittprüfungen bleiben erhalten. Nichtendliche Positions-/Rotationsdaten werden abgewiesen. Bewegungsdaten werden erst nach erfolgreicher Prüfung an Nachbarn weitergeleitet. Nichtendliche oder außerhalb von 0–1 liegende Attribut-Prozentwerte dürfen den serverseitigen Actor-Zustand ebenfalls nicht verändern.

- `off` oder `monitorMovement:false`: keine zusätzliche zeitbasierte Beobachtung; grundlegende Zustandsprüfungen bleiben aktiv.
- `monitor`: konservative Geschwindigkeits-/Aufwärtsbeobachtungen aus serverseitiger Empfangszeit protokollieren, keine heuristische Bewegungskorrektur.
- `enforce` (veraltet): wird beim Laden wie `monitor` behandelt und im Dashboard nicht mehr angeboten, weil der Modus nie strenger war. Geschwindigkeits-/Aufwärtsheuristiken führen weder zu Ablehnung noch Bann. Der Status weist `heuristicEnforcement:false` aus.

Beobachtungsfenster unter 100 ms und über drei Sekunden werden ausgelassen; Positionsproben werden höchstens alle 250 ms erneuert. Spielerselbstangaben zu Geschwindigkeit, Sprung oder Mount erlauben keine Umgehung. Große Sprünge, Knockback, Skriptbewegung und Verzögerungen können trotzdem Beobachtungen auslösen. Serverteleportationen erhalten die vorhandene Korrektur-/Resynchronisierung und werden dabei nicht als Cheat-Verstoß protokolliert.

Vertrauenswürdiger Servercode kann zusätzliche heuristische Beobachtungen eines Actors für höchstens 30 Sekunden ausnehmen. Das erlaubt weder einen Zellwechsel noch nichtendliche Koordinaten oder einen verbotenen Positionssprung. Beim Löschen des Actors verschwinden Proben und Ausnahme. Ein neuer Noclip-Modus und geometriebasierte Kollisionsprüfungen sind nicht implementiert.

## Dashboard und Status

**Einstellungen → Sicherheit → Konsolen- & Cheat-Schutz**, direkter Link `#settings/security`. Erforderlich sind die bestehende Admin-Anmeldung, Administratorrolle und `canConsole`. Die Oberfläche zeigt gespeicherte und vom nativen Prozess bestätigte aktive Werte nebeneinander. Abweichungen erfordern einen Gameserver-Neustart. Bei gestopptem oder veraltetem nativem Prozess wird keine aktive Schutzwirkung behauptet.

`GET /api/admin/console-security` liest diesen Zustand. `PUT` akzeptiert ausschließlich `{revision, consoleSecurity}` als JSON mit passender Origin. Eine veraltete Revision ergibt HTTP 409, fehlende Rechte oder falsche Origin HTTP 403, ungültige Werte HTTP 400. Nur das Sicherheitsobjekt wird in der neuesten Datei ersetzt. Die vorhandene Konfigurationsablage, Änderungsprotokollierung und Gameserver-/Dashboard-IPC werden wiederverwendet.

Clientmeldungen enthalten gefundene beziehungsweise nicht unterstützte Hooks und ihren Zeitpunkt. Sie werden ausdrücklich als **unbestätigte Selbstauskunft** dargestellt. Ein manipulierter Client kann solche Meldungen fälschen. Auch `supported` beweist weder, dass ein anderer Mod den Hook später nicht überschrieben hat, noch eine vollständige Noclip-Abwehr.

## Optionale Plugin-Berechtigungen

Die serverseitige Core-Schnittstelle `globalThis.skympConsoleSecurity` hat API-Version 1. Sie ist unabhängig von Chat und stellt keine Command-Registry bereit:

```ts
interface PermissionContext {
  userId: number;
  actorId: number;
  profileId: number;
  targetId: number;
  permission: string;
  source: 'native_console' | 'plugin';
}
```

`setPermissionResolver(owner, resolver)` nimmt genau einen synchronen, besitzergebundenen Resolver an. `true` erlaubt, `false` verweigert und `null`/`undefined` nutzt bei nativen Befehlen das vorhandene Actor-Flag. Exceptions, Promises und rekurrierende Aufrufe verweigern den Zugriff. Ein anderer Besitzer darf den Resolver nicht ersetzen; der aktuelle Besitzer entfernt ihn mit `null`. Beim Gamemode-Reload wird die Registrierung zurückgesetzt.

`hasPermission(userId, permission)` ermittelt Actor und Profil serverseitig und dient zukünftigen Plugin-Adaptern. Ohne Resolver sind nur die bekannten `console.additem`, `console.equipitem`, `console.placeatme` und `console.disable` durch das serverseitige Actor-Flag autorisierbar. Andere Permissions sind standardmäßig verweigert. `grantMovementAllowance(actorId, milliseconds)` setzt oder widerruft die beschriebene Ausnahme mit 0–30.000 ms. `getStatus()` liefert den Core-Zustand.

Ein zukünftiges Rollen-Plugin kann den **bereits vorhandenen** Chat-Resolver ausdrücklich anbinden:

```js
// Optional im eigenen serverseitigen Rollen-Plugin; Core setzt dies nicht voraus.
const core = globalThis.skympConsoleSecurity;
const chat = globalThis.skympChat;
if (core && chat) {
  chat.setPermissionResolver('roles', (userId, permission) =>
    core.hasPermission(userId, permission));
}
```

Der bestehende Chat registriert und dispatcht weiterhin selbst `/`-Commands. Es gibt keine automatische Kopplung an dessen Resolver und keine Änderungen an seinem Quellcode durch Console Security. Ohne Chat funktioniert der Core-Schutz vollständig.

## Logs und Abnahme

Das bestehende Serverlog enthält `[security]` plus strukturierte JSON-Ereignisse mit Zeitpunkt, internem Actor, kanonischem Befehl, Grund, Quelle und `blocked`. Gleiche Ereignisse werden pro Fünf-Sekunden-Fenster begrenzt und unterdrückte Wiederholungen beim nächsten Eintrag zusammengezählt. Rohargumente, Zugangstokens und IP-Adressen werden nicht übernommen. `movement_observation` bedeutet Beobachtung, `movement_rejected` tatsächliche Ablehnung. Clientberichte werden mit `source:client_report`, `reportedBlocked:true` und **`blocked:false`** protokolliert, damit keine serverseitig bewiesene Blockade vorgetäuscht wird.

Automatisierte Prüfungen liegen unter `unit/ConsoleSecurityTest.cpp` und `misc/console-security/tests/`. Bestehende Konsolen-, Bewegungs-, Attribut- und Chat-Tests gehören zur Regression. Quelltests: `npm --prefix skymp5-client run test:console-security`.

Manuell verbleiben: originale Konsolenbefehle und Aliase in Skyrim, `player.`-/selektierte Referenzen, freigegebene Adminrequests, Entwicklermodus, Wechsel/Neustart/Reconnect, interne SkyMP-Teleports und Bewegungsabläufe mit Sprüngen, Fallen, Schwimmen, Reiten, Knockback und Latenz. Clienthooks stoppen keine direkten Speicheränderungen, alternativen SKSE-Hooks oder bereits aktiven lokalen Cheat-Zustände. Eine Prüfung auf vollständige Steam-/Skyrim-/Zwei-Spieler-Funktion kann durch Quell- oder Unit-Tests nicht ersetzt werden.

## Bekannte Grenze der Rollen-Schnittstelle

Der Client erfährt pro Befehl nur, ob der Spieler ihn **auf sich selbst** ausführen darf (`allowedServerCommands`), und leitet ihn nur dann weiter. Ein Resolver, der einen Befehl ausschließlich für fremde Ziele erlaubt, muss ihn deshalb auch für den eigenen Actor erlauben. Das ist eine Einschränkung zugunsten der Sicherheit: Fälschlich blockiert werden kann ein Befehl, fälschlich ausgeführt nicht, weil der Server jede Anfrage selbst prüft.
