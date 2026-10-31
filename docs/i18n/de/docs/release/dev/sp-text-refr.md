[Deutsch](sp-text-refr.md) · [English](../../../../en/docs/release/dev/sp-text-refr.md) · [Русский](../../../../ru/docs/release/dev/sp-text-refr.md)

<a id="text-reference-attachment-api"></a>

## API zum Befestigen von Text an Referenzen

Mit `createText` erstellte Texte lassen sich jetzt an Referenzen in der Welt (Objekte, NPCs, Spieler) befestigen und folgen ihnen bei jedem Bild automatisch auf dem Bildschirm.

<a id="new-functions"></a>

### Neue Funktionen

```typescript
// Attach text to a reference. Pass 0 to detach and restore the original screen position.
setTextRefr(textId: number, refrFormId: number): void;

// Set the skeleton node to track (e.g. "NPC Head [Head]"). When empty the
// object's base position (GetPosition) is used instead of the NiNode transform.
setTextRefrNode(textId: number, nodeName: string): void;

// Apply a world-space offset (x, y, z) on top of the tracked position.
setTextRefrOffset(textId: number, offset: number[]): void;

// Apply a screen offset (x, y) on top of the tracked position and world-space offset.
setTextRefrScreenOffset(textId: number, offset: number[]): void;

// Read back the currently set values.
getTextRefr(textId: number): number;
getTextRefrNode(textId: number): string;
getTextRefrOffset(textId: number): number[];
getTextRefrScreenOffset(textId: number): number[];
```

<a id="behaviour"></a>

### Verhalten

- Wenn `refrFormId` ungleich null ist, wird die Bildschirmposition bei jedem Update durch Projektion der Weltposition über die Spielerkamera neu berechnet.
- Ist `refrNodeName` leer, wird die Objektposition (`GetPosition()`) verwendet. Dadurch funktioniert der Text auch ohne geladene 3D-Darstellung der Referenz.
- Wurde ein Knotenname angegeben, der im aktuellen Bild nicht gefunden wird, bleibt die Textposition für dieses Bild unverändert.
- Texte hinter der Kamera werden nicht verschoben.
- Beim Lösen der Bindung (`setTextRefr(id, 0)`) wird die zuletzt über `setTextPos` gesetzte Bildschirmposition wiederhergestellt.
