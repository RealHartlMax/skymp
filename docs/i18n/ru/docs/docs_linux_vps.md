[Deutsch](../../de/docs/docs_linux_vps.md) · [English](../../en/docs/docs_linux_vps.md) · [Русский](docs_linux_vps.md)

<a id="linux-vps-build-und-betrieb"></a>

# Linux VPS: сборка и эксплуатация

> **Новое:** моды теперь находятся в `data/mods/<мод>/`; `client-resources` больше не читается. Сведения о нём на этой странице устарели. См. [моды в data/mods](docs_mod_folders.md).

Дополняет [серверную инструкцию](docs_running_a_server.md) для **Ubuntu 26.04 VPS, 12 vCores/24 GB RAM**. Начальная конфигурация build/load-test, не измеренная вместимость: зависят gamemode/plugins/CPU.

[Порты/процессы](docs_vps_ports_and_process_control.md): прямой **7777/UDP**, **8080/TCP**, постоянный web лучше **443/TCP** с TLS-proxy. Там же управление после game-stop.

<a id="aktueller-server-testbuild-vom-25-oktober-2026"></a>

## Текущий server-test 25.10.2026

r9 `build/releases/2026-10-25-server-r9/`: `skymp-server-2026-10-25-r9-linux-x64-full.zip` новый, `skymp-server-2026-10-25-r9-linux-x64-update.zip` программа старого VPS. Update исключает config/accounts/`data/` с PEX/мир/mods/client-resources/gamemode. [Инструкция](docs_packaged_server_update.md) с распаковкой. Backend/dashboard обоих одинаковы.

r8: policy v2/компактная server-ticket identity, HTTP 409/`STEAM_POLICY_CHANGED`, `STEAM_TICKET_AUDIENCE_MISMATCH`. После restart свежий Launcher/ticket. Прежние fixed-codes/sanitized Valve-explanation в логе сохранены. Restart всего starter/dashboard: HTTP-login в web-процессе. Причина старого VPS-отказа не подтверждена. Launcher отдельного repo.

С r5 Steam обязателен всем. API-Key в wizard/CFG Access & Discord, выбрать access/restart game. Guests без Worlds. Обновить EXE/client: [Steam/legacy](docs_ingame_login.md). Backend/dashboard отдельно; PIN/mod-API-v2/heartbeat/Launcher-интеграция включены. С r4 [Discord](docs_discord_bot.md) независимо в web. Native прежней проверенной базы, происхождение отдельно в manifest.

Оба архива распакованы/проверены своими masters: PIN/admin/dashboard/Launcher-config/mod/UDP. Linux стартует Ubuntu 26.04.1 Node 22.22.1. Это local-container, не VPS/game-приёмка. `VALIDIERUNG.json` показывает scope/исторический Windows-native-fail.

Существующий сервер: backup/stop, заменить backend/dashboard/setup по `UPDATE-VPS.md`. **Сохранить config/admin/data/mods/свой gamemode.** Только `dist_back/` не обновляет dashboard.

r2 ставит отсутствующий/старый Node приватно `.runtime/`, Node 22 LTS/SHA-256. Недостающие Ubuntu/Debian-пакеты точечно root/noninteractive-sudo; не OS-upgrade/global-Node. Daily-update той же LTS. С r3 dashboard отдельно переживает game-stop/restart/crash: login/config/log/download/PID/WebSockets прежние, только game-PID меняется, есть Start. Использовать `start-test-server.sh`/`launch_server.sh`.

Launcher-источник отдельный: `local-builds/current/` содержит EXE/versioned-runtime/webroot-ZIP. Новый server не содержит EXE/не меняет те outputs. Steam-Launcher/client отдельно для r5.

Первичной настройке нужна игра; полный catalog может дать SKSE/Address Library. Новые DLL/address-probes есть, Skyrim/CEF открыт. [Статус](docs_project_status.md), [catalog](docs_launcher_runtime_updates.md), [Worlds](docs_launcher_worlds.md).

<a id="browser-ersteinrichtung-und-modpakete"></a>

## Browser-setup/mods

PIN появился 20 октября, mod-API 21-го. Старые local-build удалены после r5. Далее полный r9. Старый server по [update](docs_packaged_server_update.md), не отдельным backend-файлом. Дополнительное в `client-resources/Data/`, plugins `data/`/`loadOrder`; [mods](docs_launcher_modpacks.md).

