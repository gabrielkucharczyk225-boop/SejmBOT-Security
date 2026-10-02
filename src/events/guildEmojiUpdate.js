const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { scheduleBackup } = require('../utils/backup');

module.exports = [
  {
    name: Events.GuildEmojiCreate,
    async execute(emoji) {
      await log(emoji.guild, 'server', baseEmbed('server', '😀 Dodano emoji').setThumbnail(emoji.imageURL()).setDescription(`\`:${emoji.name}:\``));
      scheduleBackup(emoji.guild, `dodano emoji ${emoji.name}`);
    },
  },
  {
    name: Events.GuildEmojiDelete,
    async execute(emoji) {
      await log(emoji.guild, 'server', baseEmbed('server', '🗑️ Usunięto emoji').setDescription(`\`:${emoji.name}:\``));
      scheduleBackup(emoji.guild, `usunięto emoji ${emoji.name}`);
    },
  },
  {
    name: Events.GuildStickerCreate,
    async execute(sticker) {
      await log(sticker.guild, 'server', baseEmbed('server', '🏷️ Dodano naklejkę').setDescription(sticker.name));
      scheduleBackup(sticker.guild, `dodano naklejkę ${sticker.name}`);
    },
  },
  {
    name: Events.GuildStickerDelete,
    async execute(sticker) {
      await log(sticker.guild, 'server', baseEmbed('server', '🗑️ Usunięto naklejkę').setDescription(sticker.name));
      scheduleBackup(sticker.guild, `usunięto naklejkę ${sticker.name}`);
    },
  },
];
