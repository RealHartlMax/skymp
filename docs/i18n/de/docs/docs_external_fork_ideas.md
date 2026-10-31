[Deutsch](docs_external_fork_ideas.md) · [English](../../en/docs/docs_external_fork_ideas.md) · [Русский](../../ru/docs/docs_external_fork_ideas.md)

<a id="external-fork-ideas"></a>

# Ideen aus externen Forks

> Planungs-/Rechercheunterlage, geprüft am 22. Oktober 2026. Vorschläge und Beispiele externer Forks sind nicht automatisch in diesem Checkout implementiert. Bestätigte Fertigstellung steht im [aktuellen Projektstatus](docs_project_status.md) und der Haupt-Roadmap.

Diese Unterlage sammelt interessante Ideen, Funktionen und Verbesserungen aus öffentlichen skymp-Forks als Anregung für spätere Entwicklung und mögliche Cherry-Picks.

**Letzte Prüfung:** 2026-05-03  
**Methode:** Alle Forks mit `skyrim-multiplayer/skymp:main` über `git ls-remote` und `git log --oneline --left-right` verglichen; 118 geprüft, etwa 25 mit zusätzlichen Commits gegenüber Upstream.

---

<a id="top-cherry-pick-candidates"></a>

## Beste Kandidaten zur Übernahme

<a id="1-halfin-gamesskymp-skyv--ed25519-join-ticket-verification"></a>

### 1. HALFIN-Games/skymp-SkyV — Ed25519-Beitrittstickets prüfen

**Commit:** `e42b0ddc`  
**Titel:** `Server: verify website join ticket (Ed25519)`  
**Risiko:** Mittel, wahrscheinlich Konflikte mit dem aktuellen `login.ts`.

**Funktion:**  
Kryptografische Prüfung von Web-Beitrittstickets. `JoinTicketVerifier` validiert Ed25519-signierte JWTs über `jose`: Standardclaims `iss`, `aud`, `exp`, `iat`, `sub`, `jti` sowie eigene Claims wie `whitelisted`, `queue_points`, `reserved_ok`, `slots`. Konfiguration über Umgebungsvariablen.

**Geänderte Dateien (5, +217/-3):**
- `skymp5-server/ts/systems/login.ts` – Integration
- `skymp5-server/ts/utils/joinTicket.ts` *(neu)* – Klasse `JoinTicketVerifier`
- `skymp5-server/ts/dev/verifyJoinTicket.ts` *(neu)* – CLI-Werkzeug für manuelle Ticketprüfungen
- `skymp5-server/join_ticket_ed25519_public.pem` *(neu)* – öffentlicher Beispielschlüssel
- `skymp5-server/package.json` – Abhängigkeit `jose`

**Wichtige Umgebungsvariablen:**
```
JOIN_TICKET_ED25519_PUBLIC_KEY_PEM
JOIN_TICKET_ISSUER
JOIN_TICKET_AUDIENCE
```

**Weitere interessante Commits:**
| Commit | Thema |
|--------|-------|
| `c8674675` | Mehrcharakter-Slots |
| `59e65269` | Folgeänderungen an Charakter-Slots |
| `9c4e6f95` | Sprachchat-Adapter |
| `b0a5dd30` | Sprachchat-Verbesserungen |
| verschiedene | Betriebsdokumentation: VPS, EC2, Testerpaket |

---

<a id="2-aw-cskymp--generic-napi-serialization-archive"></a>

### 2. aw-c/skymp — Generisches NAPI-Serialisierungsarchiv

**Commit:** `6361d003`  
**Titel:** `init new serialize`  
**Risiko:** Hoch, umfangreiches Inventar-Refactoring, C++20 erforderlich.

**Funktion:**  
Klasse `NapiOutputArchive` als typsicherer Template-Serializer, der C++-Strukturen unmittelbar in NAPI-/Node.js-Objekte wandelt, ohne jedes `napi_value`-Feld manuell aufzubauen. C++20-Concepts verteilen nach Typ:

```cpp
template<class T> concept IntegralConstant = ...;
template<class T> concept StringLike       = ...;
template<class T> concept Arithmetic       = ...;
template<class T> concept ContainerLike    = ...;
template<class T> concept NoneOfTheAbove   = ...;
```

