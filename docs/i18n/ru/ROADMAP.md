<a id="roadmap"></a>
# Дорожная карта

[Deutsch](../de/ROADMAP.md) · [English](../en/ROADMAP.md) · [Русский](ROADMAP.md)

Проверка статуса: **22 октября 2026**. [Текущее состояние проекта](../../docs_project_status.md) разделяет реализацию, локальные доказательства и оставшуюся приёмку. Browser-setup, синхронизация модов Launcher, версионированные client-пакеты реализованы; настоящая Skyrim/CEF-игра и live-rollout открыты.

Добро пожаловать в дорожную карту! Здесь перечислены синхронизации; позже возможны задачи вне синхронизации и даже вне кода.

<a id="build--release-automation"></a>
Обновление от **31 октября 2026 года**: [завершение сессии](docs/docs_session_end.md) (кик, бан, перезапуск, потеря соединения) и [защита консоли](docs/docs_console_security.md) реализованы и покрыты тестами исходного кода. Приёмка в настоящем Skyrim/CEF ещё не проведена.

# Автоматизация сборок и релизов

| Область | Статус | Примечания |
| --- | --- | --- |
| PR-build Windows/VR/Emscripten | Активно | PR-workflow использует общую .github/actions/pr_base/action.yml. |
| Семантические версии сервера | Активно | `.github/workflows/running_server_files.yml` выводит версию из commits (`fix`/`feat`/`major`/`breaking`/`!`). |
| Условия релиза/changelog | Активно | Без trigger-commit релиз пропускается; notes всё равно содержат группированный журнал с последнего тега. |
| Deployment-уведомления | Активно | Статусы Discord через secret DEPLOY_STATUS_WEBHOOK. |
| Постоянный Discord-монитор игры | Реализовано | Bot принадлежит r4-dashboard; lifecycle, login-log, warnings, ban-role IPC реализованы. Имитационные integration-тесты проверяют непрерывность процесса, настоящая доставка открыта. `docs/docs_discord_bot.md`. |
| Запуск installer | Активно | Push main вызывает repository_dispatch в installer-репозитории через .github/workflows/trigger-installer.yml. |
| Ручной запуск installer | Активно | Есть `workflow_dispatch` из GitHub Actions UI. |
| Целевой installer-repo | Настраивается | Repository-variable INSTALLER_REPOSITORY, формат owner/repo. |
| Формат installer-артефакта | Внешнее | Installer создаётся workflow своего репозитория, не здесь. |

<a id="admin--server-operations"></a>
# Администрирование и серверная эксплуатация

| Область | Статус | Примечания |
| --- | --- | --- |
| Dedicated-server Windows/Linux | Тестовые пакеты проверены | Оба native-пакета прошли browser-setup, HTTP/admin-login, UDP, публикацию модов. Production/load-приёмка и прежний сбой Windows native-suite открыты. |
| Сборка Linux-server из исходников | Активно | Есть builds/start-scripts/CI. Сильнее всего Ubuntu/glibc; стандартному VPS-production нужна дальнейшая доработка. |
| Windows-server | Активно | Поддерживается с native-launcher и существующими процедурами. |
| Общая supervisor-интеграция | Частично | Есть общая `supervisor`-конфигурация. Admin-stop/restart лишь при явных командах. Открыты OS-настройка и optional auto-detection. |
| Production-пакеты/документация | Частично | Есть systemd/production-примечания для Ubuntu 24.04; равноценные Windows-service-шаблоны/runbooks ещё нужны. |
| Dashboard auth-routing | Активно | `/admin` даёт React-UI с login/timeout; `/admin/` нормализуется, `/admin-app` перенаправляется. |
| Dashboard auth-UX | Активно | Вместо Basic-popup своё login-окно (`/api/admin/session/login`, `/logout`, `/touch`), idle 10 минут по кликам панели. |
| Безопасный restart Windows-launcher | Активно | `launch_server.bat` находит/завершает старые `dist_back/skymp5-server.js` перед запуском. |
| Runtime-bootstrap пакетных launcher | Активно | r2 устанавливает отсутствующий/старый Node приватно с SHA-256, сохраняет при update-failure, проверяет native-требования. Backend уже включает npm-зависимости. |
| Admin-resource-инвентарь | Активно | `GET /api/admin/resources` показывает Skyrim-ресурсы диска/loadOrder (`.esm`, `.pex`). |
| API настроек | Активно | `GET/POST /api/admin/cfg/server-settings` загружает/сохраняет CFG. |
| Проверка Access/Discord | Активно | Структурная форма проверяет обязательные поля/формат Discord-ID. |
| Locale-routing | Активно | `localeRouting.defaultLanguage`, `countryCodeToLanguage` в `server-settings.json`. |
| Чистые locale-defaults | Активно | Генерируются `cmake/scripts/generate_server_settings.cmake`. |
| Определение языка | Активно | `GET /api/admin/locale/resolve?countryCode=XX` разрешает настроенный fallback. |
| NPC-parser/фильтры | Активно | Исправлен `npcSettings.default`; `allowHumanoid`/`allowCreature` разрешают пустые города с wildlife/monster-spawn. |
| Подбор мировых предметов | Активно | `itemPickupMode`: `allow`, `minigame`, `block-all`. В `minigame` вызывается `mp.onItemPickupAttempt(...)` для своих правил/кражи. |
| Загрузка предметов | Активно | `itemsEnabled` выключает instantiation. `itemLoadFilter` (`skipOwned`/`skipUnowned`) отдельно подавляет магазинные/NPC-предметы, свободную добычу или оба. |
| Плагины | Активно | TS/JS из `Plugins/` при старте; discovery `pluginDiscovery.mode` (`safe`/`prompt`), порядок `pluginsLoadOrder`, строгость `abortOnPluginError`. |
| Sidebar: kick-all/announcement | Активно | `POST /api/admin/players/kick-all`, `POST /api/admin/announcement` в `skymp5-server/ts/ui.ts`. Announcement — Skyrim-HUD-toast CustomPacket: тёмный металл, золото, появление сверху. Кнопки работают. |
| Announcement-toast | Активно | Client-HUD с fade-in/настраиваемым скрытием. `announcementToast`, CSS через browser-API SkyrimPlatform. |
| Имена персонажей | Активно | `showCharacterNicknames` управляет именами над actor через `createText`. CFG General; broadcast при connect; F1 блокируется явной серверной настройкой. |
| Передача зон через loading-screen | Предложено | План transfer/worker-routing/optional overflow-sharding в `docs/docs_zone_handover_roadmap.md`, общая MMORPG-среда по умолчанию сохраняется. |
| Sidebar: start/stop/restart | Активно | r3 держит весь dashboard отдельно: config/log/download/session/WebSocket переживают stop/restart/crash игры. Меняется лишь своя game-PID; Start доступен при stop. Player-actions требуют игру. Прямой backend сохраняет внешние supervisors. |

