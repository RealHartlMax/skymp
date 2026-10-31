[Deutsch](docs_admin_discord_oauth.md) · [English](../../en/docs/docs_admin_discord_oauth.md) · [Русский](../../ru/docs/docs_admin_discord_oauth.md)

# Admin Discord OAuth

<a id="purpose"></a>

## Zweck

Dieses Dokument beschreibt die Discord-OAuth-Anmeldung im SkyMP-Adminpanel und das geplante Produktionsmodell ohne manuelles Setzen von Tokens oder Umgebungsvariablen durch Serverbesitzer.

<a id="current-behavior"></a>

## Aktuelles Verhalten

Die Admin-Anmeldeseite bietet zwei Möglichkeiten:

- Benutzername/Passwort (bestehender Ablauf)
- Discord-OAuth-Schaltfläche (neuer Ablauf)

Der OAuth-Callback ordnet die Discord-Benutzer-ID einem Admin-Eintrag zu. Fehlt ein Admin mit derselben `discordId`, wird die Anmeldung verweigert.

<a id="data-model"></a>

## Datenmodell

Adminbenutzer werden in `server-settings.json` gespeichert über:

- `adminUiUsers` (Profilzuordnung mit Rolle und optionaler `discordId`)
- `adminUiRoles` (Rollenzuordnung)
- `adminUiMasterUser` (primärer Hauptadministrator)

Der Hauptadministrator entsteht bei der Ersteinrichtung oder Legacy-Migration und wird automatisch gespeichert.

<a id="planned-integration-model-no-manual-token-setup"></a>

## Geplante Integration ohne manuelle Tokens

Ziel: Benutzer sollen keine eigenen Umgebungsvariablen oder Secrets manuell hinzufügen müssen.

Geplante Architektur:

1. SkyMP liefert ein integriertes Admin-Authentifizierungsmodul.
2. Plattformwerkzeuge provisionieren und verwalten OAuth-Anwendungszugangsdaten zentral.
3. Nach erfolgreichem OAuth erhält der Server signierte Vertrauensdaten statt lokal verwalteter Secrets.
4. Die Adminzuordnung (`discordId` → Adminprofil) bleibt lokal, OAuth-Secrets verwaltet die Plattform.
5. Plattformdienste übernehmen Rotation, Widerruf und Ablauf automatisch.

<a id="why-this-model"></a>

## Gründe für dieses Modell

- Keine manuelle Secret-Verwaltung durch Betreiber
- Einfachere Einrichtung
- Weniger Fehlkonfigurationen
- Zentrale Rotation und Prüfprotokolle

<a id="security-requirements"></a>

## Sicherheitsanforderungen

Auch bei vollständiger Integration bleiben erforderlich:

- CSRF-State-Prüfung bei OAuth-Start/Callback
- Strikte Freigabeliste für Callback-URLs
- Kurzlebige Sitzungscookies
- Rollen-/Berechtigungsprüfung nach Anmeldung
- Anmeldung für nicht zugeordnete Discord-IDs verweigern

<a id="migration-path"></a>

## Migration

1. Benutzername/Passwort als Rückfallmöglichkeit erhalten.
2. Im oberen Adminbereich jedem Adminkonto eine Discord-ID zuweisen.
3. Integriertes Discord OAuth für die Instanz aktivieren.
4. Anmeldung zugeordneter Discord-Konten prüfen.
5. Später optional Passwortanmeldung für andere Administratoren als den Hauptadministrator deaktivieren.

<a id="notes-for-implementers"></a>

## Hinweise für Entwickler

- Discord-ID als unveränderliche Benutzerkennung behandeln.
- Angezeigter Benutzername ist Darstellungsmetadatum, keine Authentifizierungsidentität.
- Der Hauptadministrator muss sichtbar und nicht löschbar in der Adminliste bleiben.
