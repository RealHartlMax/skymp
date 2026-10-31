[Deutsch](../../de/docs/docs_voice_api.md) · [English](../../en/docs/docs_voice_api.md) · [Русский](docs_voice_api.md)

<a id="voice-activity-detection-api"></a>

# API определения речевой активности

Проверено по локальным исходникам **27 октября 2026 года**.

**Реализация частичная.** Контракт и обработчики существуют, но полной проверенной в игре синхронизации губ нет. До включения/расширения прочитайте [статус lipsync, препятствия и необходимые данные](docs_voice_lipsync_status.md), включая отдельный локальный мост `SkyMP-YACA-TS`.

<a id="scope"></a>

## Объём

Voice Activity Detection (VAD) сообщает, говорит ли актёр. API передаёт логическое состояние и дальность голоса, но не аудиосэмплы, громкость, фонемы или виземы. Индикатор речи или попытка диалоговой анимации не доказывает lipsync по аудио.

Сервер содержит независимый от провайдера контракт адаптера. YACA — существующий каркас; Discord, Mumble и прочие — возможные, а не готовые интеграции.

<a id="state-and-adapter-contracts"></a>

## Контракты состояния и адаптера

Основные поля `VoiceActivityState`:

```typescript
interface VoiceActivityState {
  actorId: string;      // Server actor ID, not a client-local Form ID
  isSpeaking: boolean;
  voiceRange: number;   // Metres
  providerId?: string;
  timestamp: number;    // Milliseconds since Unix epoch
  // Optional provider metadata is also supported.
}
```

Полные типы, метаданные, диагностика: [voiceActivityApi.ts](../../../../skymp5-server/ts/voiceActivityApi.ts).

Провайдер реализует `IVoiceProviderAdapter`: `providerId`, `isReady`, `initialize()`, `shutdown()`, `onVoiceActivityUpdate(callback)`, необязательный `getHealthStatus()`. `VoiceActivityManager.registerAdapter(adapter)` инициализирует адаптер и подписывает manager на callbacks.

Обновления callbacks проходят реестр, проверку дальности, таймер неактивности, рассылку. Сейчас хранится одно последнее состояние актёра; детерминированного объединения одновременных провайдеров нет.

<a id="actual-server-integration"></a>

## Фактическая интеграция сервера

[Server index.ts](../../../../skymp5-server/ts/index.ts) создаёт manager только при `voiceActivity.enabled === true` в `server-settings.json`, устанавливает выбор получателей и callback `server.sendCustomPacket(userId, json)`. При `yaca-ts` в `providers` регистрируется `YacaTeamSpeakAdapter`.

[YacaTeamSpeakAdapter.ts](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts) предоставляет `handleYacaVoiceEvent(actorId, isSpeaking, voiceRange)` для callbacks. Но `initialize()` не подключает TeamSpeak и не регистрирует транспорт. Статус готовности/здоровья не доказывает поступление реальных событий.

Callback `onVoiceActivity` отдельного моста выдаёт `{ actorId, isSpeaking, voiceRange }` с ID нативного источника. Стандартный entry плагина не передаёт callback, поэтому автоматической связи с manager нет. Новый транспорт использует CEF и `_yacaClient`, без Papyrus `YacaBridgeQuest`.

<a id="existing-client-to-server-custom-packet-path"></a>

### Существующий путь Custom Packet клиент → сервер

Сейчас сервер распознаёт `customPacketType: "voiceActivity"` и `"yaca:voiceActivity"`. Пример пакета:

```json
{
  "customPacketType": "voiceActivity",
  "isSpeaking": true,
  "voiceRange": 8,
  "providerId": "yaca-ts"
}
```

Обработчик напрямую вызывает `manager.broadcastVoiceActivity(state)`, **обходя реестр, проверку дальности и таймер manager**. Новый мост не вызывает его автоматически. Преобразование типов и принятие ID из payload также требуют исправления. Завершённая интеграция должна определять идентичность по аутентифицированному отправителю и проверять состояние до общего жизненного цикла.

<a id="server-to-client-packet"></a>

### Пакет сервер → клиент

Callback рассылки отправляет плоский JSON:

```json
{
  "customPacketType": "syncVoiceActivity",
  "actorId": "4278190081",
  "isSpeaking": true,
  "voiceRange": 8,
  "providerId": "yaca-ts",
  "timestamp": 1793090000000
}
```

`VoiceActivitySyncService` получает `customPacketMessage`, разбирает `contentJsonDump` через `parseSyncVoiceActivityPacket` и передаёт внутренний `{ eventName: "syncVoiceActivity", content }`. `eventName` не является сетевым discriminator.

