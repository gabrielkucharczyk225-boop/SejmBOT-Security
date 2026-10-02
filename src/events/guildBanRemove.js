const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanRemove, (e) => e.target?.id === ban.user.id);
    await log(ban.guild, 'moderation', baseEmbed('moderation', '🔓 Odbanowano użytkownika')
      .addFields(
        { name: 'Użytkownik', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Odbanował', value: executorTag(entry), inline: true }
      ));
  },
};
