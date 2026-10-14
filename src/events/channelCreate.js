const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, where } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!channel.guild) return;
    const entry = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, (e) => e.target?.id === channel.id);
    await log(channel.guild, 'channels', logEmbed({
      category: 'channels',
      title: '📁 Utworzono kanał',
      description: `Utworzono nowy kanał ${where(channel)}.`,
      actor: executorTag(entry),
      channel: where(channel),
      fields: [{ name: '🧩 Typ', value: String(channel.type), inline: true }],
      ids: { channel: channel.id, user: entry?.executor?.id },
    }));
    scheduleBackup(channel.guild, `utworzono kanał #${channel.name}`);
  },
};
