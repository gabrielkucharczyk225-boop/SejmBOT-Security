// Warstwa zapisu danych: MongoDB (trwałe) albo pamięć (tylko do testów - znika po restarcie!).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { BACKUP } = require('./config');

// Lekki plik-cache TYLKO dla konfiguracji (kanały logów itd.) - mała ilość danych.
// Chroni przed utratą ustawień przy zwykłym restarcie bota w trakcie tego samego deploya.
// UWAGA: na Render dysk jest kasowany przy każdym REDEPLOYU - to nie zastępuje MongoDB,
// tylko dodatkowo zabezpiecza przed np. crashem i auto-restartem przez Render bez redeployu.
const CACHE_FILE = path.join(__dirname, '..', 'data', 'config-cache.json');

function readCacheFile() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.error('[cache] nie udało się odczytać pliku cache:', err.message);
    return {};
  }
}
function writeCacheFile(all) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch (err) {
    console.error('[cache] nie udało się zapisać pliku cache:', err.message);
  }
}

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

// ---------- Konfiguracja serwera ----------
const defaults = () => ({
  routes: {},                        // kategoria -> ID kanału logów
  protectedChannels: [],             // dodatkowe kanały chronione (np. logi innego bota)
  autoRestore: 'deletions',          // 'deletions' | 'off'
  protectAllChannels: false,         // true = chroń (auto-odtwarzaj) WSZYSTKIE kanały, nie tylko logi
  ignorePrefixes: ['ticket'],        // nazwy kanałów zaczynające się na te prefiksy - NIGDY nie są chronione/odtwarzane
  linkWhitelist: { roles: [], channels: [] }, // role/kanały zwolnione z usuwania linków
});
const cfgCache = new Map();

async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  Brak MONGODB_URI - backupy i assety będą TYLKO w pamięci i znikną po restarcie!');
    console.warn('⚠️  Konfiguracja kanałów logów ma dodatkowo plik-cache na dysku, ale on też znika przy REDEPLOYU na Render.');
  } else {
    try {
      const a = new MongoAdapter();
      await a.init(uri);
      adapter = a;
      mode = 'mongo';
      console.log('✅ Połączono z MongoDB - backupy i konfiguracja są trwałe.');
    } catch (err) {
      console.error('❌ Nie udało się połączyć z MongoDB, używam pamięci + pliku cache:', err.message);
    }
  }

  // Wczytaj konfigurację z pliku-cache na dysku do pamięci podręcznej.
  // Działa jako dodatkowa siatka bezpieczeństwa, np. gdy Mongo akurat nie odpowiada przy starcie.
  const cached = readCacheFile();
  for (const [guildId, cfg] of Object.entries(cached)) {
    if (!cfgCache.has(guildId)) cfgCache.set(guildId, { ...defaults(), ...cfg });
  }
  if (Object.keys(cached).length) {
    console.log(`💾 Wczytano konfigurację logów z pliku-cache dla ${Object.keys(cached).length} serwera(ów).`);
  }
}

async function getConfig(guildId) {
  if (cfgCache.has(guildId)) return cfgCache.get(guildId);
  const stored = await adapter.get('config', guildId);
  const cfg = { ...defaults(), ...(stored || {}) };
  cfgCache.set(guildId, cfg);
  return cfg;
}