<a id="synchronization"></a>
# Синхронизация

| Функция | Статус / задача |
| --- | --- |
| **ГОТОВО:** | **Полностью реализовано и хорошо проверено, почти идеальная синхронизация.** |
| _Внешность_ | Готово |
| _Атрибуты: здоровье, магия, выносливость_ | Готово |
| _Смерть_ | Готово |
| _Инвентарь_ | Готово |
| _Кузнечное изготовление_ | Готово |
| _Своя respawn-логика_ | `canRespawn` отключает auto-respawn для целителей/врачей. |
| _Точка появления_ | `startSpawn` задаёт spawn новичка в server-settings.json. |
| _Начальный инвентарь_ | `starterInventory` с полными entry (baseId/count/зачарования и т.д.). |
| _Изучение эффектов_ | Сервер сохраняет знания ингредиентов в `private.learnedIngredientEffects`, возвращает при reconnect. При закрытии inventory/favorites клиент проверяет `Ingredient.getIsNthEffectKnown`, восстанавливает через `learnEffect`. |
| _Маркеры_ | Открытые места хранятся в `private.discoveredMarkers`, восстанавливаются. C++-`locationDiscovery` дополнен `markerFormId`, добавлен `showMapMarker`. |
| _Изучение зачарований_ | `private.knownEnchantments`, восстановление `setPlayerKnows(true)`. Client кеширует ID через `Weapon/Armor.getEnchantment()`, при закрытии 'Crafting Menu' проверяет `playerKnows()` и отправляет новое знание. |
| _Улучшение_ | Grindstone/armor-table авторитетны в CraftService: расход материалов, повышение entry `health`, сохранение ExtraData/зачарования/имени. |
| _Погода_ | `WeatherSystem`: gamemode посылает `setWeather`/`clearWeather`, сервер раздаёт `syncWeather`/`clearWeather`, возвращает при reconnect. Client `Weather.setActive()`/`Weather.releaseOverride()`. |
| _Время_ | `TimeSystem`: UTC-anchor и `timeScale` при connect, client интерполирует часы по `serverAnchor`. Default 20 как Skyrim; см. `docs_server_configuration_reference.md`. |
| **ЧАСТИЧНО:** | **Реализованное, которое планируется улучшить/исправить.** |
| _Движение_ | Lag-compensation, скорость ходьбы/детали; спросить помощь ST. |
| _Создание персонажа_ | Серверная validation. |
| _Animation-events_ | Убрать задержки очереди на следующие frame; отключать коллизию мебели/стульев; спросить ST. |
| _Урон_ | Убрать неверную проверку дальности выстрела; синхронизировать кровь/звук. |
| _Контейнеры_ | Неверное «пусто», opening-animation/звук всем. Возможно новая serialization-API как ST, также база инвентаря. Два+ игрока должны одновременно забирать добычу. |
| _Экипировка_ | Содержимое рук должно сохраняться после server-restart. |
| _Подбор предметов_ | Учитывать ExtraData (зачарование/яд и т.д., без выбрасывания таких items пока невозможно). Оригинальное «Добавлено…», синхронный звук; активация книги открывает чтение, не сразу кладёт её в инвентарь. |
| _Подбор ингредиентов_ | Оригинальные сообщение/звук синхронны, без мигания/движения. |
| _Факелы_ | Поджигать игрока факелом/синхронизировать; удалять факел через серверное время. Сейчас как стрелы бесконечны. |
| _Скрипты_ | Сохранять переменные, исследовать/документировать отличия событий от Skyrim. |
| _Консольные команды_ | Частично: admin-dispatcher с aliases/capabilities (`help`, `players`, `kick`, `kick-all`, `ban`, `unban`, `mute`, `unmute`, `warn`, `message`, `announce`, `js`), admin-only JS-fallback. Открыты vanilla syntax/output, stdin-bridge/selectors, представление player-ID клиента. |
| _Избранное_ | `private.favorites` хранит ID, возвращает client-state при reconnect. Полное применение ждёт setter: `Game.isObjectFavorited` лишь читает. |
| _ActorValues_ | Поддерживаются `health/magicka/stamina`, `healRate/magickaRate/staminaRate`, `*RateMult` через Papyrus `SetActorValue`/`mp.set(..., 'actorValues', ...)`. Расширять сервер/клиент сквозным образом. |
| **ЗАПЛАНИРОВАНО:** | **Будущие функции — нас ждёт большое путешествие!** |
| _Анимации от противника_ | Обычно PvP: stagger, случайное уклонение, реакция на sprint-collision. |
| _Leveled-предметы_ | В CK начинаются Dummy, например RandomPotion. Текущая обработка сервером неясна. |
| _Компас вкл/выкл_ | Сервер скрывает/показывает игроку. Native-API нет; возможно `Ui.setBool('HUD Menu', '_root.HUDMovieBaseInstance.CompassShoutMeterHolder._visible', false)`. Scaleform-путь недокументирован, проверить game-SWF. Server-custom-packet, client `Ui.setBool`/`Ui.setFloat`. |
| _Подсказка взаимодействия с игроком_ | `blockActivation(true)` в `movementApply.ts` намеренно скрывает «Активировать [E]» remote-игрока. Серверный «Поговорить с [Name] [E]» требует условной блокировки; простая разблокировка допускает лишние player-activation. Возможно отдельный prompt-only механизм. После реализации переключать dashboard. |
| _Выбрасывание_ | Сначала без физики создать у ног; после физики как в оригинале. |
| _Физика_ | Пинать предметы, movable-static, некоторые контейнеры (Синий дворец); нужен host-switch. |
| _Перетаскивание предметов_ | Как в оригинале. |
| _Подземелья_ | Ловушки/головоломки проверить/исправить, всё как в оригинале, state на сервере. |
| _Алхимия_ | Создание зелий. |
| _Зачарование_ | Зачаровывать/переименовывать, заполненный игроком soul-gem либо editor-gem без ExtraData. |
| _Заряд_ | Заряжать оружие/посохи камнями душ, сохранять заряд. |
| _Взлом_ | Двери/сундуки, уровень из game-data, ключи. Бонус: положение отмычки между попытками не менять, звуки синхронизировать. |
| _Навыки_ | Отключить оригинальные формулы роста, добавить прокачку существующих синхронизаций, например боя. Новая синхронизация учитывает связанный навык. |
| _Перки/уровень_ | Прирост health/magicka/stamina работает/сохраняется; выбранные perks сохраняются, далее постепенно реализуются. |
| _Блокирование_ | Отражению атак могут понадобиться Reverse Animation Events. |
| _Стрельба_ | Возможно мод вертикального угла взгляда. Стрела с правильной скоростью/источником; позже можно подобрать, сначала необязательно. Возможно синхронизировать застрявшие стрелы. Сервер списывает одну на выстрел. |
| _Карманные кражи_ | |
| _NPC_ | Проверить host-switch, бой/активацию/экипировку; server-render NPC-template и client-применение. Корректный spawn/поведение по packages, позже путешествие вне видимости игроков. |
| _Добыча_ | Обыскивать мёртвых NPC/игроков. |
| _Физика/перетаскивание трупов_ | |
| _Диалоги_ | Случайные реплики NPC/бандитов, quest-диалоги; из-за ST, вероятно, не приоритет. |
| _Лошади_ | Всегда host своей лошади, доступен бой; mounted-shooting отдельно. |
| _Квесты_ | Serialization/deserialization состояния либо нужные слова в UI; из-за ST не приоритет. |
| _Драконы_ | Авторитетные сущности/repl, flight-physics (высота/обход), combat-AI (цели/заклинания), shout-sync, поглощение души после смерти. Решение C++-core или TS-plugin открыто. Plugin-Health следит за числом, последним боем, sim-load; расширения plugins. |
| _Крики_ | Экипировать/использовать, учить слова, ограничивать, кто Довакин. Постепенно тестировать новые. |
| _Магические эффекты_ | Сервер накладывает эффект; зелье применяет его вместо мгновенной смены health. Shader при эффекте, также поздним наблюдателям. Реализовать популярные attack/heal-архетипы. |
| _Заклинания_ | TODO: описать синхронизацию. |
| _Ожидание_ | Сон/ожидание при согласии всех игроков. |
| _Статика_ | Сервер «видит» лениво, не портит БД лишними записями; полностью сбрасывать state, двигать SetPosition и т.д. |
| _Звук/музыка_ | Синхронизировать музыку ячеек/боя (сейчас и PvP). Death-music накладывается на другую. Server должен играть звук в точке, возможно SpSnippet. Определить действия с синхронным звуком. |
| _Lipsync_ | Частично: VAD, server-relay, client dialogue-idle-попытка. YACA не подключает optional callback автоматически. Actor-mapping, единицы, lifecycle/reset открыты, настоящей Skyrim/TeamSpeak-приёмки нет. [Статус/нужные сведения](docs/docs_voice_lipsync_status.md). |
| _Linked Refs_ | По памяти связь передаёт активацию, важно для dungeon-рычага/двери. |
| _Создание посохов_ | |
| _Игровые расы монстров_ | Заменять игрока любым NPC, животным/монстром. |
| _Ликантропия_ | |
| _Вампиризм_ | Perks/дополнения/заклинания DLC; личное примечание автора оригинала: не совсем понимаю смысл всего этого :) |

