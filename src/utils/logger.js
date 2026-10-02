const storage = require('../storage');

async function log(guild, categoryId, embed) {
  try {
    const cfg = await storage.getConfig(guild.id);
    const channelId = cfg.routes[categoryId];
    if (!channelId) return false;
    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return false;
    await channel.send({ embeds: [embed] });
    return true;
  } catch (err) {
    console.error(`[logger:${categoryId}]`, err.message);
    return false;
  }
}

module.exports = { log };
