const { Events } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(before, after) {
    const guild = after.guild || before.guild;
    const member = after.member || before.member;
    if (!member) return;

    if (!before.channel && after.channel) {
      await log(guild, 'voice', baseEmbed('voice', '🔊 Dołączył do kanału głosowego').setDescription(`${member} → ${after.channel}`));
      return;
    }
    if (before.channel && !after.channel) {
      await log(guild, 'voice', baseEmbed('voice', '🔇 Opuścił kanał głosowy').setDescription(`${member} wyszedł z ${before.channel}`));
      return;
    }
    if (before.channelId !== after.channelId) {
      await log(guild, 'voice', baseEmbed('voice', '🔀 Zmienił kanał głosowy').setDescription(`${member}: ${before.channel} → ${after.channel}`));
      return;
    }
    const flags = [];
    if (before.serverMute !== after.serverMute) flags.push(`serwerowy mute: ${after.serverMute}`);
    if (before.serverDeaf !== after.serverDeaf) flags.push(`serwerowe wyciszenie: ${after.serverDeaf}`);
    if (before.selfMute !== after.selfMute) flags.push(`własny mute: ${after.selfMute}`);
    if (before.selfDeaf !== after.selfDeaf) flags.push(`własne wyciszenie: ${after.selfDeaf}`);
    if (before.streaming !== after.streaming) flags.push(`stream: ${after.streaming}`);
    if (before.selfVideo !== after.selfVideo) flags.push(`kamera: ${after.selfVideo}`);
    if (flags.length) {
      await log(guild, 'voice', baseEmbed('voice', '🎛️ Zmiana stanu głosowego').setDescription(`${member} w ${after.channel}\n${flags.join(', ')}`));
    }
  },
};
