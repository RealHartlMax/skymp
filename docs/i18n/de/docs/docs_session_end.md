[Deutsch](docs_session_end.md) · [English](../../en/docs/docs_session_end.md) · [Русский](../../ru/docs/docs_session_end.md)

# Sitzungsende: Kick, Bann, Neustart und Verbindungsverlust

Spieler erfahren jetzt, wenn ihre Verbindung zum Server endet. Vorher lief das Spiel ohne Hinweis lokal weiter. Die Funktion gehört zum Core und funktioniert ohne Chat- oder UI-Core-Plugin.

## Verhalten im Spiel

| Auslöser | Ablauf für den Spieler |
| --- | --- |
| Kick, Bann, Serverneustart, Herunterfahren | Sofortiges Sitzungsende: Steuerung gesperrt, Rückkehr ins Hauptmenü, Overlay mit Grund |
| Verbindungsverlust beim Spielen | Hinweis „Verbinde neu“, bis zu 30 Sekunden automatische Versuche, Spieler bleibt in der Welt. Klappt es nicht: Hauptmenü und Overlay |
| Verbindungsfehler vor dem Spielen | Overlay im Hauptmenü, keine automatischen Versuche |
| Verbindung beim Neuverbinden abgelehnt | Sofortiges Sitzungsende, weil ein weiterer Versuch nichts ändern würde |

Während eines laufenden Neuverbindens beendet eine Server-Mitteilung (Kick, Bann, Neustart) die Versuche sofort. Akzeptiert der Server die Verbindung, verlängert sich die Frist auf mindestens 15 Sekunden, damit der Login abgeschlossen werden kann. Falsche Passwörter zeigt weiterhin der Login-Dialog an.

Das Overlay bietet zwei Aktionen:

- **Hauptmenü** schließt den Hinweis, ohne neu zu verbinden. Das ist Absicht: Bei Steam- und Offline-Profilen würde ein neuer Login sofort starten und einen gekickten Spieler wieder verbinden.
- **Erneut verbinden** startet eine neue Sitzung. Während einer aktiven Sperre ist diese Aktion nicht verfügbar.

Beide Aktionen werden im Hauptmenü freigegeben, spätestens aber 15 Sekunden nach dem Sitzungsende, falls die Rückkehr ins Hauptmenü nicht abgeschlossen wird. Eine aktive Sperre bleibt bis zu ihrem Ablauf gespeichert, bei einer dauerhaften Sperre bis zum Spielneustart. Die Sperre selbst setzt der Server durch.

## Servermitteilung

Der Server sendet ein zuverlässiges CustomPacket und trennt die Verbindung 150 ms später. `server.kick` ist dafür umschlossen, sodass alle vorhandenen Aufrufer automatisch eine Mitteilung auslösen. Plugins brauchen nichts zu ändern.

```json
{"customPacketType":"skymp:sessionEnd","version":1,"kind":"kick","message":"","until":null}
```

`kind` ist `kick`, `ban`, `restart` oder `shutdown`. `until` ist nur bei befristeten Sperren gesetzt. Angezeigte Texte werden gefiltert, auf 512 Zeichen begrenzt und als Text gerendert.

Der Server sendet die Mitteilung bei SIGTERM, also bei verwalteten Neustarts über den Supervisor, und bei SIGINT (Strg+C). Bei einem Absturz oder `kill -9` kann er nichts mehr senden. Dann erkennen Client-Heartbeat (`skymp:sessionPing`/`skymp:sessionPong`, 15 Sekunden) oder das native Timeout den Verlust. Ältere Server ohne Pong nutzen nur das native Timeout.

## Technische Grenzen

Papyrus-Aufrufe sind nur im `update`-Ereignis erlaubt, und `update` läuft im Hauptmenü nach aktuellem Kenntnisstand nicht. Deshalb gilt in `sessionEndClient.ts`:

- Der Menüzustand stammt aus `menuOpen`/`menuClose`, nicht aus `Ui.isMenuOpen`.
- Overlay und Neuverbinden laufen im `tick`.
- Nur `quitToMainMenu` und die Spielersteuerung nutzen `update`.

`NetworkingService.close()` ist ein stiller Transportabbau für den Login-Ablauf und beendet keine Sitzung.

## Tests

```powershell
npm --prefix skymp5-client run test:session-end
```

Der Test-Mock wirft bei Papyrus-Aufrufen außerhalb von `update` und feuert `update` nicht im Hauptmenü, entspricht also dem echten Verhalten. Noch manuell im Spiel abzunehmen: Kick, Bann, geplanter Neustart, beendeter Serverprozess und ein kurzer Netzausfall.
