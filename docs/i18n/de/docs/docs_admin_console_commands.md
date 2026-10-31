[Deutsch](docs_admin_console_commands.md) · [English](../../en/docs/docs_admin_console_commands.md) · [Русский](../../ru/docs/docs_admin_console_commands.md)

<a id="admin-console-commands"></a>

# Befehle der Admin-Konsole

Die Server-Admin-Konsole unterstützt einen kleinen Befehlsdispatcher mit ausdrücklichen Berechtigungen und einem JavaScript-Fallback für ältere Abläufe.

Gemeint ist die authentifizierte **Dashboard-/Server-Admin-Konsole**. Sie ist von nativen Skyrim-Konsolenbefehlen und den registrierten `/`-Commands des optionalen Chat-Plugins getrennt. [Console Security](docs_console_security.md) schützt die native Clientkonsole und validiert native Befehlsrequests im Core. Sie ersetzt weder diesen Admin-Dispatcher noch die bestehende Command-Registry des Chat-Plugins.

<a id="supported-commands"></a>

## Unterstützte Befehle

- `help [command]` – Befehlsliste oder Kurzbeschreibung anzeigen.
- `players` – angemeldete Spieler mit `userId`, `actorId` und Actor-Name anzeigen.
- `kick <userId> [reason...]` – Spieler entfernen.
- `kick-all [reason...]` – alle angemeldeten Spieler entfernen.
- `ban <userId> [durationMinutes] [reason...]` – Spieler sperren.
- `unban <userId>` – Sperre aufheben.
- `mute <userId> [durationMinutes] [reason...]` – Spieler stummschalten.
- `unmute <userId>` – Stummschaltung aufheben.
- `warn <userId> <message...>` – Warnung senden.
- `message <userId> <message...>` – private Nachricht senden.
- `announce <message...>` – visuelle Ankündigung für alle angemeldeten Spieler anzeigen.
- `js <chakraJavaScript...>` – reines Chakra-JavaScript ausführen, nur für Administratoren.

<a id="aliases"></a>

## Aliase

Folgende Kurzformen stehen zur Verfügung:

- `commands` -> `help`
- `?` -> `help`
- `listplayers` -> `players`
- `lsplayers` -> `players`
- `say` -> `announce`
- `msg` -> `message`
- `pm` -> `message`
- `kickall` -> `kick-all`
- `eval` -> `js`

<a id="permissions"></a>

## Berechtigungen

Der Zugriff wird pro Aktion anhand der Admin-Fähigkeiten geprüft:

- `canViewLogs` für `help` und `players`
- `canKick` für `kick` und `kick-all`
- `canBan` für `ban`
- `canUnban` für `unban`
- `canMute` für `mute`
- `canUnmute` für `unmute`
- `canWarn` für `warn`
- `canMessage` für `message` und `announce`
- `canConsole` für `js`

Wenn ein Befehl unbekannt ist und der Benutzer `canConsole` besitzt, bleibt zur Kompatibilität der bisherige Fallback zur JavaScript-Ausführung erhalten.

`announce` wird als HUD-Banner am oberen Bildschirmrand mit Ein-/Ausblendanimation dargestellt. Die Dashboard-Schnellaktion **Ankündigung senden** verwendet denselben bestehenden Clienthandler `announcementToast` und zeigt das Banner acht Sekunden lang. Der aktuelle Client zeigt höchstens 240 Zeichen einer Ankündigung an.

<a id="examples"></a>

## Beispiele

```text
help
players
kick 12 "spamming chat"
ban 12 1440 "griefing"
mute 18 30 "temporary mute for moderation review"
announce "Server restart in 5 minutes"
js console.log('admin test')
```

Typische Verwendung:

- Beginne mit `help`, wenn du die Befehlsrechte deiner Rolle nicht kennst.
- Ermittle mit `players` die `userId`, bevor du Moderationsbefehle ausführst.
- Setze Gründe mit Leerzeichen in Anführungszeichen.
- Verwende `js` nur zur Fehlersuche oder für ältere Arbeitsabläufe, nicht als hauptsächlichen Admin-Zugriff.

<a id="notes"></a>

## Hinweise

- Der Dispatcher entfernt umgebende Leerzeichen und zerlegt Argumente mit Beachtung von Anführungszeichen. Nachrichten mit Leerzeichen lassen sich so sicher übergeben.
- Moderationsbefehle schreiben gegebenenfalls auch in Admin-Verlauf und Serverlog.
- Die Implementierung liegt in `skymp5-server/ts/ui.ts`.
