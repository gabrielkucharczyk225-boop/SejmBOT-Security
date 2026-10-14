const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed, who, withIds } = require('../utils/embeds');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const roles = member.roles?.cache?.filter((r) => r.id !== member.guild.id).map((r) => r.name).join(', ') || '*(nieznane)*';
    const embed = baseEmbed('members', '👋 Użytkownik opuścił serwer')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Użytkownik', value: who(member.user), inline: true },
        { name: 'Dołączył', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'nieznane', inline: true },
        { name: 'Miał role', value: roles.length ? roles : '*(brak)*' }
      );
    withIds(embed, { user: member.id });
    await log(member.guild, 'members', embed);
  },
};
