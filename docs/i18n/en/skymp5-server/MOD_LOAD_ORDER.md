# Mod load order in Resources

> Mods now live in `data/mods/<mod>/`; there is no separate download directory any more. [data/mods](../docs/docs_mod_folders.md)


Open **Resources → Game mods** in the server dashboard. The neighboring **Server plugins** tab manages JavaScript/process extensions. Additional ESM, ESP and ESL files are discovered directly in the configured game-server data directory and in Data inside the configured launcher download directory. New uploads remain disabled until selected. Use **Rescan files** after uploading; search filters file names.

The five required game files (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`) are excluded from the selectable mod lists and counts. Saves always keep them first in that fixed order, including when the custom selection is empty. Direct API requests cannot remove or reorder them through this mod manager. Missing or invalid required files prevent saving.

Enable mods with checkboxes and reorder them with the arrows. Masters are inserted before ordinary plugins when enabled. **Save load order** updates only loadOrder in the existing server-settings.json, preserving private keys and unrelated settings. Editing requires an administrator with console permission.

Skyrim.esm must come first. Masters read from TES4 headers must be enabled before their dependants. Missing, invalid, duplicate or changed files and invalid ordering are handled during validation. A plugin present only in the download directory must also be placed in the game-server data directory; both copies must match.

Restart the **game server** to generate the matching game/launcher manifest. An independent dashboard can stay running. The launcher applies the active order to plugins.txt and loadorder.txt and backs up the player's original files. Disabled uploaded plugins are omitted from the modern download manifest.

Server revision r11 includes both rebuilt backends and the dashboard frontend in Windows/Linux full and update packages. Stop the entire service, including the dashboard, before replacing program files, then restart it. File/browser checks are not gameplay validation; the operator remains responsible for mod compatibility.
