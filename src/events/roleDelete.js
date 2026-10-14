const { Events, AuditLogEvent } = require('discord.js');
const { log, logLocal, logRestoreSuccess } = require('../utils/logger');
const { baseEmbed, withIds, trim } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { restoreSingleRole } = require('../utils/restore');
const { scheduleBackup } = require('../utils/backup');
const furyMode = require('../utils/furyMode');
const actionLog = require('../utils/actionLog');
const { ROLE_PING } = require('../utils/ping');
const storage = require('../storage');

module.exports = {
  name: Events.RoleDelete,
  async execute(role) {
    const guild = role.guild;
    const entry = await findExecutor(guild, AuditLogEvent.RoleDelete, (e) => e.target?.id === role.id);
    const executor = executorTag(entry);

    await log(guild, 'roles', baseEmbed('roles', '🗑️ Usunięto rolę')
      .addFields(
        { name: 'Nazwa', value: role.name, inline: true },
        { name: 'Kolor', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
        { name: 'Usunął', value: executor, inline: true }
      ));

    if (entry?.executor) {
      await furyMode.registerChannelDeleteAttempt(guild, entry.executor.id, { channels: [`rola: ${role.name}`] });
    }

    const cfg = await storage.getConfig(guild.id);
    if (cfg.autoRestore === 'off') return;

    let restored = null;
    let errMsg = null;
    try {
      restored = await restoreSingleRole(guild, role);
    } catch (err) {
      errMsg = err.message;
      console.error('[protection] nie udało się odtworzyć roli:', err.message);
    }

    actionLog.record(
      guild.id,
      restored ? 'role_restore' : 'role_restore_failed',
      `Rola "${role.name}" usunięta przez ${entry?.executor?.tag || 'nieznany'} i ${restored ? 'automatycznie odtworzona' : 'NIE udało się odtworzyć'}.`
    );

    if (restored) {
      const embed = baseEmbed('security', '✅ Przywrócono usuniętą rolę')
        .setDescription(`Rola **${role.name}** została usunięta i automatycznie odtworzona: ${restored}.`)
        .addFields({ name: 'Usunął', value: executor, inline: true });
      withIds(embed, { role: restored.id });
      await logRestoreSuccess(guild, embed);
    } else {
      const embed = baseEmbed('security', '❌ Operacja nieudana: nie udało się przywrócić roli')
        .setDescription(`Rola **${role.name}** została usunięta, a bot nie mógł jej odtworzyć.`)
        .addFields(
          { name: 'Usunął', value: executor, inline: true },
          { name: 'Błąd', value: trim(errMsg || 'brak uprawnień bota', 500), inline: false }
        )
        .setFooter({ text: 'Sprawdź, czy bot ma uprawnienie Administrator i czy jego rola jest wysoko w hierarchii.' });
      await logLocal(guild, 'security', embed, ROLE_PING);
    }

    scheduleBackup(guild, `usunięto rolę ${role.name}`);
  },
};
