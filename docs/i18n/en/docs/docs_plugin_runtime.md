[Deutsch](../../de/docs/docs_plugin_runtime.md) · [English](docs_plugin_runtime.md) · [Русский](../../ru/docs/docs_plugin_runtime.md)

# Plugin Runtime Loader

The implementation and operator/developer contract are maintained in [misc/plugin-runtime/README.md](../../../../misc/plugin-runtime/README.md).

This is a source change for the planned **v2.1.0** server milestone: it adds a public launcher manifest extension and a generic client/CEF module API. It is not a v2.0.2-only bugfix release. Launcher and plugin versions remain independently managed.

Also included in the source preparation:

- Offline inventory reads the configured native file database (`databaseName`, default `world/changeForms`), resolves the authenticated profile instead of treating a connection slot as a profile, and prefers the still-loaded native actor when available. An empty inventory is a valid snapshot. Historical entries without a known profile receive a localized, explicit status; their identity is not guessed.
- Offline players cannot receive live moderation actions. The backend checks the current connection and, when supplied, its expected profile before recording success.
- Inventory requests cannot overwrite a newer player selection. Source, timestamp and unavailable states are localized.
- The server version check defaults to `RealHartlMax/skymp`; `releaseRepository` can override it with a validated `owner/repository`.

The previous local release artifacts predate these source changes. No new build, ZIP, commit, push, tag or release was performed during this implementation. A later build must include the launcher, the shared client/CEF bootstrap and the plugin Runtime packages together; after that one-time bootstrap, compatible plugin UI/client updates belong to the plugin release.
