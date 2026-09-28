const { Events, EmbedBuilder } = require('discord.js');
const { FORBIDDEN_NAMES, NEW_ACCOUNT_DAYS } = require('../config');
const { sendWebhook } = require('../utils/webhook');
const { registerJoin } = require('../utils/raid');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // 1. Anti-Spike
    await registerJoin();

    // 2. Ochrona nicków
    const username = member.user.username.toLowerCase();
    if (FORBIDDEN_NAMES.some((bad) => username.includes(bad))) {
      try {
        await member.kick('Podejrzany nick');
      } catch (err) {
        console.error('Nie udało się wyrzucić użytkownika:', err);
      }
      return;
    }

    // 3. Log + wiek konta
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const embed = new EmbedBuilder()
      .setTitle('👤 Nowy użytkownik')
      .setColor(ageDays < NEW_ACCOUNT_DAYS ? 0xed4245 : 0x3498db)
      .addFields(
        { name: 'Użytkownik', value: `${member}`, inline: true },
        { name: 'Wiek konta', value: `${ageDays} dni`, inline: true }
      );
    await sendWebhook(embed);
  },
};
