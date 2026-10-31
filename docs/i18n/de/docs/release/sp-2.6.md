[Deutsch](sp-2.6.md) · [English](../../../en/docs/release/sp-2.6.md) · [Русский](../../../ru/docs/release/sp-2.6.md)

<a id="sp-260-release-notes"></a>

# SP 2.6.0 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.5.0

**Dieses wichtige Update ergänzt AE-/1.6-Unterstützung, verbessert die Bildrate und behebt zahlreiche Abstürze und Probleme. Ein Update ist gegenüber der weiteren Verwendung von 2.5 oder älteren Versionen empfehlenswert.**

Beachte, dass ein SP-Update bei _einigen_ Modlisten leider Spielstände beschädigen kann. Weiterhin gibt es vieles zu implementieren oder zu korrigieren. Siehe [Issues](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

SP unterstützt sowohl die Steam-Version von Skyrim SE (1.6+) als auch die ältere Version 1.5.97.

Wenn dir Skyrim Platform gefällt, gib diesem Repository einen Stern. Das hilft ⭐

<a id="error-in-http-clients-response"></a>

## `error` in der HTTP-Client-Antwort

`HttpResponse` besitzt jetzt ein Feld `error`. Es liefert genauere Informationen darüber,
warum eine HTTP-Anfrage fehlgeschlagen ist. Mögliche Werte sind derzeit
[diese](https://github.com/yhirose/cpp-httplib/blob/b80aa7fee31a8712b1d3cae05c1d9e7f5c436e3d/httplib.h#L771-L785):

- Leere Zeichenfolge bei Erfolg
- `Unknown`
- `Connection`
- `BindIPAddress`
- `Read`
- `Write`
- `ExceedRedirectCount`
- `Canceled`
- `SSLConnection`
- `SSLLoadingCerts`
- `SSLServerVerification`
- `UnsupportedMultipartBoundaryChars`
- `Compression`

<a id="add-more-events"></a>

## Weitere Ereignisse

- `buttonEvent`
- `mouseMove`
- `thumbstickEvent`
- `kinectEvent`
- `deviceConnect`
- `actorKill`
- `criticalHit`
- `disarmedEvent`
- `dragonSoulsGained`
- `itemHarvested`
- `levelIncrease`
- `locationDiscovery`
- `shoutAttack`
- `skillIncrease`
- `soulsTrapped`
- `spellsLearned`

## FileInfo-API

Du kannst jetzt Informationen über Dateien direkt im Data-Ordner von Skyrim abrufen.

```ts
sp.printConsole(JSON.stringify(sp.getFileInfo('Skyrim.esm')));
// {"filename": "Skyrim.esm", "size": ..., "crc32": ...}
```

<a id="other-changes"></a>

## Weitere Änderungen

- Mehrere Sicherheitsprobleme bei der Prüfung lokaler Dateipfade behoben.

- Die Einstellungsdatei von Skyrim Platform liegt jetzt unter `Data\SKSE\Plugins\SkyrimPlatform.ini`.

- Darstellung nicht-ASCII-kodierter Texte korrigiert: UTF-8-Verarbeitung aus JS behoben und Schrift mit kyrillischen Zeichen neu kompiliert. Informationen zu anderen Schriften stehen in der [Dokumentation der SP-Text-API](../skyrim_platform/texts.md#compiling-font).

- Das Projekt entspricht jetzt C++20 und lässt sich mit VS 2022 fehlerfrei kompilieren.

- CommonlibSSE auf die neueste Version aktualisiert.

- Laufzeitverwaltung für Ereignisempfänger eingeführt. Bis auf bestimmte direkt im Code ausgelöste Ereignisse werden Ereignisse nicht mehr verarbeitet, wenn kein Plugin sie abonniert hat. Weniger zu verarbeitende Aufrufe sollten die Leistung verbessern.

- Protokollierung ergänzt. Platform verwendet jetzt die Laufzeitprotokollierung von SKSE, um mehr Informationen über den Ausführungsablauf bereitzustellen. Die Protokolldatei liegt unter `User\Documents\My Games\Skyrim Special Edition\SKSE.`

- Alle direkten Offsets für Hooks und Spielklassen durch Address-Library-IDs ersetzt, um zukünftige Spielversionen zu unterstützen.

- SKSE64 ist keine Build-Abhängigkeit mehr, wird zum Ausführen des Plugins aber weiterhin benötigt.
