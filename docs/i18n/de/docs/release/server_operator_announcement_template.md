[Deutsch](server_operator_announcement_template.md) · [English](../../../en/docs/release/server_operator_announcement_template.md) · [Русский](../../../ru/docs/release/server_operator_announcement_template.md)

<a id="server-operator-announcement-template"></a>

# Vorlage für Mitteilungen an Serverbetreiber

Verwende diese Vorlage für Discord, Forenbeiträge oder GitHub-Versionshinweise für Serverbetreiber.

<a id="subject"></a>

## Betreff

`[SkyMP] Server update {{VERSION}} ({{RISK_LEVEL}})`

<a id="message"></a>

## Nachricht

Hallo Serverbetreiber,

wir haben das Serverupdate **{{VERSION}}** veröffentlicht.

<a id="1-risk-level"></a>

### 1) Risikostufe

- Stufe: **{{patch|minor|major}}**
- Grund: {{one-line reason}}

<a id="2-what-changed"></a>

### 2) Änderungen

- {{change 1}}
- {{change 2}}
- {{change 3}}

<a id="3-required-actions"></a>

### 3) Erforderliche Maßnahmen

- {{none OR explicit migration step}}
- {{config change if needed}}

<a id="4-before-updating-required"></a>

### 4) Vor dem Update (erforderlich)

- `server-settings.json` sichern
- `dataDir` sichern (`changeForms`, Admin-Zustandsdateien, Skript-/Mod-Assets)
- Datenbank/Dump sichern, sofern verwendet

<a id="5-maintenance-window"></a>

### 5) Wartungsfenster

- Beginn: {{date/time + timezone}}
- Erwartete Ausfallzeit: {{minutes}}

<a id="6-rollback-policy"></a>

### 6) Rollback-Regel

Bei Problemen zum vorherigen Serverpaket zurückkehren und Sicherungen wiederherstellen.

### 7) Links

- Release: {{release URL}}
- Änderungsprotokoll: {{changelog URL}}
- Update-Anleitung: `docs/docs_server_update_playbook.md`

Danke, dass ihr SkyMP-Server betreibt.
