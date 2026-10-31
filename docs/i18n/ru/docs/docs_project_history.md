[Deutsch](../../de/docs/docs_project_history.md) · [English](../../en/docs/docs_project_history.md) · [Русский](docs_project_history.md)

<a id="project-history"></a>

# История проекта

21 ноября 2015 года: мы решили начать проект и приступили к разработке.

### SkyMP 0.0.1 Pre Alpha

Написана на C++, только базовая синхронизация движения. При создании собственного Git-репозитория не было.

Впервые проверена 17 сентября 2016 года.

- [plugin_example (skymp dll)](https://github.com/Pospelove/plugin_example-skymp-dll)

### SkyMP ???

Некоторые версии потерялись, потому что я не пользовался Git!

### SkyMP 0.9, 1.0+

Написана на C++. Вдохновлена GTA SA-MP и TES3MP. Март 2017 — июнь 2018.

Впервые проверена в сентябре 2017 года.

Имеет систему скриптов Lua.

- [SkyMP Client](https://bitbucket.org/skymp_team/skymp-client)
- [SkyMP Dedicated Server](https://bitbucket.org/skymp_team/skymp-dedicated-server)
- [SkyMP Official GameMode](https://bitbucket.org/skymp_team/skymp-official-gamemode) — Lua-gamemode Secunda.
- [Reman](https://bitbucket.org/skymp_team/reman) — средство удалённого запуска сервера на Python.
- [Secunda World](https://bitbucket.org/skymp_team/secunda-world) — резервная копия мира открытой беты 2018.

### SkyMP 2.0+

Написана на C++ и JavaScript. Июнь 2018 — март 2019.

Сервер без состояния; всё хранится в MongoDB.

Имеет клиентские скрипты Lua.

Самая популярная версия на момент этой публикации: более 30 тысяч загрузок на старте открытой беты 2019, 1000/1000 игроков онлайн. К сожалению, из-за технических проблем бету остановили: поддерживать сервер онлайн было очень трудно.

- [skymp2](https://gitlab.com/pospelov/skymp2)
- [skymp2-installer](https://gitlab.com/pospelov/skymp2-installer)
- [secunda2](https://gitlab.com/pospelov/secunda2)
- [skymp2-binaries](https://gitlab.com/pospelov/skymp2-binaries)
- [skymp2-cellhost](https://gitlab.com/pospelov/skymp2-cellhost)
- [skymp2-node](https://gitlab.com/pospelov/skymp2-node)
- [skymp2-scripts](https://gitlab.com/pospelov/skymp2-scripts)
- [skymp2-server](https://gitlab.com/pospelov/skymp2-server)
- [skymp2-loadtest](https://gitlab.com/pospelov/skymp2-loadtest)
- [skymp2-monitor](https://gitlab.com/pospelov/skymp2-monitor)

### SkyMP 3

Написана на C++. Март 2019 — январь 2020.

Скриптовая система на NodeJS.

Ввела асинхронный multiplayer framework, master-сервер, stateless gamemode на удалённых машинах и параллельную обработку ячеек.

Созданы Papyrus VM и lib_espm, но VM ещё не использовалась.

Я интегрировал CEF, точнее CEFSharp.

К сожалению, всё работало ненадёжно: множество ошибок и сбоев.

- [skymp](https://gitlab.com/pospelov/skymp)
- [skymp3](https://gitlab.com/pospelov/skymp3)
- [skymp20](https://gitlab.com/pospelov/skymp20)

### SkyMP 20 / SKYRIM ROYALE

Написана на C++ на основе SkyMP 3. Январь — апрель 2020.

Внутриигровые модульные тесты с покрытием.

Запуск сервера из игрового интерфейса.

Динамическая стена огня.

Основано на SkyMP 20. Мы оставили это первоапрельской шуткой и не выпускали.

https://youtu.be/8ccDfIxCLlc

### Skyrim Multiplayer / SkyMP 5

Написана на C++ и TypeScript. Апрель 2020 — настоящее время.

Создана [Skyrim Platform](https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform) — среда TypeScript для Skyrim SE. Она позволяет очень быстро писать плагины; горячая перезагрузка особенно полезна для прототипов.

Широко тестировалась в 2020 и 2021 годах, но максимальный онлайн был около 70.

- [skymp](https://github.com/skyrim-multiplayer/skymp)
- [skymp-master-api](https://github.com/skyrim-multiplayer/skymp-master-api)
- [papyrus-compiler](https://github.com/skyrim-multiplayer/papyrus-compiler)
