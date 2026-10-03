const { Events, REST, Routes } = require('discord.js');
const { BACKUP } = require('../config');
const { createBackup } = require('../utils/backup');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const storage = require('../storage');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`SejmBOT Security (Master Edition) online jako ${client.user.tag}!`);
    storage.setClient(client);

    try {
      const rest = new REST().setToken(process.env.TOKEN);
      const body = client.commands.map((c) => c.data.toJSON());
      await rest.put(Routes.applicationCommands(client.user.id), { body });
      console.log(`✅ Zarejestrowano ${body.length} komend slash.`);
    } catch (err) {
      console.error('❌ Nie udało się zarejestrować komend:', err);
    }

    for (const guild of client.guilds.cache.values()) {
      try {
        const textChannels = guild.channels.cache.filter((c) => c.isTextBased && c.isTextBased() && !c.isThread());
        for (const channel of textChannels.values()) {
          try {
            const pins = await channel.messages.fetchPinned();
            const marker = pins.find((m) => m.content.startsWith('#SEJMBOT_DATA_CHANNEL#'));
            if (marker) {
              storage.attachChannelAdapter(guild.id, channel.id);
              console.log(`[${guild.name}] znaleziono kanał danych bota: #${channel.name}`);
              break;
            }
          } catch {
            // brak uprawnień do tego kanału - pomiń
          }
        }
      } catch (err) {
        console.error(`[startup] błąd skanowania kanału danych dla ${guild.id}:`, err.message);
      }
    }

    for (const guild of client.guilds.cache.values()) {
      try {
        const summary = await storage.getStartupSummary(guild.id);
        const modeLabel = storage.modeFor(guild.id) === 'channel' ? 'kanał Discorda' : storage.modeFor(guild.id) === 'mongo' ? 'MongoDB' : 'pamięć (nietrwałe!)';
        console.log(
          `[${guild.name}] wczytano: ${summary.routesCount} kategorii logów, ${summary.protectedCount} chronionych kanałów, ${summary.backupsCount} backupów (baza: ${modeLabel}).`
        );

        if (summary.routesCount > 0) {
          const embed = baseEmbed('backup', '🔄 Bot wznowił działanie')
            .setDescription(`Wczytano zapamiętaną konfigurację z: **${modeLabel}**.`)
            .addFields(
              { name: 'Skonfigurowane kategorie logów', value: String(summary.routesCount), inline: true },
              { name: 'Chronione kanały', value: String(summary.protectedCount), inline: true },
              { name: 'Zapisane backupy', value: String(summary.backupsCount), inline: true }
            );
          if (summary.latestBackup) {
            embed.addFields({ name: 'Ostatni backup', value: new Date(summary.latestBackup.ts).toLocaleString('pl-PL') });
          }
          await log(guild, 'backup', embed);
        }

        if (summary.backupsCount === 0) {
          console.log(`[${guild.name}] brak jakiegokolwiek backupu - tworzę pierwszy teraz.`);
          await createBackup(guild, 'pierwszy backup po starcie bota');
        }
      } catch (err) {
        console.error(`[startup] błąd przy wczytywaniu/tworzeniu backupu dla ${guild.id}:`, err.message);
      }
    }

    setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        createBackup(guild, 'planowy (co 6h)').catch((e) => console.error(`[scheduled backup] ${guild.id}:`, e.message));
      }
    }, BACKUP.INTERVAL_MS);
  },
};
