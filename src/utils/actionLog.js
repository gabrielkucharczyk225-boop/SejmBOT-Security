// Rejestr najważniejszych działań bota na danym serwerze (ochrona, furia, multikonta, blokady linków).
// Trzymany w pamięci, dołączany do każdego backupu (snapshot.actionLog), żeby backup pokazywał
// nie tylko STRUKTURĘ serwera, ale też HISTORIĘ tego, co bot po drodze robił.
const logs = new Map(); // guildId -> [{ ts, type, summary }]
const MAX_PER_GUILD = 500;
const KEEP_MS = 14 * 24 * 60 * 60 * 1000; // trzymaj wpisy z ostatnich 14 dni

function record(guildId, type, summary) {
  if (!logs.has(guildId)) logs.set(guildId, []);
  const arr = logs.get(guildId);
  arr.push({ ts: Date.now(), type, summary });
  const cutoff = Date.now() - KEEP_MS;
  while (arr.length && arr[0].ts < cutoff) arr.shift();
  if (arr.length > MAX_PER_GUILD) arr.splice(0, arr.length - MAX_PER_GUILD);
}

function getRecent(guildId, sinceMs = KEEP_MS) {
  const arr = logs.get(guildId) || [];
  const cutoff = Date.now() - sinceMs;
  return arr.filter((e) => e.ts >= cutoff);
}

module.exports = { record, getRecent };
