# skymp5-front

GUI-демо Skyrim Multiplayer. Исходный чат **davinchi59** портирован.

- `npm run build`: минимизированная production-сборка с gzip-бюджетом JavaScript.
- `npm run build:dev`: отладочный bundle без devserver.
- `npm run watch`: live reload со свободным портом.
- `npm run watch:fixed`: live reload на `1234`.
- `npm run dev:lan`: LAN/браузер, `0.0.0.0` и авто-порт.
- `npm run test:api`: интеграционные проверки списка серверов.
- `npm run test:bundle`: бюджет, lazy chunks и development-режим.
- `npm run test:e2e`: необязательный Playwright smoke при установленном Playwright.
- `npm run test:a11y`: дополнительно мобильный вид, axe WCAG, фокус и клавиатура.

Если live-reload и SkyMP-сервер на одном ПК, обновление работает в игре.

## Мобильная и клавиатурная доступность

На узких окнах элементы лаунчера складываются вертикально, содержимое прокручивается, действия не обрезаются. Широкие таблицы имеют свой скролл. Панель вертикально прокручивается на телефоне. Профиль открывается именем из существующего списка без дублирующей таблицы заголовка.

Диалоги лаунчера/панели/обновления/предупреждения/профиля/админа/whitelist имеют общую логику: Tab/Shift+Tab остаются внутри, Escape закрывает верхний и возвращает фокус. Фон modal неактивен. Вкладки профиля/панели/настроек понимают Left/Right, Home/End. Закрытие/поля имеют доступные имена во всех шести языках. Результат конфигурации объявляется live-статусом, скролл инвентаря доступен клавиатуре.

Формы админа сохраняются Enter, отменяются Escape. Пока идёт запись, поля/закрытие выключены. API-ошибка остаётся вместе с введёнными данными. При низком окне тело прокручивается. Whitelist использует то же поведение и проверяет `type:value` до записи. Поиск подписан, таблица прокручивается клавиатурой.

Серверные `/admin`, первичная настройка и миграция имеют видимый фокус, объявляемые ошибки, прокрутку. Ожидающий запрос выключает поля/конкурирующие действия. Setup указывает требования пароля, миграция различает старый/новый. Немецкий язык документа соответствует шаблону.

Игровой вход использует OAuth-виджет `AuthService`, отображаемый `components/WidgetForm`. Неиспользуемые email/password-демо удалены. При старте удаляется `localStorage.password`, нативные OAuth-сессии не меняются. Общие элементы сохраняют callbacks, настоящие disabled-кнопки, labels и checkbox. Формы прокручиваются на низких экранах, переносят длинные имена, удерживают фокус при статусах. Комментарии входа имеют live-регион. Общий skin перенесён в `components/WidgetForm/legacyControls.scss`.

Запустите watch и в другом терминале проверки по напечатанному порту; либо используйте URL обслуживаемой production-сборки:

```powershell
$env:PLAYWRIGHT_E2E_URL = 'http://127.0.0.1:1234/?devUi=1'
npm run test:a11y
```

Тест имитирует API/WebSocket. Проверяются светлый/тёмный лаунчер, игроки, respawn, события, предупреждение, три профиля, создание/изменение/ошибка админа, четыре настройки, whitelist с диалогом/ошибкой/данными, вход/ошибка/setup/миграция, три игровых виджета при **360 и 1280 px**: 54 axe-проверки, цикл/возврат фокуса, вложенный Escape и клавиши вкладок. Обычный smoke также проверяет создание пользователя, роли, неверный Discord ID, отказ записи, отмену без записи, сохранение чужих JSON-полей, whitelist validation/retry/cancel/refresh, админ-вход, дубли ожидающих запросов, setup, миграционные данные и Discord redirect. При 360 × 480 действия доступны.

`scripts/game-widget-checks.js` извлекает настоящую widget factory клиента, проверяет OAuth/Play/выбор сервера, фокус обновлений, очистку пароля, callbacks и checkbox-клавиатуру. Мост имитируется, реальный аккаунт не авторизуется. Без Playwright проверка падает вместо успешного пропуска. JSON/снимки в игнорируемой `.cache/accessibility/`; `incomplete` axe сохраняется для ручного разбора. Это не заменяет screen reader, оставшиеся формы, настоящий Discord OAuth или Skyrim/CEF. `scripts/admin-form-checks.js`, `scripts/admin-auth-checks.js` перехватывают запись: реальные настройки не меняются. Auth-тесты рендерят тот же `skymp5-server/ts/adminLoginPage.ts`, что `/admin`, перехватывая API.

