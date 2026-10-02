const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { scheduleBackup } = require('../utils/backup');

function diffOverwrites(before, after) {
  const lines = [];
  const beforeMap = new Map(before.permissionOverwrites.cache.map((o) => [o.id, o]));
  const afterMap = new Map(after.permissionOverwrites.cache.map((o) => [o.id, o]));
  for (const [id, ov] of afterMap) {
    const prev = beforeMap.get(id);
    if (!prev) { lines.push(`➕ Nowe uprawnienia dla \`${id}\``); continue; }
    if (prev.allow.bitfield !== ov.allow.bitfield || prev.deny.bitfield !== ov.deny.bitfield) {
      lines.push(`✏️ Zmieniono uprawnienia dla \`${id}\``);
    }
  }
  for (const id of beforeMap.keys()) if (!afterMap.has(id)) lines.push(`➖ Usunięto uprawnienia dla \`${id}\``);
  return lines;
}

module.exports = {
  name: Events.ChannelUpdate,
  async execute(before, after) {
    if (!after.guild) return;
    const changes = [];
    if (before.name !== after.name) changes.push(`**Nazwa:** #${before.name} → #${after.name}`);
    if (before.topic !== after.topic) changes.push(`**Temat:** ${before.topic || '*(brak)*'} → ${after.topic || '*(brak)*'}`);
    if (before.nsfw !== after.nsfw) changes.push(`**NSFW:** ${before.nsfw} → ${after.nsfw}`);
    if (before.rateLimitPerUser !== after.rateLimitPerUser) changes.push(`**Powolny tryb:** ${before.rateLimitPerUser ?? 0}s → ${after.rateLimitPerUser ?? 0}s`);
    if (before.parentId !== after.parentId) changes.push(`**Kategoria:** ${before.parent?.name || '*(brak)*'} → ${after.parent?.name || '*(brak)*'}`);
    const overwriteChanges = diffOverwrites(before, after);

    if (!changes.length && !overwriteChanges.length) return;

    const entry = await findExecutor(after.guild, AuditLogEvent.ChannelUpdate, (e) => e.target?.id === after.id);
    const embed = baseEmbed('channels', `📁 Zaktualizowano kanał #${after.name}`)
      .addFields({ name: 'Zmienił', value: executorTag(entry) });
    if (changes.length) embed.addFields({ name: 'Zmiany', value: changes.join('\n') });
    if (overwriteChanges.length) embed.addFields({ name: 'Uprawnienia', value: overwriteChanges.slice(0, 10).join('\n') });
    await log(after.guild, 'channels', embed);
    scheduleBackup(after.guild, `edycja kanału #${after.name}`);
  },
};
