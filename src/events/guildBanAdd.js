const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const recentBans = require('../utils/recentBans');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    recentBans.recordBan(ban.user);
    const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, (e) => e.target?.id === ban.user.id);
    await log(ban.guild, 'moderation', baseEmbed('moderation', '🔨 Zbanowano użytkownika')
      .setThumbnail(ban.user.displayAvatarURL())
      .addFields(
        { name: 'Użytkownik', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Zbanował', value: executorTag(entry), inline: true },
        { name: 'Powód', value: entry?.reason || ban.reason || '*(brak podanego powodu)*' }
      ));
  },
};
