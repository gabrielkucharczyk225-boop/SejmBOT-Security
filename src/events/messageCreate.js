const { Events, PermissionsBitField } = require('discord.js');
const { LINK_REGEX } = require('../config');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (LINK_REGEX.test(message.content)) {
      const content = message.content;
      const channel = message.channel;
      try {
        await message.delete();
        await log(message.guild, 'security', baseEmbed('security', '🔗 Zablokowano link')
          .setDescription(`Wiadomość od ${message.author} w ${channel} zawierała link i została usunięta.`)
          .addFields({ name: 'Treść', value: content.slice(0, 1000) || '*(puste)*' }));
      } catch (err) {
        console.error('Nie udało się usunąć wiadomości z linkiem:', err.message);
      }
    }
  },
};
