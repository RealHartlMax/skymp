[Deutsch](sp-2.7.md) · [English](../../../en/docs/release/sp-2.7.md) · [Русский](../../../ru/docs/release/sp-2.7.md)

<a id="sp-270-release-notes"></a>

# SP 2.7.0 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.6.0

WARNUNG: SP kann Spielstände beschädigen. Sichere deine Spielstände vor der Installation. Siehe https://github.com/skyrim-multiplayer/skymp/issues/796

SP unterstützt die Steam-Version von Skyrim SE (1.6.640) und die ältere Version 1.5.97.

<a id="handle-attempts-to-call-non-native-papyrus-functions"></a>

## Aufrufversuche nicht nativer Papyrus-Funktionen behandeln

Derzeit unterstützt Skyrim Platform nur Aufrufe nicht nativer Funktionen. Die Änderung besteht darin, jetzt eine JavaScript-Ausnahme auszulösen, statt abzustürzen.

```js
// JS example, in TS we already couldn't call non-natives :p
sp = skyrimPlatform;
sp.on('update', () => {
  sp.printConsole(sp.Game.getplayer().getActorValuePercentage('health'));
  // ^ "1"

  sp.printConsole(sp.Game.getplayer().getAVPercentage('health'));
  // ^ "[Exception] Function is not native 'Actor.getAVPercentage'"
  // No crash in the new version
});
```

<a id="other-changes"></a>

## Weitere Änderungen

- Unerwartet erstellte Ordner unter "overwrite" in MO2 korrigiert.

- Unterstützung für Skyrim 1.6.640 ergänzt.

- Plugin-Erkennung verbessert: Dateien mit doppelten Endungen oder der Endung ".DS_Store" werden nicht mehr als JavaScript interpretiert.

- Chromium Embedded Framework auf v105 aktualisiert.

- Doppelten Mauszeiger bei fokussiertem und sichtbarem Browser korrigiert.

- Versehentlich entferntes `InstallApplyMasksToRenderTargetsHook` wieder hinzugefügt.

- Methode `setInventory` ergänzt, um Abstürze bei umfangreichen Inventaroperationen mit `TESModPlatform.AddItemEx` zu vermeiden.

- Häufige Hänger bei den Skriptfunktionen `removeAllItems`, `equipSpell` und anderen behoben.

- CI-Skript korrigiert, das überflüssige Dateien ins SkyrimPlatform-Anniversary-Edition-Archiv aufnahm.

- Das Feld "a**g**ressor" des Trefferereignisses wiederhergestellt. Es bleibt für die Abwärtskompatibilität kompilierter Plugins erhalten. Nur Version 2.6 war von dem Fehler betroffen. Dieser Schreibfehler wird in 3.0.0 vollständig aus dem Projekt entfernt.
