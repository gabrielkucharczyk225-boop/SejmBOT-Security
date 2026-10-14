const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { DANGEROUS_PERMS } = require('../config');
const { log } = require('../utils/logger');
const { logEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.RoleUpdate,
  async execute(before, after) {
    const changes = [];
    if (before.name !== after.name) changes.push(`**Nazwa:** ${before.name} → ${after.name}`);
    if (before.color !== after.color) {
      changes.push(`**Kolor:** #${before.color.toString(16).padStart(6, '0')} → #${after.color.toString(16).padStart(6, '0')}`);
    }
    if (before.hoist !== after.hoist) changes.push(`**Wyświetlanie osobno:** ${before.hoist} → ${after.hoist}`);
    if (before.mentionable !== after.mentionable) changes.push(`**Wzmiankowalna:** ${before.mentionable} → ${after.mentionable}`);
    if (before.icon !== after.icon) changes.push('**Ikonka roli została zmieniona**');

    const addedPerms = [];
    const removedPerms = [];
    if (before.permissions.bitfield !== after.permissions.bitfield) {
      for (const [name, flag] of Object.entries(PermissionsBitField.Flags)) {
        const had = before.permissions.has(flag);
        const has = after.permissions.has(flag);
        if (!had && has) addedPerms.push(name);
        if (had && !has) removedPerms.push(name);
      }
    }
    if (!changes.length && !addedPerms.length && !removedPerms.length) return;

    const entry = await findExecutor(after.guild, AuditLogEvent.RoleUpdate, (e) => e.target?.id === after.id);
    const fields = [];
    if (changes.length) fields.push({ name: '📝 Zmiany', value: changes.join('\n') });
    if (addedPerms.length) fields.push({ name: '➕ Dodane uprawnienia', value: addedPerms.join(', ') });
    if (removedPerms.length) fields.push({ name: '➖ Usunięte uprawnienia', value: removedPerms.join(', ') });

    await log(after.guild, 'roles', logEmbed({
      category: 'roles',
      title: `🎭 Zaktualizowano rolę ${after.name}`,
      actor: executorTag(entry),
      target: after.name,
      fields,
      ids: { role: after.id, user: entry?.executor?.id },
    }));

    const dangerAdded = addedPerms.filter((p) => DANGEROUS_PERMS.includes(p));
    if (dangerAdded.length) {
      await log(after.guild, 'security', logEmbed({
        category: 'security',
        title: '⚠️ Dodano groźne uprawnienia do roli',
        description: `Roli **${after.name}** przyznano: **${dangerAdded.join(', ')}**`,
        actor: executorTag(entry),
        target: after.name,
        ids: { role: after.id, user: entry?.executor?.id },
      }));
    }

    scheduleBackup(after.guild, `edycja roli ${after.name}`);
  },
};
