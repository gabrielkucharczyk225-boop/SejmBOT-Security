const { Events } = require('discord.js');
const { FORBIDDEN_NAMES, NEW_ACCOUNT_DAYS } = require('../config');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { registerJoin } = require('../utils/raid');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await registerJoin(member.guild);

    const username = member.user.username.toLowerCase();
    if (FORBIDDEN_NAMES.some((bad) => username.includes(bad))) {
      try {
        await member.kick('Podejrzany nick (SejmBOT Security)');
        await log(member.guild, 'security', baseEmbed('security', '🚫 Zablokowano podejrzanego użytkownika')
          .setDescription(`${member.user.tag} (\`${member.id}\`) został wyrzucony za podejrzany nick.`));
      } catch (err) {
        console.error('Nie udało się wyrzucić użytkownika:', err.message);
      }
      return;
    }

    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const embed = baseEmbed('members', '👤 Nowy użytkownik dołączył')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Użytkownik', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: 'Konto założone', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Wiek konta', value: `${ageDays} dni${ageDays < NEW_ACCOUNT_DAYS ? ' ⚠️ bardzo nowe konto!' : ''}`, inline: true },
        { name: 'Liczba członków', value: String(member.guild.memberCount), inline: true }
      );
    if (ageDays < NEW_ACCOUNT_DAYS) embed.setColor(0xe74c3c);
    await log(member.guild, 'members', embed);
  },
};
