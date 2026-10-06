const { Events, AuditLogEvent } = require('discord.js');
const { log, trackSent, getTracked, untrack } = require('../utils/logger');
const { baseEmbed, trim } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { consumeExpected } = require('../utils/selfDeleteTracker');
const { createBackup } = require('../utils/backup');
const protectedBotMessages = require('../utils/protectedBotMessages');
const actionLog = require('../utils/actionLog');
const storage = require('../storage');

const DATA_MARKER_RE = /^#SEJMBOT#([^#\n]+)#([^#\n]+)#/;
const EVERYONE_PING = { content: '@everyone', allowedMentions: { parse: ['everyone'] } };

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild) return;

    if (message.author?.id === client.user.id) {
      if (consumeExpected(message.id)) return;

      const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => e.target?.id === client.user.id);

      const tracked = getTracked(message.id);
      if (tracked) {
        untrack(message.id);
        try {
          const channel =
            message.guild.channels.cache.get(tracked.channelId) || (await message.guild.channels.fetch(tracked.channelId).catch(() => null));
          if (channel) {
            const resent = await channel.send({ embeds: [tracked.embed] });
            trackSent(resent.id, tracked);
          }
        } catch (err) {
          console.error('[self-protect] nie udało się odtworzyć logu:', err.message);
        }

        actionLog.record(message.guild.id, 'self_log_protect', `Ktoś usunął log bota na #${message.channel.name} - odesłano ponownie. Usunął: ${entry?.executor?.tag || 'nieznany'}.`);
        await log(
          message.guild,
          'security',
          baseEmbed('security', '🚨 PRÓBA USUNIĘCIA LOGU BOTA')
            .setDescription(`Ktoś usunął log bota na kanale ${message.channel}. Ten sam log został wysłany ponownie.`)
            .addFields({ name: 'Usunął', value: executorTag(entry) }),
          EVERYONE_PING
        );
        return;
      }

      const dataMatch = message.content.match(DATA_MARKER_RE);
      if (dataMatch) {
        const [, col] = dataMatch;
        if (col === 'config') {
          const cfg = await storage.getConfig(message.guild.id);
          await storage.saveConfig(message.guild.id, cfg);
          actionLog.record(message.guild.id, 'self_config_protect', `Ktoś usunął wiadomość z configiem - zapisano ponownie. Usunął: ${entry?.executor?.tag || 'nieznany'}.`);
          await log(
            message.guild,
            'security',
            baseEmbed('security', '🚨 PRÓBA USUNIĘCIA KONFIGURACJI BOTA')
              .setDescription('Ktoś usunął wiadomość z konfiguracją bota. Zapisano ją ponownie, bez zmian.')
              .addFields({ name: 'Usunął', value: executorTag(entry) }),
            EVERYONE_PING
          );
        } else if (col === 'backups' || col === 'backupmeta') {
          await createBackup(message.guild, 'automatyczne odtworzenie po próbie usunięcia backupu');
          actionLog.record(message.guild.id, 'self_backup_protect', `Ktoś usunął wpis backupu - utworzono nowy backup. Usunął: ${entry?.executor?.tag || 'nieznany'}.`);
          await log(
            message.guild,
            'security',
            baseEmbed('security', '🚨 PRÓBA USUNIĘCIA BACKUPU BOTA')
              .setDescription(
                'Ktoś usunął wiadomość z backupem serwera. Dokładnie tej samej wersji nie da się odzyskać (dane fizycznie zniknęły z Discorda), więc od razu utworzono nowy, aktualny backup.'
              )
              .addFields({ name: 'Usunął', value: executorTag(entry) }),
            EVERYONE_PING
          );
        }
        return;
      }

      return;
    }

    if (message.author?.bot) {
      const cfg = await storage.getConfig(message.guild.id);
      const botEntry = (cfg.protectedBots || []).find((b) => b.botId === message.author.id && b.channelId === message.channelId);
      if (botEntry) {
        const cached = protectedBotMessages.get(message.id);
        protectedBotMessages.untrack(message.id);
        const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => e.target?.id === message.author.id);

        try {
          const channel =
            message.guild.channels.cache.get(botEntry.channelId) || (await message.guild.channels.fetch(botEntry.channelId).catch(() => null));
          if (channel && cached) {
            const resent = await channel.send({ content: cached.content || undefined, embeds: cached.embeds || [] });
            protectedBotMessages.track(resent.id, cached);
          }
        } catch (err) {
          console.error('[chron-bota] nie udało się odtworzyć logu:', err.message);
        }

        actionLog.record(
          message.guild.id,
          'protected_bot_log_protect',
          `Ktoś usunął log chronionego bota ${botEntry.botTag} - ${cached ? 'odesłano ponownie' : 'NIE udało się odtworzyć'}. Usunął: ${entry?.executor?.tag || 'nieznany'}.`
        );
        await log(
          message.guild,
          'security',
          baseEmbed('security', '🚨 PRÓBA USUNIĘCIA LOGU CHRONIONEGO BOTA')
            .setDescription(
              `Ktoś usunął log bota **${botEntry.botTag}** na kanale ${message.channel}.` +
                (cached ? ' Ten sam log został wysłany ponownie.' : ' Nie udało się odtworzyć treści (bot nie zdążył jej zapisać przed usunięciem).')
            )
            .addFields(
              { name: 'Chroniony bot', value: `<@${botEntry.botId}> (${botEntry.botTag})`, inline: true },
              { name: 'Usunął', value: executorTag(entry), inline: true }
            ),
          EVERYONE_PING
        );
        return;
      }
      return;
    }

    const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => e.target?.id === message.author?.id);
    const embed = baseEmbed('messages', '🗑️ Usunięto wiadomość')
      .addFields(
        { name: 'Autor', value: message.author ? `${message.author} (\`${message.author.id}\`)` : 'Nieznany (spoza cache)', inline: true },
        { name: 'Kanał', value: `${message.channel}`, inline: true },
        { name: 'Usunął', value: executorTag(entry), inline: true },
        { name: 'Treść', value: trim(message.content || '*(brak treści / spoza cache)*') }
      );
    if (message.attachments?.size) {
      embed.addFields({ name: 'Załączniki', value: [...message.attachments.values()].map((a) => a.name).join(', ') });
    }
    await log(message.guild, 'messages', embed);
  },
};
