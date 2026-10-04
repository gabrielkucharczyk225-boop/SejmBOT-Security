const { Events, PermissionsBitField } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const storage = require('../storage');
const protectedBotMessages = require('../utils/protectedBotMessages');
const furyMode = require('../utils/furyMode');

const LINK_EXTRACT_RE = /(https?:\/\/\S+)|(discord\.gg\/\S+)/gi;
const INVITE_CODE_RE = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([\w-]+)/i;
const EVENT_LINK_RE = /discord(?:app)?\.com\/events\/(\d+)/i;

async function isOwnServerLink(url, guild, client) {
  const eventMatch = url.match(EVENT_LINK_RE);
  if (eventMatch) return eventMatch[1] === guild.id;

  const inviteMatch = url.match(INVITE_CODE_RE);
  if (inviteMatch) {
    try {
      const invite = await client.fetchInvite(inviteMatch[1]);
      return invite.guild?.id === guild.id;
    } catch {
      return false;
    }
  }
  return false;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild) return;

    // ---- Logi CHRONIONYCH botów (/chron-bota) - zapamiętaj treść, żeby móc ją odesłać ----
    if (message.author.bot) {
      const cfg = await storage.getConfig(message.guild.id);
      const botEntry = (cfg.protectedBots || []).find((b) => b.botId === message.author.id && b.channelId === message.channel.id);
      if (botEntry) {
        protectedBotMessages.track(message.id, {
          channelId: message.channel.id,
          content: message.content || null,
          embeds: message.embeds.map((e) => e.toJSON()),
          botId: botEntry.botId,
          botTag: botEntry.botTag,
        });
      }
      return;
    }

    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const links = message.content.match(LINK_EXTRACT_RE);
    if (!links || !links.length) return;

    const cfg = await storage.getConfig(message.guild.id);
    const whitelist = cfg.linkWhitelist || { roles: [], channels: [] };

    const parentId = message.channel.parentId;
    if (whitelist.channels.includes(message.channel.id) || (parentId && whitelist.channels.includes(parentId))) return;

    if (message.member && message.member.roles.cache.some((r) => whitelist.roles.includes(r.id))) return;

    const ownChecks = await Promise.all(links.map((u) => isOwnServerLink(u, message.guild, message.client)));
    if (ownChecks.every(Boolean)) return;

    const content = message.content;
    const channel = message.channel;
    const isInvite = links.some((u) => INVITE_CODE_RE.test(u));

    try {
      await message.delete();
      await log(message.guild, 'security', baseEmbed('security', '🔗 Zablokowano link')
        .setDescription(`Wiadomość od ${message.author} w ${channel} zawierała link i została usunięta.`)
        .addFields({ name: 'Treść', value: content.slice(0, 1000) || '*(puste)*' }));
    } catch (err) {
      console.error('Nie udało się usunąć wiadomości z linkiem:', err.message);
    }

    if (isInvite) {
      await furyMode.registerLinkSpamAttempt(message.guild, message.author.id, { exampleLink: links[0] });
    }
  },
};
