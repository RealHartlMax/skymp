[Deutsch](../../de/docs/docs_server_ports_usage.md) · [English](../../en/docs/docs_server_ports_usage.md) · [Русский](docs_server_ports_usage.md)

<a id="server-ports-usage"></a>

# Назначение портов сервера

Обычная работа использует UDP listener игры и отдельный TCP/HTTP listener. Порты webpack и Chromium ниже относятся к разработке. Здесь описаны их роли; номера HTTP и UDP могут совпадать.

Для текущих тестовых пакетов пробросьте **7777/UDP** для игры и **8080/TCP** для HTTP/WebSocket. [Руководство firewall VPS и процессов](docs_vps_ports_and_process_control.md) содержит рекомендации HTTPS, конкретные правила и независимый полный dashboard при остановленном игровом backend (r3 и позднее).

<a id="main-port"></a>

## Основной порт

Используется для синхронизации и основной сетевой связи.

- Протокол UDP
- По умолчанию 7777
- Настраивается через [файл конфигурации](docs_server_configuration_reference.md) или [API командной строки](docs_server_command_line_api.md)

<a id="ui-port"></a>

## Порт UI

Для встроенного браузера, dashboard администратора, загрузок модов и необязательного хостинга runtime клиента. Здесь launcher читает `/api/launcher/manifest`.

- Протокол HTTP
- Настраивается `uiPort` в `server-settings.json`
- Без `uiPort` используется значение `port`
- `uiListenHost` задаёт адрес привязки HTTP listener
- Локальные тестовые пакеты задают `uiPort: 8080`; читайте фактическую конфигурацию
- Для удалённых загрузок launcher кроме UDP-порта нужен доступный извне базовый HTTP(S) URL

<a id="webpack-devserver-port"></a>

## Порт WebPack DevServer

Если WebPack dev server и skymp работают на одном компьютере, skymp проксирует UI-запросы в WebPack. Это позволяет тестировать игровые системы с живым обновлением frontend.

- Адрес проверки разработки: `http://localhost:1234`
- При доступности запросы `/ui/*` проксируются туда
- Другие запросы API/ресурсов обслуживает встроенное приложение сервера

## Chromium DevTools

Это не серверный порт. Встроенный браузер открывает порт 9000 для удалённых DevTools. Откройте `localhost:9000` в обычном браузере, чтобы попасть в Chromium DevTools игрового браузера.
