[Deutsch](../../de/docs/docs_deploy.md) · [English](../../en/docs/docs_deploy.md) · [Русский](docs_deploy.md)

<a id="deploy-server-from-github"></a>

# Развёртывание сервера из GitHub

Описан путь Docker/GitHub Actions, не локальные браузерные тестовые архивы и не PHP webroot. Проверено 22 октября 2026 года. Для них см. [VPS/браузер](docs_linux_vps.md), [SkyMP Worlds](docs_launcher_worlds.md), [статус](docs_project_status.md). Конфигурация workflow не доказывает успешное live-развёртывание.

GitHub Actions может разворачивать сервер из git-ветки. Здесь описана настройка.

<a id="github-prerequisites"></a>

## Требования GitHub

- Нужно владеть исходным репозиторием. Подойдёт fork [skyrim-multiplayer/skymp](https://github.com/skyrim-multiplayer/skymp).
- Настроить secrets (у нас https://github.com/skyrim-multiplayer/skymp/settings/secrets/actions):
  - `DEPLOY_TARGET_HOST`: IP/домен назначения.
  - `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`: частный SSH-ключ и ожидаемый fingerprint, подробнее ниже.
  - `DEPLOY_STATUS_WEBHOOK`: Discord webhook, см. https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks. **Не добавлять /github и подобное!**
- Добавить ветки в [`.github/workflows/deploy.yml`](../../../../.github/workflows/deploy.yml), установить `DEPLOY_TARGET_USER` в настроенного пользователя.
- PR для развёртывания должен исходить из ветки **главного репозитория, не fork**. \
  См. https://docs.github.com/en/actions/security-guides/encrypted-secrets:
  > **Примечание:** кроме `GITHUB_TOKEN`, secrets не передаются runner при запуске workflow из fork.

<a id="server-prerequisites"></a>

## Требования сервера

- Ubuntu 22.04; другие дистрибутивы должны работать, не проверены.
- Доступ из Интернета и открытые порты.
- Docker и пользователь группы `docker`. \
  **Примечание:** это фактически root-доступ. Осторожно выбирайте допуск к deployjob, то есть запись в репозиторий.
- Для каждой ветки создать `~/skymp-server-<branch>`, соответствующий варианту Deploy. Настройка ниже.

<a id="setup-access-for-github"></a>

### Доступ GitHub

Получить публичный ключ сервера:

```
ssh-keyscan <server ip>
<...>
# <server ip>:22 SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.2
<server ip> ecdsa-sha2-nistp256 AAAAE<...>
<...>
```

Скопировать строку с `ecdsa-sha2-nistp256` в `DEPLOY_SSH_KNOWN_HOSTS`.

Создать пару ключей и добавить авторизованный ключ:

```sh
ssh-keygen -b 4096 -C skymp_github_deployer -f gh_key
cat gh_key.pub >> ~/.ssh/authorized_keys
```

Содержимое `gh_key` без `.pub` — в `DEPLOY_SSH_PRIVATE_KEY`.

Для безопасности можно удалить частный ключ:

```
rm gh_key
```

<a id="setting-up-branch-on-a-server"></a>

## Настройка ветки на сервере

- Создать `mkdir -p ~/skymp-server-<branch>/server/data`, загрузить нужные данные.
- Создать `server-settings.json` в `skymp-server-<branch>`, не в `skymp-server-<branch>/server`, где он будет перезаписан.

Ожидаемое содержимое для успешного развёртывания:

```
$ ls -lhR skymp-server-<branch>/
skymp-server-<branch>/:
total 8.0K
drwxrwxr-x 3 ubuntu ubuntu 4.0K Dec  5 12:04 server
-rw-rw-r-- 1 ubuntu ubuntu  239 Dec  5 12:02 server-settings.json

skymp-server-<branch>/server:
total 4.0K
drwxrwxr-x 2 ubuntu ubuntu 4.0K Dec  5 12:01 data

skymp-server-<branch>/server/data:
total 346M
-rw-rw-r-- 1 ubuntu ubuntu  25M Dec  5 12:01 Dawnguard.esm
-rw-rw-r-- 1 ubuntu ubuntu  62M Dec  5 12:01 Dragonborn.esm
-rw-rw-r-- 1 ubuntu ubuntu 3.8M Dec  5 12:01 HearthFires.esm
-rw-rw-r-- 1 ubuntu ubuntu 239M Dec  5 12:01 Skyrim.esm
-rw-rw-r-- 1 ubuntu ubuntu  18M Dec  5 12:01 Update.esm
```

<a id="running-deploy"></a>

## Запуск развёртывания

Отдельный workflow [`.github/workflows/deploy.yml`](../../../../.github/workflows/deploy.yml) запускается из [Actions](https://github.com/skyrim-multiplayer/skymp/actions): https://github.com/skyrim-multiplayer/skymp/actions/workflows/deploy.yml

![](../../../img/run_deploy.png)

Прогресс — в списке запусков или Discord-канале `DEPLOY_STATUS_WEBHOOK`.

Доступные действия:

- `deploy` — объединить PR с `merge-to:<branch>`, собрать результат, загрузить артефакты, перезапустить.
- `restart` — остановить, если работает, затем запустить.
- `stop` — остановить.

<a id="debugging-crashes"></a>

## Диагностика сбоев

Самые полезные команды:

```sh
# To attach to the running server
docker exec -it -u 0:0 skymp-server-indev sh -c 'gdb -p "`pgrep node`" -ex c'

# To debug a crash (needs some configuration, see below for details)
ls -lh /var/crash
docker exec -it skymp-server-indev gdb /usr/bin/node /var/crash/...
```

Развёрнутый сервер может упасть; важно подготовить диагностику.

Требования:

1. `scam_native.node` нужен с debug-символами. Наш [CI](https://github.com/skyrim-multiplayer/skymp/blob/688c5dfeabffd6510d759d5a128349de8898743c/.github/workflows/pr-ubuntu-docker.yml#L10) включает их; при своей сборке явно задать `-DCMAKE_BUILD_TYPE=Debug` или `RelWithDebInfo`.
2. Установить `gdb` в среде сервера. В контейнере включить его в image: отладка контейнерного процесса с host ненадёжна.
3. Разрешить `ptrace` в контейнере: `--cap-add=SYS_PTRACE` в `docker run`.

Подключиться к серверу:

```
$ docker exec -it -u 0:0 skymp-server-indev sh -c 'gdb -p "`pgrep node`" -ex c'
<...>
Continuing.
```

gdb несколько секунд загружает данные, сервер стоит на паузе. Обычно затем ждёт ввода; здесь `-ex c` сразу продолжает, уменьшая паузу. Ctrl+C снова ставит паузу и открывает prompt. Не держите рабочий сервер долго остановленным.

Теперь доступны обычные команды gdb: breakpoints или `c` для продолжения.

<a id="collecting-core-dumps"></a>

### Сбор core dump

Нужно и для сбоев без подключённого `gdb`; настоятельно рекомендуется настроить.

1. Настроить dumps на host, даже при контейнере.
   1. `ulimit -c` должен показывать `unlimited` или хотя бы 500–1000 МБ.
   2. Можно задать `sysctl kernel.core_pattern` как путь файловой системы. Лучше без `|`: это осложняет Docker и требует настройки принимающей программы, например apport. \
      Рекомендуется:
      - `sudo sysctl kernel.core_pattern=/var/crash/core-%P-%u-%g-%s-%t-%c-%h`
      - Добавить `kernel.core_pattern=/var/crash/core-%P-%u-%g-%s-%t-%c-%h` в `/etc/sysctl.cfg` для сохранения после перезапуска.
2. В контейнере смонтировать `/var/crash` как volume, иначе dumps останутся только внутри.

Как проверить:

1. Получить PID сервера, например:
   ```
   $ ps aux | grep 'node dist_back' | grep -v grep
   ubuntu   1532646  5.8  3.7 35411280 609416 ?     SLl  Jan28   2:21 node dist_back/skymp5-server.js
            ^~~~~~~ PID you're looking for
   ```
2. Принудительно завершить через `SIGABRT`:
   ```
   $ kill -QUIT 1532646
   ```
3. `docker logs <container name>` должен содержать:
   ```
   ./run.sh: line 8:     7 Quit                    (core dumped) LD_LIBRARY_PATH="$PWD" node dist_back/skymp5-server.js
   ```
4. Dump должен появиться в `/var/crash`:
   ```
   $ ls -lh /var/crash
   total 204M
   -rw------- 1 ubuntu ubuntu 326M Jan 29 00:33 core-1532646-1000-1000-3-<...>
                                          ^~~~~      ^~~~~~~
                                   Current time      Server's PID when it crashed
   ```

Отладка dump:

1. Войти в существующий контейнер или аналогично настроенный новый и запустить `docker exec -it skymp-server-indev gdb /usr/bin/node /var/crash/...`.
2. `bt` показывает стек.
3. Исследовать ошибку.