<a id="partially---delivery-backlog-proposed"></a>
# От «частично» к поставке: предлагаемый backlog

Пункты `PARTIALLY` разбиты на планируемые tickets с объёмом, приёмкой, оценкой и зависимостями.

<a id="sprint-1-p0-stability--visible-ux"></a>
## Sprint 1: P0 стабильность и видимый UX

| ID | Пункт | Реализация | Приёмка | Оценка | Зависимости |
| --- | --- | --- | --- | --- | --- |
| SYNC-CC-001 | Создание персонажа | Server-validation name/race/preset/slider/обязательных полей create/update. | Неверное отклонено стабильными кодами, верное сохранено; malformed/overflow/range-негативные тесты. | 2–3 дня | Нет |
| SYNC-EQ-001 | Экипировка | Состояние рук переживает restart/reconnect. | Local/remote видят правильные items, без дублей/расхождений после inventory-reapply. | 2–4 дня | Inventory-persistence |
| SYNC-DMG-001 | Урон | Убрать неверную дальность, связать damage/blood/sound с одним authoritative-hit. | Без ложных промахов; observers видят синхронную кровь/звук; near/far/hitscan-тесты. | 2–3 дня | Hit-processing/broadcast |
| SYNC-PICK-001 | Ингредиенты | Vanilla-message/sound, убрать blink/move. | Правильный текст, звук соседям, без blink/teleport в multi-client. | 1–2 дня | Pickup-events |
| OPS-SUP-001 | Supervisor | Admin-preflight start/stop/restart, понятная помощь. | UI блокирует неподдерживаемое с причиной; машиночитаемый ответ; failed-preflight не выполняет команду. | 1–2 дня | Supervisor-config |

