[Deutsch](docs_plugin_ui_troubleshooting.md) · [English](../../en/docs/docs_plugin_ui_troubleshooting.md) · [Русский](../../ru/docs/docs_plugin_ui_troubleshooting.md)

# Chat und YACA geladen, aber im Spiel unsichtbar

Quell-/Paketabgleich vom **27. Oktober 2026**. Im gemeldeten Linux-Serverlog
werden `skymp-chat` und `skymp-yaca-ts` erfolgreich geladen. Die fehlende Anzeige
hat im untersuchten Client zwei konkrete Ursachen; ein weiterer Linux-Serverbuild
oder eine Änderung der Plugin-Loader ist dafür nicht nötig.

## Nachgewiesener Unterschied

Der öffentliche Server-Manifest-Endpunkt bietet
`https://update.skymp-worlds.net/client-runtime/catalog.json` als `runtimeSource`
an. Dieser Katalog verwies beim Abgleich noch auf
`1.7.104.0/client-2026-10-25-tintfix/runtime-manifest.json`.
Die dort angegebenen Hashes stimmen exakt mit den installierten Spieldateien
überein:

| Datei | Installierter / angebotener alter SHA-256 | Neuer Chat-Runtime SHA-256 |
| --- | --- | --- |
| `Data/Platform/Plugins/skymp5-client.js` | `3498934c92a308a6c9736eaff3c1d16449eefb5ab35fb1ff649b0a69034e9256` | `78151b2583739e0e26f4ee8b1c0960e4da1a333fdc276445454d391bfd867f71` |
| `Data/Platform/UI/build.js` | `229a40896f8f3805a1dc46c9819c839d10a7a6115c25f5649558641f9026d628` | `000df4a213f26b6d678bddd683f71f578081ec7f81c1f52491e41f5dbb750918` |

1. **Chat:** Im alten Client und Frontend fehlen `skympChat:send` und
   `skympChat:packet` vollständig. Ein geladenes Server-Plugin kann diesen
   fehlenden Clienttransport und die Oberfläche nicht installieren.
2. **YACA:** Die aus dem installierten Client extrahierte `SettingsService`
   erzeugt ohne konfigurierte Schlüssel `publicKeys: {}`. Die Signaturprüfung
   behandelt diese leere Map als konfigurierten Schlüsselspeicher. Der tatsächliche
   YACA-EventSource-Code wird damit mit `no signature found` verworfen.
   Mit der bereits korrigierten aktuellen `SettingsService` wird derselbe Code
   angenommen. Wenn echte Schlüssel konfiguriert sind, bleiben gültige Signaturen
   weiterhin erforderlich.

Die 73 nativen Dateien des neuen Runtime-Pakets stimmen mit der untersuchten
Skyrim-Installation überein. Der Fehler erfordert hier keinen neuen
SKSE-/SkyrimPlatform-DLL-Build. Ein Server-Full-/Update-ZIP aktualisiert die
installierten Clientdateien nicht.

## Korrigiertes Runtime-Paket verwenden

Das Paket wird im Server-Fork gebaut; das Launcher-Repository enthält den
Web-/Auslieferungsworkflow. Für diesen Fall wurde eine geprüfte Kopie vorbereitet:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

Für einen **lokalen Test ohne Veröffentlichung** im Launcher beim Server unter
**Verbindungsoptionen → SkyMP-Clientpaket** diesen vollständigen Runtime-Ordner
eintragen und den Server speichern:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat
```

Skyrim schließen und danach regulär über den Launcher verbinden. Die manuelle
Quelle hat Vorrang vor der noch alten Serverquelle; Authentifizierung und
Vorbereitung bleiben im normalen Launcher-Ablauf.

Für **alle Spieler** zuerst den neuen Versionsordner nach
`update.skymp-worlds.net/client-runtime/1.7.104.0/` hochladen, danach erst
`client-runtime/catalog.json` ersetzen. Bestehende Versionsordner und andere
Katalogeinträge erhalten. Sobald der Live-Katalog den neuen Stand anbietet,
eine vorübergehende lokale Auswahl wieder entfernen. Eine neue Launcher-EXE
und Änderungen am Linux-Gameserver sind dafür nicht erforderlich.

## Nur die lokale Oberfläche prüfen oder installieren

Der Helfer [install_client_ui.ps1](../../../../misc/deploy/install_client_ui.ps1) vergleicht
die installierten JS-/UI-Dateien mit einem vorhandenen Runtime-Manifest. Ohne
`-Apply` schreibt er keine Dateien. Mit `-Apply` sichert er die zu ersetzenden
Dateien vorab. Native Dateien und private Client-Einstellungen bleiben erhalten;
eine falsche Spielversion, laufendes Skyrim, Links, Pfadtraversierung und
abweichende Quelldateihashes werden abgewiesen.

```powershell
pwsh -File misc/deploy/install_client_ui.ps1 `
  -GameDirectory 'G:/SteamLibrary/steamapps/common/Skyrim Special Edition' `
  -RuntimeDirectory 'build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat'
```

Bei weiterhin altem Live-Katalog ersetzt der nächste automatische Launcher-Lauf
manuell kopierte Dateien wieder durch den alten Stand. Für den Test deshalb
die oben beschriebene Launcher-Quelle wählen oder den neuen Katalog veröffentlichen.

## Prüfgrenzen und Gamemode-Meldung

Die Meldung `skipping gamemode data update send, clientside hot-reload is disabled`
betrifft Änderungen an Skripten für bereits verbundene Spieler. Der native Server
speichert den Stand und sendet ihn beim Verbinden. Sie erklärt die hier belegten
alten Clientdateien nicht und erfordert kein Aktivieren von Hot-Reload.

Die Diagnose liegt lokal unter `build/reports/plugin-ui-2026-10-27/`: Live-Katalog,
extrahierte tatsächlich installierte Servicequellen und Reproduktion mit dem
echten YACA-EventSource-Code. Browser-/Fixturetests ersetzen keine echte
Skyrim-/CEF- oder TeamSpeak-Audioabnahme.

Weiterführend: [Chat-Integration und Runtime-Auslieferung](docs_chat_integration.md).
