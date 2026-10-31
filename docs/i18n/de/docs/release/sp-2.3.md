[Deutsch](sp-2.3.md) · [English](../../../en/docs/release/sp-2.3.md) · [Русский](../../../ru/docs/release/sp-2.3.md)

<a id="sp-23-release-notes"></a>

# SP 2.3 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.2.

SP wird regelmäßig aktualisiert. Dieses Update enthält möglicherweise nicht ALLE erforderlichen Korrekturen.
Es gibt weiterhin vieles zu implementieren oder zu korrigieren. Siehe [Issues](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Beachte: Diese SP-Version funktioniert nur mit dem alten SE-Build vor dem Update vom 11.11.21.
Verwende [diesen Patch](https://www.nexusmods.com/skyrimspecialedition/mods/57618), um deine Skyrim-SE-Installation zurückzustufen.

<a id="add-hookremove-method"></a>

## Methode `hook.remove`

Speichere die ID beim Hinzufügen des Hooks, um ihn später entfernen zu können:

```typescript
const id = hooks.sendAnimationEvent.add({...});
//later...
hooks.sendAnimationEvent.remove(id);
```

So lassen sich Hooks anhand [neuer Ereignisse](https://github.com/skyrim-multiplayer/skymp/blob/main/docs/skyrim_platform/new_events.md) dynamisch hinzufügen und entfernen.

Beispielsweise könntest du Spieleranimationen während eines Zaubers abfangen:

```typescript
let id;

export let main = () => {
  on('effectStart', () => {
    id = hooks.sendAnimationEvent.add({...});
  });

  on('effectFinish', () => {
    if (id) {
      hooks.sendAnimationEvent.remove(id);
    }
  });
};

```

<a id="fix-vulnerability-in-writelogs-method"></a>

## Sicherheitslücke in `writeLogs` behoben

Ohne diese Korrektur konnten Textdateien an beliebige Stellen im Hostsystem geschrieben werden:

```typescript
writeLogs('../foo', '111');
// or even:
writeLogs('../../foo', '111');
```

SP erlaubt Plugins absichtlich keine Dateisystemzugriffe außerhalb des Ordners Data. PapyrusUtil, JContainers oder andere Plugins können jedoch weitere Zugriffe ermöglichen; das ist zulässig.

<a id="other-changes"></a>

## Weitere Änderungen

- `writeLogs` schreibt jetzt nach `Data/Platform/Logs` statt `Data/Platform/Plugins`.
- Plugins können aus dem zusätzlichen Ordner `Platform/PluginsDev` geladen werden. Damit wird Hot Reload für MO2-Benutzer mit heruntergeladenen SP-Plugins unterstützt.