<a id="sprint-2-p1-operations--shared-interactions"></a>
## Sprint 2: P1 эксплуатация и общие взаимодействия

| ID | Пункт | Реализация | Приёмка | Оценка | Зависимости |
| --- | --- | --- | --- | --- | --- |
| SYNC-CONT-001 | Контейнеры, A | Open/close-animation/sound всем observers. | Два клиента получают согласованное время, activate-spam без duplicate-packet. | 2–4 дня | Container-activation |
| OPS-WIN-001 | Production/docs | Windows-service/runbook как Ubuntu. | Проверяемый чистый host, install/update/restart/rollback/log-path/troubleshooting. | 1–2 дня | Ubuntu-docs |
| ADM-SRV-001 | Sidebar-server UX | Wizard/checklist supervisor-команд и runtime-validation. | Статус настройки, проверка до включения, способы исправить все ошибки. | 2–3 дня | OPS-SUP-001 |
| SYS-CMD-001 | Console MVP | Важные команды с permission-tiers/audit. | 10–15 команд, близкая vanilla-syntax/output где разумно, роли, аудит каждого выполнения. | 4–6 дней | Auth/roles |
| DOC-SCR-001 | Скрипты | Различия events/vanilla, матрица persistence. | Документ parity/rules, автоматический либо scripted-тест каждого важного event. | 2–3 дня | Script-hooks |

<a id="deferred-but-prepared-p2"></a>
## Отложено, но подготовлено: P2+

