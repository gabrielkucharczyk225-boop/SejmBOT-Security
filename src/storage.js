const zlib = require('zlib');
const { BACKUP } = require('./config');

class MemoryAdapter {
  constructor() { this.cols = new Map(); }
  c(n) { if (!this.cols.has(n)) this.cols.set(n, new Map()); return this.cols.get(n); }
  async get(col, id) { return this.c(col).get(id) ?? null; }
  async put(col, id, v) { this.c(col).set(id, v); }
  async remove(col, id) { this.c(col).delete(id); }
  async keys(col, prefix = '') { return [...this.c(col).keys()].filter((k) => k.startsWith(prefix)).sort(); }
}

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

let adapter = new MemoryAdapter();
let mode = 'memory';

async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  Brak MONGODB_URI - dane będą TYLKO w pamięci i znikną po restarcie!');
    return;
  }
  try {
    const a = new MongoAdapter();
    await a.init(uri);
    adapter = a;
    mode = 'mongo';
    console.log('✅ Połączono z MongoDB');
  } catch (err) {
    console.error('❌ Nie udało się połączyć z MongoDB, używam pamięci:', err.message);
  }
}

const defaults = () => ({
  routes: {},
  protectedChannels: [],
  autoRestore: 'deletions',
});
const cfgCache = new Map();

async function getConfig(guildId) {
  if (cfgCache.has(guildId)) return cfgCache.get(guildId);
  const stored = await adapter.get('config', guildId);
  const cfg = { ...defaults(), ...(stored || {}) };
  cfgCache.set(guildId, cfg);
  return cfg;
}
async function saveConfig(guildId, cfg) {
  cfgCache.set(guildId, cfg);
  await adapter.put('config', guildId, cfg);
}

const pad = (n) => String(n).padStart(13, '0');

async function saveBackup(guildId, snapshot, meta) {
  const ts = Date.now();
  const id = `${guildId}:${pad(ts)}`;
  const data = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot))).toString('base64');
  await adapter.put('backups', id, data);
  await adapter.put('backupmeta', id, { ...meta, ts, id, bytes: data.length });
  const ids = await adapter.keys('backupmeta', guildId + ':');
  for (const old of ids.slice(0, Math.max(0, ids.length - BACKUP.KEEP))) {
    await adapter.remove('backups', old);
    await adapter.remove('backupmeta', old);
  }
  return id;
}
async function listBackups(guildId) {
  const ids = (await adapter.keys('backupmeta', guildId + ':')).reverse();
  const out = [];
  for (const id of ids) { const m = await adapter.get('backupmeta', id); if (m) out.push(m); }
  return out;
}
async function loadBackup(id) {
  const data = await adapter.get('backups', id);
  if (!data) return null;
  return JSON.parse(zlib.gunzipSync(Buffer.from(data, 'base64')).toString());
}

async function putAsset(key, buf) { await adapter.put('assets', key, buf.toString('base64')); }
async function getAsset(key) {
  const v = await adapter.get('assets', key);
  return v ? Buffer.from(v, 'base64') : null;
}

module.exports = {
  init, getConfig, saveConfig, saveBackup, listBackups, loadBackup, putAsset, getAsset,
  get mode() { return mode; },
};
