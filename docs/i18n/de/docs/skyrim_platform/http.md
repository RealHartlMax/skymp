[Deutsch](http.md) · [English](../../../en/docs/skyrim_platform/http.md) · [Русский](../../../ru/docs/skyrim_platform/http.md)

<a id="http-requests"></a>

# HTTP-Anfragen

SkyrimPlatform unterstützt HTTP/HTTPS-Anfragen eingeschränkt.
Derzeit stehen nur `get` und `post` zur Verfügung.

```typescript
import { HttpClient } from 'skyrimPlatform';

let url = 'https://canhazip.com:443'; // URL may contain port or not
let http = new HttpClient(url);
http.get('/').then((response) => printConsole(response.body));
```

- Schlägt die Anfrage fehl, ist `response.body` leer.
