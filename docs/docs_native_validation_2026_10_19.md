# Native Server-Abnahme vom 19. Oktober 2026

## Nachtrag vom 22. Oktober 2026

Das Protokoll darunter dokumentiert die damaligen Server-/Clientstände.
Inzwischen ist die CommonLib-7.5.4-Portierung im aktiven lokalen Quellstand
vorhanden. Neue `SkyrimPlatform.dll` und `SkyrimPlatformImpl.dll` wurden als
Release gebaut. Der eigenständige Adressdatenbank-Test besteht für Skyrim
1.5.97 / Format 1, 1.6.1170 / Format 2 und 1.7.104 / Format 5.

Die neuere Clientausgabe liegt im Launcher-Repository unter
`local-builds/current/client-runtime/`; deren `VALIDATION.json` und
`native-compat/real-catalog-validation.json` belegen Paketdownload,
Versions-/Prüfsummenprüfung, Cache und Wiederherstellung. Das ältere unten
beschriebene Research-Plugin wurde laut aktuellem Nachweis vom Benutzer entfernt.

Diese Nachweise nennen weiterhin **keinen Spielstart und keine echte Sitzung**.
Der vollständige Skyrim-/SKSE-/CEF-Test bleibt offen. Die frühere Server-Suite
bleibt separat: Linux 264/264, Windows 263/264 mit offenem `Activate torch`-Fehler;
die volle native Suite wurde für die neuen Clientänderungen nicht wiederholt.
Siehe [aktueller Projektstand](docs_project_status.md) und
[Clientinstallation](docs_client_installation.md).

## Umfang und Quellstand

Auf Wunsch des Benutzers werden zunächst **Server-Testpakete für Linux und
Windows aus demselben lokalen Quellstand** gebaut. Skyrim wird nicht gestartet.
Alle Änderungen bleiben uncommittet und ungepusht; Basis ist `ce91db65`.

Der Quell-Snapshot enthält die lokalen Frontend-, Client- und Serveränderungen
einschließlich des gebauten Frontends. Git-Metadaten, Zugangsdaten, persönliche
Agent-Verzeichnisse, Spiel-Masterdateien und Windows-`node_modules` sind ausgeschlossen.
Die SHA256 des mitgelieferten Quellarchivs steht als `sourceFingerprint` in beiden
Paketmanifesten. Die native Servererweiterung wird je Betriebssystem separat gebaut.

Beide Builds verwenden Release, `BUILD_CLIENT=OFF`, `BUILD_SKYRIM_PLATFORM=OFF`,
`BUILD_SCRIPTS=OFF`, `BUILD_GAMEMODE=OFF`, `BUILD_UNIT_TESTS=ON` und
`DOWNLOAD_SKYRIM_DATA=OFF`. Der gemeinsame Gamemode ist
`skymp5-functions-lib/local-gamemode.js`. Die vorhandene eigene PEX-Datei wird
übernommen; der Windows-Papyrus-Compiler ist für diese Serverbuilds nicht nötig.
Reine Serverbuilds wählen die clientseitige CommonLib-Abhängigkeit nicht mehr an.

## Build- und Laufzeitumgebungen

| | Linux-Build | Linux-Laufzeittest | Windows-Build |
| --- | --- | --- | --- |
| Architektur | x86_64 | x86_64 | x64 |
| System | Ubuntu 25.10 im Docker-Container | Ubuntu 26.04.1 LTS im separaten Container | Windows 10, Build 19045 |
| Compiler | Clang 20.1.8 | kein Compiler erforderlich | MSVC 14.51.36231 / Visual Studio 18 2026 |
| CMake | 4.3.0 | nicht erforderlich | 4.4.0 |
| Node | 22.22.2 | 22.22.1 | 24.19.0 |

Linux-Build-Image: `skymp/skymp-vcpkg-deps:733f2d5`, Digest
`sha256:31da377a08790891335582f8951ab076621591b838fe7306013d344a45982ea5`.
vcpkg: `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`.
Die lokale Linux-Umgebung verwendet zwei parallele Jobs und ein Containerlimit
von 4 GB RAM. Das ist keine Leistungs- oder Spielerzahlmessung für den VPS.
Das bereitgestellte VPS-Startprotokoll bestätigt Linux x64; das Paket benötigt
`x86_64`.

## Ergebnisse

### Browser-Ersteinrichtung vom 20. Oktober

