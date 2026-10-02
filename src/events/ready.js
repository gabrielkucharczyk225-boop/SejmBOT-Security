const { Events, REST, Routes } = require('discord.js');
const { BACKUP } = require('../config');
const { createBackup } = require('../utils/backup');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`SejmBOT Security (Master Edition) online jako ${client.user.tag}!`);
    try {
      const rest = new REST().setToken(process.env.TOKEN);
      const body = client.commands.map((c) => c.data.toJSON());
      await rest.put(Routes.applicationCommands(client.user.id), { body });
      console.log(`✅ Zarejestrowano ${body.length} komend slash.`);
    } catch (err) {
      console.error('❌ Nie udało się zarejestrować komend:', err);
    }
    setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        createBackup(guild, 'planowy (co 6h)').catch((e) => console.error(`[scheduled backup] ${guild.id}:`, e.message));
      }
    }, BACKUP.INTERVAL_MS);
  },
};
