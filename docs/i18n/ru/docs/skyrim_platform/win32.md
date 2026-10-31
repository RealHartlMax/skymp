[Deutsch](../../../de/docs/skyrim_platform/win32.md) · [English](../../../en/docs/skyrim_platform/win32.md) · [Русский](win32.md)

# Win32

SkyrimPlatform поддерживает, в частности, открытие ссылок в браузере операционной системы по умолчанию через вызовы оболочки Windows.

```typescript
import { win32 } from 'skyrimPlatform';

let url = 'https://google.com'; // URL should start with prefix https://
win32.loadUrl(url);
```

```typescript
import { win32 } from 'skyrimPlatform';

win32.exitProcess(); // terminates the process gracefully
```
