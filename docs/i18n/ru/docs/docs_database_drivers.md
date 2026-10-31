[Deutsch](../../de/docs/docs_database_drivers.md) · [English](../../en/docs/docs_database_drivers.md) · [Русский](docs_database_drivers.md)

<a id="database-drivers"></a>

# Драйверы базы данных

Skyrim Multiplayer повторяет поведение исходной игры и поэтому автоматически сохраняет данные мира и игроков, в отличие от многих многопользовательских модов других игр.

Здесь описаны различия и возможности драйверов базы данных.

## file

По умолчанию Skyrim Multiplayer использует драйвер `file` и `databaseName: world`. Если конфигурация не изменена, сервер сохраняет данные в подкаталоге `world` серверного каталога. Поддерживаются только относительные пути.

```json5
{
  // ...
  databaseDriver: 'file',
  databaseName: 'world',
  // ...
}
```

## mongodb

Хранит данные в MongoDB. Предназначен для серверов с реальными игроками из Интернета, а не для тестеров или нескольких друзей в совместной игре.

`databaseUri` — Mongo URI для подключения к удалённому экземпляру MongoDB.

В качестве облачного сервиса базы данных рекомендуем [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

```json5
{
  // ...
  databaseDriver: 'mongodb',
  databaseName: 'db',
  databaseUri: 'mongodb://<user>:<pass>@cluster0-shard-00-00.xxxxx.mongodb.net:27017,cluster0-shard-00-01.xxxxx.mongodb.net:27017,cluster0-shard-00-02.xxxxx.mongodb.net:27017/<dbname>?ssl=true&replicaSet=atlas-a16dc0-shard-0&authSource=admin&retryWrites=true&w=majority',
  // ...
}
```

## zip

Аналогичен `file`, но использует ZIP-архив вместо каталога. Значение `databaseName` по умолчанию — `world`; данные будут храниться в `world.zip`.

```json5
{
  // ...
  databaseDriver: 'zip',
  databaseName: 'world',
  // ...
}
```

## migration

Специальный драйвер позволяет переходить между типами баз данных на лету. Перед использованием обязательно сохраните резервные копии всего.

```json5
{
  // ...
  databaseDriver: 'migration',
  databaseOld: {
    databaseDriver: 'file',
    databaseName: 'world',
  },
  databaseNew: {
    databaseDriver: 'mongodb',
    // ...
  },
  // ...
}
```
