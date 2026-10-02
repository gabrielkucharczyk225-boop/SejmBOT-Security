const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag, AuditLogEvent } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');
const { BACKUP } = require('../config');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(before, after) {
    if (before.nickname !== after.nickname) {
      const embed = baseEmbed('members', '✏️ Zmieniono pseudonim')
        .addFields(
          { name: 'Użytkownik', value: `${after} (\`${after.id}\`)`, inline: true },
          { name: 'Przed', value: before.nickname || '*(brak)*', inline: true },
          { name: 'Po', value: after.nickname || '*(brak)*', inline: true }
        );
      await log(after.guild, 'members', embed);
      scheduleBackup(after.guild, 'zmiana nicku', BACKUP.MEMBER_DEBOUNCE_MS);
    }

    const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    if (added.size || removed.size) {
      const entry = await findExecutor(after.guild, AuditLogEvent.MemberRoleUpdate, (e) => e.target?.id === after.id);
      const embed = baseEmbed('members', '🎭 Zmieniono role użytkownika')
        .addFields(
          { name: 'Użytkownik', value: `${after} (\`${after.id}\`)`, inline: true },
          { name: 'Wykonał', value: executorTag(entry), inline: true }
        );
      if (added.size) embed.addFields({ name: '➕ Dodano', value: added.map((r) => r.name).join(', ') });
      if (removed.size) embed.addFields({ name: '➖ Usunięto', value: removed.map((r) => r.name).join(', ') });
      await log(after.guild, 'members', embed);
      scheduleBackup(after.guild, 'zmiana ról członka', BACKUP.MEMBER_DEBOUNCE_MS);
    }

    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp) {
      const until = after.communicationDisabledUntilTimestamp;
      const entry = await findExecutor(after.guild, AuditLogEvent.MemberUpdate, (e) => e.target?.id === after.id);
      const embed = baseEmbed('moderation', until ? '🔇 Nałożono timeout' : '🔊 Zdjęto timeout')
        .addFields(
          { name: 'Użytkownik', value: `${after} (\`${after.id}\`)`, inline: true },
          { name: 'Wykonał', value: executorTag(entry), inline: true }
        );
      if (until) embed.addFields({ name: 'Do', value: `<t:${Math.floor(until / 1000)}:F>` });
      await log(after.guild, 'moderation', embed);
    }
  },
};
