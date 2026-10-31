# Чат в локальном форке

React-чат связан с необязательным **SkyMP Chat**. С Plugin Runtime Loader новые клиентские/CEF-модули и подписанные пакеты принадлежат отдельному Chat-репозиторию. Здесь — общий bootstrap и зафиксированный старый мост серверам без `pluginRuntime`. Сообщения отделены от нативной консоли. Сборка/тесты/поставка: [интеграция](../../docs/docs_chat_integration.md), [runtime](../../docs/docs_plugin_runtime.md).

## Настоящий транспорт

CEF вызывает `window.skyrimPlatform.sendMessage('skympChat:send', {text, requestId})`. `chatBridge.ts` проверяет данные и использует надёжный `MsgType.CustomPacket`. Личность сервер берёт из нативного connection/actor, не ролей/ID клиента.

Ответы имеют `customPacketType: 'skympChat:…'`. Клиент передаёт сериализованные данные через `browser.executeJavaScript` DOM-событию `skympChat:packet`; `features/chat/bridge.js` меняет только существующий Redux-чат. `window.mp`/`window.skymp` и старый `cef::chat:send` не этот проверенный путь.

| Пакет | Действие |
| --- | --- |
| `skympChat:ready` | API v1, epoch, лимит, необязательные display/routing/commands-only |
| `skympChat:message` | Текст в буфер Redux до 100 записей, устранение повторов ID |
| `skympChat:ack` | Подтверждение запроса; очистка черновика лишь при принятии |
| `skympChat:open` / `close` | Совместное переключение ввода/фокуса |
| `skympChat:releaseOpenKey` | Открывающий Enter отправляет только после отпускания |
| `skympChat:status` / `unavailable` | Устойчивое отображение соединения/плагина |

Один handshake и ID загруженного frontend исключают polling/повторный фокус от позднего ready. Сообщения не добавляются локально как отправленные. HTML/скрипты/старые цвета — текст, legacy spans дают только текст без произвольного CSS.

## Redux и виджеты

Сохраняются `ADD_CHAT_MSG`, `UPDATE_CHAT_LIST`, `UPDATE_CHAT_SHOW`, `UPDATE_CHAT_INPUT`, `UPDATE_CHAT_SHOWINPUT`. `showInput: 'true'` держит ввод видимым; иначе управляет нативный режим. Явный `isInputHidden: true` виджета может скрыть. Виджет использует тот же список и заменяет стандартное место.

Готовый SkyMP Chat используется даже старым виджетом. Явный legacy-`send` действует лишь без готовности плагина. Второго store и зависимостей `window.chatMessages`/dev/login нет.

## HUD и серверная настройка

Enter показывает HUD/ввод. После закрытия скрывает `hideAfterSeconds`, стандарт 15. При `showOnMessage: true` сообщение показывает HUD без фокуса и продлевает срок; false хранит скрыто до Enter/F6.

Очищаемый React-таймер использует Redux-время. Повторные ID/close не продлевают. Открытие отменяет прежний срок, старый таймер не скрывает активный ввод. Disconnect очищает параметры/историю/черновик.

`commandsOnly` обеспечивает сервер. UI показывает подсказку, не хранит обычные player/system; личные command/error остаются. Входные уведомления создаёт только серверный `showJoinMessages`. Конфигурация серверная, второго файла клиента нет. [Правила](../../docs/docs_chat_integration.md).

## Клавиши

Enter открывает/отправляет, Escape сохраняет черновик/возвращает игру, F6 переключает браузерный фокус, F2 видимость CEF. Регистрация в BrowserService без нового hotkey-механизма. Обычные меню Skyrim блокируют открытие. Автотесты не заменяют настоящую нативную клавиатуру/CEF-фокус.

## Язык

С 1.2 сервер передаёт `localization: {locale, ui}` с проверенными текстами JSON. Reducer принимает известные ограниченные поля. React применяет только чату, общий i18n не меняет. Смена/disconnect удаляет старое. Серверы без метаданных используют прежние fallback-тексты клиента.
