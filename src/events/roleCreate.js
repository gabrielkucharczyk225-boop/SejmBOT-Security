const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.RoleCreate,
  async execute(role) {
    const entry = await findExecutor(role.guild, AuditLogEvent.RoleCreate, (e) => e.target?.id === role.id);
    await log(role.guild, 'roles', logEmbed({
      category: 'roles',
      title: '🎭 Utworzono rolę',
      description: `Utworzono rolę **${role.name}**.`,
      actor: executorTag(entry),
      target: role.name,
      fields: [{ name: '🎨 Kolor', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true }],
      ids: { role: role.id, user: entry?.executor?.id },
    }));
    scheduleBackup(role.guild, `utworzono rolę ${role.name}`);
  },
};
