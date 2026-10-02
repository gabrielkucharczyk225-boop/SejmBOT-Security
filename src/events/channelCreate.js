const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!channel.guild) return;
    const entry = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, (e) => e.target?.id === channel.id);
    await log(channel.guild, 'channels', baseEmbed('channels', '📁 Utworzono kanał')
      .addFields(
        { name: 'Nazwa', value: `#${channel.name}`, inline: true },
        { name: 'Typ', value: String(channel.type), inline: true },
        { name: 'Utworzył', value: executorTag(entry), inline: true }
      ));
    scheduleBackup(channel.guild, `utworzono kanał #${channel.name}`);
  },
};
