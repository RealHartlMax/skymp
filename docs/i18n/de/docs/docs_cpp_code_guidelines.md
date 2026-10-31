[Deutsch](docs_cpp_code_guidelines.md) · [English](../../en/docs/docs_cpp_code_guidelines.md) · [Русский](../../ru/docs/docs_cpp_code_guidelines.md)

<a id="сpp-code-guidelines"></a>

# C++-Coderichtlinien

<a id="language"></a>

## Sprache

Die oberste CMake-Konfiguration verlangt C++20 (`CMAKE_CXX_STANDARD 20`).

Verwende die von der aktuellen CMake-Konfiguration gewählte Toolchain. Am 29. Oktober 2026 wurden gezielte native Windows-Unit-Test- und Server-Addon-Builds mit Visual Studio 18 2026 / MSVC 14.51 geprüft. Frühere Nennungen von Microsoft Visual C++ 2019 und Clang 15 beschreiben ältere Kompatibilitätsziele und belegen keinen aktuellen erfolgreichen Build mit diesen Compilern. Linux-/Serverkompatibilität muss gesondert geprüft werden.

<a id="code-style"></a>

## Codestil

Codeblöcke benötigen geschweifte Klammern.

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

## Benennung

<a id="variables"></a>

### Variablen

Das erste Wort beginnt klein, weitere Wörter groß: `camelCase`.

Globale, statische und threadlokale Variablen benötigen das Präfix `g_`, beispielsweise `static int g_foo;`, sofern sie keine Konstanten sind.

Konstanten erhalten das Präfix `k`. Beachte bei ihrer Deklaration [mögliche Nebenwirkungen](#globalartige-variablen).

Boolesche Variablen und Methoden verwenden das Präfix is, etwa `isSet`, `isFinished`, `isVisible`, `isFound`, `isOpen`.

Je nach Bedeutung passen has, can oder should besser, etwa `hasLicense`, `canEvaluate`, `shouldSort`.

Konstruktorparameter erhalten einen abschließenden Unterstrich, wenn ein Mitglied denselben Namen hat:

```c++
class Foo {
public:
  Foo(int bar_);
  const int bar;
};

Foo::Foo(int bar_) : bar(bar_) {};
```

Vermeide kurze Variablennamen. Bevorzuge `server` gegenüber `svr`.

Zulässige Kurzformen: `i`, `n`, `it` in Schleifen; `lhs`/`rhs` bei Operatorüberladungen; `res` für Funktionsergebnisse.

<a id="classes"></a>

### Klassen

Klassennamen beginnen groß: `class SomeClass`.

Abstrakte Klassen erhalten kein I-Präfix.

Verwende nach Möglichkeit ein Substantiv statt eines Verbs als Klassenname.

### Enums

Enumnamen beginnen groß: `enum SomeEnum`. Das gilt auch für Enumkonstanten.

Verwende `enum class`, sofern kein guter Grund für ein gewöhnliches `enum` vorliegt.

<a id="functions"></a>

### Funktionen

Funktionsnamen beginnen groß: `void LaunchOpenBeta();`.

Funktionsnamen beginnen mit einem Verb.

<a id="global-like-variables"></a>

## Globalartige Variablen

Vermeide globale, statische und threadlokale Variablen oder Konstanten mit komplexer Struktur oder Destruktoren. Die Zerstörungsreihenfolge globaler Objekte ist undefiniert und kann unerwartete Fehler verursachen.

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

## Const-Qualifizierer

<a id="variables-1"></a>

### Variablen

Verwende möglichst `constexpr`.

Deklariere Klassenfelder und -methoden möglichst const.

Faustregeln für Funktionsargumente:

1. Soll der Wert außerhalb der Funktion geändert werden? `void Func(SomeType& outVar)`
2. Ist der Typ primitiv (`enum`, `int64_t`, `char` usw.)? Als nicht konstante Kopie übergeben: `void Func(int64_t var)`
3. Wird Move-Semantik benötigt? `SomeType var` für Kopieren und Verschieben, `SomeType&& var` für ausschließliches Verschieben.
4. Sonst als konstante Referenz übergeben, etwa `void Func(const std::string& message, const MyStruct& data)`.

Markiere lokale Variablen und per Wert übergebene Argumente nicht als const. Werte mit kleinem Gültigkeitsbereich benötigen keine const-Markierung.

Bevorzuge konstante globale/statische/threadlokale Variablen, solange kein guter Grund für Veränderlichkeit besteht.

<a id="methods"></a>

### Methoden

Deklariere Methoden möglichst const.

Const-Methoden müssen threadsicher sein.

<a id="types"></a>

### Typen

Bevorzuge `int32_t` gegenüber `int`, `int16_t` gegenüber `short` usw.

<a id="macros"></a>

### Makros

Nach `#endif` muss ein Kommentar folgen:

```c++
#ifdef _DEBUG
    auto debugFunctionJson = f.dump();
#endif // _DEBUG
```

Vermeide eigene Makros, sofern sich die Logik mit C++-Templates umsetzen lässt; prüfe auch andernfalls den Bedarf sorgfältig. Falls ein Makro nötig ist, entferne es mit `#undef`, sobald es nicht mehr gebraucht wird.

Beispiel:

```c++
#define DO_MAGIC(a, b, c) ...
DO_MAGIC(foo, bar, baz)
DO_MAGIC(fizz, buzz, fizzbuzz)
#undef DO_MAGIC
```

<a id="application-to-existing-code"></a>

## Anwendung auf bestehenden Code

Der vorhandene Projektcode kann diese Regeln stellenweise verletzen. Wenn du an einer solchen Stelle arbeitest, ziehe eine Korrektur in Betracht.