Die vollständigen Pakete unter `build/releases/2026-10-20-browser-setup/`
ersetzen die älteren Terminal-Assistenten. Der erste Launcher-Aufruf startet
einen temporären HTTP-Assistenten auf TCP 8080 und zeigt im Terminal einen
zufälligen vierstelligen Code. Alle Eingaben erfolgen im Browser. Nach
Code-Freigabe, Servereinstellungen, Masterdatei-Prüfung und eigenem Admin-Konto
wird der HTTP-Port an den eigentlichen Spielserver übergeben.

- Beide fertigen Archive wurden entpackt und jede Paketdatei gegen das Manifest
  geprüft; beide verweisen auf denselben zusätzlichen Quell-Snapshot.
- Windows und Linux: jeweils 19 Konfigurations-Testgruppen und 10 echte
  HTTP-Testgruppen bestanden. Geprüft sind unter anderem einmalige PIN-Freigabe,
  Ablauf, globales Versuchslimit, Origin-/CSRF-Schutz, fehlende/ungültige
  Masterdateien, Datenerhalt und keine erneute Einrichtung vorhandener Konten.
- Beide echten Serverpakete bestehen die Ersteinrichtung über HTTP mit dem
  ausschließlich im Terminal ausgegebenen Code, den nativen Start mit fünf
  vollständigen Masterdateien und den Login mit dem selbst gewählten Konto.
  Falsches Passwort, erneutes öffentliches Bootstrap, Frontend-Prüfsumme und
  nativer UDP-Socket werden ebenfalls geprüft.
- Sichtbarer Chromium-Test: vollständiger Browser-Durchlauf mit Fehlerfällen
  und Sitzung nach Neuladen; fünf Schritte bei 1280 und 360 Pixel Breite ohne
  horizontalen Überlauf oder JavaScript-Ausnahmen. Zehn Axe-Prüfungen melden
  keine WCAG-A/AA-Verstöße; unvollständige Kontrastbefunde auf Verläufen bleiben
  im Bericht zur manuellen Sichtung erhalten. Axe-Injektion erfolgt nur im
  Testkontext mit CSP-Ausnahme; die Paketdateien behalten ihre strikte CSP.
- Der Browser-Assistent wurde unter Windows und Ubuntu 24.04 mit Node 24
  geprüft. Die unveränderte native Linux-/Backend-Laufzeit war zusätzlich unter
  Ubuntu 26.04 mit Node 22 geprüft. Echte VPS-Last und Skyrim-/CEF-Spielverbindung
  bleiben ausstehend; das Spiel wurde nicht gestartet.

Dateiprüfsummen stehen in `SHA256SUMS`; Einzelberichte und `VALIDIERUNG.json`
liegen neben den neuen Archiven. Die Ersteinrichtung benötigt keinen
vorgefertigten Admin-Zugang und enthält keine Spiel-Masterdateien. Die
Laufzeitherkunft und der neue Quell-Snapshot sind im Paketmanifest getrennt
angegeben. Dokumentationsabschluss und Prüfberichte entstehen nach dem
eingefrorenen Quell-Snapshot.

### Nativer Serverkern und vorherige Abnahme

- Linux: nativer Release-Build erfolgreich. `scam_native.node` ist ein echtes
  ELF-x86_64-Modul. `ldd` findet unter Ubuntu 26.04 alle benötigten Bibliotheken;
  Node lädt die Erweiterung über N-API und exportiert `ScampServer`.
- Linux: vollständige native Unit-Suite mit **264 Testfällen und 476.480
  Assertions bestanden**, letzter Lauf 15,81 Sekunden.
- Ubuntu 26.04: echter Serverstart mit fünf vollständigen Skyrim-Masterdateien,
  `/admin`, produktives `/build.js`, realer Admin-Login und authentifizierte
  Sitzung sowie gebundener nativer UDP-Spielport erfolgreich geprüft.
- Linux-Paketprüfung am 20. Oktober: alle 90 Paketdateien per SHA256 geprüft;
  gelieferte Startprüfung, unveränderte Testkonfiguration mit fünf Masterdateien,
  korrektes/falsches Admin-Passwort, Sitzung, Frontend und UDP ohne Internetzugriff
  erfolgreich geprüft. Das fertige Archiv wurde separat entpackt und vollständig
  gegen sein Paketmanifest sowie das Quellarchiv abgeglichen.
