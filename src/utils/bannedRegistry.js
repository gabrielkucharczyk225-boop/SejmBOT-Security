// Rejestr zbanowanych osób po ID. Każdy ban zapisywany jest w configu serwera, na którym nastąpił,
// a przy dołączeniu sprawdzamy WSZYSTKIE serwery, na których jest bot.
const storage = require('../storage');

async function recordBan(guild, user, reason) {
  const cfg = await storage.getConfig(guild.id);
  cfg.bannedUsers = cfg.bannedUsers || {};
  cfg.bannedUsers[user.id] = {
    tag: user.tag,
    reason: reason || null,
    ts: Date.now(),
    active: true,
  };
  await storage.saveConfig(guild.id, cfg);
}

async function recordUnban(guild, userId) {
  const cfg = await storage.getConfig(guild.id);
  const entry = cfg.bannedUsers?.[userId];
  if (!entry) return;
  entry.active = false;
  entry.unbannedAt = Date.now();
  await storage.saveConfig(guild.id, cfg);
}

// Szuka aktywnego bana tego ID na innych serwerach bota. Zwraca dane bana albo null.
async function findBanElsewhere(userId, currentGuildId, client) {
  for (const guild of client.guilds.cache.values()) {
    if (guild.id === currentGuildId) continue;
    const cfg = await storage.getConfig(guild.id);
    const entry = cfg.bannedUsers?.[userId];
    if (entry?.active) return { ...entry, guildName: guild.name };
  }
  return null;
}

module.exports = { recordBan, recordUnban, findBanElsewhere };
