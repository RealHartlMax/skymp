# Moddateien fuer den Launcher

Zusaetzliche benoetigte Clientdateien unter `Data/` mit ihrer fertigen
Skyrim-Verzeichnisstruktur ablegen, z.B. `Data/textures/Community/sword.dds`,
`Data/meshes/Community/sword.nif` oder `Data/Scripts/ClientScript.pex`.

Eigene Plugins in `data/` ablegen und in `server-settings.json` unter
`loadOrder` eintragen. Der Server bietet diese Plugins und ihre zugehoerigen
BSA-Archive automatisch an. Nach einer Aenderung der Pluginliste neu starten.

Der Launcher fragt `GET /api/launcher/manifest` am HTTP-Port ab. Er prueft
Dateigroesse und SHA-256, installiert fehlende Dateien und startet SKSE erst
nach erfolgreicher Vorbereitung. Spieler brauchen keinen Nexus-/Vortex-Zugang.
Die passende eigene Skyrim-Installation bleibt Voraussetzung. SKSE kann der
aktuelle Launcher aus einem vollstaendigen versionierten Clientpaket beziehen;
bei aelteren Paketen muss es passend vorinstalliert sein.

Hier nur das fertig ausgewaehlte Modpaket veroeffentlichen, keine ZIP-/7z-
Archive, Bethesda-Spieldateien, Admin-Zugaenge oder Serverkonfiguration.
Native Client-DLLs und JavaScript gehoeren ins separate Clientpaket; dessen
Manifest-URL kann `launcherResources.runtimeSource` in `server-settings.json`
vorgeben. Vollstaendige Anleitung: `docs/docs_launcher_modpacks.md` im Quellarchiv.
