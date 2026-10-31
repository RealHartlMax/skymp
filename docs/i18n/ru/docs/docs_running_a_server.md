[Deutsch](../../de/docs/docs_running_a_server.md) · [English](../../en/docs/docs_running_a_server.md) · [Русский](docs_running_a_server.md)

<a id="running-a-server"></a>

# Запуск сервера

Skyrim Multiplayer публикует готовые пакеты GitHub Releases. **Скачивать/собирать репозиторий для своего сервера не обязательно.**

<a id="current-fork-test-packages-and-browser-setup"></a>

## Тестовые пакеты fork/browser-setup

Проверено **22.10.2026**: Linux/Windows `build/releases/2026-10-21-modsync/`, mod-API v2, browser-setup со случайным четырёхзначным terminal-PIN/своим admin. Готовых logins/Bethesda-master нет. Node.js 22+ отдельно, старт `start-test-server.sh`/`start-test-server.cmd`.

См. [Linux/VPS/setup](docs_linux_vps.md), [статус](docs_project_status.md), [mods](docs_launcher_modpacks.md). Сохранять `server-settings.json`, `data/`, `world/`, свои published-файлы; `UPDATE-VPS.md` описывает backend-only update. Поздний Worlds-heartbeat: [Launcher/master](docs_launcher_worlds.md).

Ниже source/release `launch_server.*` с другим bootstrap. Upstream-download не обязательно содержит local browser/Launcher-правки fork.

<a id="source-build-and-upstream-release-package-conventions"></a>

## Source-build/upstream-конвенции

Готовые пакеты:

**<https://github.com/skyrim-multiplayer/skymp/releases>**

<a id="windows-pre-built"></a>

### Windows: готовая сборка

