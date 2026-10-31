# Chat im lokalen Fork

Der React-Chat ist mit dem optionalen Server-Plugin **SkyMP Chat** verbunden.
Seit dem Plugin Runtime Loader gehören neue Chat-Client-/CEF-Module und ihre
signierten Runtime-Pakete zum separaten Chat-Repository. Dieser Fork enthält den
generischen Bootstrap und die eingefrorene Kompatibilitätsbrücke für alte Server
ohne `pluginRuntime`-Ankündigung. Die nachfolgend beschriebenen Nachrichtenwege
bleiben getrennt von nativen Konsolenbefehlen. Build, Tests und Auslieferung:
[Integration](../../docs/docs_chat_integration.md) und
[Plugin-Runtimes](../../docs/docs_plugin_runtime.md).

## Echter Transport

CEF ruft `window.skyrimPlatform.sendMessage('skympChat:send', {text, requestId})`
auf. `chatBridge.ts` validiert die UI-Daten und verwendet den vorhandenen
zuverlässigen `MsgType.CustomPacket`-Weg. Der Server leitet die Spieleridentität
aus dem nativen Verbindungs-/Actor-Kontext ab; keine Client-Rollen oder IDs.

Serverantworten tragen `customPacketType: 'skympChat:…'`. Der vorhandene Client
übergibt sie mit `browser.executeJavaScript` als serialisierte Daten an das
DOM-Event `skympChat:packet`; `features/chat/bridge.js` aktualisiert ausschließlich
den vorhandenen Redux-Chat-State. `window.mp`/`window.skymp` und das früher
dokumentierte `cef::chat:send` sind nicht dieser verifizierte Netzwerkweg.

| Paket | Wirkung |
| --- | --- |
| `skympChat:ready` | API v1, Server-Epoch, Eingabelimit und optionale Anzeige-/Routing-/Command-only-Einstellungen übernehmen |
| `skympChat:message` | Nachricht als Text in den auf 100 Einträge begrenzten Redux-Puffer aufnehmen; IDs deduplizieren |
| `skympChat:ack` | Passende Anfrage bestätigen; Entwurf nur bei Annahme leeren |
| `skympChat:open` / `close` | Eingabemodus und Input-Fokus gemeinsam schalten |
| `skympChat:releaseOpenKey` | Die öffnende Enter-Taste erst nach Loslassen zum Senden zulassen |
| `skympChat:status` / `unavailable` | Verbindungs-/Pluginzustand fehlertolerant anzeigen |

Ein einmaliger Handshake sowie eine ID je geladenem Frontend verhindern Polling
und doppelte Fokusänderungen durch verspätete Bereitschaftssignale. Nachrichten
werden nicht lokal als vermeintlich gesendet eingefügt. HTML, Scripts und alte
Farbmarkierungen sind Text; Legacy-Spans liefern nur Text ohne frei gesetztes CSS.

## Vorhandene Redux-Actions und Widgets

`ADD_CHAT_MSG`, `UPDATE_CHAT_LIST`, `UPDATE_CHAT_SHOW`, `UPDATE_CHAT_INPUT` und
`UPDATE_CHAT_SHOWINPUT` bleiben unterstützt. Bei `showInput: 'true'` wird das
Input dauerhaft dargestellt; sonst steuert der native Eingabemodus die Anzeige.
`isInputHidden: true` eines ausdrücklich gesetzten Chat-Widgets kann sie verbergen.
Ein Chat-Widget verwendet dieselbe Redux-Liste und ersetzt den Standard-Renderplatz.

Bei aktivem SkyMP Chat verwendet auch ein altes Widget dessen tatsächlichen
Transport. Nur bei fehlender Plugin-Bereitschaft kann ein ausdrücklich gesetzter
Legacy-`send`-Callback weiter verwendet werden. Es gibt keinen zweiten Chat-Store
und keine Abhängigkeit von `window.chatMessages` oder Dev-/Login-Flags.

## HUD-Sichtbarkeit und Serverkonfiguration

Enter zeigt das HUD mit Eingabe. Nach Beenden der Eingabe wird es gemäß
`hideAfterSeconds` (Default 15) ausgeblendet. Bei `showOnMessage: true` zeigen
neue Nachrichten das HUD ohne Eingabefokus an und erneuern die Frist. Bei `false`
bleiben sie verborgen im bestehenden Verlauf, bis Enter/F6 geöffnet wird.

Ein bereinigter React-Timer verwendet die Ablaufzeit im vorhandenen Redux-Store.
Doppelte Nachrichten-IDs und Schließereignisse verlängern die Zeit nicht. Erneutes
Öffnen verwirft eine alte Frist; ein alter Timer darf das offene Input nicht
ausblenden. Disconnect setzt Anzeigeoptionen, Verlauf und Entwurf zurück.

`commandsOnly` wird serverseitig erzwungen. Die Oberfläche zeigt einen Command-
Eingabehinweis und nimmt keine normalen Spieler-/Systemnachrichten in den Store
auf. Private Command-/Fehlerantworten bleiben verfügbar. Beitrittsmeldungen
werden ausschließlich vom Server mit `showJoinMessages` erzeugt.

Die Konfiguration gehört zum Server-Plugin, keine zweite Client-Konfigurationsdatei.
Details: [Anzeige und Serverregeln](../../docs/docs_chat_integration.md).

## Tasten

Enter öffnet den sichtbaren Chat und sendet im Input. Escape erhält den Entwurf
und gibt Gameplay-Fokus frei. F6 bleibt Browser-Fokusumschalter, F2 bleibt CEF-
Sichtbarkeit. Die zentrale Registrierung liegt im vorhandenen BrowserService;
kein zweites Hotkey-System. Reguläre Skyrim-Menüs sperren die Chatöffnung.

Automatisierte Client-/Browserprüfungen ersetzen keinen Test der tatsächlichen
nativen Tastaturunterdrückung und CEF-Fokusübergabe in Skyrim.

## Sprache

Seit 1.2 überträgt der Server `localization: {locale, ui}` mit den geprüften
Texten seiner konfigurierten JSON-Sprachdatei. Der bestehende Chat-Reducer nimmt
nur bekannte, begrenzte Textfelder an. React verwendet sie ausschließlich für
den Chat; die globale i18n-Sprache anderer Komponenten bleibt unverändert.
Serverwechsel/Disconnect verwirft alte Übersetzungen. Ältere Server ohne
Metadaten verwenden die vorhandenen Client-Fallbacktexte.
