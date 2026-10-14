const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, where } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages, channel) {
    const guild = channel.guild;
    if (!guild) return;
    const entry = await findExecutor(guild, AuditLogEvent.MessageBulkDelete, (e) => e.target?.id === channel.id);
    await log(guild, 'messages', logEmbed({
      category: 'messages',
      title: '🧹 Masowe usunięcie wiadomości',
      description: `Usunięto **${messages.size}** wiadomości na kanale ${where(channel)}.`,
      actor: executorTag(entry),
      channel: where(channel),
      ids: { channel: channel.id, user: entry?.executor?.id },
    }));
  },
};
