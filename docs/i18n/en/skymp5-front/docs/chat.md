# Chat in the local fork

React chat connects to the optional **SkyMP Chat** server plugin. Since Plugin Runtime Loader, new chat client/CEF modules and signed packages belong to the separate Chat repository. This fork contains generic bootstrap and a frozen compatibility bridge for old servers without `pluginRuntime` advertisement. These messages remain separate from native console commands. Build/tests/delivery: [integration](../../docs/docs_chat_integration.md), [plugin runtimes](../../docs/docs_plugin_runtime.md).

## Actual transport

CEF calls `window.skyrimPlatform.sendMessage('skympChat:send', {text, requestId})`. `chatBridge.ts` validates UI data and uses reliable `MsgType.CustomPacket`. Server identity comes from native connection/actor context, never client-supplied roles/IDs.

Replies use `customPacketType: 'skympChat:…'`. Client sends serialized data through `browser.executeJavaScript` to DOM event `skympChat:packet`; `features/chat/bridge.js` updates only existing Redux chat state. `window.mp`/`window.skymp` and previously documented `cef::chat:send` are not this verified route.

| Packet | Effect |
| --- | --- |
| `skympChat:ready` | API v1, server epoch, input limit and optional display/routing/commands-only options |
| `skympChat:message` | Text into 100-entry Redux buffer; deduplicate IDs |
| `skympChat:ack` | Match request; clear draft only if accepted |
| `skympChat:open` / `close` | Change input mode/focus together |
| `skympChat:releaseOpenKey` | Opening Enter may send only after release |
| `skympChat:status` / `unavailable` | Tolerantly show connection/plugin status |

One handshake and a per-loaded-frontend ID avoid polling/duplicate focus from late ready events. Messages are not locally inserted as if sent. HTML/scripts/old color markup are text; legacy spans provide text without arbitrary CSS.

## Existing Redux actions/widgets

`ADD_CHAT_MSG`, `UPDATE_CHAT_LIST`, `UPDATE_CHAT_SHOW`, `UPDATE_CHAT_INPUT`, `UPDATE_CHAT_SHOWINPUT` remain. `showInput: 'true'` keeps input visible; otherwise native mode controls it. Explicit widget `isInputHidden: true` may hide it. A widget uses the same Redux list and replaces the default location.

With SkyMP Chat ready, old widgets use its actual transport. An explicit legacy `send` callback works only when the plugin is not ready. No second store or dependency on `window.chatMessages`/dev/login flags.

## HUD and server settings

Enter opens HUD/input. After input closes it hides after `hideAfterSeconds`, default 15. `showOnMessage: true` shows new messages without input focus and renews expiry; false retains them invisibly until Enter/F6.

A cleaned React timer uses Redux expiry. Duplicate IDs/close events do not extend it. Reopening cancels old expiry; stale timers cannot hide active input. Disconnect resets options/history/draft.

`commandsOnly` is server-enforced. UI shows command guidance and stores no ordinary player/system messages; private command/error replies remain. Only server `showJoinMessages` creates join notices. Configuration belongs to server plugin, no second client file. [Display/server rules](../../docs/docs_chat_integration.md).

## Keys

Enter opens/sends, Escape keeps draft/releases gameplay focus, F6 toggles browser focus, F2 CEF visibility. Existing BrowserService owns registration; no new hotkey system. Regular Skyrim menus block opening. Automated client/browser checks do not replace real native keyboard suppression/CEF focus testing.

## Language

Since 1.2, server sends `localization: {locale, ui}` containing validated configured JSON texts. Reducer accepts only known bounded fields. React uses them only for chat; global component i18n stays unchanged. Switching/disconnect discards old texts. Old servers without metadata use existing client fallbacks.
