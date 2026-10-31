[Deutsch](docs_server_metrics.md) · [English](../../en/docs/docs_server_metrics.md) · [Русский](../../ru/docs/docs_server_metrics.md)

# Serverleistung im Admin-Dashboard

Stand: 26. Oktober 2026, **Serverrevision r12**. Diese Erweiterung wird in den
Voll- und Update-Paketen für Windows x64 und Linux x64 mitgeliefert.

Die Messansicht steht auch direkt auf **Dashboard** zur Verfügung, ergänzt um
die dauerhaft im Webprozess erfassten Verbindungsabbrüche der letzten sechs
Stunden. Die beobachtete Zeit wird ausdrücklich angezeigt. Siehe
[Dashboard und Neustartplan](docs_dashboard_operations.md).

<a id="deutsch"></a>

## Messansicht

Unter **Metriken → Serverleistung** stehen Live-Prozesswerte, eine Verteilung
der Game-Tick-Laufzeiten und ein Verlauf für 1, 6 oder 24 Stunden. Die bisherige
Frontend- und Client-Diagnose bleibt darunter verfügbar. Ein Admin-Konto mit
`canViewLogs` ist erforderlich; öffentliche Spieler- und Launcher-APIs erhalten
diese Messdaten nicht.

- **Prozesswerte:** CPU, gesamter Prozessspeicher (RSS), JavaScript-Heap und
  mittlere Node-Event-Loop-Verzögerung, getrennt für Game-Server und Dashboard.
  CPU 100 % entspricht einem ausgelasteten Kern; auf mehreren Kernen sind
  Werte über 100 % möglich. RSS enthält auch Speicher des nativen Serverkerns.
  Die Event-Loop-Messung verwendet `monitorEventLoopDelay` mit 20 ms Auflösung;
  ihr Mittelwert liegt auch im Leerlauf ungefähr bei dieser Auflösung.
- **Game-Ticks:** Gemessen wird ausschließlich der synchrone Aufruf von
  `server.tick()`. Die absichtliche Wartemillisekunde der äußeren Schleife ist
  ausgeschlossen. Die Balken zeigen den Anteil der **Tick-Anzahl** pro
  Laufzeitklasse, keine CPU-Zeitanteile und keine Client-FPS. Live gilt ein
  rollendes Fenster der letzten 60 Sekunden.
- **Verlauf:** Prozesswerte sind zeitgewichtete Minutenmittel; Tick-Mittel und
  Tick-Maximum stammen aus den gemessenen Aufrufen. Minuten ohne Messung bleiben
  Lücken. Über die Messgrößenauswahl sind Tick, CPU, RSS, Spieler und Event Loop
  verfügbar. Ein Klick oder die Pfeiltasten wählen einen historischen Zeitpunkt;
  Home/End springen zum ersten/letzten Messpunkt, Esc oder **Zurück zu Live**
  beenden die Auswahl. Die Werte und die Verteilung oben folgen dieser Minute.
- **Game-Prozess aktiv:** Anteil der erfassten Zeit, in der der Supervisor den
  Prozess als `running` meldete. Erfasste Minuten werden angezeigt. Dies ist
  keine öffentliche Erreichbarkeits- oder Gameplay-Garantie. Ausfallzeiten des
  Dashboards werden nicht nachträglich als Betrieb oder Ausfall geschätzt.
- **Spieler-Median und -Spitze:** Berechnet aus den vorhandenen gerundeten
  Minutenmitteln der letzten 24 Stunden. Ein kurzzeitiger Spitzenwert innerhalb
  einer Minute kann dadurch niedriger erscheinen. Gemeint sind verbundene
  Game-Verbindungen einschließlich einer noch offenen Anmeldung.

Mit dem mitgelieferten Starter sammelt der **dauerhafte Dashboard-Prozess** die
Daten. Stoppen, Starten und Absturz des Game-Prozesses erhalten die Ansicht,
Dashboard-Messungen und den bisherigen Verlauf. Aktuelle Game-Werte erscheinen
bei fehlender oder über fünf Sekunden alter Telemetrie als `—`. Nach einem
Neustart werden nur Messungen der aktuellen Game-PID angenommen. Ein direkter
Start ohne Supervisor zeigt einen gemeinsamen Prozess für Game und Web.

