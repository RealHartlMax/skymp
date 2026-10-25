#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const launcherConnection = require('./launcher-connection.cjs');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = value => JSON.stringify(value, null, 2) + '\n';

function authPath(root, settings) {
  const data = path.resolve(root, settings.dataDir || 'data');
  const relative = path.relative(root, data);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Die Ersteinrichtung erwartet dataDir innerhalb des Paketverzeichnisses.');
  }
  return path.join(data, 'admin-auth.json');
}

function isConfigured(root, settings) {
  const file = authPath(root, settings);
  if (fs.existsSync(file)) {
    const auth = readJson(file);
    if (typeof auth.user !== 'string' || !auth.user || auth.algo !== 'scrypt-v1' ||
        !/^scrypt-v1\$\d+\$\d+\$\d+\$[a-f0-9]+\$(?:[a-f0-9]{2})+$/.test(auth.passwordHash)) {
      throw new Error('Vorhandener Admin-Auth-Store ist ungueltig. Er wird nicht ueberschrieben.');
    }
    return true;
  }
  return Boolean(settings.adminUiAuth?.user && settings.adminUiAuth?.password) ||
    Boolean(settings.metricsAuth?.user && settings.metricsAuth?.password);
}

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Einrichtungsdaten muessen ein JSON-Objekt sein.');
  const name = String(input.serverName ?? '').trim();
  if (!name || name.length > 120 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Servername: 1 bis 120 Zeichen.');
  const integer = (value, label, max) => {
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max) {
      throw new Error(`${label}: ganze Zahl zwischen 1 und ${max}.`);
    }
    return Number(value);
  };
  const port = integer(input.port, 'UDP-Spielport', 65535);
  const uiPort = integer(input.uiPort, 'HTTP-Dashboard-Port', 65535);
  const maxPlayers = integer(input.maxPlayers, 'Spielerplaetze', 1000);
  const access = input.access;
  if (!['local', 'private', 'public'].includes(access)) throw new Error('Zugriff: local, private oder public.');
  const publicHost = access === 'local' ? '127.0.0.1' : String(input.publicHost ?? '').trim();
  const domain = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (net.isIP(publicHost) === 6 || (!net.isIP(publicHost) && (!domain.test(publicHost) || /^[\d.]+$/.test(publicHost)))) {
    throw new Error('Oeffentliche IPv4-Adresse oder Domain ohne http://, Port oder Pfad eingeben.');
  }
  if (access !== 'local' && (publicHost === '0.0.0.0' || publicHost === '::' || publicHost === 'localhost' || publicHost === '::1' || publicHost.startsWith('127.'))) {
    throw new Error('Fuer den VPS-Zugriff wird eine erreichbare IP oder Domain benoetigt.');
  }
  const adminUser = String(input.adminUser ?? '').trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(adminUser) || ['__proto__', 'constructor', 'prototype'].includes(adminUser)) throw new Error('Admin-Benutzer: 3 bis 32 Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich; keine reservierten Objektnamen.');
  if (typeof input.password !== 'string' || input.password.length < 10 || input.password.length > 1024) {
    throw new Error('Admin-Passwort: 10 bis 1024 Zeichen.');
  }
  if (input.password !== input.passwordConfirm) throw new Error('Die beiden Passwoerter stimmen nicht ueberein.');
  return { name, port, uiPort, maxPlayers, access, publicHost, adminUser };
}

