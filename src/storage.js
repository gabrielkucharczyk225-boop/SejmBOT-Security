// Warstwa zapisu danych. Dla każdego serwera (guildId) źródłem prawdy może być:
//  - kanał na Discordzie (zalecane - nic nie znika przy redeployu, bo to Discord jest "dyskiem"),
//  - MongoDB (jeśli ustawiłeś MONGODB_URI),
//  - pamięć (fallback - znika po restarcie).
// Kanał na Discordzie ma PIERWSZEŃSTWO dla danego serwera, jeśli jest skonfigurowany.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { BACKUP } = require('./config');

// ============ Lekki plik-cache TYLKO dla configu (dodatkowa siatka bezpieczeństwa) ============
// UWAGA: na Render dysk jest kasowany przy REDEPLOYU - to nie jest główny mechanizm trwałości.
const CACHE_FILE = path.join(__dirname, '..', 'data', 'config-cache.json');
function readCacheFile() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch { return {}; }
}
function writeCacheFile(all) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch (err) { console.error('[cache] zapis nie powiódł się:', err.message); }
}

// ============ Adapter: pamięć (fallback) ============
class MemoryAdapter {
  constructor() { this.cols = new Map(); }
  c(n) { if (!this.cols.has(n)) this.cols.set(n, new Map()); return this.cols.get(n); }
  async get(col, id) { return this.c(col).get(id) ?? null; }
  async put(col, id, v) { this.c(col).set(id, v); }
  async remove(col, id) { this.c(col).delete(id); }
  async keys(col, prefix = '') { return [...this.c(col).keys()].filter((k) => k.startsWith(prefix)).sort(); }
}

