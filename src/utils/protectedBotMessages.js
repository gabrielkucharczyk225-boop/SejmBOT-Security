// Krótkoterminowa pamięć logów wysłanych przez CHRONIONE boty (/chron-bota) na ich kanałach.
// Dzięki temu, jeśli ktoś usunie taki log, SejmBOT może odesłać dokładnie tę samą treść.
const cache = new Map(); // messageId -> { channelId, content, embeds, botId, botTag }
const MAX_CACHE = 1000;

function track(messageId, data) {
  cache.set(messageId, data);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}
function get(messageId) {
  return cache.get(messageId) || null;
}
function untrack(messageId) {
  cache.delete(messageId);
}

module.exports = { track, get, untrack };