- Windows: nativer Release-Build, TypeScript-Build und Offline-Heartbeat-Regression
  bestanden. Das echte Paket besteht Startprüfung, Serverstart mit fünf Masterdateien,
  Frontend, UDP und Admin-Authentifizierung einschließlich falschem Passwort.
  Die vollständige native Unit-Suite erreicht unter Windows auf NTFS **263 von
  264 bestandenen Testfällen** (477.544 von 477.545 Assertions). Offen bleibt
  `Activate torch`, `unit/PartOne_ActivateTest.cpp:587`, mit der Prüfung
  `ref.IsHarvested()` innerhalb eines 25-ms-Reloot-Fensters. Der isolierte Lauf
  schlägt ebenfalls fehl. Testzeiten und Assertions wurden nicht verändert.
  Der Prüfbericht meldet deshalb `installationAndStartupPassed: true`, aber
  `nativeFullSuitePassed: false`; eine vollständig grüne native Abnahme wird
  nicht behauptet. Zuvor unter exFAT beobachtete SaveStorage-Fehler treten im
  vollständigen NTFS-Lauf nicht mehr auf.
- Plattformvergleich: **Backend-Bundle samt Source Map und alle 73
  Frontend-Dateien sind per SHA256 identisch**. Der Gamemode und die eigene
  PEX-Datei kommen für beide Pakete aus denselben Quelldateien.
- Offline-Modus: Startup installiert keine Master-Heartbeat-Signalhandler und
  sendet keinen Initial-Heartbeat mehr. Regression prüft auch Updates und den
  unveränderten Online-Heartbeat einschließlich Shutdown.
- Datenvorbereitung: `DOWNLOAD_SKYRIM_DATA=OFF` verhindert auch optionale
  Downloads. Lokale Masterdateien werden über eine temporäre Datei vollständig
  kopiert und erst anschließend an ihren Zielnamen verschoben.

Linux-Native-SHA256:
`a150eb58f08a98d4d20d3ae765db7e15877803ed097f315e33dafe0b0302551e`.
Windows-Native-SHA256:
`3453479b8db908986b46a0f6d54eaeeea7fc48380269e2f767c2f8ed33b722f3`.
Frontend-`build.js`-SHA256:
`0dadcc5c885f04f853f816d1d393028381020f3efbc48f2e3357f314d6875888`.

Die vorherige unterbrochene Linux-Testausführung nutzte langsam gemappte
Windows-Dateien. Der abschließende Test verwendet vollständige, per SHA256
abgeglichene Masterdateien auf einem nativen Docker-Volume. Ein erster
Laufzeittest forderte irrtümlich `/ui/build.js` an; die echte Serverroute ist
`/build.js`. Der korrigierte Lauf ist erfolgreich.

Lokale Protokolle und maschinenlesbare Ergebnisse:

- `build/linux-native-final-build.log`
- `build/linux-native/unit-last-test.log`
- `build/linux-native/ubuntu2604-runtime-report.json`
- `build/linux-native/platform-parity.json`
- `build/windows-native-configure.log` und `build/windows-native-build.log`
- `build/windows-native-build-serial.log`
- `build/releases/2026-10-19/linux-package-test.json`
- `build/releases/2026-10-19/linux-x64-archive-verification.json`
- `build/releases/2026-10-19/windows-package-test.json`
- `build/releases/2026-10-19/windows-x64-archive-verification.json`

Der erste parallele Windows-Neubuild überschritt den verfügbaren Commit-Speicher
des lokalen 16-GB-Rechners (`0x800705AF`). Die Fortsetzung begrenzt sowohl
MSBuild als auch MSVC auf einen Compilerprozess, ohne System- oder
Auslagerungsdatei-Einstellungen zu ändern:

```powershell
$env:_CL_ = ($env:_CL_ + ' /MP1').Trim()
cmake --build . --target skymp5-server unit --config Release --parallel 1 -- /p:CL_MPCount=1 /nr:false
```

## Docker-Bereinigung am 20. Oktober

Nach Export und erfolgreicher Linux-Paketprüfung wurden sieben abgeschlossene
SkyMP-Build-/Testcontainer, das eigene Volume `skymp-linux-native-20261019`
und die drei ausschließlich verwendeten Build-/Laufzeit-/Basis-Images entfernt.
Quellen, native Ergebnisse, Protokolle und das geprüfte Linux-Archiv liegen
weiterhin im lokalen Workspace. Ein erneuter Linux-Quellbuild benötigt einen
neuen Build-Cache.

Zusätzlich wurde ungenutzter Docker-Build-Cache bereinigt; Docker meldete
6,684 GB plus 34,62 GB. Der Build-Cache steht anschließend bei 0 B.
Die laufenden Outplay-Dienste blieben aktiv. Container, Images und persistente
Daten anderer Projekte wurden erhalten.

