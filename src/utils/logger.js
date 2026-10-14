const { EmbedBuilder } = require('discord.js');
const storage = require('../storage');
const { CATEGORY_LABELS } = require('./embeds');
const { ROLE_PING } = require('./ping');

const sentLogCache = new Map();
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

async function forwardToCentral(guild, categoryId, embed, centralChannelId) {
  try {
    const central = await guild.client.channels.fetch(centralChannelId).catch(() => null);
    if (!central || !central.isTextBased()) return;
    const copy = new EmbedBuilder(embed.toJSON());
    await central.send({
      content: `📡 **${guild.name}** • ${CATEGORY_LABELS[categoryId] || categoryId}`,
      embeds: [copy],
    });
  } catch (err) {
    console.error('[central] nie udało się przekazać logu:', err.message);
  }
}

async function deliver(guild, categoryId, embed, extra, forward) {
  let sentLocally = false;
  try {
    const cfg = await storage.getConfig(guild.id);
    const channelId = cfg.routes[categoryId];
    if (channelId) {
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (channel && channel.isTextBased()) {
        const sent = await channel.send({ embeds: [embed], ...extra });
        trackSent(sent.id, { guildId: guild.id, categoryId, channelId, embed });
        sentLocally = true;
      }
    }
    if (forward && cfg.centralForwardTo) {
      await forwardToCentral(guild, categoryId, embed, cfg.centralForwardTo);
    }
    return sentLocally;
  } catch (err) {
    console.error(`[logger:${categoryId}]`, err.message);
    return sentLocally;
  }
}

async function log(guild, categoryId, embed, extra = {}) {
  return deliver(guild, categoryId, embed, extra, true);
}

async function logLocal(guild, categoryId, embed, extra = {}) {
  return deliver(guild, categoryId, embed, extra, false);
}

async function logRestoreSuccess(guild, embed) {
  try {
    const cfg = await storage.getConfig(guild.id);
    if (cfg.centralForwardTo) {
      const hub = await guild.client.channels.fetch(cfg.centralForwardTo).catch(() => null);
      if (hub && hub.isTextBased()) {
        await hub.send({
          content: `${ROLE_PING.content} 📡 **${guild.name}**`,
          allowedMentions: ROLE_PING.allowedMentions,
          embeds: [new EmbedBuilder(embed.toJSON())],
        });
        return true;
      }
    }
    return deliver(guild, 'security', embed, ROLE_PING, false);
  } catch (err) {
    console.error('[restore-log]', err.message);
    return false;
  }
}

module.exports = { log, logLocal, logRestoreSuccess, trackSent, getTracked, untrack };
