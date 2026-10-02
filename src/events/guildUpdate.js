const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

module.exports = {
  name: Events.GuildUpdate,
  async execute(before, after) {
    const changes = [];
    if (before.name !== after.name) changes.push(`**Nazwa:** ${before.name} → ${after.name}`);
    if (before.icon !== after.icon) changes.push('**Ikonka serwera** została zmieniona');
    if (before.banner !== after.banner) changes.push('**Baner serwera** został zmieniony');
    if (before.verificationLevel !== after.verificationLevel) changes.push(`**Poziom weryfikacji:** ${before.verificationLevel} → ${after.verificationLevel}`);
    if (before.ownerId !== after.ownerId) changes.push(`**⚠️ Właściciel serwera:** <@${before.ownerId}> → <@${after.ownerId}>`);
    if (!changes.length) return;

    const entry = await findExecutor(after, AuditLogEvent.GuildUpdate, () => true);
    await log(after, 'server', baseEmbed('server', '⚙️ Zaktualizowano ustawienia serwera')
      .addFields({ name: 'Zmiany', value: changes.join('\n') }, { name: 'Zmienił', value: executorTag(entry) }));
    scheduleBackup(after, 'edycja ustawień serwera');
  },
};
