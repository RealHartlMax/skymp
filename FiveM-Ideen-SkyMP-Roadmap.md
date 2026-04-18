# FiveM-Ideen → SkyMP-Roadmap

Diese Roadmap enthält 5 konkrete, umsetzbare Tasks, die von den besten Architekturideen aus FiveM inspiriert sind und auf SkyMP angewendet werden können. Jeder Task enthält eine kurze Beschreibung, geschätzten Aufwand, Risiko und betroffene Dateien/Module.

---

## 1. Ressourcen-Diagnose & Validierungssystem
**Beschreibung:**
Implementiere ein System, das alle Ressourcen (Assets, Scripts, Mods) beim Serverstart und auf Anfrage validiert (Existenz, Integrität, Kompatibilität). Fehlerhafte oder fehlende Ressourcen werden klar gemeldet.
- **Aufwand:** Mittel
- **Risiko:** Gering
- **Betroffene Dateien:** skymp5-server, manifestGen.ts, Admin-Dashboard, dataDir-Handling

## 2. State-Bag-ähnliches Key-Value-Sync-System
**Beschreibung:**
Führe ein leichtgewichtiges Key-Value-Sync-System für Entities/Spieler ein (ähnlich FiveM State Bags), um flexible, effiziente Synchronisation von Custom-States zu ermöglichen.
- **Aufwand:** Hoch
- **Risiko:** Mittel
- **Betroffene Dateien:** skymp5-server, skymp5-client, Netzwerkprotokoll, Entity-Modelle

## 3. Ressourcen-Manifest & Abhängigkeitsauflösung
**Beschreibung:**
Erweitere das Ressourcen-Manifest um explizite Abhängigkeiten, Versionen und optionale Integritätsprüfungen. Ressourcen werden nur geladen, wenn alle Abhängigkeiten erfüllt sind.
- **Aufwand:** Mittel
- **Risiko:** Mittel
- **Betroffene Dateien:** manifestGen.ts, dataDir, Admin-Dashboard

## 4. Ressourcen-Auto-Download & Caching für Clients
**Beschreibung:**
Implementiere ein System, das Clients beim Verbinden automatisch fehlende Ressourcen (Assets, Scripts, Mods) vom Server herunterladen und lokal cachen lässt.
- **Aufwand:** Hoch
- **Risiko:** Hoch (Security, Bandbreite, Kompatibilität)
- **Betroffene Dateien:** skymp5-client, skymp5-server, Netzwerkprotokoll, dataDir

## 5. Entity-Relevanz & Ownership-Optimierung
**Beschreibung:**
Überarbeite das Entity-Relevanzsystem (welche Entities werden an welchen Client synchronisiert) und Ownership-Logik, um Bandbreite und Serverlast zu reduzieren (z.B. Zonen, Distanz, explizite Ownership-Migration).
- **Aufwand:** Hoch
- **Risiko:** Hoch
- **Betroffene Dateien:** skymp5-server, skymp5-client, Netzwerkprotokoll, Entity-Modelle

---

**Hinweis:**
Diese Roadmap ist als Inspirationsquelle und Planungsgrundlage gedacht. Die Reihenfolge ist nach Impact und Umsetzbarkeit priorisiert. Für jeden Task empfiehlt sich ein eigenes Design-Dokument und ggf. ein Prototyp vor der vollständigen Implementierung.