| ID | Пункт | Реализация | Приёмка | Оценка | Зависимости |
| --- | --- | --- | --- | --- | --- |
| SYNC-MOV-001 | Движение | Lag-compensation/reconciliation движения/выстрелов. | Меньше desync при latency, correction-rate/rollback-метрики. | 1–2 недели | Movement/damage metrics |
| SYNC-ANIM-001 | Анимации | Убрать queue-delay, переходы furniture-collision. | Детерминированный порядок под нагрузкой, нет аномалий стульев. | 1 неделя | Queue-refactor |
| SYNC-CONT-002 | Контейнеры | Concurrent-loot с server-версиями/conflicts. | Два+ игрока безопасно, без потери/дублирования state. | 1–2 недели | SYNC-CONT-001, state-API |
| SYNC-AV-001 | ActorValues | Волнами, боевые первыми, end-to-end parity. | Новые разрешённые AV читаются/меняются/repl в игре; тесты каждой волны. | 1–2 недели | Mapping/tests |
| SYNC-FAV-001 | Избранное | Persistence оставить, полный reapply после setter. | Reconnect возвращает в игре, не только cache; до этого стабильный fallback. | Заблокировано | SkyrimPlatform setter |

<a id="suggested-initial-command-set-for-sys-cmd-001"></a>
## Предлагаемые первые команды SYS-CMD-001

`help`, `players`, `tp`, `tgm` (ограничено), `tcl` (ограничено), `setav`, `modav`, `heal`, `kill`, `resurrect`, `time`, `weather`, `announce`, `kick`, `ban`.

<a id="notes"></a>
## Примечания

- Полное избранное ждёт setter SkyrimPlatform; `Game.isObjectFavorited` есть лишь для чтения.
- Оценки широкие до завершения первых 1–2 tickets/калибровки скорости команды.

<a id="repository-audit---action-backlog-proposed"></a>
# Аудит репозитория: предлагаемый backlog действий

Основан на проверке runtime-stub/dummy и недокументированных реализованных возможностей.

<a id="bucket-a-blockers--safety-net-p0"></a>
## Группа A: блокеры/страховка, P0

| ID | Тип | Объём | Почему | Код | Приёмка |
| --- | --- | --- | --- | --- | --- |
| AUD-BLK-001 — Открыто | Удалить runtime-stub | Papyrus-cell-stub заменить реализацией/явным безопасным отказом. | Скрытые расхождения игровой логики. | `skymp5-server/cpp/server_guest_lib/script_classes/PapyrusCell.cpp` | Нет безусловного `// stub` return, native unit/integration-тест. |
| AUD-BLK-002 — Открыто | Полнота property-binding | Реализовать `mp.get/mp.set` либо capability-gate. | Жёсткий `not implemented` неожиданно ломает production. | `skymp5-server/cpp/addon/property_bindings/PropertyBinding.cpp`, `skymp5-server/cpp/addon/property_bindings/PosBinding.cpp`, `skymp5-server/cpp/addon/property_bindings/AngleBinding.cpp` | Неподдерживаемое — стабильная API-ошибка, поддерживаемое end-to-end тестируется. |
| AUD-BLK-003 — Открыто | WorldState-assert | Заменить `assert(false)` явной обработкой/fallback. | Реальный traffic/data может завершить процесс. | `skymp5-server/cpp/server_guest_lib/WorldState.cpp` | Нет безусловного assert в доступном пользователю пути, ошибка логируется/нефатальна. |
| AUD-BLK-004 — Открыто | Deferred-load | Загружать dead/disabled refs либо явный документированный флаг отключения. | Иначе state мира расходится после restart/load. | `skymp5-server/cpp/server_guest_lib/WorldState.cpp` | Детерминированное описанное поведение, regression dead/disabled. |

<a id="bucket-b-production-risk--technical-debt-in-live-paths-p1"></a>
## Группа B: production-risk/техдолг, P1

| ID | Тип | Объём | Почему | Код | Приёмка |
| --- | --- | --- | --- | --- | --- |
| AUD-RSK-001 — Открыто | Login-flow | Временный login-hack заменить явным тестируемым потоком. | Критический auth сам помечен hack. | `skymp5-server/ts/systems/login.ts` | Hack-путь удалён, success/fail/edge автоматически проверены. |
| AUD-RSK-002 — Открыто | ObjectReference-policy | Фиксированные script-filter hacks заменить server-config. | Скрытое поведение/хрупкая mod-совместимость. | `skymp5-server/cpp/server_guest_lib/MpObjectReference.cpp` | Settings/API/doc, обратно совместимый default. |
| AUD-RSK-003 — Открыто | Client-legacy | Удалить movement-hack при enforcement минимальной версии. | Fallback усложняет sync/debug, прячет ошибки протокола. | `skymp5-client/src/sync/movementApply.ts` | Versioned-gate, legacy удалён либо feature-flag. |
| AUD-RSK-004 — Открыто | Неисполненные events | Исправить handler с `Not implemented`. | Непоследовательный runtime. | `skymp5-server/cpp/server_guest_lib/gamemode_events/UpdateAppearanceAttemptEvent.cpp`, `skymp5-server/cpp/server_guest_lib/gamemode_events/UpdateEquipmentAttemptEvent.cpp` | Реализация либо явно отключено с понятной диагностикой. |

