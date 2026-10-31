[Deutsch](../../de/docs/docs_vps_ports_and_process_control.md) · [English](../../en/docs/docs_vps_ports_and_process_control.md) · [Русский](docs_vps_ports_and_process_control.md)

<a id="vps-ports-protokolle-und-game-prozesssteuerung"></a>

# VPS: порты, протоколы, управление игрой

На **23.10.2026**, test-package **r3**. Значения — его defaults на `87.106.58.116`; ваши `server-settings.json` приоритетны.

<a id="eingehende-regeln-für-den-direkten-test"></a>

## Входящие правила прямого теста

| Целевой порт VPS | Протокол | Назначение | Доступ |
| --- | --- | --- | --- |
| **7777** | **UDP** | Игра/синхронизация | Тестовые игроки |
| **8080** | **TCP**, HTTP/WebSocket | Setup/dashboard/Launcher-mods/downloads | Браузеры/Launcher игроков |
| Настоящий SSH, часто 22 | TCP, SSH | Администрирование/туннель | Лучше свой IP/VPN |

Исходящие порты клиентов произвольны. В VPS-правиле выбирать **целевой порт**/протокол. Game-port не требует TCP. WebSockets делят HTTP TCP-port: `/ws/admin-updates`, `/ws/live-console`.

Адреса прямого теста:

- Dashboard/setup: `http://87.106.58.116:8080/admin`
- Manifest: `http://87.106.58.116:8080/api/launcher/manifest`
- Игра: host `87.106.58.116`, порт `7777`, UDP

Launcher кроме UDP нужен web-адрес для загрузки. Ограничение всего web-port IP оператора блокирует downloads остальных игроков.

VPS с прямым public-IP обычно нуждается в firewall-разрешении. NAT-forwarding лишь если NAT действительно у провайдера. Provider/local-firewall оба должны разрешать.

Дополнить/сверить настройки; не заменять config неполным примером:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080,
  "publicHost": "87.106.58.116"
}
```

`listenHost` привязывает UDP, `uiListenHost` HTTP. `publicHost` лишь публикует адрес, не заменяет bind. `adminApi.externalUrl` тоже не bind.

При уже включённом UFW и правильном прежнем SSH:

```sh
sudo ufw allow 7777/udp comment 'SkyMP game'
sudo ufw allow 8080/tcp comment 'SkyMP web test'
sudo ufw status verbose
```

Инструкция UFW не включает/SSH не меняет. [Ubuntu firewall](https://ubuntu.com/server/docs/how-to/security/firewalls/).

<a id="empfehlung-für-dauerhaften-öffentlichen-betrieb"></a>

## Постоянная публичная эксплуатация

Игра остаётся **7777/UDP**. Web через reverse-proxy с действительным TLS на **443/TCP**:

| Listener | Доступ | Назначение |
| --- | --- | --- |
| 7777/UDP | Публичный | Игра |
| 443/TCP | Публичный | HTTPS-dashboard/downloads/WSS |
| 80/TCP | При необходимости | Redirect/ACME HTTP-01 |
| 127.0.0.1:8080/TCP | Внутренний | Proxy → SkyMP-admin |

После рабочей proxy-настройки `uiListenHost: 127.0.0.1`, restart всего starter. Public-8080 не нужен. Launcher перевести на HTTPS-base. Один `uiPort:443`/forward 443→8080 шифрования не включает.

HTTP-01 требует 80, другие методы могут отличаться. [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/).

Nginx сохраняет public `Host` с нестандартным портом, передаёт WebSocket-upgrade. Process-control writes проверяют origin. Фрагменты для уже настроенного HTTPS:

```nginx
# Im http-Kontext:
map $http_upgrade $skymp_connection_upgrade {
    default upgrade;
    ''      close;
}

# Im vorhandenen HTTPS-server-Block:
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $skymp_connection_upgrade;
    proxy_read_timeout 300s;
}
```

Certificate/domain-IP/TLS-listener отдельно; это не полный HTTPS-vhost. [Nginx WebSocket](https://nginx.org/en/docs/http/websocket.html). Для HTTP/1.1 здесь 443/UDP не нужен.

<a id="was-die-dashboard-prozesssteuerung-beeinflusst"></a>

## Что затрагивает управление процессами

`start-test-server.sh`, `start-test-server.bat`/aliases запускают постоянное управление/public-HTTP. Dashboard и игра — **два отдельных дочерних процесса**. Dashboard native-addon не загружает. Команды через **Node IPC**, без нового public-control-port.

| Действие | Игра | Public-HTTP |
| --- | --- | --- |
| Stop панели | Свой child завершён, UDP свободен | Тот же порт работает |
| Start оператора | Новый child | Работает |
| Restart панели | Свой child заменён | Работает |
| Crash игры | Child завершён, operator-start | Доступен |
| Ctrl+C/закрыть starter/весь systemd stop | Свой child завершён | Тоже завершён |

**С r3 весь dashboard сохраняется:** login/config/admin/logs/downloads работают при stopped/crashed game. Страница не reload, PID/WebSockets прежние. UI показывает state/**Start**. Kick/announcement требуют игру, иначе `GAME_NOT_RUNNING`, HTTP 409. Mods требуют верный `data/manifest.json` под `loadOrder`; после смены списка может нужен game-start для нового manifest.

Старый r2 сохраняет отдельную operator-page. Полное разделение требует r3: `dist_back/skymp5-admin.js`, backend, frontend, `server-supervisor.cjs`.

Upstream Nginx/Caddy не останавливается dashboard. Управление завершает лишь свой child, не ищет чужие Node/webserver. Полный exit starter завершает обоих.

systemd запускает поставляемый starter. `systemctl stop`/`systemctl restart` всей службы затрагивает управление. Только game-restart — через dashboard. HTTP port/bind требуют всего starter-restart. Прямой `node dist_back/skymp5-server.js` обходит управление.

<a id="interne-ports-und-ausgehende-verbindungen"></a>

## Внутренние порты/исходящие подключения

С r4 [Discord-bot](docs_discord_bot.md) остаётся в dashboard, получает game-state private-IPC, сообщает start/stop/restart/crash. Полный stop сначала завершает игру, затем bot/dashboard. Новый public-listener не нужен.

- У dashboard/game динамический **TCP на 127.0.0.1** для внутреннего HTTP. Не открывать их/диапазон публично.
- **1234/TCP** frontend-dev; managed-пакет пропускает detection. На VPS не открывать.
- **9000/TCP** CEF DevTools игрока, не VPS.
- Voice/TeamSpeak/plugins требуют правил лишь при отдельном хостинге.
- При ограниченном egress разрешить **443/TCP** Node-download/Discord HTTPS/WSS/optional master-login; mirrors **80/TCP или 443/TCP**. DNS обычно **53/UDP и 53/TCP** к resolver. Ответы разрешённых соединений тоже пропускать.

Master-heartbeat исходящий, новый входящий порт не нужен. Внешний client-runtime URL также listener не создаёт.

<a id="erreichbarkeit-prüfen"></a>

## Проверка доступности

```sh
ss -lnup
ss -lntp
curl -I http://127.0.0.1:8080/admin
```

HTTP проверить другим ПК. HTTP/TCP не доказывает UDP-игру, её отдельно подходящим клиентом. Package-test проверяет UDP bind/free при stop, новые PID start/restart. Dashboard-test — config/log/download/тот же PID/WebSockets после crash. Доказательства у релиза; local-тест не заменяет VPS/игру.

См. [Linux VPS/setup](docs_linux_vps.md), [config](docs_server_configuration_reference.md), [Launcher mods](docs_launcher_modpacks.md).
