[Deutsch](../../../de/docs/skyrim_platform/http.md) · [English](../../../en/docs/skyrim_platform/http.md) · [Русский](http.md)

<a id="http-requests"></a>

# HTTP-запросы

SkyrimPlatform предоставляет ограниченную поддержку HTTP/HTTPS-запросов.
В настоящее время доступны только `get` и `post`.

```typescript
import { HttpClient } from 'skyrimPlatform';

let url = 'https://canhazip.com:443'; // URL may contain port or not
let http = new HttpClient(url);
http.get('/').then((response) => printConsole(response.body));
```

- Если запрос завершается ошибкой, `response.body` будет пустым.