Сервис зарегистрирован в [client index.ts](../../../../skymp5-client/src/index.ts). [Обработчик анимации](../../../../skymp5-client/src/sync/voiceActivitySync.ts) напрямую передаёт серверный ID в `Game.getFormEx`, пытается `playIdle(0x0005B1B0)`, повторяет каждые две секунды, при остановке вызывает `stopTranslation()`. Правильное сопоставление, видимый рот, сброс и клиентский срок действия остаются открыты.

<a id="configuration"></a>

## Конфигурация

Полный пример описывает читаемые поля запуска и оставляет незавершённый путь отключённым:

```json
{
  "voiceActivity": {
    "enabled": false,
    "providers": ["yaca-ts"],
    "voiceRangeTiers": [1, 3, 8, 15, 20, 25, 30, 40],
    "defaultVoiceRange": 8,
    "proximityDistance": 100,
    "inactivityTimeoutMs": 1000,
    "allowedProviders": ["yaca-ts"]
  }
}
```

`enabled: true` создаёт manager и регистрирует каркас, но не завершает мост/анимацию.

| Параметр | Значение и ограничение |
| --- | --- |
| `enabled` | Явное включение при старте; стандарт API false. |
| `providers` | Выбор запуска; реализован `yaca-ts`. |
| `voiceRangeTiers` | Числовой массив. Контракт разрешает `null`, но запуск его не передаёт. Проверка для адаптеров, не прямых пакетов. |
| `defaultVoiceRange` | Стандарт 8 метров. Задавайте явно до исправления defaults запуска. |
| `proximityDistance` | Стандарт 100 метров. Resolver сравнивает сырые координаты без пересчёта с ним и дальностью речи. |
| `inactivityTimeoutMs` | Стандарт 1000 мс для адаптеров; согласовать с примерно двухсекундными отчётами моста. |
| `allowedProviders` | Действует при регистрации адаптера, не прямой рассылке Custom Packet. |

`maxConcurrentSpeakersPerCell` не обеспечивается manager и не передаётся запуском: это не активный предел. Отсутствующие опции иногда передаются как `undefined`, перезаписывая spread defaults; частичные настройки не наследуют все значения надёжно.

Resolver обычно исключает говорящего и сравнивает ячейку/мир и расстояние каждого пользователя. Некоторые неразрешённые позиции ведут к выбору всех. Выбор получателей и stop для прежних получателей требуют приёмки после исправления единиц.

<a id="implemented-admin-diagnostics"></a>

## Реализованная диагностика администратора

Оба маршрута требуют сессию администратора с `canViewLogs`:

| Маршрут | Результат |
| --- | --- |
| `GET /api/admin/voice/status` | Здоровье manager, адаптеры, число говорящих, последняя рассылка, ошибки; отключён/пуст без manager. |
| `GET /api/admin/voice/speakers` | Состояния речи из реестра или пустой массив без manager. |

Маршруты — в [ui.ts](../../../../skymp5-server/ts/ui.ts). Постоянный dashboard проксирует их игровому процессу; при остановке — `409 GAME_NOT_RUNNING`.

Отдельной панели диагностики и `POST /api/admin/voice/range` нет. Здоровье адаптера не доказывает транспорт. Прямая рассылка не заполняет список речи; `lastBroadcastTime` может расти без получателей. Счётчик YACA также требует дедупликации по актёру.

<a id="verification-and-next-steps"></a>

## Проверка и следующие шаги

27 октября 2026 года `npm run test:voice-sync` в `skymp5-client` прошёл: discriminator распознаётся, чужие типы игнорируются, неверный JSON отклонён. Это проверка парсера, не голоса/анимации.

Недостающая реализация, целевые версии, качество анимации и приёмка двумя игроками — в [статусе lipsync](docs_voice_lipsync_status.md). Дополнительные адаптеры должны сообщать реальную речь; одного членства в канале недостаточно.

<a id="sources"></a>

## Источники

- [Типы и defaults](../../../../skymp5-server/ts/voiceActivityApi.ts)
- [Manager](../../../../skymp5-server/ts/voiceActivityManager.ts)
- [Каркас YACA](../../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts)
- [Клиентский сервис](../../../../skymp5-client/src/services/services/voiceActivitySyncService.ts)
- [Парсер и тест](../../../../skymp5-client/tests/voiceActivitySyncPacket.test.ts)
- [Интеграция плагинов](../README-plugins.md#voice-activity-adapters-für-lipsync--proximity-chat)
- [Задачи Voice](../ROADMAP.md#voice--proximity-chat-sync-backlog-proposed)