<a id="bucket-c-documentation--roadmap-gaps-p1"></a>
## Группа C: пробелы документации, P1

| ID | Тип | Объём | Почему | Код | Приёмка |
| --- | --- | --- | --- | --- | --- |
| AUD-DOC-001 — Готово | Config-parity | joinAccess-моды, identifier-массивы, примеры/отказы описаны. | Реализовано, но оператору трудно найти. | `skymp5-server/ts/systems/login.ts`, `skymp5-server/ts/ui.ts`, `cmake/scripts/generate_server_settings.cmake` | Полная схема/примеры/ошибки в `docs/docs_server_configuration_reference.md`. |
| AUD-DOC-002 — Готово | Discord-settings | Поля discordBot, dashboard, отличие discordAuth.guilds, startup/limits. | Активным настройкам нужна инструкция. | `skymp5-server/ts/ui.ts`, `cmake/scripts/generate_server_settings.cmake` | Required/optional/security/UI-mapping. |
| AUD-DOC-003 — Готово | Nickname-toggle | Default, CFG-broadcast, приоритет showCharacterNicknames. | Не было главной config-reference. | `skymp5-server/ts/index.ts`, `skymp5-server/ts/ui.ts` | Семантика/default/client-последствия. |
| AUD-DOC-004 — Готово | Admin-session | login/logout/session/touch, HttpOnly, idle 10 минут, restart. | Улучшает self-host/reverse-proxy/support. | `skymp5-server/ts/ui.ts` | Инструкция `/api/admin/session/login`, `/logout`, `/touch`, cookies/timeout. |

<a id="suggested-execution-order"></a>
## Рекомендуемый порядок

1. `AUD-BLK-003`, `AUD-BLK-002`, `AUD-BLK-001`, `AUD-BLK-004`
2. `AUD-RSK-001`, `AUD-RSK-002`, `AUD-RSK-004`, `AUD-RSK-003`
3. `AUD-DOC-001`–`AUD-DOC-004` завершены 22 октября; поддерживать при изменениях.

<a id="notes-1"></a>
## Примечания

- Сначала runtime-risk, затем стабильность/поддержка, затем понятность оператору.
- По возможности один ticket на PR для простого rollback.

<a id="mods--plugins-completion-backlog-proposed"></a>
# Завершение поддержки модов/плагинов: предлагаемый backlog

Цель — полный end-to-end опыт оператора/клиента поверх текущей рабочей базы.

<a id="p0---hardening-current-plugin-runtime"></a>
## P0: укрепление текущего plugin-runtime

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| MODPLUG-001 — Открыто | Process-plugin policy | Явный allowlist команд, optional cwd-guard, env-scrub. | Произвольные host-команды опасны production. | Неразрешённые — явная startup-error, описание. |
| MODPLUG-002 — Открыто | Health/crash-lifecycle | `starting/running/failed/stopped`, restart `never/on-failure`. | Одних logs мало. | Admin-state, видимые проверенные failure-переходы. |
| MODPLUG-003 — Открыто | Discovery-integrity | Проверять/чинить `Plugins/.discovery-state.json` при boot. | Повреждение блокирует/меняет порядок. | Детерминированный repair/warning без скрытых изменений activation. |

<a id="p1---mod-distribution-end-to-end-server---client"></a>
## P1: доставка модов сервер → клиент

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| MODPLUG-004 — Готово (Launcher preparation) | Manifest-sync | Standalone-Launcher читает v2, проверяет path/size/SHA-256, кеширует/ставит до SKSE; v1 fallback. | Реализовано skymp-client-launcher/launcher/src-tauri/src/connection.rs, запуск игры отдельно. | Preparation/cache/repair/update/restore успешны, world-entry открыт. |
| MODPLUG-005 — Частично | Resume/retry | Полные verified-cache используются, сервер даёт Range; partial-resume/config-retry/backoff открыты. | Большие моды/нестабильная сеть. | Восстановление без corrupt-cache, настраиваемый max-retry. |
| MODPLUG-006 — Частично | Versioned-cache | Server/resource-hash namespace есть, eviction/disk-limits открыты. | Без stale/cross-server загрязнения. | Детерминированные hit/miss, удалять старое без вреда валидному. |

<a id="p1---dependency--load-order-guarantees"></a>
## P1: зависимости/порядок

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| MODPLUG-007 — Открыто | Resource metadata | Зависимости/optional constraints в manifest. | Предсказуемая mod/script-загрузка. | `dependsOn`/`version`, понятный resolver-error. |
| MODPLUG-008 — Открыто | Client-resolver | Топологический порядок по metadata. | Одного hash-sync недостаточно. | Детерминированный порядок либо явная исправимая ошибка. |
| MODPLUG-009 — Открыто | Plugin-dependencies | `dependsOn`, version-bounds в `plugin.json`. | Ручной порядок/drift ломают boot. | Точный отказ несовместимому graph, стабильный совместимый старт. |

