[Deutsch](../../../de/docs/release/sp-2.6.md) · [English](../../../en/docs/release/sp-2.6.md) · [Русский](sp-2.6.md)

<a id="sp-260-release-notes"></a>

# SP 2.6.0 Примечания к выпуску

В документе перечислены изменения после SP 2.5.0

**Это важное обновление добавляет поддержку AE/1.6, повышает FPS и исправляет множество сбоев и проблем. Рекомендуется обновиться вместо использования 2.5 и более ранних версий.**

К сожалению, обновление SP может повредить сохранения в _некоторых_ наборах модов. Многое ещё предстоит реализовать или исправить. См. [задачи](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

SP поддерживает как Steam-версию Skyrim SE (1.6+), так и старую 1.5.97.

Если вам нравится Skyrim Platform, поставьте звезду этому репозиторию. Это помогает ⭐

<a id="error-in-http-clients-response"></a>

## `error` в ответе HTTP-клиента

В `HttpResponse` добавлено поле `error`. Оно даёт более подробную информацию
о причине ошибки HTTP-запроса. Сейчас возможен
[один из следующих вариантов](https://github.com/yhirose/cpp-httplib/blob/b80aa7fee31a8712b1d3cae05c1d9e7f5c436e3d/httplib.h#L771-L785):

- Пустая строка при успешном выполнении
- `Unknown`
- `Connection`
- `BindIPAddress`
- `Read`
- `Write`
- `ExceedRedirectCount`
- `Canceled`
- `SSLConnection`
- `SSLLoadingCerts`
- `SSLServerVerification`
- `UnsupportedMultipartBoundaryChars`
- `Compression`

<a id="add-more-events"></a>

## Дополнительные события

- `buttonEvent`
- `mouseMove`
- `thumbstickEvent`
- `kinectEvent`
- `deviceConnect`
- `actorKill`
- `criticalHit`
- `disarmedEvent`
- `dragonSoulsGained`
- `itemHarvested`
- `levelIncrease`
- `locationDiscovery`
- `shoutAttack`
- `skillIncrease`
- `soulsTrapped`
- `spellsLearned`

<a id="fileinfo-api"></a>

## API FileInfo

Теперь можно получать сведения о файлах непосредственно внутри каталога Data игры Skyrim.

```ts
sp.printConsole(JSON.stringify(sp.getFileInfo('Skyrim.esm')));
// {"filename": "Skyrim.esm", "size": ..., "crc32": ...}
```

<a id="other-changes"></a>

## Другие изменения

- Исправлены несколько проблем безопасности при проверке локальных путей файлов.

- Файл настроек Skyrim Platform теперь находится в `Data\SKSE\Plugins\SkyrimPlatform.ini`.

- Исправлен вывод не-ASCII-текста: обработка UTF-8 из JS исправлена, шрифт пересобран с кириллицей. Для замены шрифта см. [документацию SP Texts API](../skyrim_platform/texts.md#compiling-font).

- Проект теперь соответствует C++20 и компилируется VS 2022 без ошибок.

- CommonlibSSE обновлена до последней версии.

- Добавлено управление получателями событий во время выполнения. Кроме отдельных событий, вызываемых прямо из кода, события больше не обрабатываются, если на них не подписан ни один плагин. Уменьшение числа вызовов должно повысить производительность.

- Добавлено журналирование. Platform использует возможности SKSE для журналирования во время выполнения и сообщает пользователю больше о ходе работы. Файл журнала находится в `User\Documents\My Games\Skyrim Special Edition\SKSE.`

- Все прямые смещения перехватчиков и игровых классов заменены ID Address Library для поддержки будущих версий игры.

- SKSE64 больше не требуется для сборки, но по-прежнему нужен для запуска плагина.
