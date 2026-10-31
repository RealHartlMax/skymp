[Deutsch](docs_plugin_runtime.md) · [English](../../en/docs/docs_plugin_runtime.md) · [Русский](../../ru/docs/docs_plugin_runtime.md)

# Plugin Runtime Loader

Die Implementierung und der Vertrag für Betreiber und Entwickler werden unter [misc/plugin-runtime/README.md](../../../../misc/plugin-runtime/README.md) gepflegt.

Dies ist eine Quelländerung für den geplanten Server-Meilenstein **v2.1.0**: Sie ergänzt das öffentliche Launcher-Manifest und eine generische Client-/CEF-Modul-API. Es handelt sich nicht um ein reines v2.0.2-Bugfix-Release. Launcher- und Plugin-Versionen werden unabhängig verwaltet.

Zur Quellvorbereitung gehören außerdem:

- Das Offline-Inventar liest die konfigurierte native Dateidatenbank (`databaseName`, Standard `world/changeForms`), löst das authentifizierte Profil auf, statt einen Verbindungsslot als Profil zu behandeln, und bevorzugt einen noch geladenen nativen Actor. Ein leeres Inventar ist ein gültiger Snapshot. Historische Einträge ohne bekanntes Profil erhalten einen lokalisierten, ausdrücklichen Status; ihre Identität wird nicht geraten.
- Offline-Spieler erhalten keine Live-Moderationsaktionen. Vor einer Erfolgsmeldung prüft das Backend die aktuelle Verbindung und gegebenenfalls das erwartete Profil.
- Inventaranfragen überschreiben keine neuere Spielerauswahl. Quelle, Zeitstempel und Nichtverfügbarkeitsstatus sind lokalisiert.
- Die Serverversionsprüfung verwendet standardmäßig `RealHartlMax/skymp`; `releaseRepository` kann dies mit einem validierten `owner/repository` überschreiben.

Die bisherigen lokalen Releaseartefakte stammen aus der Zeit vor diesen Quelländerungen. Während dieser Implementierung wurden weder ein neuer Build noch ZIP, Commit, Push, Tag oder Release erstellt. Ein späterer Build muss Launcher, gemeinsamen Client-/CEF-Bootstrap und Plugin-Runtime-Pakete zusammen enthalten. Nach dieser einmaligen Bootstrap-Aktualisierung gehören kompatible Plugin-UI-/Client-Updates in das jeweilige Plugin-Release.
