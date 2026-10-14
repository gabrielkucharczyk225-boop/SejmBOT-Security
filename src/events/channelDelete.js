const { Events, AuditLogEvent, ChannelType } = require('discord.js');
const { log, logLocal, logRestoreSuccess } = require('../utils/logger');
const { baseEmbed, where, withIds, trim } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { restoreSingleChannel } = require('../utils/restore');
const { scheduleBackup } = require('../utils/backup');
const furyMode = require('../utils/furyMode');
const actionLog = require('../utils/actionLog');
const { ROLE_PING } = require('../utils/ping');
const storage = require('../storage');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    const guild = channel.guild;
    const entry = await findExecutor(guild, AuditLogEvent.ChannelDelete, (e) => e.target?.id === channel.id);
    const cfg = await storage.getConfig(guild.id);
    const executor = executorTag(entry);

    const nameLower = (channel.name || '').toLowerCase();
    const isIgnored = (cfg.ignorePrefixes || []).some((p) => nameLower.startsWith(p.toLowerCase()));
    const isLogChannel = Object.values(cfg.routes).includes(channel.id) || cfg.protectedChannels.includes(channel.id);
    const botEntry = (cfg.protectedBots || []).find((b) => b.channelId === channel.id);
    const isProtected = !isIgnored && (isLogChannel || cfg.protectAllChannels);

    if (channel.type !== ChannelType.GuildCategory) {
      await log(guild, 'channels', baseEmbed('channels', '🗑️ Usunięto kanał')
        .addFields(
          { name: 'Nazwa', value: `#${channel.name}`, inline: true },
          { name: 'Typ', value: String(channel.type), inline: true },
          { name: 'Usunął', value: executor, inline: true }
        ));
    }

    // Licznik Trybu Furii liczy każde usunięcie kanału (nie tylko chronionego)
    if (entry?.executor) {
      await furyMode.registerChannelDeleteAttempt(guild, entry.executor.id, { channels: [channel.name] });
    }

    if (!isProtected) {
      scheduleBackup(guild, `usunięto kanał #${channel.name}`);
      return;
    }

    // KANAŁ CHRONIONY - próba automatycznego odtworzenia
    let restored = null;
    let errMsg = null;
    try {
      restored = await restoreSingleChannel(guild, channel);
      for (const cat of Object.keys(cfg.routes)) {
        if (cfg.routes[cat] === channel.id) cfg.routes[cat] = restored.id;
      }
      if (cfg.protectedChannels.includes(channel.id)) {
        cfg.protectedChannels = cfg.protectedChannels.filter((id) => id !== channel.id).concat(restored.id);
      }
      if (botEntry) botEntry.channelId = restored.id;
      await storage.saveConfig(guild.id, cfg);
    } catch (err) {
      errMsg = err.message;
      console.error('[protection] nie udało się odtworzyć kanału:', err.message);
    }

    actionLog.record(
      guild.id,
      restored ? 'channel_restore' : 'channel_restore_failed',
      `Kanał #${channel.name} usunięty przez ${entry?.executor?.tag || 'nieznany'} i ${restored ? `odtworzony jako <#${restored.id}>` : 'NIE udało się odtworzyć'}.`
    );

    if (restored) {
      const title = botEntry
        ? '✅ Przywrócono chroniony log bota'
        : isLogChannel
          ? '✅ Przywrócono kanał z logami'
          : '✅ Przywrócono usunięty kanał';
      const embed = baseEmbed('security', title)
        .setDescription(`Kanał **#${channel.name}** został usunięty i automatycznie odtworzony: ${where(restored)}.`)
        .addFields({ name: 'Usunął', value: executor, inline: true });
      if (botEntry) embed.addFields({ name: 'Chroniony bot', value: `<@${botEntry.botId}> (${botEntry.botTag})`, inline: true });
      withIds(embed, { channel: restored.id });
      await logRestoreSuccess(guild, embed);
    } else {
      const embed = baseEmbed('security', '❌ Operacja nieudana: nie udało się przywrócić kanału')
        .setDescription(`Kanał **#${channel.name}** został usunięty, a bot nie mógł go odtworzyć.`)
        .addFields(
          { name: 'Usunął', value: executor, inline: true },
          { name: 'Błąd', value: trim(errMsg || 'brak uprawnień bota', 500), inline: false }
        )
        .setFooter({ text: 'Sprawdź, czy bot ma uprawnienie Administrator i czy jego rola jest wysoko w hierarchii.' });
      await logLocal(guild, 'security', embed, ROLE_PING);
    }
  },
};