Es gibt keine neue Portfreigabe und keine zusätzliche Abhängigkeit.
`GET /api/admin/server-performance?minutes=1440` verwendet die bestehende
Admin-Sitzung, `canViewLogs` und `Cache-Control: no-store`. Der Browser lädt
höchstens eine Anfrage gleichzeitig und aktualisiert nach jeweils fünf Sekunden.
Die vorhandene geschützte Prometheus-Schnittstelle `/metrics` bleibt bestehen.

Der Verlauf liegt unter **`<dataDir>/.admin/server-performance.json`**, standardmäßig
`data/.admin/server-performance.json`. Er wird ungefähr einmal pro Minute und
beim geregelten Beenden atomar gespeichert. Bei Updates das gesamte eigene
`data/` einschließlich versteckter Ordner erhalten. Es bleiben höchstens 24
Stunden mit einer zusätzlichen angeschnittenen Randminute gespeichert. Ein
abrupter Prozessabbruch kann die seit dem letzten Speichern erfasste Minute
verlieren. Beschädigte Dateien werden nicht überschrieben; die Oberfläche zeigt
dann an, dass neue Werte nur im Arbeitsspeicher bleiben. Die Live-Verteilung
beginnt nach einem Dashboard-Neustart neu; gespeicherte Minuten bleiben wählbar.









<a id="local-validation"></a>

## Lokale Prüfung

Befehle aus `build/` ausführen. TypeScript-Prüfungen und Tests veröffentlichen keinen Release:

```powershell
node ../skymp5-server/node_modules/typescript/bin/tsc --project ../skymp5-server/tsconfig.json --noEmit
node ../skymp5-front/node_modules/typescript/bin/tsc --project ../skymp5-front/tsconfig.json --noEmit
node ../skymp5-server/tests/serverPerformance.integration.mjs
node ../skymp5-front/scripts/test-unit.js
node ../skymp5-front/scripts/test-locales.js
# Point this at an isolated compilation of the current dashboard source:
$env:SKYMP_DASHBOARD_TEST_BUNDLE = '<test-directory>/skymp5-admin.js'
node ../misc/tests/test_dashboard_runtime.cjs
node ../misc/tests/test_dashboard_runtime.cjs --delayed-dashboard
```

Die Lifecycle-Fixture verwendet bekannte synthetische Spielmesswerte über echte Supervisor-IPC und einen echten Dashboard-Prozess. Diese Prüfungen belegen weder Produktionsleistung noch tatsächliches Skyrim-/CEF-Verhalten oder Mehrspielerkapazität.

Das verzögerte Dashboard-Szenario prüft auch frühen Owner-Login/touch/logout bei bereits bereitem Spiel. Der Supervisor leitet diese Sitzungen sofort an beide Kindprozesse weiter; nach abgeschlossenem Dashboard-Start ist keine erneute Anmeldung nötig.

Lokale Prüfungen am 25. Oktober 2026 bestanden: TypeScript, Frontend-Units, alle sechs Sprachwörterbücher, History/IPC unter Windows (Node 24.19.0) und Ubuntu 26.04 (Node 22.22.1) sowie Dashboard-Lifecycle/Authentifizierung auf beiden Plattformen. Sichtbares Chromium prüfte Maus-/Tastaturauswahl, alle Messgrößen/Zeiträume, 360/390/768 px, gestopptes Spiel, leeren Verlauf, Rechteverlust und begrenzte automatische WCAG-A/AA-Checks. Spiel-/Verlaufswerte waren synthetisch. Isolierter Produktionsbuild bestand mit vorhandenen Größenwarnungen. r9-ZIPs blieben bei den Quelltests unverändert, r10 wird separat paketiert. Der Wegwerf-Browserserver wurde entfernt. Produktionslast und echtes Gameplay bleiben hier ungeprüft.