Для новых modal используйте `ModalDialog` с именем/`onClose`, не глобальный Escape. Широкое содержимое держите в скролле, разрешайте вертикальное сжатие.

Для Linux VPS 12 vCores/24 GB см. [сборку/эксплуатацию](../docs/docs_linux_vps.md). Нативный сервер собирается под Linux; frontend переносим, Windows `scam_native.node` нет. Клиент отдельно для Windows. Тестовые пакеты 19.10.2026 содержат одинаковый production UI на двух ОС. Нативные результаты — [отчёт](../docs/docs_native_validation_2026_10_19.md); deployment VPS и Skyrim/CEF отдельно.

## Производственная сборка и бюджет

`npm run build` использует production Webpack; watch/dev:lan явно development для hot reload. Единственный `build.js` совместим с прежним HTML/пакетом без новых загрузок chunks во время работы.

Успешная сборка создаёт `bundle-size.json` рядом с `build.js` по `outputPath`: raw/gzip для каждого JS, флаги initial, суммы, режим, бюджет. Старые остатки не считаются. Изображения/аудио/лицензии/sourcemaps вне JS-бюджета. gzip означает размер передачи с компрессией, не обещает сжатие сервером или чтение gzip игрой.

Production падает выше **850 КиБ gzip** по всем JS, включая будущие lazy chunks. Guard действует и в CI. CMake копирует отчёт с готовыми assets. Development только сообщает размеры. Начальная база — **813 004 байта gzip** вместо **1 153 515** прежнего dev-bundle. Цель **500 КиБ** открыта, splitting/lazy loading позже. Guard — `scripts/bundle-budget-plugin.js`. При ошибке указаны размеры; оставшиеся файлы могут быть старой успешной сборкой, не новым отчётом.

## Использование

Создайте `config.js` с выходным каталогом:

```js
module.exports = {
  /* TIP: Change to '<your_server_path>/data/ui' */
  outputPath: './dist',
};
```

## Devserver в браузере и LAN

Webpack слушает все интерфейсы.

1. Запустите:

```bash
npm run watch
```

Занятый `1234` автоматически заменяется свободным. Фиксированный вариант:

```bash
npm run watch:fixed
```

Явный LAN/браузер с авто-портом:

```bash
npm run dev:lan
```

2. На этом ПК:

```text
http://127.0.0.1:<printed-port>/
```

3. На другом LAN-устройстве:

```text
http://<your-lan-ip>:<printed-port>/
```

Принудительный авторизованный overlay без клиента:

```text
http://127.0.0.1:1234/?devUi=1&devOverlay=serverList
http://127.0.0.1:1234/?devUi=1&devOverlay=admin
```

`devOverlay`: `serverList`, `admin` или оба через запятую.

При `?devUi=1` banner показывает действующие UI URL и proxy `/api`. Проверка `/api/servers` даёт `reachable`, `timeout`, `network error` или HTTP-статус, Retry, возраст успеха и обратный отсчёт. Pause/Resume хранится localStorage, Reset warnings сбрасывает предупреждения; последовательные ошибки усиливают предупреждение.

Стабильные `data-testid`:

- `dev-banner-health-controls`
- `dev-banner-health-status`
- `dev-banner-retry-btn`
- `dev-banner-pause-btn`
- `dev-banner-reset-warnings-btn`
- `dev-banner-health-meta`
- `dev-banner-health-warning`, только при предупреждении.

Переопределение host/port/backend/интервала:

```bash
SKYMP_FRONT_HOST=0.0.0.0 SKYMP_FRONT_PORT=1234 SKYMP_FRONT_API_TARGET=http://127.0.0.1:7777 npm run watch
```

```bash
SKYMP_FRONT_HEALTH_MS=5000 npm run watch
```

Целевой URL Playwright:

```bash
PLAYWRIGHT_E2E_URL=http://127.0.0.1:1234/ npm run test:e2e
```

В браузерном `?devUi=1` отправка метрик без явного endpoint подавляется, чтобы не повторять proxy-ошибки без backend на `7777`. Для проверки ingestion запустите backend и задайте endpoint до загрузки:

```js
window.SKYMP_METRICS_ENDPOINT = 'http://127.0.0.1:7777/api/frontend/metrics';
```
