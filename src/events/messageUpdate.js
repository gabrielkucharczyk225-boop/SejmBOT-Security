const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, who, where, trim } = require('../utils/embeds');

module.exports = {
  name: Events.MessageUpdate,
  async execute(before, after) {
    if (!after.guild || after.author?.bot) return;
    if (before.content === after.content) return;

    await log(after.guild, 'messages', logEmbed({
      category: 'messages',
      title: '✏️ Edytowano wiadomość',
      description: `Wiadomość ${who(after.author)} została edytowana na kanale ${where(after.channel)}.`,
      thumb: after.author.displayAvatarURL(),
      target: who(after.author),
      channel: where(after.channel),
      fields: [
        { name: '⬅️ Przed', value: trim(before.content), inline: false },
        { name: '➡️ Po', value: trim(after.content), inline: false },
        ...(after.url ? [{ name: '🔗 Link', value: after.url, inline: false }] : []),
      ],
      ids: { user: after.author.id, message: after.id, channel: after.channelId },
    }));
  },
};
