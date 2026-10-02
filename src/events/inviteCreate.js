const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = [
  {
    name: Events.InviteCreate,
    async execute(invite) {
      await log(invite.guild, 'server', baseEmbed('server', '📨 Utworzono zaproszenie')
        .addFields(
          { name: 'Kod', value: invite.code, inline: true },
          { name: 'Utworzył', value: invite.inviter ? `${invite.inviter.tag}` : 'Nieznany', inline: true },
          { name: 'Kanał', value: `${invite.channel}`, inline: true },
          { name: 'Maks. użyć', value: invite.maxUses ? String(invite.maxUses) : 'bez limitu', inline: true },
          { name: 'Wygasa', value: invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'nigdy', inline: true }
        ));
    },
  },
  {
    name: Events.InviteDelete,
    async execute(invite) {
      await log(invite.guild, 'server', baseEmbed('server', '🗑️ Usunięto zaproszenie').setDescription(`Kod: \`${invite.code}\``));
    },
  },
  {
    name: Events.WebhooksUpdate,
    async execute(channel) {
      await log(channel.guild, 'server', baseEmbed('server', '🪝 Zmiana webhooków').setDescription(`Kanał: ${channel}`));
    },
  },
];
