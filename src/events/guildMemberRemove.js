const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { logEmbed, who, when } = require('../utils/embeds');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const roles = member.roles?.cache?.filter((r) => r.id !== member.guild.id).map((r) => r.name).join(', ') || '*(nieznane)*';
    await log(member.guild, 'members', logEmbed({
      category: 'members',
      title: '👋 Użytkownik opuścił serwer',
      description: `${who(member.user)} opuścił serwer.`,
      thumb: member.user.displayAvatarURL(),
      target: who(member.user),
      fields: [
        { name: '📥 Dołączył', value: member.joinedTimestamp ? when(member.joinedTimestamp) : 'nieznane', inline: true },
        { name: '🎭 Miał role', value: roles.length ? roles : '*(brak)*', inline: false },
      ],
      ids: { user: member.id },
    }));
  },
};
