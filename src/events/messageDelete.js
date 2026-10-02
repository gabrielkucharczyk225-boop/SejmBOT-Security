const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed, trim } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => e.target?.id === message.author?.id);
    const embed = baseEmbed('messages', '🗑️ Usunięto wiadomość')
      .addFields(
        { name: 'Autor', value: message.author ? `${message.author} (\`${message.author.id}\`)` : 'Nieznany (spoza cache)', inline: true },
        { name: 'Kanał', value: `${message.channel}`, inline: true },
        { name: 'Usunął', value: executorTag(entry), inline: true },
        { name: 'Treść', value: trim(message.content || '*(brak treści / spoza cache)*') }
      );
    if (message.attachments?.size) {
      embed.addFields({ name: 'Załączniki', value: [...message.attachments.values()].map((a) => a.name).join(', ') });
    }
    await log(message.guild, 'messages', embed);
  },
};
