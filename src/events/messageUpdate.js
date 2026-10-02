const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed, trim } = require('../utils/embeds');

module.exports = {
  name: Events.MessageUpdate,
  async execute(before, after) {
    if (!after.guild || after.author?.bot) return;
    if (before.content === after.content) return;

    const embed = baseEmbed('messages', '✏️ Edytowano wiadomość')
      .addFields(
        { name: 'Autor', value: `${after.author} (\`${after.author.id}\`)`, inline: true },
        { name: 'Kanał', value: `${after.channel}`, inline: true },
        { name: 'Przed', value: trim(before.content) },
        { name: 'Po', value: trim(after.content) }
      );
    if (after.url) embed.addFields({ name: 'Link', value: after.url });
    await log(after.guild, 'messages', embed);
  },
};
