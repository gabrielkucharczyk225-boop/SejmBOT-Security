const storage = require('../storage');
const actionLog = require('./actionLog');

// Szuka kanału na serwerze, który odpowiada kanałowi z backupu: najpierw po tym samym ID,
// potem po nazwie i typie (ID po odtworzeniu kanału są nowe).
function mapChannel(oldId, snapshot, guild) {
  if (!oldId) return null;
  if (guild.channels.cache.has(oldId)) return oldId;
  const old = snapshot.channels.find((c) => c.id === oldId);
  if (!old) return null;
  const match = guild.channels.cache.find((c) => c.name === old.name && c.type === old.type);
  return match ? match.id : null;
}

function mapRole(oldId, snapshot, guild) {
  if (!oldId) return null;
  if (guild.roles.cache.has(oldId)) return oldId;
  const old = snapshot.roles.find((r) => r.id === oldId);
  if (!old) return null;
  const match = guild.roles.cache.find((r) => r.name === old.name && !r.managed);
  return match ? match.id : null;
}

// Przywraca ustawienia bota (nie kanały ani role serwera) z backupu.
async function restoreBotConfig(guild, snapshot, by) {
  const bc = snapshot.botConfig;
  if (!bc) return { ok: false, message: 'Ten backup nie zawiera ustawień bota (powstał przed dodaniem tej funkcji).' };

  const cfg = await storage.getConfig(guild.id);
  const lost = [];
  const chan = (id, label) => {
    const m = mapChannel(id, snapshot, guild);
    if (id && !m) lost.push(label);
    return m;
  };

  cfg.routes = {};
  for (const [cat, id] of Object.entries(bc.routes || {})) {
    const m = chan(id, `kanał logów: ${cat}`);
    if (m) cfg.routes[cat] = m;
  }

  cfg.protectedChannels = (bc.protectedChannels || []).map((id) => chan(id, 'chroniony kanał')).filter(Boolean);
  cfg.protectAllChannels = !!bc.protectAllChannels;
  cfg.ignorePrefixes = bc.ignorePrefixes || ['ticket'];

  cfg.linkWhitelist = {
    channels: (bc.linkWhitelist?.channels || []).map((id) => chan(id, 'biała lista (kanał)')).filter(Boolean),
    roles: (bc.linkWhitelist?.roles || [])
      .map((id) => {
        const m = mapRole(id, snapshot, guild);
        if (id && !m) lost.push('biała lista (rola)');
        return m;
      })
      .filter(Boolean),
  };

  cfg.protectedBots = (bc.protectedBots || [])
    .map((b) => {
      const m = chan(b.channelId, `chroniony bot ${b.botTag}`);
      return m ? { ...b, channelId: m } : null;
    })
    .filter(Boolean);

  cfg.furyBlockedBots = bc.furyBlockedBots || [];

  await storage.saveConfig(guild.id, cfg);

  actionLog.record(
    guild.id,
    'config_restored',
    `Przywrócono ustawienia bota z backupu przez ${by.tag}: ${Object.keys(cfg.routes).length} kanałów logów, ${cfg.protectedChannels.length} chronionych, ${cfg.linkWhitelist.channels.length} kanałów na białej liście.`
  );

  return {
    ok: true,
    routes: Object.keys(cfg.routes).length,
    protectedChannels: cfg.protectedChannels.length,
    whitelistChannels: cfg.linkWhitelist.channels.length,
    whitelistRoles: cfg.linkWhitelist.roles.length,
    protectedBots: cfg.protectedBots.length,
    protectAll: cfg.protectAllChannels,
    prefixes: cfg.ignorePrefixes,
    lost,
  };
}

module.exports = { restoreBotConfig };
