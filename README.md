# SkyMP

[![Discord Chat](https://img.shields.io/discord/699653182946803722?label=Discord&logo=Discord)](https://discord.gg/k39uQ9Yudt)
[![PR's Welcome](https://img.shields.io/badge/PRs%20-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Players](https://skymp-badges.vercel.app/badges/players_online.svg)](https://discord.gg/k39uQ9Yudt)
[![Servers](https://skymp-badges.vercel.app/badges/servers_online.svg)](https://discord.gg/k39uQ9Yudt)

SkyMP is an open-source multiplayer project for Skyrim.

This repository is the main home of the project: server, client, admin web UI, build system, docs, and CI pipelines are all managed here.

## Language Quick Links

| Language | Start Here |
| --- | --- |
| Deutsch | [Zum deutschen Abschnitt](#deutsch) |
| English | [Go to English section](#english) |
| Русский | [Перейти к русскому разделу](#русский) |
| Español | [Ir a la sección en español](#español) |

## Deutsch

### Überblick

SkyMP bringt Multiplayer nach Skyrim. Dieses Repository ist die zentrale Anlaufstelle für Betrieb, Entwicklung und Beiträge.

### Wofür du dieses Repository nutzen kannst

1. Deinen eigenen Server betreiben.
2. Client und Server selbst bauen.
3. Mit Code, Dokumentation und Tests beitragen.

### Schnellstart

#### Server starten

1. Starte mit [docs/docs_running_a_server.md](docs/docs_running_a_server.md).
2. Richte die Build-Umgebung mit [CONTRIBUTING.md](CONTRIBUTING.md) ein.
3. Erzeuge eine `server-settings.json` aus der generierten Vorlage.
4. Starte den Server mit `build/launch_server.bat` oder `build/launch_server.sh`.
5. Öffne das Admin-Dashboard unter `http://<host>:<uiPort>/admin`.

#### Lokal bauen

1. Folge [CONTRIBUTING.md](CONTRIBUTING.md).
2. Baue das Projekt.
3. Artefakte findest du unter `build/dist`.
4. Server unter `build/dist/server`.
5. Client unter `build/dist/client`.

#### Beitreten als Spieler

1. Installiere Skyrim SE oder AE.
2. Installiere SKSE gemäß [docs/docs_client_installation.md](docs/docs_client_installation.md).
3. Falls du selbst baust: kopiere `build/dist/client` in deinen Skyrim-Ordner.
4. Starte das Spiel und verbinde dich mit deinem Server.

Wenn du keinen eigenen Launcher bauen möchtest, ist dieses Nexus-Tool eine praktische Option:

https://www.nexusmods.com/skyrimspecialedition/mods/30379?tab=files

### Plattformstatus

- Windows-Server: stabil und gut unterstützt.
- Linux-Server: empfohlen auf Ubuntu 24.04 und ähnlichen glibc-basierten Distributionen.
- Client: Schwerpunkt weiterhin Windows.

### Wichtige Bereiche im Repository

- `skymp5-server`: Server-Logik und Admin-API.
- `skymp5-front`: Admin-Dashboard.
- `skymp5-client`: Client-Integration.
- `docs`: Dokumentation.
- `cmake`, `overlay_ports`, `overlay_triplets`, `vcpkg`: Build- und Dependency-Infrastruktur.

### Wichtige Dokumente

- Einstieg in Build und Entwicklung: [CONTRIBUTING.md](CONTRIBUTING.md)
- Serverbetrieb: [docs/docs_running_a_server.md](docs/docs_running_a_server.md)
- Client-Installation: [docs/docs_client_installation.md](docs/docs_client_installation.md)
- Server-Konfiguration: [docs/docs_server_configuration_reference.md](docs/docs_server_configuration_reference.md)
- Ports und Netzwerk: [docs/docs_server_ports_usage.md](docs/docs_server_ports_usage.md)
- Projektstruktur: [docs/docs_repository_structure.md](docs/docs_repository_structure.md)

### Rechtliches

- Nutzungsbedingungen: [TERMS.md](TERMS.md)
- Drittanbieter-Lizenzen: [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)

## English

### Overview

SkyMP brings multiplayer to Skyrim. This repository is the central place for running servers, building binaries, and contributing to the project.

### What you can do here

1. Host your own server.
2. Build client and server from source.
3. Contribute code, docs, and tests.

### Quick Start

#### Run a server

1. Begin with [docs/docs_running_a_server.md](docs/docs_running_a_server.md).
2. Set up your environment using [CONTRIBUTING.md](CONTRIBUTING.md).
3. Generate your `server-settings.json` from the base template.
4. Start with `build/launch_server.bat` or `build/launch_server.sh`.
5. Open the admin dashboard at `http://<host>:<uiPort>/admin`.

#### Build locally

1. Follow [CONTRIBUTING.md](CONTRIBUTING.md).
2. Build the project.
3. Output is in `build/dist`.
4. Server package: `build/dist/server`.
5. Client package: `build/dist/client`.

#### Join as a player

1. Install Skyrim SE or AE.
2. Install SKSE as described in [docs/docs_client_installation.md](docs/docs_client_installation.md).
3. If you build locally, copy `build/dist/client` into your Skyrim folder.
4. Launch the game and connect to your server.

If you do not want to build your own launcher, this Nexus tool is a practical option:

https://www.nexusmods.com/skyrimspecialedition/mods/30379?tab=files

### Platform status

- Windows server: stable and well supported.
- Linux server: best on Ubuntu 24.04 and similar glibc-based distributions.
- Client runtime: still primarily Windows-focused.

### Key areas in this repo

- `skymp5-server`: server runtime and admin APIs.
- `skymp5-front`: admin dashboard frontend.
- `skymp5-client`: client-side integration.
- `docs`: full documentation.
- `cmake`, `overlay_ports`, `overlay_triplets`, `vcpkg`: build and dependency stack.

### Essential docs

- Build and dev setup: [CONTRIBUTING.md](CONTRIBUTING.md)
- Running a server: [docs/docs_running_a_server.md](docs/docs_running_a_server.md)
- Client installation: [docs/docs_client_installation.md](docs/docs_client_installation.md)
- Server config reference: [docs/docs_server_configuration_reference.md](docs/docs_server_configuration_reference.md)
- Ports and networking: [docs/docs_server_ports_usage.md](docs/docs_server_ports_usage.md)
- Repository structure: [docs/docs_repository_structure.md](docs/docs_repository_structure.md)

### Legal

- Terms of use: [TERMS.md](TERMS.md)
- Third-party licenses: [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)

## Русский

### Обзор

SkyMP добавляет мультиплеер в Skyrim. Этот репозиторий - центральная точка проекта для запуска сервера, сборки клиента и участия в разработке.

### Что можно делать в этом репозитории

1. Поднять собственный сервер.
2. Собрать клиент и сервер из исходников.
3. Помогать проекту кодом, документацией и тестами.

### Быстрый старт

#### Запуск сервера

1. Начните с [docs/docs_running_a_server.md](docs/docs_running_a_server.md).
2. Подготовьте окружение по [CONTRIBUTING.md](CONTRIBUTING.md).
3. Сгенерируйте `server-settings.json` из базового шаблона.
4. Запустите сервер через `build/launch_server.bat` или `build/launch_server.sh`.
5. Откройте панель администратора: `http://<host>:<uiPort>/admin`.

#### Локальная сборка

1. Следуйте [CONTRIBUTING.md](CONTRIBUTING.md).
2. Соберите проект.
3. Результаты лежат в `build/dist`.
4. Сервер: `build/dist/server`.
5. Клиент: `build/dist/client`.

#### Подключение игрока

1. Установите Skyrim SE или AE.
2. Установите SKSE по [docs/docs_client_installation.md](docs/docs_client_installation.md).
3. При локальной сборке скопируйте `build/dist/client` в папку Skyrim.
4. Запустите игру и подключитесь к серверу.

Если не хотите делать собственный лаунчер, можно использовать инструмент с Nexus:

https://www.nexusmods.com/skyrimspecialedition/mods/30379?tab=files

### Статус платформ

- Windows-сервер: стабильная и зрелая поддержка.
- Linux-сервер: лучший опыт на Ubuntu 24.04 и других дистрибутивах на базе glibc.
- Клиент: основной фокус по-прежнему на Windows.

### Ключевые разделы репозитория

- `skymp5-server`: сервер и admin API.
- `skymp5-front`: веб-панель администратора.
- `skymp5-client`: клиентская интеграция.
- `docs`: документация.
- `cmake`, `overlay_ports`, `overlay_triplets`, `vcpkg`: инфраструктура сборки и зависимостей.

### Важные документы

- Сборка и разработка: [CONTRIBUTING.md](CONTRIBUTING.md)
- Запуск сервера: [docs/docs_running_a_server.md](docs/docs_running_a_server.md)
- Установка клиента: [docs/docs_client_installation.md](docs/docs_client_installation.md)
- Настройки сервера: [docs/docs_server_configuration_reference.md](docs/docs_server_configuration_reference.md)
- Порты и сеть: [docs/docs_server_ports_usage.md](docs/docs_server_ports_usage.md)
- Структура репозитория: [docs/docs_repository_structure.md](docs/docs_repository_structure.md)

### Правовая информация

- Условия использования: [TERMS.md](TERMS.md)
- Сторонние лицензии: [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)

## Español

### Resumen

SkyMP lleva el modo multijugador a Skyrim. Este repositorio es el centro del proyecto para operar servidores, compilar componentes y colaborar en el desarrollo.

### Qué puedes hacer aquí

1. Alojar tu propio servidor.
2. Compilar cliente y servidor desde código fuente.
3. Contribuir con código, documentación y pruebas.

### Inicio rápido

#### Ejecutar un servidor

1. Empieza con [docs/docs_running_a_server.md](docs/docs_running_a_server.md).
2. Prepara tu entorno con [CONTRIBUTING.md](CONTRIBUTING.md).
3. Genera `server-settings.json` desde la plantilla base.
4. Inicia con `build/launch_server.bat` o `build/launch_server.sh`.
5. Abre el panel de administración en `http://<host>:<uiPort>/admin`.

#### Compilar en local

1. Sigue [CONTRIBUTING.md](CONTRIBUTING.md).
2. Compila el proyecto.
3. La salida queda en `build/dist`.
4. Servidor: `build/dist/server`.
5. Cliente: `build/dist/client`.

#### Unirte como jugador

1. Instala Skyrim SE o AE.
2. Instala SKSE según [docs/docs_client_installation.md](docs/docs_client_installation.md).
3. Si compilas localmente, copia `build/dist/client` a tu carpeta de Skyrim.
4. Inicia el juego y conéctate a tu servidor.

Si no quieres crear tu propio launcher, esta herramienta de Nexus es una opción práctica:

https://www.nexusmods.com/skyrimspecialedition/mods/30379?tab=files

### Estado de plataforma

- Servidor Windows: soporte estable.
- Servidor Linux: la mejor experiencia es en Ubuntu 24.04 y otras distribuciones basadas en glibc.
- Cliente: enfoque principal todavía en Windows.

### Áreas clave del repositorio

- `skymp5-server`: servidor y APIs de administración.
- `skymp5-front`: frontend del panel de administración.
- `skymp5-client`: integración del lado cliente.
- `docs`: documentación completa.
- `cmake`, `overlay_ports`, `overlay_triplets`, `vcpkg`: infraestructura de build y dependencias.

### Documentos clave

- Configuración de build y desarrollo: [CONTRIBUTING.md](CONTRIBUTING.md)
- Ejecutar un servidor: [docs/docs_running_a_server.md](docs/docs_running_a_server.md)
- Instalación del cliente: [docs/docs_client_installation.md](docs/docs_client_installation.md)
- Configuración del servidor: [docs/docs_server_configuration_reference.md](docs/docs_server_configuration_reference.md)
- Puertos y red: [docs/docs_server_ports_usage.md](docs/docs_server_ports_usage.md)
- Estructura del repositorio: [docs/docs_repository_structure.md](docs/docs_repository_structure.md)

### Legal

- Términos de uso: [TERMS.md](TERMS.md)
- Licencias de terceros: [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)
