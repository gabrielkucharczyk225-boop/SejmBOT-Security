const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages, channel) {
    const guild = channel.guild;
    if (!guild) return;
    const embed = baseEmbed('messages', '🧹 Masowe usunięcie wiadomości')
      .setDescription(`Usunięto **${messages.size}** wiadomości na kanale ${channel}.`);
    await log(guild, 'messages', embed);
  },
};
