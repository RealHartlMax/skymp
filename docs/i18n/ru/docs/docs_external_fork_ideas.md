[Deutsch](../../de/docs/docs_external_fork_ideas.md) · [English](../../en/docs/docs_external_fork_ideas.md) · [Русский](docs_external_fork_ideas.md)

<a id="external-fork-ideas"></a>

# Идеи внешних fork

> План/исследование, проверено 22 октября 2026 года. Предложения и примеры внешних fork не означают реализацию в этом checkout. Подтверждённое выполнение см. в [статусе проекта](docs_project_status.md) и основной дорожной карте.

Документ собирает интересные идеи, функции и улучшения публичных fork skymp для будущей разработки и возможного переноса коммитов.

**Последняя проверка:** 2026-05-03  
**Метод:** Сравнение всех fork с `skyrim-multiplayer/skymp:main` через `git ls-remote` и `git log --oneline --left-right`; проверено 118, около 25 опережали upstream.

---

<a id="top-cherry-pick-candidates"></a>

## Основные кандидаты переноса

<a id="1-halfin-gamesskymp-skyv--ed25519-join-ticket-verification"></a>

### 1. HALFIN-Games/skymp-SkyV — проверка билетов входа Ed25519

**Коммит:** `e42b0ddc`  
**Заголовок:** `Server: verify website join ticket (Ed25519)`  
**Риск:** средний, вероятны конфликты с текущим `login.ts`.

**Действие:**  
Криптографическая проверка билетов веб-бэкенда. `JoinTicketVerifier` проверяет подписанные Ed25519 JWT через `jose`: стандартные claims `iss`, `aud`, `exp`, `iat`, `sub`, `jti` и дополнительные `whitelisted`, `queue_points`, `reserved_ok`, `slots`. Настройка через переменные окружения.

**Изменённые файлы (5, +217/-3):**
- `skymp5-server/ts/systems/login.ts` — интеграция
- `skymp5-server/ts/utils/joinTicket.ts` *(новый)* — класс `JoinTicketVerifier`
- `skymp5-server/ts/dev/verifyJoinTicket.ts` *(новый)* — CLI для ручной проверки
- `skymp5-server/join_ticket_ed25519_public.pem` *(новый)* — пример публичного ключа
- `skymp5-server/package.json` — зависимость `jose`

**Важные переменные окружения:**
```
JOIN_TICKET_ED25519_PUBLIC_KEY_PEM
JOIN_TICKET_ISSUER
JOIN_TICKET_AUDIENCE
```

**Другие интересные коммиты:**
| Коммит | Тема |
|--------|------|
| `c8674675` | Слоты нескольких персонажей |
| `59e65269` | Дополнение слотов |
| `9c4e6f95` | Адаптер голосового чата |
| `b0a5dd30` | Улучшения голосового чата |
| различные | Эксплуатация: VPS, EC2, набор тестера |

---

<a id="2-aw-cskymp--generic-napi-serialization-archive"></a>

### 2. aw-c/skymp — универсальный архив сериализации NAPI

**Коммит:** `6361d003`  
**Заголовок:** `init new serialize`  
**Риск:** высокий, большая переработка Inventory, требуется C++20.

**Действие:**  
Класс `NapiOutputArchive` — типобезопасный шаблонный сериализатор C++-структур прямо в NAPI/Node.js без ручного построения каждого `napi_value`. Диспетчеризация типов использует concepts C++20:

```cpp
template<class T> concept IntegralConstant = ...;
template<class T> concept StringLike       = ...;
template<class T> concept Arithmetic       = ...;
template<class T> concept ContainerLike    = ...;
template<class T> concept NoneOfTheAbove   = ...;
```

`Inventory` перенесён как проверка подхода: универсальный `template<class Archive> void Serialize(Archive&)` убирает дублирование JSON/NAPI.

**Изменённые файлы (4, +364/-193):**
- `serialization/include/archives/NapiOutputArchive.h` *(новый)*
- `serialization/CMakeLists.txt`
- `skymp5-server/cpp/server_guest_lib/Inventory.cpp`
- `skymp5-server/cpp/server_guest_lib/Inventory.h`

> **Примечание:** `houndlord/skymp` содержит очень похожую сериализацию и дополнительные изменения `ScampServer.cpp` и `index.ts`; стоит сравнить оба.

---

<a id="3-q1000treadzskymp--client-actorvalues-helper"></a>

### 3. q1000treadz/skymp — клиентская функция ActorValues

**Коммит:** `4601e331`  
**Заголовок:** `feat(skymp5-client): send changed health percentage after animation`  
**Риск:** низкий; небольшое изменение, но нужен ручной перенос в текущую структуру клиента.

**Действие:**  
Выносит чтение параметров актёра в `getActorValues()`. Функция читает проценты здоровья, выносливости, магии и корректно возвращает здоровье `0` для мёртвого актёра.

**Изменённые файлы (2, +16/-10):**
- `skymp5-client/src/front/components/actorvalues.ts` *(новая функция)*
- `skymp5-client/src/front/skympClient.ts`

> **⚠ Нужен перенос:** Старой структуры `src/front/` больше нет. Цели ручного переноса:  
> - `skymp5-client/src/sync/actorvalues.ts`  
> - `skymp5-client/src/services/services/skympClient.ts`

---

<a id="other-notable-forks"></a>

## Другие интересные fork

### piotroszko/skyworld
**Опережение:** около 105 коммитов, 1955 изменённых файлов  
**Характер:** отдельная продуктовая линия/крупный fork

Крупная перестройка со своей иерархией (`projects/*`), привязками свойств, VoIP, расширенным OnHit/Damage и документацией. Прямой перенос маловероятен, но полезен как архитектурный пример, особенно VoIP и урон.

---

### F02K/skymp
**Опережение:** около 88 коммитов, 159 изменённых файлов  
**Характер:** gamemode и инструменты

Содержит gamemode в стиле Frostfall и помощник сборки. Полезен для выживания и улучшения инструментов разработки.

---

### reveriadive/skymp
**Опережение:** около 35 коммитов, 77 изменённых файлов  
**Характер:** клиентские исправления игры

Исправления инвентаря, проверки телепорта и движения на клиенте. Стоит изучить при работе с anti-cheat и корректностью синхронизации.

---

### peterkmg/skymp
**Опережение:** около 37 коммитов, 123 изменённых файлов  
**Характер:** сборка Skyrim VR/CommonLibVR

Добавляет CMake/настройки сборки с CommonLibVR (Skyrim VR). Актуально только при цели VR.

---

<a id="how-to-reproduce-the-scan"></a>

## Повторение проверки

```bash
# List all forks via GitHub API (replace TOKEN)
curl -s -H "Authorization: token TOKEN" \
  "https://api.github.com/repos/skyrim-multiplayer/skymp/forks?per_page=100" \
  | jq '.[].full_name'

# Add a fork as a remote and compare
git remote add halfin https://github.com/HALFIN-Games/skymp-SkyV
git fetch halfin

# Commits in fork not in upstream
git log --oneline upstream/main..halfin/main

# Ahead/behind count
git rev-list --left-right --count upstream/main...halfin/main
```

---

*Исключён: `RealHartlMax/skymp`, собственный fork сопровождающего.*
