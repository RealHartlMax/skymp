# SkyMP Worlds: Launcher und Online-Master

> **Neu:** Mods liegen jetzt in `data/mods/<Mod>/`; `client-resources` wird nicht mehr gelesen. Angaben dazu auf dieser Seite sind überholt. Siehe [Mods in data/mods](docs_mod_folders.md).

Vollständige Anleitung: https://docs.skymp-worlds.net/ (Deutsch, Englisch, Russisch).
Dieser Fork stellt /api/launcher/manifest und die zugehörigen Moddownloads bereit.
Client-/SKSE-Dateien werden separat über runtimeSource angeboten. Es gibt keine
Garantie für beliebige Skyrim-Versionen, Plugins oder bestehende Server.

Im Server-Adminpanel unter **Einstellungen → Launcher-Anbindung** die Master-URL,
öffentliche Server-ID, privaten Schlüssel, Spieladresse und Port eintragen.
Mod-Synchronisation, relatives Mod-Verzeichnis und Clientkatalog sind eigene Felder.
Speichern führt diese Werte mit der vorhandenen Konfiguration zusammen und legt
eine private Sicherung an; anschließend den Server neu starten. Das gleiche
Formular steht in der geschützten Browser-Ersteinrichtung zur Verfügung.
Ein leeres Schlüsselfeld behält den vorhandenen Schlüssel bei. Der Schlüssel
wird nicht an Spieler exportiert.

Technisches Zusammenführungsbeispiel für andere Implementierungen:

    {
      "publicHost": "DEIN_OEFFENTLICHER_SPIELHOST",
      "master": "https://api.skymp-worlds.net",
      "serverUid": "OEFFENTLICHE_ID_AUS_DEM_DASHBOARD",
      "masterKey": "PRIVATER_SCHLUESSEL_AUS_DEM_DASHBOARD",
      "offlineMode": false,
      "launcherResources": {
        "enabled": true,
        "directory": "./client-resources",
        "runtimeSource": "https://update.skymp-worlds.net/client-runtime/catalog.json"
      }
    }

Ein registrierter Dashboard-Eintrag mit Status active und gültigem Heartbeat ist
für die öffentliche Liste nötig. serverUid ist öffentlich; masterKey bleibt privat.
Keine neue Identität erzeugen, wenn bereits Weltdaten an der alten Identität hängen.

Der aktuelle lokale Standard-Master ist `https://api.skymp-worlds.net`.
Neu erzeugte CMake-Konfigurationen ergänzen auch die Katalog-URL, wenn sie noch
fehlt. Explizite bestehende Werte, auch eine leere `runtimeSource`, bleiben
erhalten. Das bietet einen externen Katalog an und bettet keine Client-DLLs
in den Server oder Launcher ein; die Veröffentlichung bleibt ein eigener Schritt.

Der Heartbeat geht an POST <master>/api/servers/<privateMasterKey>. Er meldet
akzeptierte Anfragen beim Start, nach Fehlerbehebung und höchstens einmal pro Minute.
Die eigentlichen Heartbeats laufen weiterhin alle 10 bis 30 Sekunden (Standard 15).
Ein 404 mit "Server is not registered yet" aus der alten Registry verlangt ein Update
des API-Webroots: api/servers/index.php muss an den Dashboard-Master weiterreichen.
Dafür API- und Manage-Webpaket gemeinsam aktualisieren, echte config.php und Daten behalten.
Der Serverpatch allein kann eine veraltete Webroute nicht reparieren.

Die bereitgestellte runtimeSource muss einen vollständigen Versionskatalog liefern.
Die Launcher-EXE enthält keine SkyMP-/SKSE-DLLs. Sie wählt die passende Freigabe anhand
der Dateiversion von SkyrimSE.exe, prüft alle Dateien und aktualisiert sie vor dem Start.
Richtige Zielpfade sind Data/Platform/Plugins, Data/SKSE/Plugins und der Spielhauptordner.
Platform/Plugins ohne Data ist für dieses Paket kein Zielpfad.
Verbindungseinstellungen und gespeicherte Anmeldungen gehören nicht in ein Clientpaket.

Eigene Mods unter client-resources/Data/ vorbereiten; Bethesda-/DLC-Dateien bleiben
lokale Voraussetzungen. Modmanifest und Clientkatalog haben getrennte Verträge.
Eine manuelle Clientquelle im erweiterten Launcher-Profil hat Vorrang. Für automatische
Serverupdates diese manuelle Auswahl entfernen.

Build und isolierter Heartbeat-Test aus dem Build-Verzeichnis des Server-Repositories:

    npm --prefix ../skymp5-server run build-ts
    node ../skymp5-server/tests/masterClient.integration.mjs

Der Test startet nur einen lokalen HTTP-Empfänger, keinen nativen Spielserver.
Ein erfolgreicher Build und Downloadtest ersetzen keinen vollständigen Spieltest.

Abgleich vom 22. Oktober 2026: TypeScript und der isolierte Test bestehen lokal.
Die damit erzeugten Pakete und eine tatsächliche Veröffentlichung sind getrennte
Schritte; aktueller Gesamtstand: [Projektstatus](docs_project_status.md).
