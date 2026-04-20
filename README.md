# SkyMP

[![Discord Chat](https://img.shields.io/discord/699653182946803722?label=Discord&logo=Discord)](https://discord.gg/k39uQ9Yudt)
[![PR's Welcome](https://img.shields.io/badge/PRs%20-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Players](https://skymp-badges.vercel.app/badges/players_online.svg)](https://discord.gg/k39uQ9Yudt)
[![Servers](https://skymp-badges.vercel.app/badges/servers_online.svg)](https://discord.gg/k39uQ9Yudt)

SkyMP is an open-source multiplayer project for Skyrim.

This repository is the main source monorepo. It contains server, client, shared systems, frontend admin dashboard, docs, build scripts, and CI workflows.

## What This Repo Is For

You can use this repository in three practical ways:

1. Host your own dedicated server.
2. Build client and server from source.
3. Contribute code, docs, tests, or tooling.

## Quick Start Paths

### Path A: Host a Server (Recommended Start)

1. Read [docs/docs_running_a_server.md](docs/docs_running_a_server.md).
2. Build from source using [CONTRIBUTING.md](CONTRIBUTING.md).
3. Configure `server-settings.json` from the generated base template.
4. Start server with `build/launch_server.bat` (Windows) or `build/launch_server.sh` (Linux).
5. Open admin dashboard at `http://<host>:<uiPort>/admin`.

### Path B: Build Client + Server Locally

1. Follow prerequisites in [CONTRIBUTING.md](CONTRIBUTING.md).
2. Configure and build.
3. Artifacts are generated under `build/dist`.
4. Server package is in `build/dist/server`.
5. Client package is in `build/dist/client`.

### Path C: Contribute to Development

1. Setup dev environment via [CONTRIBUTING.md](CONTRIBUTING.md).
2. Use docs index at [docs/README.md](docs/README.md).
3. Submit PRs with tests and updated docs.

## Hosting Support Status

Dedicated server hosting is an active direction on both Windows and Linux.

Windows:
Works and includes launcher convenience scripts.

Linux:
Best supported path is Ubuntu 24.04 and other glibc-based distributions. See Ubuntu production notes in [docs/docs_running_a_server.md](docs/docs_running_a_server.md).

Client runtime remains Windows-first.

## Client Join Guide

This is the practical flow for joining your server after it is running.

1. Install Skyrim SE/AE.
2. Install SKSE from https://skse.silverlock.org/ (Current SE build), as required by [docs/docs_client_installation.md](docs/docs_client_installation.md).
3. If you build client from source, copy files from `build/dist/client` into your Skyrim folder as described in [docs/docs_client_installation.md](docs/docs_client_installation.md).
4. Start the game through your preferred launcher workflow and connect to your SkyMP server.

### Recommended Tool If You Do Not Build Your Own Launcher

If you do not want to build your own launcher, the following Nexus tool is a practical option:

https://www.nexusmods.com/skyrimspecialedition/mods/30379?tab=files

Use that tool according to its own mod-page instructions for installation and launch flow.

## Repository Map

Important top-level parts:

- `skymp5-server`: Dedicated server runtime, admin APIs, backend logic.
- `skymp5-front`: Admin dashboard frontend.
- `skymp5-client`: Client-side integration code.
- `docs`: Project documentation.
- `cmake`, `overlay_ports`, `overlay_triplets`, `vcpkg`: Build and dependency infrastructure.
- `build.sh`, `CMakeLists.txt`, `Dockerfile`: Build entry points and container path.

## Most Important Docs

- Build and source setup: [CONTRIBUTING.md](CONTRIBUTING.md)
- Run and configure server: [docs/docs_running_a_server.md](docs/docs_running_a_server.md)
- Client installation from build output: [docs/docs_client_installation.md](docs/docs_client_installation.md)
- Server config reference: [docs/docs_server_configuration_reference.md](docs/docs_server_configuration_reference.md)
- Server ports: [docs/docs_server_ports_usage.md](docs/docs_server_ports_usage.md)
- Project structure: [docs/docs_repository_structure.md](docs/docs_repository_structure.md)

## Terms and Licenses

- Terms of use: [TERMS.md](TERMS.md)
- Third-party licenses: [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)

## Development with GitHub Codespaces

[![Create Codespace](https://img.shields.io/badge/Codespace-Launch-blue?logo=github)](https://github.com/codespaces/new?repo=skyrim-multiplayer/skymp&ref=main)

## CI and Deployment Notes

- PR builds for Windows, Skyrim VR, and Emscripten run via a shared action at `.github/actions/pr_base/action.yml`.
- You can start Windows and Linux CI builds manually from the GitHub Actions tab via `.github/workflows/pr-windows-flatrim.yml` and `.github/workflows/pr-linux-variants.yml` (`Run workflow`).
- For server-hosting artifacts specifically, use `.github/workflows/running_server_files.yml` (`Run workflow`) to build dedicated server files for Windows and Linux.
- Deploy workflows post status updates to Discord using the `DEPLOY_STATUS_WEBHOOK` repository secret.
- Installer binaries are not built in this repository.
- Pushes to `main` trigger `.github/workflows/trigger-installer.yml`, which sends a `repository_dispatch` event to the installer repository.
- Installer dispatch target is configured via repository variable `INSTALLER_REPOSITORY` (format `owner/repo`).