<a id="p2---operator-ux-and-observability"></a>
## P2: UX оператора/наблюдаемость

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| MODPLUG-010 — Частично | Resource-panel | Инвентарь есть; publication-diagnostics/hash-comparison/missing-corrupt-UX открыты. | Меньше SSH/logs. | Статус ресурса, one-click refresh, ошибки. |
| MODPLUG-011 — Открыто | Control-API | Enable/disable/restart с capability/audit. | Без ручных файлов/restarts. | Разрешения/аудит/live-state. |
| MODPLUG-012 — Открыто | Distribution telemetry | Manifest-latency, download success/fail, bytes, cache-ratio. | Настройка rollout/ранние регрессии. | Прежняя telemetry/admin/Prometheus. |

<a id="recommended-rollout-order"></a>
## Порядок rollout

1. `MODPLUG-001`, `MODPLUG-002`, `MODPLUG-003`
2. `MODPLUG-004`, `MODPLUG-006`, `MODPLUG-005`
3. `MODPLUG-007`, `MODPLUG-008`, `MODPLUG-009`
4. `MODPLUG-010`, `MODPLUG-011`, `MODPLUG-012`

<a id="mapping-to-existing-roadmap-docs"></a>
## Связь с существующей roadmap

- Resource API: `docs/docs_resource_auto_download.md`
- Phase 2/3: `ROADMAP_FIVEM_IDEAS.md`
- Plugin-runtime база: `README-plugins.md`

<a id="voice--proximity-chat-sync-backlog-proposed"></a>
# Backlog синхронизации голоса/пространственного чата

План интеграции voice-activity detection (VAD) и анимации губ. Архитектура **независима от провайдера**: YACA-TS, Discord, Mumble, собственный 3D-VoIP и др. реализуют стандартный Voice Activity API.

**Аудит исходников 27.10.2026:** end-to-end остаётся частичным. У локального YACA есть optional-callback, но standard-entry не соединяет его с анимацией. Блокеры, недостающие сведения и приёмка вдвоём: [Lipsync status](docs/docs_voice_lipsync_status.md). Таблицы описывают цели, не результаты игровой приёмки.

<a id="context"></a>
## Контекст

- **Провайдеры:** возможны YACA TeamSpeak, Discord-bots, self-hosted VoIP и др.
- **Общий контракт:** единый VAD-интерфейс для серверного приёма.
- **Клиент:** `VoiceActivitySyncService` принимает `syncVoiceActivity`, вызывает animation-handler. Новая YACA-bridge — CEF/`_yacaClient`, optional-callback ещё подключить; Papyrus-quest в её транспорт не входит.
- **Сервер:** Voice Activity Manager скрывает различия провайдеров, сообщает соседним клиентам «игрок X говорит».
- **Попытка анимации:** `playIdle(0x0005B1B0)`, в коде IdleDialogueLock. Настоящее движение рта/reset требуют игры; расширенного animation-pool нет.

<a id="voice-activity-api-specification-design-first"></a>
## Спецификация Voice Activity API: сначала контракт

До реализации определить:

| Компонент | Интерфейс | Примечания |
| --- | --- | --- |
| **Server Voice Activity Manager** | `IVoiceProviderAdapter.onVoiceActivityUpdate(callback)` передаёт `VoiceActivityState` менеджеру. | Существующий adapter-callback. Registry хранит один latest-state на actor; merge/conflict-resolution пока цель. |
| **Server→Client** | CustomPacket `syncVoiceActivity(actorId, isSpeaking, voiceRange)` | Анимация по состоянию, не по провайдеру. |
| **Client adapter** | Script/plugin принимает пакет, применяет state/animation/effects; специфическая связка. | YACA `onVoiceActivity` подключить полностью; другим нужны реальные speaking-events. |
| **Provider identity** | Optional `providerId`, например "yaca-ts", "discord-bot", "custom-voip". | Диагностика источника update. |
| **Модель дальности** | Ступени 1.0, 3.0, 8.0, 15.0, 20.0, 25.0, 30.0, 40.0 м либо 0–100 м непрерывно. | Выбор оператора, enforcement сервера. |

---

<a id="p0---voice-activity-api--core-lipsync"></a>
## P0: Voice Activity API и core-lipsync

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| VOICE-API-SPEC-001 — Готово (TS/docs) | Спецификация | Формализовать TS-контракт/текущие пределы. | Общая интеграция вместо произвольных hacks. | `voiceActivityApi.ts`, `docs/docs_voice_api.md`; YACA-adapter остаётся transport-skeleton. Дополнительный OpenAPI-артефакт не заявляется. |
| VOICE-VAD-MNG-001 — Частично | Server-manager | Абстрактный VAD-receiver gamemode, C++/TS-plugin; routing любых провайдеров соседям. | Core без связи с провайдером, новые решения без правок сервера. | Независимый state, только proximity-clients, детерминированные merge/conflicts. |

**Существующие исходники, проверены 27.10.2026; игровая приёмка открыта:**

