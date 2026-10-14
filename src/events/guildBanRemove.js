const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, who } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const bannedRegistry = require('../utils/bannedRegistry');
const actionLog = require('../utils/actionLog');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanRemove, (e) => e.target?.id === ban.user.id);
    await bannedRegistry.recordUnban(ban.guild, ban.user.id);
    actionLog.record(ban.guild.id, 'unban_registered', `Odbanowano ${ban.user.tag} (${ban.user.id}). Odbanował: ${entry?.executor?.tag || 'nieznany'}.`);

    await log(ban.guild, 'moderation', logEmbed({
      category: 'moderation',
      title: '🔓 Odbanowano użytkownika',
      thumb: ban.user.displayAvatarURL(),
      actor: executorTag(entry),
      target: who(ban.user),
      ids: { user: ban.user.id },
    }));
  },
};
