[Deutsch](../../de/docs/docs_cpp_code_guidelines.md) · [English](../../en/docs/docs_cpp_code_guidelines.md) · [Русский](docs_cpp_code_guidelines.md)

<a id="сpp-code-guidelines"></a>

# Правила кода C++

<a id="language"></a>

## Язык

Корневая конфигурация CMake требует C++20 (`CMAKE_CXX_STANDARD 20`).

Используйте инструментарий текущей конфигурации CMake. 29 октября 2026 года целевые Windows-сборки нативных модульных тестов и серверного addon проверены с Visual Studio 18 2026 / MSVC 14.51. Старые упоминания Microsoft Visual C++ 2019 и Clang 15 описывают прежние цели совместимости и не доказывают текущую успешную сборку этими компиляторами. Совместимость Linux/сервера проверяется отдельно.

<a id="code-style"></a>

## Стиль кода

Блоки кода требуют фигурные скобки.

```c++
// ok
if (foo) {
  bar();
}

// not ok
if (foo) bar();

// also not ok
if (boo)
  bar();
```

<a id="naming"></a>

## Именование

<a id="variables"></a>

### Переменные

Первое слово начинается со строчной, остальные — с прописной: `camelCase`.

Глобальные, статические и thread-local переменные имеют префикс `g_`, например `static int g_foo;`, кроме констант.

Константам нужен префикс `k`. При объявлении учитывайте [возможные побочные эффекты](#глобальноподобные-переменные).

Логические переменные и методы используют префикс is: `isSet`, `isFinished`, `isVisible`, `isFound`, `isOpen`.

В некоторых случаях лучше подходят has, can, should: `hasLicense`, `canEvaluate`, `shouldSort`.

Параметр конструктора заканчивается подчёркиванием, если есть одноимённое поле:

```c++
class Foo {
public:
  Foo(int bar_);
  const int bar;
};

Foo::Foo(int bar_) : bar(bar_) {};
```

Избегайте коротких имён. Предпочитайте `server`, а не `svr`.

Допустимы: `i`, `n`, `it` в циклах; `lhs`/`rhs` при перегрузке операторов; `res` для результата функции.

<a id="classes"></a>

### Классы

Имя класса начинается с прописной: `class SomeClass`.

Префикс I для абстрактных классов не используется.

По возможности имя класса — существительное, не глагол.

<a id="enums"></a>

### Перечисления

Имя перечисления начинается с прописной: `enum SomeEnum`. То же относится к его константам.

Объявляйте `enum class`, если нет веской причины использовать обычный `enum`.

<a id="functions"></a>

### Функции

Имя функции начинается с прописной: `void LaunchOpenBeta();`.

Имя функции начинается с глагола.

<a id="global-like-variables"></a>

## Глобальноподобные переменные

Не создавайте глобальные, статические или thread-local переменные/константы сложной структуры или с деструкторами. Порядок уничтожения глобальных объектов не определён и может вызвать неожиданные ошибки.

```c++
// ok
const KeyCode kDefaultChatHotkey = KeyCode::F6;  // enum
const std::string kDefaultName = "ThisIsAVeryOriginalUsername";
const std::unordered_map<std::string, std::string> kSomeMapping{
  { "a", "b" },
  { "b", "a" },
};

// not ok
struct WrappedRef {
  const std::string& something;
};
const WrappedRef kSomeWrappedRef{ kDefaultName };

{
  // ...
  // This is very dangerous and can lead to crashes. Don't do like this!
  // Existing places will be eventually removed.
  thread_local JsValue g_undefined = JsValue::Undefined();
}
```

<a id="const-qualifier"></a>

## Квалификатор const

<a id="variables-1"></a>

### Переменные

По возможности используйте `constexpr`.

По возможности объявляйте поля и методы класса const.

Правила передачи аргументов:

1. Нужно менять значение вне функции? `void Func(SomeType& outVar)`
2. Это примитив (`enum`, `int64_t`, `char` и т. д.)? Передавайте неконстантным значением: `void Func(int64_t var)`
3. Нужна move-семантика? `SomeType var` для копирования+перемещения, `SomeType&& var` только для перемещения.
4. Иначе передавайте константную ссылку, например `void Func(const std::string& message, const MyStruct& data)`.

Не помечайте локальные переменные и передаваемые по значению аргументы как const: значения с небольшой областью видимости в этом не нуждаются.

Предпочитайте константные глобальные/статические/thread-local переменные, пока нет причины делать их изменяемыми.

<a id="methods"></a>

### Методы

По возможности объявляйте методы const.

Const-методы должны быть потокобезопасны.

<a id="types"></a>

### Типы

Предпочитайте `int32_t` вместо `int`, `int16_t` вместо `short` и т. д.

<a id="macros"></a>

### Макросы

После `#endif` должен идти комментарий:

```c++
#ifdef _DEBUG
    auto debugFunctionJson = f.dump();
#endif // _DEBUG
```

Не создавайте собственные макросы, если задачу можно решить шаблонами C++; даже иначе тщательно подумайте. Если макрос необходим, выполните `#undef`, как только он больше не нужен.

Пример:

```c++
#define DO_MAGIC(a, b, c) ...
DO_MAGIC(foo, bar, baz)
DO_MAGIC(fizz, buzz, fizzbuzz)
#undef DO_MAGIC
```

<a id="application-to-existing-code"></a>

## Применение к существующему коду

В отдельных местах код проекта может нарушать эти правила. Работая с таким кодом, рассмотрите его исправление.
