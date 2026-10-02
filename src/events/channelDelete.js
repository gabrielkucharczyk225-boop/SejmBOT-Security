const { Events, AuditLogEvent, ChannelType } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { restoreSingleChannel } = require('../utils/restore');
const { scheduleBackup } = require('../utils/backup');
const storage = require('../storage');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    const guild = channel.guild;
    const entry = await findExecutor(guild, AuditLogEvent.ChannelDelete, (e) => e.target?.id === channel.id);
    const cfg = await storage.getConfig(guild.id);
    const isProtected = Object.values(cfg.routes).includes(channel.id) || cfg.protectedChannels.includes(channel.id);

    if (channel.type !== ChannelType.GuildCategory) {
      await log(guild, 'channels', baseEmbed('channels', '🗑️ Usunięto kanał')
        .addFields(
          { name: 'Nazwa', value: `#${channel.name}`, inline: true },
          { name: 'Typ', value: String(channel.type), inline: true },
          { name: 'Usunął', value: executorTag(entry), inline: true }
        ));
    }

    if (isProtected) {
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
        await storage.saveConfig(guild.id, cfg);
      } catch (err) {
        console.error('[protection] nie udało się odtworzyć kanału z logami:', err.message);
      }

      const alertEmbed = baseEmbed('security', '🚨 PRÓBA USUNIĘCIA KANAŁU Z LOGAMI')
        .setDescription(
          `Kanał **#${channel.name}** (chroniony) został usunięty!\n` +
            `${restoredId ? `✅ Kanał został automatycznie odtworzony: <#${restoredId}>` : '❌ Nie udało się automatycznie odtworzyć kanału - sprawdź uprawnienia bota!'}`
        )
        .addFields({ name: 'Wykonał', value: executorTag(entry) });
      const sent = await log(guild, 'security', alertEmbed);
      if (!sent) {
        const target = restoredId ? guild.channels.cache.get(restoredId) : null;
        if (target) await target.send({ embeds: [alertEmbed] }).catch(() => {});
        else {
          const owner = await guild.fetchOwner().catch(() => null);
          if (owner) await owner.send({ embeds: [alertEmbed] }).catch(() => {});
        }
      }
      return;
    }

    scheduleBackup(guild, `usunięto kanał #${channel.name}`);
  },
};
