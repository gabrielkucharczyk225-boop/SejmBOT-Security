const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendReport } = require('../utils/weeklyReport');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raport')
    .setDescription('Wyślij teraz tygodniowy raport bezpieczeństwa (zamiast czekać na automatyczny)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    await sendReport(interaction.guild);
    return interaction.editReply('📊 Raport wysłany na kanał logów Ochrony.');
  },
};
