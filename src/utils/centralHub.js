const storage = require('../storage');

// Serwery podłączone do huba: te, których cfg.centralForwardTo wskazuje kanał na serwerze huba.
async function getChildGuilds(client, hubGuild) {
  const children = [];
  for (const guild of client.guilds.cache.values()) {
    if (guild.id === hubGuild.id) continue;
    const cfg = await storage.getConfig(guild.id);
    if (!cfg.centralForwardTo) continue;
    const target =
      client.channels.cache.get(cfg.centralForwardTo) || (await client.channels.fetch(cfg.centralForwardTo).catch(() => null));
    if (target?.guild?.id === hubGuild.id) children.push(guild);
  }
  return children;
}

// Serwer jest hubem, jeśli ma ustawiony kanał zbiorczy (/centralizacja ustaw).
async function isHub(guild) {
  const cfg = await storage.getConfig(guild.id);
  return !!cfg.centralHubChannelId;
}

module.exports = { getChildGuilds, isHub };
