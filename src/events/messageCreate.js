const { Events, PermissionsBitField } = require('discord.js');
const { LINK_REGEX } = require('../config');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (LINK_REGEX.test(message.content)) {
      try {
        await message.delete();
      } catch (err) {
        console.error('Nie udało się usunąć wiadomości z linkiem:', err);
      }
    }
  },
};
