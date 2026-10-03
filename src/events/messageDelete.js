const { Events, AuditLogEvent } = require('discord.js');
const { log, trackSent, getTracked, untrack } = require('../utils/logger');
const { baseEmbed, trim } = require('../utils/embeds');
const { findExecutor, executorTag } = require('../utils/audit');
const { consumeExpected } = require('../utils/selfDeleteTracker');
const { createBackup } = require('../utils/backup');
const storage = require('../storage');

const DATA_MARKER_RE = /^#SEJMBOT#([^#\n]+)#([^#\n]+)#/;

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild) return;

    // ---- Ochrona WŁASNYCH logów i danych bota ----
    if (message.author?.id === client.user.id) {
      if (consumeExpected(message.id)) return; // zaplanowane, własne usunięcie (np. podmiana configu) - nic się nie stało

      const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => e.target?.id === client.user.id);

      // 1) Czytelny log (embed) wysłany przez logger.js - odeślij dokładnie ten sam
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

        await log(
          message.guild,
          'security',
          baseEmbed('security', '🚨 PRÓBA USUNIĘCIA LOGU BOTA')
            .setDescription(`Ktoś usunął log bota na kanale ${message.channel}. Ten sam log został wysłany ponownie.`)
            .addFields({ name: 'Usunął', value: executorTag(entry) }),
          { content: '@everyone', allowedMentions: { parse: ['everyone'] } }
        );
        return;
      }

      // 2) Wiadomość z danymi (config/backup) w kanale-magazynie danych
      const dataMatch = message.content.match(DATA_MARKER_RE);
      if (dataMatch) {
        const [, col] = dataMatch;
        if (col === 'config') {
          const cfg = await storage.getConfig(message.guild.id);
          await storage.saveConfig(message.guild.id, cfg); // ta sama konfiguracja, zapisana ponownie
          await log(
            message.guild,
            'security',
            baseEmbed('security', '🚨 PRÓBA USUNIĘCIA KONFIGURACJI BOTA')
              .setDescription('Ktoś usunął wiadomość z konfiguracją bota. Zapisano ją ponownie, bez zmian.')
              .addFields({ name: 'Usunął', value: executorTag(entry) }),
            { content: '@everyone', allowedMentions: { parse: ['everyone'] } }
          );
        } else if (col === 'backups' || col === 'backupmeta') {
          await createBackup(message.guild, 'automatyczne odtworzenie po próbie usunięcia backupu');
          await log(
            message.guild,
            'security',
            baseEmbed('security', '🚨 PRÓBA USUNIĘCIA BACKUPU BOTA')
              .setDescription(
                'Ktoś usunął wiadomość z backupem serwera. Dokładnie tej samej wersji nie da się odzyskać (dane fizycznie zniknęły z Discorda), więc od razu utworzono nowy, aktualny backup.'
              )
              .addFields({ name: 'Usunął', value: executorTag(entry) }),
            { content: '@everyone', allowedMentions: { parse: ['everyone'] } }
          );
        }
        return;
      }

      return; // inna, nieśledzona wiadomość bota - nic nie rób
    }

    if (message.author?.bot) return;

    // ---- zwykły log usuniętej wiadomości użytkownika ----
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
