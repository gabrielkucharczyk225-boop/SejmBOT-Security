const { Events, EmbedBuilder } = require('discord.js');
const { sendWebhook } = require('../utils/webhook');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Usunięto wiadomość')
      .setColor(0xe67e22)
      .addFields(
        { name: 'Autor', value: message.author ? `${message.author}` : 'Nieznany' },
        { name: 'Treść', value: (message.content || '*brak treści / spoza cache*').slice(0, 1024) }
      );
    await sendWebhook(embed);
  },
};
