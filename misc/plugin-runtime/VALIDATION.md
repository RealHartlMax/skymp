# Quellprüfung vom 29.10.2026

Dieser Stand implementiert den generischen Plugin Runtime Loader in Server,
gemeinsamem Client/CEF und Launcher sowie die Plugin-eigenen Module für Chat,
UI-Core und YACA. Metabolism bleibt ein UI-Core-Consumer. Es wurden keine
Anwendungs-Builds, ZIPs, Commits, Pushes oder Veröffentlichungen ausgeführt.

## Ausgeführte Prüfungen

- `node --test misc/plugin-runtime/tests/*.test.cjs`: 24 Tests. Darunter echte
  temporäre Dateisystem-/Ed25519-Prüfungen, Inventarzugriff auf konfigurierten
  Speicher, Offline-/Profilwechsel-Schutz, öffentliche Dateifreigabe, native
  Aktivierung und Aufräumen mit SkyrimPlatform-Event-Handles, Redux-Zustandsabbau,
  Legacy-/YACA-Verhalten, Herausgeber-Einstellungen und tatsächlicher Server-
  Plugin-Startpfad über den aktualisierten Prüfhelfer.
- `npm test` in `SkyMP-Chat`: 41 bestehende Server-Quelltests bestanden. Dieser
  Testbefehl ruft keinen Build auf.
- `tsc --noEmit` in Server, Client, Frontend, Launcher-Renderer, UI-Core und YACA:
  erfolgreich, ohne Ausgabedateien.
- `node skymp5-front/scripts/test-locales.js`: die sechs Sprachdateien haben
  übereinstimmende Schlüssel.
- Browserprüfung des echten generischen CEF-Host-Quellcodes in Chromium:
  Installation, Asset-Auflösung, wiederholte Revision, DOM-/Listener-/Reducer-
  Abbau, falscher Modulbesitzer, Skriptfehler nach Registrierung, Mount-Fehler,
  gesperrte Interaktion und verwalteter Modus erfolgreich. React/SkyrimPlatform
  wurden dabei durch einen Testhost ersetzt; kein Frontend-Build wurde erzeugt.
- JavaScript-/JSX-/TypeScript-Syntax der vorbereiteten Änderungen und Rust-Parser
  über `rustfmt --emit stdout` erfolgreich. Rust-Unit-Testquellen für Ed25519-
  Kompatibilität zum JS-Produzenten, unbekannte Herausgeber, veränderte Signaturen,
  unveränderliche Versionen, Pfade und kanonisches JSON sind vorbereitet.

Die Consumer-Tests verwenden die benachbarten Plugin-/Launcher-Checkouts. Ohne
diesen lokalen Workspace werden diese Tests ausdrücklich übersprungen; die
eigenständigen Vertrags-/Server-/Loader-Tests bleiben ausführbar.

## Für den später beauftragten Build offen

Keine Rust-Kompilierung und kein `cargo test`, da dies Build-Ausgaben erzeugen
würde. Die neuen Plugin-Module, Basis-Runtime und Launcher-Binärdateien wurden
noch nicht gebaut. Es gibt noch keine signierten Release-Manifeste und keine
dauerhaften Herausgeberschlüssel aus diesem Auftrag.

Nach dem Build sind Launcher-Download/-Installation/-Restore, echte Skyrim-/CEF-
Aktivierung und Serverwechsel, unterstützte Skyrim-Versionen, TeamSpeak-Audio
und sichtbare Lipsync separat abzunehmen. Die älteren lokalen Release-Artefakte
enthalten diese Quelländerungen noch nicht.

Vertrag und Ablauf: [deutsche Anleitung](README.de.md),
[technische Referenz](README.md).