`Inventory` dient als Machbarkeitsnachweis: Eine generische Methode `template<class Archive> void Serialize(Archive&)` ersetzt doppelte JSON-/NAPI-Konvertierung.

**Geänderte Dateien (4, +364/-193):**
- `serialization/include/archives/NapiOutputArchive.h` *(neu)*
- `serialization/CMakeLists.txt`
- `skymp5-server/cpp/server_guest_lib/Inventory.cpp`
- `skymp5-server/cpp/server_guest_lib/Inventory.h`

> **Hinweis:** `houndlord/skymp` hat ein sehr ähnliches Serialisierungsmuster sowie weitere Änderungen an `ScampServer.cpp` und `index.ts`; beide sollten verglichen werden.

---

<a id="3-q1000treadzskymp--client-actorvalues-helper"></a>

### 3. q1000treadz/skymp — Clienthilfe für ActorValues

**Commit:** `4601e331`  
**Titel:** `feat(skymp5-client): send changed health percentage after animation`  
**Risiko:** Niedrig; kleine Änderung, aber manuelle Portierung auf die aktuelle Clientstruktur nötig.

**Funktion:**  
Lagert das Auslesen von Actor-Werten in `getActorValues()` aus. Die Funktion liest Gesundheits-, Ausdauer- und Magickaverhältnisse und gibt für tote Actors korrekt Gesundheit `0` zurück.

**Geänderte Dateien (2, +16/-10):**
- `skymp5-client/src/front/components/actorvalues.ts` *(neue Hilfsfunktion)*
- `skymp5-client/src/front/skympClient.ts`

> **⚠ Portierung nötig:** Die alte Struktur `src/front/` existiert nicht mehr. Ziele der manuellen Portierung:  
> - `skymp5-client/src/sync/actorvalues.ts`  
> - `skymp5-client/src/services/services/skympClient.ts`

---

<a id="other-notable-forks"></a>

## Weitere interessante Forks

### piotroszko/skyworld
**Vorsprung:** etwa 105 Commits, 1955 geänderte Dateien  
**Art:** Eigenständige Produktlinie/großer Fork

Großer Umbau mit eigener Hierarchie (`projects/*`), eigenen Eigenschaftsbindings, VoIP und erweitertem Treffer-/Schadenssystem mit Dokumentation. Kaum unmittelbar übernehmbar, aber architektonisch interessant, besonders VoIP und Schaden.

---

### F02K/skymp
**Vorsprung:** etwa 88 Commits, 159 geänderte Dateien  
**Art:** Gamemode und Werkzeuge

Enthält einen Gamemode im Frostfall-Stil und einen Buildassistenten. Interessant für Überlebensmechaniken und bessere Entwicklungswerkzeuge.

---

### reveriadive/skymp
**Vorsprung:** etwa 35 Commits, 77 geänderte Dateien  
**Art:** Clientseitige Spielkorrekturen

Korrekturen für Inventar, Teleport- und Bewegungsprüfung auf dem Client. Bei Anti-Cheat oder korrekter Clientsynchronisierung näher prüfen.

---

### peterkmg/skymp
**Vorsprung:** etwa 37 Commits, 123 geänderte Dateien  
**Art:** Skyrim VR/CommonLibVR-Buildunterstützung

Ergänzt CMake-/Buildkonfiguration für CommonLibVR (Skyrim VR). Nur bei geplantem VR-Ziel relevant.

---

<a id="how-to-reproduce-the-scan"></a>

## Prüfung reproduzieren

```bash
# List all forks via GitHub API (replace TOKEN)
curl -s -H "Authorization: token TOKEN" \
  "https://api.github.com/repos/skyrim-multiplayer/skymp/forks?per_page=100" \
  | jq '.[].full_name'

# Add a fork as a remote and compare
git remote add halfin https://github.com/HALFIN-Games/skymp-SkyV
git fetch halfin

# Commits in fork not in upstream
git log --oneline upstream/main..halfin/main

# Ahead/behind count
git rev-list --left-right --count upstream/main...halfin/main
```

---

*Ausgeschlossen: `RealHartlMax/skymp`, der eigene Fork des Maintainers.*
