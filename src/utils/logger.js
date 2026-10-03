const storage = require('../storage');

// Krótkoterminowa pamięć ostatnio wysłanych logów (embedów) - żeby móc je odesłać ponownie,
// jeśli ktoś je usunie. Ograniczona do MAX_CACHE wpisów (najstarsze są usuwane).
const sentLogCache = new Map(); // messageId -> { guildId, categoryId, channelId, embed }
const MAX_CACHE = 500;

function trackSent(messageId, data) {
  sentLogCache.set(messageId, data);
  if (sentLogCache.size > MAX_CACHE) {
    const oldestKey = sentLogCache.keys().next().value;
    sentLogCache.delete(oldestKey);
  }
}
function getTracked(messageId) {
  return sentLogCache.get(messageId) || null;
}
function untrack(messageId) {
  sentLogCache.delete(messageId);
}

// Wysyła embed na kanał przypisany do danej kategorii logów. Zwraca true, jeśli wysłano.
// `extra` pozwala dołożyć dodatkowe opcje do wiadomości (np. content: '@everyone').
async function log(guild, categoryId, embed, extra = {}) {
  try {
    const cfg = await storage.getConfig(guild.id);
    const channelId = cfg.routes[categoryId];
    if (!channelId) return false;
    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return false;
    const sent = await channel.send({ embeds: [embed], ...extra });
    trackSent(sent.id, { guildId: guild.id, categoryId, channelId, embed });
    return true;
  } catch (err) {
    console.error(`[logger:${categoryId}]`, err.message);
    return false;
  }
}

module.exports = { log, trackSent, getTracked, untrack };
