const { Events, AuditLogEvent, ChannelType } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { restoreSingleChannel } = require('../utils/restore');
const { scheduleBackup } = require('../utils/backup');
const furyMode = require('../utils/furyMode');
const actionLog = require('../utils/actionLog');
const storage = require('../storage');

const EVERYONE_PING = { content: '@everyone', allowedMentions: { parse: ['everyone'] } };

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    const guild = channel.guild;
    const entry = await findExecutor(guild, AuditLogEvent.ChannelDelete, (e) => e.target?.id === channel.id);
    const cfg = await storage.getConfig(guild.id);

    const nameLower = (channel.name || '').toLowerCase();
    const isIgnored = (cfg.ignorePrefixes || []).some((p) => nameLower.startsWith(p.toLowerCase()));
    const isLogChannel = Object.values(cfg.routes).includes(channel.id) || cfg.protectedChannels.includes(channel.id);
    const botEntry = (cfg.protectedBots || []).find((b) => b.channelId === channel.id);
    const isProtected = !isIgnored && (isLogChannel || cfg.protectAllChannels);

    // Zwykły log usunięcia (zawsze, nawet dla kanałów ignorowanych/niechronionych)
    if (channel.type !== ChannelType.GuildCategory) {
      await log(guild, 'channels', baseEmbed('channels', '🗑️ Usunięto kanał')
        .addFields(
          { name: 'Nazwa', value: `#${channel.name}`, inline: true },
          { name: 'Typ', value: String(channel.type), inline: true },
          { name: 'Usunął', value: executorTag(entry), inline: true }
        ));
    }

    // Licznik Trybu Furii reaguje na usunięcie DOWOLNEGO kanału (nie tylko chronionego) -
    // 3 usunięcia pod rząd przez tę samą osobę to podejrzane niezależnie od tego, co usuwa.
    if (entry?.executor) {
      await furyMode.registerChannelDeleteAttempt(guild, entry.executor.id, { channels: [channel.name] });
    }

    if (!isProtected) {
      scheduleBackup(guild, `usunięto kanał #${channel.name}`);
      return;
    }

    // KANAŁ CHRONIONY - automatyczne odtworzenie
    let restoredId = null;
    try {
      const restored = await restoreSingleChannel(guild, channel);
      restoredId = restored.id;
      for (const cat of Object.keys(cfg.routes)) {
        if (cfg.routes[cat] === channel.id) cfg.routes[cat] = restored.id;
      }
      if (cfg.protectedChannels.includes(channel.id)) {
        cfg.protectedChannels = cfg.protectedChannels.filter((id) => id !== channel.id).concat(restored.id);
      }
      if (botEntry) {
        botEntry.channelId = restored.id;
      }
      await storage.saveConfig(guild.id, cfg);
    } catch (err) {
      console.error('[protection] nie udało się odtworzyć kanału:', err.message);
    }

    actionLog.record(
      guild.id,
      'channel_restore',
      `Kanał #${channel.name} usunięty przez ${entry?.executor?.tag || 'nieznany'} i ${restoredId ? `odtworzony jako <#${restoredId}>` : 'NIE udało się odtworzyć'}.`
    );

    let title;
    if (botEntry) title = '🚨 USUNIĘTO CHRONIONY LOG BOTA';
    else if (isLogChannel) title = '🚨 PRÓBA USUNIĘCIA KANAŁU Z LOGAMI';
    else title = '🛡️ Auto-przywrócono usunięty kanał';

    const alertEmbed = baseEmbed('security', title)
      .setDescription(
        `Kanał **#${channel.name}** (chroniony) został usunięty!\n` +
          `${restoredId ? `✅ Kanał został automatycznie odtworzony: <#${restoredId}>` : '❌ Nie udało się automatycznie odtworzyć kanału - sprawdź uprawnienia bota!'}`
      )
      .addFields({ name: 'Usunął', value: executorTag(entry) });
    if (botEntry) {
      alertEmbed.addFields({ name: 'Chroniony bot', value: `<@${botEntry.botId}> (${botEntry.botTag})` });
    }

    const sent = await log(guild, 'security', alertEmbed, EVERYONE_PING);
    if (!sent) {
      const target = restoredId ? guild.channels.cache.get(restoredId) : null;
      if (target) await target.send({ embeds: [alertEmbed], ...EVERYONE_PING }).catch(() => {});
      else {
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner) await owner.send({ embeds: [alertEmbed] }).catch(() => {});
      }
    }
  },
};