// ============ Adapter: MongoDB (opcjonalny) ============
class MongoAdapter {
  async init(uri) {
    const { MongoClient } = require('mongodb');
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB || 'sejmbot');
  }
  col(n) { return this.db.collection(n); }
  async get(col, id) { const d = await this.col(col).findOne({ _id: id }); return d ? d.v : null; }
  async put(col, id, v) { await this.col(col).replaceOne({ _id: id }, { _id: id, v }, { upsert: true }); }
  async remove(col, id) { await this.col(col).deleteOne({ _id: id }); }
  async keys(col, prefix = '') {
    const q = prefix ? { _id: { $regex: '^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } } : {};
    const docs = await this.col(col).find(q, { projection: { _id: 1 } }).toArray();
    return docs.map((d) => d._id).sort();
  }
}

// ============ Adapter: kanał na Discordzie (zalecany, per-serwer) ============
// Każdy "rekord" to jedna wiadomość w kanale. Mała wartość (JSON) ląduje w treści wiadomości
// za znacznikiem #SEJMBOT#kolekcja#id#. Duża wartość (np. gzip backupu) idzie jako załącznik.
// Po restarcie bot sam odnajduje ten kanał po przypiętej wiadomości-znaczniku (zobacz ready.js) -
// nie trzeba pamiętać jego ID nigdzie indziej.
const MARKER_RE = /^#SEJMBOT#([^#\n]+)#([^#\n]+)#/;
const PIN_MARKER = '#SEJMBOT_DATA_CHANNEL# (nie usuwaj tej wiadomości - bot przechowuje tu swoje dane)';
const { markExpected } = require('./utils/selfDeleteTracker');

class ChannelAdapter {
  constructor(client, channelId) {
    this.client = client;
    this.channelId = channelId;
    this.index = null; // Map<"kolekcja:id", messageId>
  }

  async getChannel() {
    const ch = this.client.channels.cache.get(this.channelId) || (await this.client.channels.fetch(this.channelId).catch(() => null));
    if (!ch) throw new Error('Kanał danych bota nie istnieje albo bot nie ma do niego dostępu.');
    return ch;
  }

  async ensureIndex() {
    if (this.index) return this.index;
    const channel = await this.getChannel();
    const index = new Map();
    let before;
    for (let page = 0; page < 30; page++) { // bezpiecznik: max 3000 wiadomości przeszukanych
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!batch.size) break;
      for (const msg of batch.values()) {
        const m = msg.content.match(MARKER_RE);
        if (m) index.set(`${m[1]}:${m[2]}`, msg.id);
      }
      before = batch.last().id;
      if (batch.size < 100) break;
    }
    this.index = index;
    return index;
  }

  async get(col, id) {
    const index = await this.ensureIndex();
    const msgId = index.get(`${col}:${id}`);
    if (!msgId) return null;
    const channel = await this.getChannel();
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) { index.delete(`${col}:${id}`); return null; }
    const attachment = msg.attachments.first();
    if (attachment) {
      const res = await fetch(attachment.url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return attachment.name?.endsWith('.bin') ? buf : JSON.parse(buf.toString('utf8'));
    }
    const jsonPart = msg.content.replace(MARKER_RE, '').trim();
    return jsonPart ? JSON.parse(jsonPart) : null;
  }

  async put(col, id, value) {
    const { AttachmentBuilder } = require('discord.js');
    const index = await this.ensureIndex();
    const key = `${col}:${id}`;
    const channel = await this.getChannel();

    const oldId = index.get(key);
    if (oldId) {
      markExpected(oldId); // to usunięcie jest zaplanowane przez nas samych - nie alarmuj
      await channel.messages.delete(oldId).catch(() => {});
    }

    const marker = `#SEJMBOT#${col}#${id}#`;
    const safeName = `${col}-${String(id).replace(/[:]/g, '_')}`;
    let msg;
    if (Buffer.isBuffer(value)) {
      const file = new AttachmentBuilder(value, { name: `${safeName}.bin` });
      msg = await channel.send({ content: marker, files: [file] });
    } else {
      const json = JSON.stringify(value);
      if (json.length < 1800) {
        msg = await channel.send({ content: `${marker}\n${json}` });
      } else {
        const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `${safeName}.json` });
        msg = await channel.send({ content: marker, files: [file] });
      }
    }
    index.set(key, msg.id);
  }

  async remove(col, id) {
    const index = await this.ensureIndex();
    const key = `${col}:${id}`;
    const msgId = index.get(key);
    if (!msgId) return;
    markExpected(msgId); // to usunięcie jest zaplanowane przez nas samych - nie alarmuj
    const channel = await this.getChannel();
    await channel.messages.delete(msgId).catch(() => {});
    index.delete(key);
  }

  async keys(col, prefix = '') {
    const index = await this.ensureIndex();
    const out = [];
    for (const key of index.keys()) {
      if (key.startsWith(col + ':') && key.slice(col.length + 1).startsWith(prefix)) out.push(key.slice(col.length + 1));
    }
    return out.sort();
  }
}

// ============ Wybór adaptera: globalny (Mongo/pamięć) + per-serwer (kanał Discorda) ============
let adapter = new MemoryAdapter();
let mode = 'memory';
let discordClient = null;
const channelAdapters = new Map(); // guildId -> ChannelAdapter

function setClient(client) { discordClient = client; }

function resolveAdapter(guildId) {
  return channelAdapters.get(guildId) || adapter;
}
function modeFor(guildId) {
  return channelAdapters.has(guildId) ? 'channel' : mode;
}

// Podłącza kanał Discorda jako magazyn danych dla danego serwera (idempotentne).
function attachChannelAdapter(guildId, channelId) {
  if (!discordClient) throw new Error('Klient Discorda nie jest jeszcze gotowy.');
  channelAdapters.set(guildId, new ChannelAdapter(discordClient, channelId));
}
function detachChannelAdapter(guildId) {
  channelAdapters.delete(guildId);
}
function hasChannelAdapter(guildId) {
  return channelAdapters.has(guildId);
}

