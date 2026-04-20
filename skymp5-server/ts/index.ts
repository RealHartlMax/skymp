import * as ui from "./ui";

// @ts-ignore
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install({
  retrieveSourceMap: function (source: string) {
    if (source.endsWith('skymp5-server.js')) {
      return {
        url: 'original.js',
        map: require('fs').readFileSync('dist_back/skymp5-server.js.map', 'utf8')
      };
    }
    return null;
  }
});

import * as scampNative from "./scampNative";
import { Settings } from "./settings";
import { System } from "./systems/system";
import { MasterClient } from "./systems/masterClient";
import { Spawn } from "./systems/spawn";
import { Login } from "./systems/login";
import { DiscordBanSystem } from "./systems/discordBanSystem";
import { MasterApiBalanceSystem } from "./systems/masterApiBalanceSystem";
import { EventEmitter } from "events";
import { pid } from "process";
import * as fs from "fs";
import * as chokidar from "chokidar";
import * as path from "path";
import * as os from "os";

import * as manifestGen from "./manifestGen";
import { createScampServer } from "./scampNative";
import { MetricsSystem, tickDurationHistogram, tickDurationSummary } from "./systems/metricsSystem";

const gamemodeCache = new Map<string, string>();

function requireTemp(module: string) {
  // https://blog.mastykarz.nl/create-temp-directory-app-node-js/
  let tmpDir;
  const appPrefix = 'skymp5-server';
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix));

    const contents = fs.readFileSync(module, 'utf8');
    const tempPath = path.join(tmpDir, Math.random() + '-' + Date.now() + '.js');
    fs.writeFileSync(tempPath, contents);

    require(tempPath);
  } catch (e) {
    console.error(e.stack);
  } finally {
    try {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
    }
  }
}

function requireUncached(
  module: string,
  clear: () => void,
  server: scampNative.ScampServer
): void {
  let gamemodeContents = fs.readFileSync(require.resolve(module), "utf8");

  // Reload gamemode.js only if there are real changes
  const gamemodeContentsOld = gamemodeCache.get(module);
  if (gamemodeContentsOld !== gamemodeContents) {
    gamemodeCache.set(module, gamemodeContents);

    while (1) {
      try {
        clear();

        // In native module we now register mp-api methods into the ScampServer class
        // This workaround allows code that is bound to global 'mp' object to run
        // @ts-ignore
        globalThis.mp = globalThis.mp || server;

        requireTemp(module);
        return;
      } catch (e) {
        if (`${e}`.indexOf("'JsRun' returned error 0x30002") === -1) {
          throw e;
        } else {
          console.log("Bad syntax, ignoring");
          return;
        }
      }
    }
  }
}

const setupStreams = (scampNative: any) => {
  class LogsStream {
    constructor(private logLevel: string) {
    }

    write(chunk: Buffer, encoding: string, callback: () => void) {
      // @ts-ignore
      const str = chunk.toString(encoding);
      if (str.trim().length > 0) {
        ui.pushServerLogChunk(this.logLevel === 'error' ? 'error' : 'info', str);
        scampNative.writeLogs(this.logLevel, str);
      }
      callback();
    }
  }

  const infoStream = new LogsStream('info');
  const errorStream = new LogsStream('error');
  // @ts-ignore
  process.stdout.write = (chunk: Buffer, encoding: string, callback: () => void) => {
    infoStream.write(chunk, encoding, callback);
  };
  // @ts-ignore
  process.stderr.write = (chunk: Buffer, encoding: string, callback: () => void) => {
    errorStream.write(chunk, encoding, callback);
  };
};

const setupGamemode = (server: any, gamemodePath: string) => {
  const clear = () => server.clear();

  const toAbsolute = (p: string) => {
    if (path.isAbsolute(p)) {
      return path.normalize(p);
    }
    return path.normalize(path.resolve("", p));
  };

  const getAlternativeNtfsAliasPath = (absolutePath: string): string | null => {
    if (process.platform !== 'win32') {
      return null;
    }

    const normalized = path.normalize(absolutePath);
    const lower = normalized.toLowerCase();
    const dRoot = 'd:\\github\\skymp';
    const cRoot = 'c:\\github\\skymp';

    const isAtOrInside = (value: string, root: string) => value === root || value.startsWith(root + '\\');

    if (isAtOrInside(lower, dRoot)) {
      return 'C:' + normalized.slice(2);
    }
    if (isAtOrInside(lower, cRoot)) {
      return 'D:' + normalized.slice(2);
    }
    return null;
  };

  const resolveExistingPath = (p: string): string => {
    const absolute = toAbsolute(p);
    const candidates = [absolute];
    const aliasCandidate = getAlternativeNtfsAliasPath(absolute);
    if (aliasCandidate) {
      candidates.push(aliasCandidate);
    }

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      try {
        return fs.realpathSync.native(candidate);
      } catch {
        return candidate;
      }
    }

    return absolute;
  };

  const absoluteGamemodePath = resolveExistingPath(gamemodePath);
  console.log(`Gamemode path is "${absoluteGamemodePath}"`);

  if (!fs.existsSync(absoluteGamemodePath)) {
    console.log(
      `Error during loading a gamemode from "${absoluteGamemodePath}" - file or directory does not exist`,
    );
    return;
  }

  try {
    requireUncached(absoluteGamemodePath, clear, server);
  } catch (e) {
    console.error(e);
  }

  const watcher = chokidar.watch(absoluteGamemodePath, {
    ignored: /^\./,
    persistent: true,
    awaitWriteFinish: true,
  });

  const numReloads = { n: 0 };

  const reloadGamemode = () => {
    try {
      requireUncached(absoluteGamemodePath, clear, server);
      numReloads.n++;
    } catch (e) {
      console.error(e);
    }
  };

  const reloadGamemodeTimeout = function () {
    const n = numReloads.n;
    setTimeout(
      () => (n === numReloads.n ? reloadGamemode() : undefined),
      1000,
    );
  };

  watcher.on("add", reloadGamemodeTimeout);
  watcher.on("addDir", reloadGamemodeTimeout);
  watcher.on("change", reloadGamemodeTimeout);
  watcher.on("unlink", reloadGamemodeTimeout);
  watcher.on("error", function (error) {
    console.error("Error happened in chokidar watch", error);
  });
};

