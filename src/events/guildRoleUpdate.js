const { Events, EmbedBuilder } = require('discord.js');
const { sendWebhook } = require('../utils/webhook');

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(before, after) {
    if (before.permissions.bitfield === after.permissions.bitfield) return;

    const embed = new EmbedBuilder()
      .setTitle('🛡️ ALARM: Zmiana uprawnień!')
      .setColor(0xed4245)
      .addFields({ name: 'Rola', value: after.name });
    await sendWebhook(embed);
  },
};
