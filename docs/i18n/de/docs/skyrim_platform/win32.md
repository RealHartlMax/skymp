[Deutsch](win32.md) · [English](../../../en/docs/skyrim_platform/win32.md) · [Русский](../../../ru/docs/skyrim_platform/win32.md)

# Win32

SkyrimPlatform unterstützt unter anderem das Öffnen von Links im Standardbrowser des Betriebssystems über Aufrufe der Windows-Shell.

```typescript
import { win32 } from 'skyrimPlatform';

let url = 'https://google.com'; // URL should start with prefix https://
win32.loadUrl(url);
```

```typescript
import { win32 } from 'skyrimPlatform';

win32.exitProcess(); // terminates the process gracefully
```
