[Deutsch](../../de/docs/docs_plugin_ui_troubleshooting.md) · [English](../../en/docs/docs_plugin_ui_troubleshooting.md) · [Русский](docs_plugin_ui_troubleshooting.md)

<a id="chat-und-yaca-geladen-aber-im-spiel-unsichtbar"></a>

# Chat и YACA загружены, но не видны в игре

Сравнение исходников/пакетов от **27 октября 2026 года**. В присланном Linux-журнале `skymp-chat` и `skymp-yaca-ts` загружаются успешно. У исследованного клиента две конкретные причины отсутствия интерфейса; для них не нужны новая Linux-сборка сервера или изменения загрузчиков плагинов.

<a id="nachgewiesener-unterschied"></a>

## Подтверждённое отличие

Публичный манифест предлагает `https://update.skymp-worlds.net/client-runtime/catalog.json` как `runtimeSource`. Во время сравнения каталог ещё указывал на `1.7.104.0/client-2026-10-25-tintfix/runtime-manifest.json`. Его хеши точно совпадают с установленными файлами:

| Файл | Установленный / предлагаемый старый SHA-256 | SHA-256 новой Chat runtime |
| --- | --- | --- |
| `Data/Platform/Plugins/skymp5-client.js` | `3498934c92a308a6c9736eaff3c1d16449eefb5ab35fb1ff649b0a69034e9256` | `78151b2583739e0e26f4ee8b1c0960e4da1a333fdc276445454d391bfd867f71` |
| `Data/Platform/UI/build.js` | `229a40896f8f3805a1dc46c9819c839d10a7a6115c25f5649558641f9026d628` | `000df4a213f26b6d678bddd683f71f578081ec7f81c1f52491e41f5dbb750918` |

1. **Chat:** В старом клиенте и frontend полностью отсутствуют `skympChat:send` и `skympChat:packet`. Загруженный серверный плагин не может установить недостающий транспорт и UI клиента.
2. **YACA:** Извлечённый из установленного клиента `SettingsService` создаёт `publicKeys: {}` без настроенных ключей. Проверка подписи считает эту пустую карту настроенным хранилищем и отклоняет реальный код EventSource YACA с `no signature found`. Уже исправленный текущий `SettingsService` принимает тот же код. При настроенных настоящих ключах действительные подписи по-прежнему обязательны.

Все 73 нативных файла нового runtime-пакета совпадают с исследованной установкой Skyrim. Для этой ошибки новая SKSE/SkyrimPlatform DLL не нужна. Серверный Full/Update ZIP не обновляет установленные клиентские файлы.

<a id="korrigiertes-runtime-paket-verwenden"></a>

## Использование исправленного runtime-пакета

Пакет собирается в серверном fork; репозиторий launcher содержит веб-процесс доставки. Для этого случая подготовлена проверенная копия:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

Для **локальной проверки без публикации** укажите этот полный каталог в **Параметры соединения → Пакет клиента SkyMP** для сервера и сохраните:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat
```

Закройте Skyrim, затем подключитесь обычным launcher. Ручной источник имеет приоритет над старым серверным; аутентификация и подготовка остаются в обычном потоке.

Для **всех игроков** сначала загрузите новый каталог версии в `update.skymp-worlds.net/client-runtime/1.7.104.0/`, затем замените `client-runtime/catalog.json`. Сохраните старые каталоги и остальные записи. Когда live-каталог предложит новую версию, удалите временный локальный выбор. Новая launcher EXE и изменения Linux-сервера не нужны.

<a id="nur-die-lokale-oberfläche-prüfen-oder-installieren"></a>

## Проверка или установка только локального UI

[install_client_ui.ps1](../../../../misc/deploy/install_client_ui.ps1) сравнивает установленные JS/UI с существующим runtime-манифестом. Без `-Apply` ничего не записывает. С `-Apply` сначала сохраняет заменяемые файлы. Нативные файлы и частные настройки сохраняются; неверная версия игры, работающий Skyrim, ссылки, обход пути и неправильные хеши источника отклоняются.

```powershell
pwsh -File misc/deploy/install_client_ui.ps1 `
  -GameDirectory 'G:/SteamLibrary/steamapps/common/Skyrim Special Edition' `
  -RuntimeDirectory 'build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat'
```

Если live-каталог старый, следующий автоматический запуск launcher снова заменит вручную скопированное старой версией. Поэтому для теста выберите указанный источник или опубликуйте новый каталог.

<a id="prüfgrenzen-und-gamemode-meldung"></a>

## Границы проверки и сообщение gamemode

`skipping gamemode data update send, clientside hot-reload is disabled` относится к изменению скриптов для уже подключённых игроков. Нативный сервер сохраняет состояние и отправляет при подключении. Сообщение не объясняет подтверждённые старые клиентские файлы и не требует включения hot reload.

Локальная диагностика: `build/reports/plugin-ui-2026-10-27/` — live-каталог, извлечённые реальные службы и воспроизведение с настоящим EventSource YACA. Браузерные/fixture-тесты не заменяют Skyrim/CEF или проверку звука TeamSpeak.

Подробнее: [интеграция Chat и доставка runtime](docs_chat_integration.md).