**Готового admin нет.** Новый каталог, пять своих masters `data/`, `sh ./start-test-server.sh`/`start-test-server.cmd`. Terminal URL/**четырёхзначный код**. Открыть VPS `http://87.106.58.116:8080/admin`, код, имя/порты/слоты/access/public-IP/domain/admin в браузере. Password scrypt, дальше setup сохранён. Не перезаписывать старый config/мир defaults.

Три режима:

| Режим | UDP bind | HTTP bind |
| --- | --- | --- |
| Local | `127.0.0.1` | `127.0.0.1` |
| VPS/SSH | `0.0.0.0` | `127.0.0.1` |
| VPS/public | `0.0.0.0` | `0.0.0.0` |

Для интернета **VPS · Dashboard и игра публичны**, `87.106.58.116`. Firewall свой. `VERBINDUNG.txt` — адреса, `skymp5-client-settings.example.txt` — тест. Plaintext-password нет, existing-admin не сбрасывается. Setup-listener все IPv4/TCP 8080, открыть provider-firewall заранее. Game после завершения/валидных masters; недостающее видно, скопировать/«Проверить снова». Код одноразовый/10 минут; пять ошибок — глобальная минута паузы/новый код. Browser-разрешение 30 минут. Terminal-ввод не нужен даже service, код в log. Только setup: `node setup-server.cjs`. HTTPS/SSH защищают и setup.

Старые local-build удалены после r5 по запросу. `native-baseline-evidence.json`/`cleanup.json` сохраняют доказательства/очистку. Живой VPS сохраняет свои config/accounts, defaults поверх не распаковывать.

<a id="neuinstallation-auf-ubuntu"></a>

## Новая Ubuntu-установка

`uname -m`: нужен `x86_64`. Starter ставит Node.js 22+, нужны пять своих masters, в архивах их нет. Ubuntu 26.04:

```sh
mkdir ~/skymp-browser-test
unzip skymp-server-2026-10-25-r9-linux-x64-full.zip -d ~/skymp-browser-test
cd ~/skymp-browser-test
# Skyrim.esm, Update.esm, Dawnguard.esm, HearthFires.esm und Dragonborn.esm nach data/ kopieren.
sh ./start-test-server.sh
```

Остановить старый процесс/service, освободить TCP 8080/UDP 7777. Для parallel-test свободный `uiPort` нового `server-settings.json`/другой UDP в browser. Старый config/мир отдельно.

`http://87.106.58.116:8080/admin`, код, четыре шага. Defaults UDP 7777/TCP 8080/offline/16 slots, не capacity-limit. Deps bundled, `npm install` не нужен. Нет client/admin-предустановки.

Среды/результаты [отчёт](docs_native_validation_2026_10_19.md). User-log 20 октября доказывает VPS-start Linux x64/five masters/admin-store. `/admin` позже 200/реальный login, `/api/admin/setup/status` настроен. Remote-game/load открыты, VPS-config локально не менялся.

<a id="vorhandene-vps-installation-im-internet-erreichbar-machen"></a>

## Доступность существующего VPS извне

**`server-settings.json` распакованного сервера**, остальные значения сохранить:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080
}
```

Stop/restart прежним Launcher/systemd. `http://DEINE_VPS_IP:8080/admin` при разрешённом firewall. `0.0.0.0` bind, в browser public-IP. `adminApi.externalUrl` не bind, при прямом IP можно пустым. `data/admin-auth.json` прежний.

Активный UFW:

```sh
sudo ufw allow 7777/udp
sudo ufw allow 8080/tcp
sudo ufw status verbose
ss -lnup
ss -lntp
```

Provider тоже UDP 7777/TCP 8080. Не включать UFW вслепую, сохранить SSH-port. [Ubuntu firewall](https://ubuntu.com/server/docs/how-to/security/firewalls/). HTTP-login не шифруется, постоянно HTTPS/domain/SSH.

Прямой тест игры: существующий JSON `Data/Platform/Plugins/skymp5-client-settings.txt`:

```json
{
  "gameData": { "profileId": 1 },
  "master": "",
  "server-info-ignore": true,
  "server-ip": "DEINE_VPS_IP",
  "server-port": 7777,
  "server-master-key": "MASTERKEY_AUS_SERVER_SETTINGS"
}
```

Положительный `profileId` каждому, например 1/2/3. `offlineMode: true` — local-test-login, не отсутствие интернета. Только доверенная группа, не verified-public-аккаунты. Direct UDP без master-publication. Client-modlist использует gateway, HTTP его не заменяет. Сохранить другие settings. Нужен matching Windows-client/game-data, server-пакет не исправляет отложенную Skyrim-1.7/CEF-совместимость.

<a id="plattform-und-eigene-builds"></a>

## Платформа/свои builds

Нужен **Linux `scam_native.node`**, Windows не работает. Собирать target/совместимой Linux-средой, matching arch/libs; `uname -m`.

Compiler/CMake/Ninja/Node/vcpkg: [CONTRIBUTING.md](../CONTRIBUTING.md), distro-helper `misc/deps_linux/`. Dockerfile Node 22. Инструкция автоматически system-пакеты не ставит/обновляет.

<a id="eigenen-fork-bauen"></a>

## Собрать свой fork

Передать нужные sources Linux. Clone не включает uncommitted, Windows-build/`node_modules` не передавать.

После prerequisites из корня:

```sh
mkdir -p build
cd build
npm --prefix ../skymp5-front ci
npm --prefix ../skymp5-front test
npm --prefix ../skymp5-front run build

../build.sh --configure \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_CLIENT=OFF \
  -DBUILD_SKYRIM_PLATFORM=OFF \
  -DBUILD_SCRIPTS=OFF \
  -DBUILD_UNIT_TESTS=OFF \
  -DBUILD_GAMEMODE=OFF \
  -DDOWNLOAD_SKYRIM_DATA=OFF \
  -DOFFLINE_MODE=OFF

cmake --build . --target skymp5-server --parallel 6
```

Шесть jobs осторожно для 24 GB, менять по RAM. Первый vcpkg дольше/требует память.

`build/dist/server/`: `ui/build.js`, `dist_back/skymp5-server.js`, native/launcher. CMake копирует frontend, `BUILD_FRONT` не нужен.

Game-widget также в **Windows-client**, отдельно `npm --prefix ../skymp5-client run build` из build. Linux-server клиент не заменяет.

<a id="erststart-und-konfiguration"></a>

## Первый старт/config

Весь Linux-пакет, например `/opt/skymp/server`, writable-user `skymp`. Добавить masters `data/`, plugins/gamemode по [server](docs_running_a_server.md).

Править свой `server-settings.json`, не заменять минимальным. Важно:

- `port`: UDP, `7777`.
- `uiPort`: HTTP UI/API, default `port`.
- `listenHost`: UDP bind.
- `uiListenHost`: HTTP bind.
- `masterKey`: соответствует client.
- `adminApi.externalUrl`: явный public-HTTPS.

Одинаковый номер HTTP/UDP — разные службы. API/панель HTTP, client-CEF локально `Data/Platform/UI/`. Proxy может HTTP-loopback, если передаёт все paths и `/ws/admin-updates` upgrade. [Ports](docs_server_ports_usage.md), [config](docs_server_configuration_reference.md), [OAuth](docs_admin_discord_oauth.md).

Один раз server-user из пакета:

```sh
cd /opt/skymp/server
./launch_server.sh
```

Launcher проверяет Node/ставит deps; подготовить до service. Проверить `/admin` setup/login/whitelist настоящими endpoints. Real-OAuth требует public-domain/Discord-config.

<a id="als-systemd-dienst-starten"></a>

## systemd-service

После первого старта/deps unit `/etc/systemd/system/skymp.service`; поменять user/path/Node:

```ini
[Unit]
Description=SkyMP server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=skymp
Group=skymp
WorkingDirectory=/opt/skymp/server
ExecStart=/usr/bin/node /opt/skymp/server/dist_back/skymp5-server.js
Restart=on-failure
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=60
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Ручной сервер остановить до enable:

```sh
sudo systemd-analyze verify /etc/systemd/system/skymp.service
sudo systemctl daemon-reload
sudo systemctl enable --now skymp
sudo systemctl status skymp
sudo journalctl -u skymp -f
```

Stop service, backup `data/`/settings/мира, [playbook](docs_server_update_playbook.md), start. Не запускать параллельно `--start-after` при systemd.

<a id="lasttest-und-abnahme"></a>

## Load-test/приёмка

CPU/process/RAM через admin, `top`, `free -h`, сначала мало игроков, затем realistic-load. 12 vCores не означают масштабирование всей simulation.

Browser проверяет реальные frontend/widgets с simulated-API/client. Linux-native/full-unit в container, Ubuntu 26.04 real-core/admin. До production нужны client/Discord/Skyrim/CEF/настоящий VPS.
