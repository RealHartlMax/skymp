[Deutsch](docs_maintainer_rules.md) · [English](../../en/docs/docs_maintainer_rules.md) · [Русский](../../ru/docs/docs_maintainer_rules.md)

<a id="maintainer-rules"></a>

# Regeln für Maintainer

Maintainer setzen die Regeln dieses Dokuments durch. Wer lediglich einen Beitrag leisten möchte, muss diese Abläufe nicht unbedingt kennen.

<a id="messaging-protocol"></a>

## Nachrichtenprotokoll

Ändert ein PR das Nachrichtenprotokoll, muss der Autor `kMessagingProtocolVersion` in `skymp5-server/cpp/mp_common/Config.h` aktualisieren und die inkompatible Änderung im PR-Titel kennzeichnen.

<a id="tree"></a>

## Quellbaum

Merge-Commits werden im Quellbaum wie bei [microsoft/vcpkg](https://github.com/microsoft/vcpkg) vermieden.

<a id="commit-names"></a>

## Commit-Titel

Commit-Titel folgen der [Conventional-Commits-Spezifikation](https://www.conventionalcommits.org/en/v1.0.0/).

Verwendete Commit-Typen nach Priorität:

- release – neue Versionen von SP und anderen Projekten veröffentlichen.
- feat – API-/Funktionsänderungen, kompatibel oder inkompatibel.
- fix – Fehler-/Absturzbehebung.
- tests – Teständerungen.
- perf – Leistungsverbesserungen.
- docs – Textdateiänderungen.
- refact – bessere Lesbarkeit oder Umsetzung in anderer Sprache/anderem Stil.
- internal – Buildsystem, Verzeichnisstruktur oder anderes, das nicht auf Benutzerrechnern ausgeführt wird.

Repository-Unterordner benennen den Commit-Scope. Commits ohne Scope sind erlaubt.

Liegen beispielsweise alle Änderungen in `skymp5-server`, verwende `skymp5-server` als Scope.

Die Typen `docs` und `tests` erhalten keinen Scope.

Alle Typen außer `fix` beginnen mit Verben wie add oder make.

Beispiele:

```
feat(skymp5-server): add feature to choose default spawn points
internal: make server's node addon buildable via top-level CMakeLists
fix: server startup
release(skyrim-platform): version 2.1
```

Der Footer `BREAKING CHANGE` wird nicht verwendet, nur das Zeichen `!`.

<a id="github-workflow-diagnostics"></a>

## GitHub-Workflow-Diagnosen

Editorseitige YAML-/Actions-Validatoren prüfen häufig `.github/workflows`. Ähnlich aussehende Warnungen können unterschiedlich wichtig sein.

<a id="actionable-warnings-must-fix"></a>

### Handlungsrelevante Warnungen (beheben)

Dies sind gewöhnlich tatsächliche Fehler in der Kontextverdrahtung:

- Fehlende Schritt-ID für eine verwendete Ausgabe, etwa `steps.buildx.outputs.name` ohne `id: buildx`.
- `${{ env.VAR }}` in Ausdrücken, obwohl ein vorheriger Schritt den Wert dynamisch erzeugt und über `$GITHUB_OUTPUT` bereitstellen sollte.
- `${{ env.* }}` in einem Schritt, in dem der Wert nie exportiert wurde.

Empfohlenes Muster:

1. Dynamische Werte in einem Schritt mit `id:` erzeugen und nach `$GITHUB_OUTPUT` schreiben.
2. In Ausdrücken über `${{ steps.<id>.outputs.<name> }}` verwenden.
3. In Shellskripten nach Export über `$GITHUB_ENV` Shellvariablen (`$VAR`) bevorzugen.

<a id="non-actionable-warnings-usually-safe"></a>

### Nicht handlungsrelevante Warnungen (gewöhnlich unbedenklich)

Warnungen wie `Context access might be invalid: SOME_SECRET_NAME` bei `secrets.*` bedeuten oft nur, dass der lokale Validator Repository-/Organisations-Secretnamen nicht prüfen kann.

Sind die Namen beabsichtigt und in GitHub eingerichtet, können diese Warnungen ignoriert werden.

<a id="maintainer-checklist-for-workflow-warning-triage"></a>

### Prüfliste für Workflow-Warnungen

1. Zuerst Ausgabe-/ID-/Umgebungsverdrahtung korrigieren.
2. Diagnosen für `.github/workflows` erneut ausführen.
3. Bleiben nur unbekannte `secrets.*`-Namen, als Information behandeln.
4. Im Zweifel Secretnamen in Repository-/Organisationseinstellungen prüfen, bevor Workflow-Code geändert wird.
