[Deutsch](sp-2.9.md) · [English](../../../en/docs/release/sp-2.9.md) · [Русский](../../../ru/docs/release/sp-2.9.md)

<a id="sp-290-release-notes"></a>

# SP 2.9.0 Versionshinweise

Danke für die Verwendung von Skyrim Platform!

Dieses Dokument enthält die Änderungen seit SP 2.8.0

WARNUNG: Ein neues Spiel ist erforderlich. Ein Update mit bestehendem Spielstand erfolgt auf eigene Gefahr. Sichere deine Spielstände.

Weitere Informationen zum Projektstatus: https://github.com/skyrim-multiplayer/skymp/blob/main/skyrim-platform/README.md

<a id="changes"></a>

## Änderungen

- Nach mehreren Einzelkorrekturen sind alle verbleibenden unsicheren Ereignishandler behoben. **Beim Laden eines Spielstands sollten keine Abstürze mehr auftreten.** ❤️‍🩹

- Unterstützung für Skyrim 1.6.1170.0 ergänzt. ❤️‍🩹

- Native Funktion `TESModPlatform.CreateReferenceAtLocation` ergänzt.

- Absturz beim Laden eines Spielstands mit mindestens einem aktiven Listener für `effectStart`/`effectFinish` behoben.

- Text-API leicht optimiert.

- Fehlenden Wert `isSunGazing` im Ereignis `playerBowShot` ergänzt.

- `loadGame` unterstützt jetzt nicht standardmäßige Kopfteile.

- `blockPapyrusEvents` blockiert keine Ereignisse im Skript `defaultDisableHavokOnLoad` mehr.

- Einstellungs-API deutlich optimiert.

- Native Funktion `TESModPlatform.CloseMenu` ergänzt.

- `setInventory` verhindert beim Spieler standardmäßig nicht mehr das Ablegen ausgerüsteter Gegenstände; bei anderen Actors bleibt es verhindert.

- Absturz beim Hot Reload nach dem Versuch behoben, einen Listener für ein nicht existierendes Ereignis zu registrieren.

- Methode `blockPapyrusEvents` als Alias für die Papyrus-Funktion `TESModPlatform.blockPapyrusEvents` ergänzt, die einen `on('update')`-Kontext benötigt.

- Die [eingebettete Konsole](https://github.com/skyrim-multiplayer/skymp/blob/592c6527ed91e6c97a38d143f4ae1cdab9c3268e/docs/release/sp-2.8.md?plain=1#L68) spiegelt unbehandelte Ausnahmen der Spielkonsole jetzt korrekt.

- Parameter `time` und `loadOrder` zu `loadGame` hinzugefügt.

- Laufzeitfehler behoben, wenn Bundler const-Enums in skyrimPlatform.ts als nicht konstant behandeln.

- Erste Unterstützung für Skriptfunktionen im tick-Kontext: `Game.getModCount`, `Game.getModName`.

- Möglichen Absturz beim Laden eines Spielstands mit mindestens einem aktiven Listener für `magicEffectApply` behoben.

- Experimentelle native Funktion `TESModPlatform.EvaluateLeveledNpc` ergänzt. Sie ist instabil und darf nicht in Benutzerplugins verwendet werden; SkyMP benötigt sie.

- Absturz im Ereignis `CameraStateChanged` beim Öffnen der Weltkarte behoben.

- Die HTTP-Client-API unterstützt jetzt Callbacks zusätzlich zu Promises. Das ist hilfreich, weil Promises in SkyrimPlatform im Hauptmenü nicht aufgelöst werden.
