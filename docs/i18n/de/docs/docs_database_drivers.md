[Deutsch](docs_database_drivers.md) · [English](../../en/docs/docs_database_drivers.md) · [Русский](../../ru/docs/docs_database_drivers.md)

<a id="database-drivers"></a>

# Datenbanktreiber

Skyrim Multiplayer bildet das Verhalten des ursprünglichen Spiels nach und speichert daher im Gegensatz zu vielen Multiplayer-Mods anderer Spiele Welt- und Spielerdaten automatisch.

Diese Seite beschreibt Unterschiede und Funktionen der Datenbanktreiber.

## file

Skyrim Multiplayer verwendet standardmäßig den Treiber `file` und `databaseName: world`. Ohne Konfigurationsänderung werden alle Daten im Unterordner `world` des Serverordners gespeichert. Nur relative Pfade werden unterstützt.

```json5
{
  // ...
  databaseDriver: 'file',
  databaseName: 'world',
  // ...
}
```

## mongodb

Speichert Daten in MongoDB. Gedacht für Server mit öffentlichen Internetspielern, nicht für Tester oder wenige Freunde im Koop-Spiel.

`databaseUri` ist die Mongo-URI zur Verbindung mit einer entfernten MongoDB-Instanz.

Als Cloud-Datenbankdienst empfehlen wir [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

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

Ähnlich wie `file`, verwendet aber ein ZIP-Archiv statt eines Ordners. `databaseName` ist standardmäßig `world`; der Server speichert die Daten dann in `world.zip`.

```json5
{
  // ...
  databaseDriver: 'zip',
  databaseName: 'world',
  // ...
}
```

## migration

Ein spezieller Treiber ermöglicht den laufenden Wechsel zwischen Datenbanktypen. Sichere vor seiner Verwendung alle Daten.

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
