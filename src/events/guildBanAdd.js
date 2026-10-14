const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, who } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const recentBans = require('../utils/recentBans');
const bannedRegistry = require('../utils/bannedRegistry');
const actionLog = require('../utils/actionLog');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    recentBans.recordBan(ban.user);
    const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, (e) => e.target?.id === ban.user.id);
    const reason = entry?.reason || ban.reason || null;

    await bannedRegistry.recordBan(ban.guild, ban.user, reason);
    actionLog.record(ban.guild.id, 'ban_registered', `Zapisano ban ${ban.user.tag} (${ban.user.id}) w rejestrze. Zbanował: ${entry?.executor?.tag || 'nieznany'}.`);

    await log(ban.guild, 'moderation', logEmbed({
      category: 'moderation',
      title: '🔨 Zbanowano użytkownika',
      thumb: ban.user.displayAvatarURL(),
      actor: executorTag(entry),
      target: who(ban.user),
      fields: [{ name: '📝 Powód', value: reason || '*(brak podanego powodu)*', inline: false }],
      ids: { user: ban.user.id },
    }));
  },
};
