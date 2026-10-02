const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { DANGEROUS_PERMS } = require('../config');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
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
    const embed = baseEmbed('roles', `🎭 Zaktualizowano rolę ${after.name}`).addFields({ name: 'Zmienił', value: executorTag(entry) });
    if (changes.length) embed.addFields({ name: 'Zmiany', value: changes.join('\n') });
    if (addedPerms.length) embed.addFields({ name: '➕ Dodane uprawnienia', value: addedPerms.join(', ') });
    if (removedPerms.length) embed.addFields({ name: '➖ Usunięte uprawnienia', value: removedPerms.join(', ') });
    await log(after.guild, 'roles', embed);

    const dangerAdded = addedPerms.filter((p) => DANGEROUS_PERMS.includes(p));
    if (dangerAdded.length) {
      await log(after.guild, 'security', baseEmbed('security', '⚠️ Dodano groźne uprawnienia do roli')
        .setDescription(`Roli **${after.name}** przyznano: **${dangerAdded.join(', ')}**`)
        .addFields({ name: 'Wykonał', value: executorTag(entry) }));
    }

    scheduleBackup(after.guild, `edycja roli ${after.name}`);
  },
};
