[Deutsch](../../de/docs/docs_resource_auto_download.md) · [English](../../en/docs/docs_resource_auto_download.md) · [Русский](docs_resource_auto_download.md)

<a id="resource-auto-download--distribution"></a>

# Автозагрузка и распространение ресурсов

Отдельный `skymp-client-launcher` устанавливает серверные моды до запуска SKSE. Контракт v2 с сохранением путей, настройка оператором и обнаружение runtime описаны в [пакетах модов launcher](docs_launcher_modpacks.md).

Ниже описан старый API v1 плоских файлов, сохранённый для старых launcher. Игровой `skymp5-client` не устанавливает моды автоматически — этим занимается отдельный launcher.

Проверено 22 октября 2026 года: текущий v1-сканер `ui.ts` в основном перечисляет `.esm` и `.pex` и не предназначен для полных новых modpack. Используйте v2 для ESP/ESL/BSA и вложенных ресурсов. Старые предложения ниже не являются текущим TODO desktop launcher.

<a id="overview"></a>

## Обзор

```
Client connects
      │
      ▼
GET /api/resources/manifest          ← fetch list of all resources + SHA256 hashes
      │
      ▼
Compare hashes against local cache   ← dataDir/cache/resources/
      │
      ├── up-to-date: skip
      │
      └── missing / changed:
              │
              ▼
          GET /api/resources/download/:name   ← stream file, validate X-Resource-Hash
              │
              ▼
          Save to cache, load resource
```

<a id="endpoints"></a>

## Конечные точки

### `GET /api/resources/manifest`

Публичный, без аутентификации. Возвращает полный список доступных ресурсов.

**Ответ (200 OK):**

```json
{
  "version": "1",
  "generatedAt": "2026-04-25T12:00:00.000Z",
  "resources": [
    {
      "name": "SweetPie.esm",
      "kind": "mod",
      "size": 204800,
      "hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "name": "SweetPieScript.pex",
      "kind": "script",
      "size": 1024,
      "hash": "sha256:abc123..."
    }
  ]
}
```

**Поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `version` | string | Версия схемы (`"1"`) |
| `generatedAt` | ISO 8601 | Серверное время создания |
| `resources[].name` | string | Имя файла, например `SweetPie.esp` |
| `resources[].kind` | `"mod"` \| `"script"` | Вид ресурса |
| `resources[].size` | number | Размер в байтах |
| `resources[].hash` | string | `sha256:<hex>`; пусто, если файл не читается |

**Виды ресурсов:**

- `mod` — плагины Elder Scrolls (`.esm`, `.esp`, `.esl`)
- `script` — скомпилированные скрипты Papyrus (`.pex`)

---

### `GET /api/resources/download/:name`

Публичный, без аутентификации. Передаёт исходные байты указанного ресурса.

**URL-параметр:** `:name` — только имя файла, без разделителей пути.

**Заголовки ответа:**

| Заголовок | Значение |
|-----------|----------|
| `Content-Type` | `application/octet-stream` |
| `Content-Disposition` | `attachment; filename="<name>"` |
| `X-Resource-Hash` | `sha256:<hex>` — для проверки загрузки |

**Ошибки:**

| Статус | Причина |
|--------|---------|
| `400` | Пустое имя или разделители пути |
| `403` | Путь вне разрешённых корней (path traversal) |
| `404` | Нет в манифесте или на диске |

---

<a id="security"></a>

## Безопасность

<a id="path-traversal-protection"></a>

### Защита от обхода каталогов

Загрузка разрешает имя относительно тех же корней, что сканирует `listAdminResources`. `../../../etc/passwd` отклоняется с `403`, так как путь не находится в разрешённом корне.

Разрешённые корни:
- `dataDir` (настройки сервера)
- `./` (рабочий каталог)
- `./scripts`
- `./data`
- `./skymp5-gamemode`

<a id="hash-verification"></a>

### Проверка хеша

Клиенты **должны по возможности** проверять SHA256 из `X-Resource-Hash` после загрузки. Формат: `sha256:<lowercase hex>`.

```ts
// Example client-side verification (TypeScript)
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function verifyResource(filePath: string, expectedHash: string): boolean {
  const content = readFileSync(filePath);
  const actual = 'sha256:' + createHash('sha256').update(content).digest('hex');
  return actual === expectedHash;
}
```

---

<a id="server-configuration"></a>

## Конфигурация сервера

Дополнительная настройка не нужна. Манифест автоматически строится по ресурсам dashboard (`listAdminResources`). Действуют те же настройки порядка загрузки `npcSettings` и `dataDir`.

Для загрузки поместите ресурс в один из сканируемых каталогов:

```
server/
├── data/           ← .esm / .esp / .esl plugins
├── scripts/        ← .pex compiled Papyrus scripts
├── skymp5-gamemode/
└── <dataDir>/      ← as configured in server-settings.json
```

---

<a id="legacy-in-game-client-proposal"></a>

## Старое предложение игрового клиента

Это прежнее предложение для `skymp5-client`. Реализованный отдельный launcher вместо него использует `/api/launcher/manifest` до запуска игры:

1. При соединении получить `/api/resources/manifest`.
2. Для каждого ресурса:
   - Путь `<cacheDir>/<serverHost>/<name>`.
   - Если файл есть и хеш совпал — пропустить.
   - Иначе `GET /api/resources/download/<name>`, проверить `X-Resource-Hash`, сохранить.
3. Загрузить из кеша до входа в мир.
4. При отключении сохранить кеш для следующего входа.

**Каталог кеша:** `<SkyrimDataDir>/SkyMP/cache/<serverHost_port>/`

---

<a id="implementation-details"></a>

## Подробности реализации

Маршруты манифеста/загрузки регистрируются в `skymp5-server/ts/ui.ts`.

`computeResourceHash(filePath)` синхронно читает файл и возвращает `sha256:<hex>`. Для файлов больше нескольких МБ на этапе 2 нужен потоковый хеш.

`listAdminResources(settings, dataDir)` общий для `/api/admin/resources` и публичного манифеста, чтобы обнаружение ресурсов оставалось в одном месте.

---

<a id="roadmap"></a>

## Дорожная карта

Поэтапный план — [ROADMAP_FIVEM_IDEAS.md](../ROADMAP_FIVEM_IDEAS.md):

| Этап | Статус | Описание |
|------|--------|----------|
| 1 | Готово | Серверный манифест и загрузки |
| 2 | План | Диагностика ресурсов dashboard |
| 3 | План | Клиентский манифест, кеш, автозагрузка |
| 4 | План | Зависимости и порядок загрузки |