const main = async () => {
  const settingsObject = await Settings.get();
  const {
    port, master, maxPlayers, name, masterKey, offlineMode, gamemodePath
  } = settingsObject;

  const log = console.log;
  const systems = new Array<System>();
  systems.push(
    new MetricsSystem(),
    new MasterClient(log, port, master, maxPlayers, name, masterKey, 5000, offlineMode),
    new Spawn(log),
    new Login(log, maxPlayers, master, port, masterKey, offlineMode),
    new DiscordBanSystem(),
    new MasterApiBalanceSystem(log, maxPlayers, master, port, masterKey, offlineMode),
  );

  setupStreams(scampNative.getScampNative());

  manifestGen.generateManifest(settingsObject);
  ui.main(settingsObject);

  let server: any;

  try {
    server = createScampServer(settingsObject.allSettings);
    ui.setServer(server);
  } catch (e) {
    console.error(e);
    console.error(`Stopping the server due to the previous error`);
    process.exit(-1);
  }
  const ctx = { svr: server, gm: new EventEmitter() };

  console.log(`Current process ID is ${pid}`);

  (async () => {
    while (1) {
      const endTimerHistogram = tickDurationHistogram.startTimer();
      const endTimerSummary = tickDurationSummary.startTimer();
      try {
        server.tick();
        await new Promise((r) => setTimeout(r, 1));
      } catch (e) {
        console.error(`in server.tick:\n${e.stack}`);
      } finally {
        endTimerHistogram();
        endTimerSummary();
      }
    }
  })();

  for (const system of systems) {
    if (system.initAsync) {
      await system.initAsync(ctx);
    }
    log(`Initialized ${system.systemName}`);
    if (system.updateAsync)
      (async () => {
        while (1) {
          await new Promise((r) => setTimeout(r, 1));
          try {
            await system.updateAsync(ctx);
          } catch (e) {
            console.error(e);
          }
        }
      })();
  }

  server.on("connect", (userId: number) => {
    log("connect", userId);
    for (const system of systems) {
      try {
        if (system.connect) {
          system.connect(userId, ctx);
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  server.on("disconnect", (userId: number) => {
    log("disconnect", userId);
    for (const system of systems) {
      try {
        if (system.disconnect) {
          system.disconnect(userId, ctx);
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  server.on("customPacket", (userId: number, rawContent: string) => {
    const content = JSON.parse(rawContent);

    const type = `${content.customPacketType}`;
    delete content.customPacketType;

    if (type === 'clientTelemetry') {
      const source = typeof content.source === 'string'
        ? String(content.source).slice(0, 80)
        : 'skymp5-client';
      const sessionId = typeof content.sessionId === 'string'
        ? String(content.sessionId).slice(0, 64)
        : undefined;
      const receivedAt = Date.now();

      const events = Array.isArray(content.events) ? content.events : [content];
      const ip = (() => {
        try {
          return ctx.svr.getUserIp(userId);
        } catch {
          return '';
        }
      })();

      const safeEvents = events.slice(0, 50).map((entry: any) => {
        const eventName = String(entry?.name ?? 'unknown').slice(0, 120);
        const levelRaw = String(entry?.level ?? 'info').toLowerCase();
        const level: 'info' | 'warn' | 'error' = (
          levelRaw === 'warn' || levelRaw === 'error' || levelRaw === 'info'
        ) ? levelRaw : 'info';

        let details = '';
        if (typeof entry?.details === 'string') {
          details = entry.details;
        } else if (entry?.details !== undefined) {
          try {
            details = JSON.stringify(entry.details);
          } catch {
            details = String(entry.details);
          }
        }

        const tsRaw = Number(entry?.ts);

        return {
          userId,
          ip,
          source,
          sessionId,
          event: eventName,
          level,
          ts: Number.isFinite(tsRaw) ? tsRaw : receivedAt,
          receivedAt,
          details,
        };
      });

      ui.pushClientRuntimeEvents(safeEvents);
    }

    for (const system of systems) {
      try {
        if (system.customPacket)
          system.customPacket(userId, type, content, ctx);
      } catch (e) {
        console.error(e);
      }
    }
  });

  server.on("customPacket", (userId: number, content: string) => {
    // At this moment we don't have any custom packets
  });

  // It's important to call this before gamemode
  try {
    server.attachSaveStorage();
  } catch (e) {
    console.error(e);
    console.error(`Stopping the server due to the previous error`);
    process.exit(-1);
  }

  setupGamemode(server, gamemodePath);
};

main();

// This is needed at least to handle axios errors in masterClient
// TODO: implement alerts
process.on("unhandledRejection", (...args) => {
  console.error("[!!!] unhandledRejection")
  console.error(...args);
});

// setTimeout on gamemode should not be able to kill the entire server
// TODO: implement alerts
process.on("uncaughtException", (...args) => {
  console.error("[!!!] uncaughtException")
  console.error(...args);
});