1. Скачать `running_server_files_windows_server_dist.zip` последнего релиза.
2. Распаковать отдельно, например `C:\skymp-server`.
3. `launch_server.bat` при первом старте ставит Node.js через `winget`/npm-зависимости.
4. Настроить `server-settings.json`, [конфигурация](#configuration).
5. Открыть `http://localhost:8080/admin`, default `uiPort`.

<a id="linux-pre-built"></a>

### Linux: готовая сборка

1. Скачать `running_server_files_linux_server_dist.tar.gz`.
2. `tar -xzf running_server_files_linux_server_dist.tar.gz -C /opt/skymp`.
3. `./launch_server.sh` ставит Node через package-manager/npm-зависимости.
4. Настроить `server-settings.json`.
5. `http://localhost:8080/admin`.

<a id="required-skyrim-master-files-esm"></a>

### Обязательные Skyrim-master (`*.esm`)

В архивах намеренно **нет** Bethesda (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`).

Из своей легальной Skyrim скопировать в корень server-data, обычно `data/`; те же имена `loadOrder`.

- Windows: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Linux/Proton: `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

Пример server-структуры:

```text
data/Skyrim.esm
data/Update.esm
data/Dawnguard.esm
data/HearthFires.esm
data/Dragonborn.esm
```

<a id="updating-an-existing-installation"></a>

### Обновление существующей установки

Архив в корень пакета, затем helper, сохраняющий `data/`/`server-settings.json`:

**Windows:**
```powershell
.\update_server.ps1 -PackagePath C:\Downloads\running_server_files_windows_server_dist.zip
```

**Linux:**
```sh
./update_server.sh --package /path/to/running_server_files_linux_server_dist.tar.gz
```

`-StartAfter` Windows/`--start-after` Linux автоматически запускает после update.

Полный backup/update: [playbook](docs_server_update_playbook.md).

---

<a id="building-from-source-advanced--contributors"></a>

## Сборка исходников для разработчиков

См. [CMake](docs_cmake_workflow.md), [CONTRIBUTING.md](../CONTRIBUTING.md). Server `build/dist/server`, дополнительные starters `build/launch_server.bat`/`build/launch_server.sh`.

---

<a id="installation"></a>

## Установка

### Windows

64-bit Windows с поддержкой нужного Node. Текущие test-архивы требуют Node.js 22+. Локальный startup не подтверждает старые Windows.

Сервер 64-bit, нужна 64-bit Windows.

Весь проект собирается из исходников, server `build/dist/server`, запуск `launch_server.bat`, helper `build/launch_server.bat`.

Сборки распаковывать отдельно. Update `update_server.ps1` из корня с сохранением `data`/`server-settings.json`.

`update_server.ps1 -StartAfter` запускает package `launch_server.bat`, сохраняя restart-protection/runtime-bootstrap.

`launch_server.bat` проверяет старый `dist_back/skymp5-server.js`, автоматически завершает до нового старта.

Также ставит недостающий `node` через `winget` при возможности, runtime-пакеты при отсутствии `node_modules`.

### Linux

Для VPS см. [Linux: сборка/эксплуатация](docs_linux_vps.md): native-build, frontend-package, systemd для 12 vCores/24 GB RAM.

Linux поддерживает native-source builds; парные Ubuntu 26.04 x86_64/Windows x64 с browser-owner: [Linux VPS](docs_linux_vps.md).

После build `build/dist/server/launch_server.sh`, дополнительно `build/launch_server.sh`.

`update_server.sh --package /path/to/release.tar.gz` из корня резервирует/сохраняет `data`/`server-settings.json`.

`--start-after` использует package `launch_server.sh`, прежний bootstrap после замены.

`launch_server.sh` проверяет `node`, ставит package-manager, при отсутствии `node_modules` добавляет зависимости.

Client преимущественно Windows; Linux-server отдельно. Цель Ubuntu 26.04 x86_64, [native-report](docs_native_validation_2026_10_19.md) описывает среды/границы.

<a id="admin-dashboard"></a>

## Административная панель

`http://<host>:<uiPort>/admin`.

Owner-store `<dataDir>/admin-auth.json`, browser-пакеты создают PIN-wizard. Права/user/Discord через `adminUiUsers`, game-access отдельно [`joinAccess`](docs_server_configuration_reference.md#joinaccess).

### Admin-session API

| Endpoint | Поведение |
| --- | --- |
| `POST /api/admin/session/login` | JSON `{ "user": "owner", "password": "..." }`, cookie успеха, неверное 401 |
| `GET /api/admin/session` | `authenticated`, `user`, `idleTimeoutMs`, `remainingMs`; нет/expired 401 |
| `POST /api/admin/session/touch` | Продлевает после действия; expired 401 |
| `POST /api/admin/session/logout` | Удаляет server-session/cookie |

Cookie `skymp_admin_session` (`HttpOnly`, `SameSite=Lax`, `/`), **10 минут idle**. Dashboard шлёт interaction, фоновый polling не считается. Session-memory после restart требует login, owner-password хранится. Legacy-plaintext может мигрировать в scrypt; существующий owner setup не перезаписывает.

Proxy передаёт `Host`, `X-Forwarded-Proto`, cookies, использует внешний HTTPS-origin. `uiListenHost` bind, `adminApi.externalUrl` лишь URL. Optional admin-[Discord OAuth](docs_admin_discord_oauth.md) отдельно, password-test не доказывает callback.

r2 23 октября содержит process-manager `start-test-server.sh`/`start-test-server.bat`, aliases `launch_server.sh`/`launch_server.bat`: недостающий/старый Node, Stop/Restart без внешних команд. При stop остаётся owner-страница `/admin` со старым аккаунтом, не создаёт credentials. Private Node-22-LTS SHA-256, daily-update, старое при failure. Backend npm install не нужен. [Linux](docs_linux_vps.md), `README-TEST.md`.

Direct-backend обходит manager, требует внешний supervisor Stop/Restart. CMake-стартеры отдельно от r2. HTTP port/bind — restart всего starter. Control-POST требует session/same-origin JSON.

<a id="server-logs"></a>

## Серверные логи

Консоль и ротация `logs/` рядом с процессом.

- Имя `server-<ISO timestamp>.log`
- Старше 14 дней удаляются при старте
- Остаются максимум 30 новейших

При client movement-telemetry периодические `[MovementDebug]` JSON: `profileId`, интервал, extrapolation, correction-счётчики и т.д.

<a id="runtime-readiness-api-international-support"></a>

### Runtime Readiness API: международная поддержка

Диагностика новых установок:

- `GET /api/admin/runtime-readiness`

Языконезависимые `code`, `overall` (`ok`, `warn`, `error`) для автоматизации.

Проверяется, например:

- `launch_server.bat`/`launch_server.sh`
- `package.json`, `dist_back/skymp5-server.js`
- `node`/`npm`
- Bootstrap `node_modules`
- Корректный `release-info.json`

<a id="configuration"></a>

## Конфигурация

Default — локальный тест. Public зависит от `offlineMode`, master, identity, heartbeat. [Worlds](docs_launcher_worlds.md) описывает PHP-master, offline не регистрируется.

Для внешних игроков настроить bind/listen/firewall/router.

```json5
{
  dataDir: 'data',
  loadOrder: [
    'Skyrim.esm',
    'Update.esm',
    'Dawnguard.esm',
    'HearthFires.esm',
    'Dragonborn.esm',
  ],
  listenHost: '0.0.0.0',
  uiListenHost: '0.0.0.0',
  port: 7777,
  uiPort: 8080,
  name: 'My Server',
  adminApi: {
    enabled: true,
    externalUrl: '',
  },
  supervisor: {
    enabled: false,
    stopCommand: '',
    restartCommand: '',
  },
}
```

- Public-IP http://api.ipify.org.
- Порты уточнить у провайдера; проверка https://www.yougetsignal.com/tools/open-ports/. [Порты](docs_server_ports_usage.md), [config](docs_server_configuration_reference.md).
- `LogMeIn Hamachi`/аналоги: указать выданный IP, подключатся друзья виртуальной LAN, не остальные интернет-игроки.

<a id="ubuntu-2404-production-setup"></a>

## Production Ubuntu 24.04

Рекомендуется:

1. Собрать/поставить, например `/opt/skymp`.
2. [systemd template](../../../../misc/systemd/skymp.service).
3. Отдельный user `skymp`.
4. `systemctl enable --now skymp.service`.
5. Открыть game/admin в `ufw`/provider-firewall.

Пример supervisor-config dashboard:

```json5
{
  supervisor: {
    enabled: true,
    stopCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh stop',
    restartCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh restart',
  },
}
```

Helper [misc/systemd/skymp-supervisorctl.sh](../../../../misc/systemd/skymp-supervisorctl.sh). Обычно `sudoers` разрешает service-user `systemctl stop skymp.service`/`systemctl restart skymp.service` без пароля.

Nginx/proxy передаёт `Host`/`X-Forwarded-Proto` для верных внешних admin-URL.