- `skymp5-server/ts/voiceActivityApi.ts`: полный TS-контракт VoiceActivityState/IVoiceProviderAdapter/IVoiceActivityManager/VoiceActivityConfig.
- `skymp5-server/ts/voiceActivityManager.ts`: registry, inactivity-timers, broadcast.
- `skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts`: reference-skeleton.
- `skymp5-client/src/sync/voiceActivitySync.ts`: client-lipsync/IdleDialogueLock.
- `docs/docs_voice_api.md`: контракт, настоящие packet-форматы, config, diagnostic-limits.
- `docs/docs_voice_lipsync_status.md`: выводы, нужные сведения, two-player-план.
- `README-plugins.md`: границы интеграции/ссылки.

**Следующее, VOICE-VAD-MNG-001/VOICE-LIP-001:** соединить bridge, единый аутентифицированный state-ingestion, конверсия координат/actor-ID, stop/expiry, настоящая анимация Skyrim.

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| VOICE-LIP-001 — Частично | Client-animation | При `isSpeaking=true` IdleDialogueLock, false возвращает idle/locomotion. | Видимая обратная связь синхронной речи. | Proximity-клиенты видят правильный remote lock/unlock, без animation-race. |
| VOICE-PROX-001 — Частично | Дальность | Server-respect ступеней/расстояния, VAD только в зоне. | Bandwidth/privacy, согласованность звука/визуального. | Вне зоны нет VAD, пересчёт при движении, без broadcast-storm. |

<a id="p1---provider-implementations--adapters"></a>
## P1: провайдеры/адаптеры

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| VOICE-YACA-IMPL-001 — Открыто | YACA-TS | Соединить локальный `onVoiceActivity` с полным state/animation-путём, CEF/native-source. | Первый провайдер проверяет дизайн, разблокирует YACA. | Настоящие TALK/SOUND ведут правильного remote-actor, sustained-speech/stop/cleanup, two-player Skyrim/TeamSpeak. |
| VOICE-DISCORD-IMPL-001 — Открыто | Optional Discord-bot | Реальная речь с аутентифицированным actor-mapping; одного присутствия в канале мало. | Discord-first/независимость API. | Start/stop серверу, правильная client-animation, без YACA. |
| VOICE-CUSTOM-IMPL-001 — Открыто | Custom VoIP | Starter-template/docs своих backend. | Третьи стороны без core-правок. | Пример, validation-list, diagnostic-tools. |

<a id="p1---admin--diagnostics"></a>
## P1: администрация/диагностика

| ID | Область | Объём | Причина | Приёмка |
| --- | --- | --- | --- | --- |
| VOICE-MON-001 — Частично | Metrics/health | Relay-uptime, speakers, range-distribution/providers в plugin-health. | Видимость pipeline, поиск voice-desync/ошибок провайдера. | Admin `voiceActivity.runtimeStatus`, speakers/providers, timestamp последнего события каждого. |
| VOICE-ADM-001 — Открыто | Voice-dashboard | Speakers, histogram, latency, provider-health, relay. | Без SSH/logs быстро проверить настройку. | Realtime, калибровка одним кликом, provider-toggle для диагностики. |

<a id="p2---advanced-features-post-mvp"></a>
## P2: расширения после MVP

| ID | Область | Объём | Причина | Приёмка |

<a id="recommended-rollout-order-1"></a>
## Рекомендуемый порядок

1. **Дизайн/контракт:** `VOICE-API-SPEC-001`.
2. **Независимое ядро:** `VOICE-VAD-MNG-001`, `VOICE-PROX-001`, `VOICE-LIP-001`, server-manager/client-sync.
3. **Первый провайдер:** `VOICE-YACA-IMPL-001`, проверка YACA-TS.
4. **Admin/diagnostics:** `VOICE-MON-001`, `VOICE-ADM-001`.
5. **Другие провайдеры/расширения:** `VOICE-DISCORD-IMPL-001`, `VOICE-CUSTOM-IMPL-001`, `VOICE-DYN-001`, `VOICE-EFFECT-001` после MVP.

<a id="notes-2"></a>
## Примечания

- **Абстракция:** YACA имеет skeleton/отдельный локальный bridge, полная связка открыта. Discord/Mumble/custom VoIP могут реализовать общий API.
- **Adapter pattern:** server-adapter переводит provider-state в VAD; новым провайдерам core-правки не нужны.
- **Inactivity:** manager-timer есть для adapter-update; direct-CustomPacket его обходит. Согласовать timeout/heartbeat/старых recipients/client-expiry до обещания надёжной очистки.
- **Multiplayer lifecycle:** порядок, despawn/recreation, потерянный stop, другие анимации требуют настоящей приёмки.
- **Развитие:** native-audio streaming может расширить effects без изменения VAD.
- **Документация:** `voiceActivityApi.ts`, `docs/docs_voice_api.md` уже задают TS-контракт/руководство. Provider/gameplay-приёмка и дополнительный OpenAPI отдельно.
