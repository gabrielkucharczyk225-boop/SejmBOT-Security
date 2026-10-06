const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { restoreSingleRole } = require('../utils/restore');
const { scheduleBackup } = require('../utils/backup');
const furyMode = require('../utils/furyMode');
const actionLog = require('../utils/actionLog');
const storage = require('../storage');

module.exports = {
  name: Events.RoleDelete,
  async execute(role) {
    const guild = role.guild;
    const entry = await findExecutor(guild, AuditLogEvent.RoleDelete, (e) => e.target?.id === role.id);

    await log(guild, 'roles', baseEmbed('roles', '🗑️ Usunięto rolę')
      .addFields(
        { name: 'Nazwa', value: role.name, inline: true },
        { name: 'Kolor', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
        { name: 'Usunął', value: executorTag(entry), inline: true }
      ));

    // Liczy się do tego samego licznika co usuwanie kanałów - oba to "destrukcyjne usuwanie"
    if (entry?.executor) {
      await furyMode.registerChannelDeleteAttempt(guild, entry.executor.id, { channels: [`rola: ${role.name}`] });
    }

    const cfg = await storage.getConfig(guild.id);
    if (cfg.autoRestore === 'off') return;

    // Auto-odtworzenie roli + próba przywrócenia jej członkom
    let restored = null;
    try {
      restored = await restoreSingleRole(guild, role);
    } catch (err) {
      console.error('[protection] nie udało się odtworzyć roli:', err.message);
    }

    actionLog.record(
      guild.id,
      'role_restore',
      `Rola "${role.name}" usunięta przez ${entry?.executor?.tag || 'nieznany'} i ${restored ? 'automatycznie odtworzona' : 'NIE udało się odtworzyć'}.`
    );

    await log(guild, 'security', baseEmbed('security', '🛡️ Auto-przywrócono usuniętą rolę')
      .setDescription(
        `Rola **${role.name}** została usunięta i ${restored ? `automatycznie odtworzona jako ${restored}` : 'NIE udało się jej odtworzyć - sprawdź uprawnienia bota'}.`
      )
      .addFields({ name: 'Usunął', value: executorTag(entry) }));

    scheduleBackup(guild, `usunięto rolę ${role.name}`);
  },
};