## Pakete und Start

Die Testpakete liegen unter `build/releases/2026-10-19/`:

- `skymp-server-test-2026-10-19-linux-x64.tar.gz`
- `skymp-server-test-2026-10-19-windows-x64.zip`
- `skymp-server-test-2026-10-19-source.tar.gz`
- `SHA256SUMS`
- `VALIDIERUNG.json` mit den abgeschlossenen nativen Unit- und Paketprüfungen

Das Quellarchiv ist der Snapshot vor der abschließenden Qualifikation.
Nachträgliche Testergebnisse und die fortgeschriebene Abnahmedokumentation
stehen separat im Workspace bzw. in `VALIDIERUNG.json`; beide Serverarchive
verweisen unverändert auf denselben gebauten Quellstand.

Jedes Serverpaket enthält `README-TEST.md`, einen eigenen Testlauncher,
`check-install.cjs`, Dateiprüfsummen und den separat erzeugten Admin-Testzugang
in `TEST-ZUGANG.txt`. Beide Pakete verwenden dieselben Testzugangsdaten und
Einstellungen. Private Build-Metadaten und bestehende Benutzer-/Weltdaten
werden nicht in den Quell-Snapshot übernommen.

Der Paketierer ist `misc/deploy/package_test_server.cjs`. Er übernimmt nur das
gebündelte Backend samt Source Map, UI-Assets, natives Modul, Gamemode,
Paketmetadaten und eigene PEX-Dateien. Alte lose TypeScript-Ausgaben,
PDB-Dateien und `node_modules` aus bestehenden Build-Verzeichnissen werden
nicht übernommen. `misc/tests/test_server_package.cjs` prüft in einem neuen
Arbeitsverzeichnis das echte Paket mit eigenen Masterdateien: SHA256, native
Startprüfung, Serverstart, Frontend, falsches/richtiges Admin-Passwort,
Sitzung und UDP. Nur Netzwerk-Bindings werden für den lokalen Test geändert.

Start und VPS-Zugriff: [Linux-VPS-Anleitung](docs_linux_vps.md). Die Testkonfiguration
verwendet Offline-Modus und 16 Spielerplätze, UDP 7777 und HTTP 8080. HTTP bindet
an Loopback; der Admin-Zugriff auf den VPS erfolgt zunächst über SSH-Tunnel.
Node.js ab Version 22 und die fünf eigenen Skyrim-Masterdateien sind erforderlich.

## Zurückgestellter Skyrim-/CEF-Test (historischer Stand vom 20. Oktober)

Die Steam-Installation auf `G:` verwendet Skyrim `1.7.104.0`. SKSE `2.3.1` und
Address Library v13 wurden zuvor aus den bereitgestellten Archiven mit Sicherung
installiert. Die vorhandenen Client-DLLs stoppten anschließend bei der
Address-Library-Initialisierung (`REL/ID.h(219)`). Der eingebundene ältere
CommonLib-Reader erkennt Versionszweig 1.7 und Datenbankformat 5 nicht korrekt.

Die experimentelle CommonLib-7.5.4-Portierung wurde nach der Änderung des
Arbeitsauftrags zurückgestellt. Ihre Änderungen sind separat unter
`build/cef-compat/deferred-client-port/` gesichert und nicht im aktiven
Quellstand. Das für die Fehlersuche vorübergehend isolierte Research-Hilfsplugin
ist wiederhergestellt. Die Serverpakete enthalten keine neuen Client-DLLs.

Das am 20. Oktober vom Benutzer bereitgestellte Terminalprotokoll bestätigt
den erfolgreichen nativen Start auf dem tatsächlichen VPS: Linux x64,
Node 22.22.1, fünf Masterdateien und geladener sicherer Admin-Auth-Store.
Das ist ein vom Benutzer gelieferter Laufzeitnachweis; ein SSH-/systemd-Test
wurde nicht von der lokalen Umgebung durchgeführt. Der öffentliche HTTP-Aufruf
auf Port 8080 wurde zunächst abgewiesen, während das Paket HTTP an Loopback bindet.
Die anschließende öffentliche HTTP-Prüfung liefert 200 und die echte SkyMP-
Anmeldeseite; der Einrichtungsstatus meldet `needsSetup: false`. Es wurden dabei
keine Zugangsdaten übertragen und keine Einstellungen auf dem VPS verändert.
Spielerlast, entfernte Spielverbindung, echter
Discord-Callback und eine funktionierende Skyrim-/CEF-Sitzung sind weiterhin offen.
