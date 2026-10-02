const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = [
  {
    name: Events.ThreadCreate,
    async execute(thread) {
      if (!thread.guild) return;
      await log(thread.guild, 'channels', baseEmbed('channels', '🧵 Utworzono wątek').setDescription(`${thread} w ${thread.parent || 'nieznanym kanale'}`));
    },
  },
  {
    name: Events.ThreadDelete,
    async execute(thread) {
      if (!thread.guild) return;
      await log(thread.guild, 'channels', baseEmbed('channels', '🗑️ Usunięto wątek').setDescription(`#${thread.name}`));
    },
  },
];