function configure(root, input) {
  const values = validate(input);
  const settingsFile = path.join(root, 'server-settings.json');
  const lock = path.join(root, '.setup.lock');
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  fs.closeSync(descriptor);
  let createdAuth = false;
  let temporary;
  let file;
  try {
    const settings = readJson(settingsFile);
    if (isConfigured(root, settings)) throw new Error('Server ist bereits eingerichtet. Zugangsdaten und Einstellungen bleiben erhalten.');
    file = authPath(root, settings);
    const connection = input.launcher ? launcherConnection.normalize({
      ...input.launcher, publicHost: values.publicHost, port: values.port,
    }, settings) : {};
    const next = {
      ...settings, ...connection, publicHost: values.publicHost, name: values.name, port: values.port, uiPort: values.uiPort,
      maxPlayers: values.maxPlayers,
      listenHost: values.access === 'local' ? '127.0.0.1' : '0.0.0.0',
      uiListenHost: values.access === 'public' ? '0.0.0.0' : '127.0.0.1',
      masterKey: connection.masterKey || settings.masterKey || '',
      adminApi: { ...settings.adminApi, enabled: true },
      adminUiUsers: { ...settings.adminUiUsers, [values.adminUser]: { role: 'admin' } },
      adminUiRoles: { ...settings.adminUiRoles, [values.adminUser]: 'admin' },
      adminUiMasterUser: values.adminUser,
    };
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(input.password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    const now = Date.now();
    const auth = { user: values.adminUser, algo: 'scrypt-v1', passwordHash: `scrypt-v1$16384$8$1$${salt}$${hash}`, createdAt: now, updatedAt: now };
    const suffix = crypto.randomBytes(6).toString('hex');
    const backup = settingsFile + '.before-setup-' + suffix;
    fs.copyFileSync(settingsFile, backup, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backup, 0o600);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    temporary = settingsFile + '.setup-' + suffix;
    fs.writeFileSync(temporary, json(next), { flag: 'wx', mode: 0o600 });
    const authDescriptor = fs.openSync(file, 'wx', 0o600);
    createdAuth = true;
    try { fs.writeFileSync(authDescriptor, json(auth)); } finally { fs.closeSync(authDescriptor); }
    fs.renameSync(temporary, settingsFile);
    const hostForUrl = net.isIP(values.publicHost) === 6 ? `[${values.publicHost}]` : values.publicHost;
    const dashboard = values.access === 'public' ? `http://${hostForUrl}:${values.uiPort}/admin` : `http://127.0.0.1:${values.uiPort}/admin`;
    const client = {
      master: next.offlineMode ? '' : next.master, 'server-info-ignore': true,
      'server-ip': values.publicHost, 'server-port': values.port,
      'server-master-key': next.offlineMode ? undefined : next.serverUid,
    };
    // These are convenience exports; credentials and configuration are already saved.
    try {
      fs.writeFileSync(path.join(root, 'skymp5-client-settings.example.txt'), json(client));
      fs.writeFileSync(path.join(root, 'VERBINDUNG.txt'), `Dashboard: ${dashboard}\nAdmin-Benutzer: ${values.adminUser}\nSpieler: ${values.publicHost}, UDP ${values.port}\nDashboard: TCP ${values.uiPort}, ${next.uiListenHost}\n\nPasswort wird ausschliesslich als Hash in data/admin-auth.json gespeichert.\nAnmeldung: Steam ist Pflicht; aktueller Launcher und passendes Clientpaket erforderlich. Steam Web API Key bleibt auf dem Server. Gastzugang benoetigt kein Ingame-Konto; bei Kontozugang gilt der ausgewaehlte Anmeldedienst.\nSiehe INGAME-LOGIN.md und README-TEST.md fuer Einrichtung, Firewall und Client-Installation.\n`);
    } catch (error) {
      console.error(`Hinweis: Verbindungsexport konnte nicht geschrieben werden: ${error.message}`);
    }
    return { dashboard, user: values.adminUser, access: values.access, port: values.port, uiPort: values.uiPort };
  } catch (error) {
    if (createdAuth && temporary && fs.existsSync(temporary)) fs.unlinkSync(file);
    throw error;
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.unlinkSync(lock);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let ensure = false, config;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ensure') ensure = true;
    else if (args[i] === '--config' && args[i + 1]) config = args[++i];
    else throw new Error('Aufruf: node setup-server.cjs [--ensure] [--config EINRICHTUNG.json]');
  }
  const root = __dirname;
  const manifest = readJson(path.join(root, 'build-manifest.json'));
  if (Number(process.versions.node.split('.')[0]) < manifest.nodeMinimum) throw new Error(`Node.js ${manifest.nodeMinimum} oder neuer wird benoetigt.`);
  const actual = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  if (manifest.platform !== actual) throw new Error(`Paket ${manifest.platform}, dieses System ${actual}. Bitte das passende Paket verwenden.`);
  if (ensure && manifest.installationMode !== 'first-run') return;
  const settings = readJson(path.join(root, 'server-settings.json'));
  if (isConfigured(root, settings)) {
    if (config) throw new Error('Server ist bereits eingerichtet. Die Konfigurationsdatei wird nicht angewendet.');
    if (!ensure) console.log('Server ist bereits eingerichtet. Vorhandener Zugang bleibt erhalten. Einstellungen: server-settings.json');
    return;
  }
  // --config is an explicit provisioning interface; normal launches use the browser.
  if (config) {
    configure(root, readJson(path.resolve(config)));
    return;
  }
  await require('./setup-web.cjs').runBrowserSetup(root, { startAfterSetup: ensure });
}

module.exports = { configure, isConfigured, validate };
if (require.main === module) main().catch(error => { console.error(`Ersteinrichtung: ${error.message}`); process.exitCode = process.exitCode || 1; });
