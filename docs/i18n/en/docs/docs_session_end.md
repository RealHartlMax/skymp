[Deutsch](../../de/docs/docs_session_end.md) · [English](docs_session_end.md) · [Русский](../../ru/docs/docs_session_end.md)

# Session end: kick, ban, restart and connection loss

Players now find out when their connection to the server ends. Previously the game kept running locally with no notice. This feature belongs to the core and works without the Chat or UI-Core plugin.

## Behaviour in the game

| Trigger | What the player experiences |
| --- | --- |
| Kick, ban, server restart, shutdown | Immediate session end: controls locked, return to the main menu, overlay with the reason |
| Connection lost while playing | "Reconnecting" notice, automatic attempts for up to 30 seconds, player stays in the world. If that fails: main menu and overlay |
| Connection error before playing | Overlay at the main menu, no automatic attempts |
| Connection refused while reconnecting | Immediate session end, because another attempt would not change the outcome |

A server notice (kick, ban, restart) during a reconnect stops the attempts immediately. If the server accepts the connection, the deadline extends to at least 15 seconds so that login can finish. Wrong passwords are still shown by the login dialog.

The overlay offers two actions:

- **Main menu** closes the notice without reconnecting. This is deliberate: with Steam and offline profiles a new login would start immediately and reconnect a kicked player.
- **Connect again** starts a new session. It is not available during an active ban.

Both actions unlock at the main menu, or at the latest 15 seconds after the session ended if the return to the main menu does not complete. An active ban stays stored until it expires, and a permanent ban until the game restarts. The server itself enforces the ban.

## Server notice

The server sends a reliable CustomPacket and closes the connection 150 ms later. `server.kick` is wrapped for this, so all existing callers trigger a notice automatically. Plugins do not need to change.

```json
{"customPacketType":"skymp:sessionEnd","version":1,"kind":"kick","message":"","until":null}
```

`kind` is `kick`, `ban`, `restart` or `shutdown`. `until` is only set for temporary bans. Displayed text is filtered, limited to 512 characters and rendered as text.

The server sends the notice on SIGTERM, which covers managed restarts through the supervisor, and on SIGINT (Ctrl+C). After a crash or `kill -9` it can no longer send anything. The client heartbeat (`skymp:sessionPing`/`skymp:sessionPong`, 15 seconds) or the native timeout then detects the loss. Older servers without a pong only use the native timeout.

## Technical limits

Papyrus calls are only allowed in the `update` event, and as far as we currently know `update` does not run at the main menu. `sessionEndClient.ts` therefore works as follows:

- Menu state comes from `menuOpen`/`menuClose`, not from `Ui.isMenuOpen`.
- The overlay and reconnecting run in `tick`.
- Only `quitToMainMenu` and the player controls use `update`.

`NetworkingService.close()` is a silent transport stop for the login flow and does not end a session.

## Tests

```powershell
npm --prefix skymp5-client run test:session-end
```

The test mock throws on Papyrus calls outside `update` and does not fire `update` at the main menu, matching the real behaviour. Still to be accepted manually in the game: kick, ban, scheduled restart, a stopped server process and a short network outage.
