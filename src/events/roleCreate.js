const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.RoleCreate,
  async execute(role) {
    const entry = await findExecutor(role.guild, AuditLogEvent.RoleCreate, (e) => e.target?.id === role.id);
    await log(role.guild, 'roles', baseEmbed('roles', '🎭 Utworzono rolę')
      .addFields(
        { name: 'Nazwa', value: role.name, inline: true },
        { name: 'Kolor', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
        { name: 'Utworzył', value: executorTag(entry), inline: true }
      ));
    scheduleBackup(role.guild, `utworzono rolę ${role.name}`);
  },
};
