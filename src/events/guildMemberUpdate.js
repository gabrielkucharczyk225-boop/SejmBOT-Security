const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, who } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');
const { BACKUP } = require('../config');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(before, after) {
    if (before.nickname !== after.nickname) {
      const entry = await findExecutor(after.guild, AuditLogEvent.MemberUpdate, (e) => e.target?.id === after.id);
      await log(after.guild, 'members', logEmbed({
        category: 'members',
        title: '✏️ Zmieniono pseudonim',
        thumb: after.user.displayAvatarURL(),
        actor: executorTag(entry),
        target: who(after.user),
        fields: [
          { name: '⬅️ Przed', value: before.nickname || '*(brak)*', inline: true },
          { name: '➡️ Po', value: after.nickname || '*(brak)*', inline: true },
        ],
        ids: { user: after.id },
      }));
      scheduleBackup(after.guild, 'zmiana nicku', BACKUP.MEMBER_DEBOUNCE_MS);
    }

    if (before.avatar !== after.avatar) {
      await log(after.guild, 'members', logEmbed({
        category: 'members',
        title: '🖼️ Zmieniono avatar na serwerze',
        thumb: after.displayAvatarURL(),
        target: who(after.user),
        fields: [
          { name: '⬅️ Poprzedni', value: before.avatar ? `[link](${before.displayAvatarURL({ size: 256 })})` : '*(brak)*', inline: true },
          { name: '➡️ Nowy', value: after.avatar ? `[link](${after.displayAvatarURL({ size: 256 })})` : '*(brak)*', inline: true },
        ],
        ids: { user: after.id },
      }));
    }

    const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    if (added.size || removed.size) {
      const entry = await findExecutor(after.guild, AuditLogEvent.MemberRoleUpdate, (e) => e.target?.id === after.id);
      const fields = [];
      if (added.size) fields.push({ name: '➕ Dodano', value: added.map((r) => r.name).join(', '), inline: false });
      if (removed.size) fields.push({ name: '➖ Usunięto', value: removed.map((r) => r.name).join(', '), inline: false });
      await log(after.guild, 'members', logEmbed({
        category: 'members',
        title: '🎭 Zmieniono role użytkownika',
        thumb: after.displayAvatarURL(),
        actor: executorTag(entry),
        target: who(after.user),
        fields,
        ids: { user: after.id },
      }));
      scheduleBackup(after.guild, 'zmiana ról członka', BACKUP.MEMBER_DEBOUNCE_MS);
    }

    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp) {
      const until = after.communicationDisabledUntilTimestamp;
      const entry = await findExecutor(after.guild, AuditLogEvent.MemberUpdate, (e) => e.target?.id === after.id);
      const fields = until ? [{ name: '⏳ Do', value: `<t:${Math.floor(until / 1000)}:F>`, inline: false }] : [];
      await log(after.guild, 'moderation', logEmbed({
        category: 'moderation',
        title: until ? '🔇 Nałożono timeout' : '🔊 Zdjęto timeout',
        thumb: after.displayAvatarURL(),
        actor: executorTag(entry),
        target: who(after.user),
        fields,
        ids: { user: after.id },
      }));
    }
  },
};