async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  Brak MONGODB_URI - serwery BEZ ustawionego kanału danych (/ustaw-kanal-backupow) będą trzymane tylko w pamięci!');
  } else {
    try {
      const a = new MongoAdapter();
      await a.init(uri);
      adapter = a;
      mode = 'mongo';
      console.log('✅ Połączono z MongoDB (używane dla serwerów bez własnego kanału danych).');
    } catch (err) {
      console.error('❌ Nie udało się połączyć z MongoDB, używam pamięci:', err.message);
    }
  }

  const cached = readCacheFile();
  for (const [guildId, cfg] of Object.entries(cached)) {
    if (!cfgCache.has(guildId)) cfgCache.set(guildId, { ...defaults(), ...cfg });
  }
  if (Object.keys(cached).length) {
    console.log(`💾 Wczytano konfigurację z pliku-cache dla ${Object.keys(cached).length} serwera(ów) (tymczasowo, do czasu wykrycia kanału danych).`);
  }
}

// ---------- Konfiguracja serwera ----------
const defaults = () => ({
  routes: {},
  protectedChannels: [],
  autoRestore: 'deletions',
  protectAllChannels: false,
  ignorePrefixes: ['ticket'],
  linkWhitelist: { roles: [], channels: [] },
  protectedBots: [], // [{ botId, botTag, channelId }] - kanały logów innych botów chronione przez /chron-bota
});
const cfgCache = new Map();

async function getConfig(guildId) {
  if (cfgCache.has(guildId)) return cfgCache.get(guildId);
  const a = resolveAdapter(guildId);
  const stored = await a.get('config', guildId);
  const cfg = { ...defaults(), ...(stored || {}) };
  cfgCache.set(guildId, cfg);
  return cfg;
}
async function saveConfig(guildId, cfg) {
  cfgCache.set(guildId, cfg);
  const a = resolveAdapter(guildId);
  await a.put('config', guildId, cfg);
  const all = readCacheFile();
  all[guildId] = cfg;
  writeCacheFile(all);
}

async function getStartupSummary(guildId) {
  const cfg = await getConfig(guildId);
  const routesCount = Object.keys(cfg.routes).length;
  const backups = await listBackups(guildId);
  return { routesCount, protectedCount: cfg.protectedChannels.length, backupsCount: backups.length, latestBackup: backups[0] || null };
}

// ---------- Backupy ----------
const pad = (n) => String(n).padStart(13, '0');

async function saveBackup(guildId, snapshot, meta) {
  const a = resolveAdapter(guildId);
  const ts = Date.now();
  const id = `${guildId}:${pad(ts)}`;
  const data = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot))); // surowy Buffer - bez base64
  await a.put('backups', id, data);
  await a.put('backupmeta', id, { ...meta, ts, id, bytes: data.length });
  const ids = await a.keys('backupmeta', guildId + ':');
  for (const old of ids.slice(0, Math.max(0, ids.length - BACKUP.KEEP))) {
    await a.remove('backups', old);
    await a.remove('backupmeta', old);
  }
  return id;
}
async function listBackups(guildId) {
  const a = resolveAdapter(guildId);
  const ids = (await a.keys('backupmeta', guildId + ':')).reverse();
  const out = [];
  for (const id of ids) { const m = await a.get('backupmeta', id); if (m) out.push(m); }
  return out;
}
async function loadBackup(id) {
  const guildId = id.split(':')[0];
  const a = resolveAdapter(guildId);
  const data = await a.get('backups', id);
  if (!data) return null;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64'); // kompatybilność wstecz
  return JSON.parse(zlib.gunzipSync(buf).toString());
}

module.exports = {
  init, setClient, getConfig, saveConfig, saveBackup, listBackups, loadBackup, getStartupSummary,
  attachChannelAdapter, detachChannelAdapter, hasChannelAdapter, modeFor, PIN_MARKER,
  get mode() { return mode; },
};
