const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const lockdown = require('../utils/lockdown');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blokada')
    .setDescription('Blokada serwera - wstrzymuje pisanie i wejście na głosowe dla wszystkich bez dodatkowych ról')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('wlacz').setDescription('Włącz blokadę (zapamiętuje obecne uprawnienia)'))
    .addSubcommand((s) => s.setName('wylacz').setDescription('Wyłącz blokadę i przywróć zapamiętane uprawnienia'))
    .addSubcommand((s) => s.setName('status').setDescription('Sprawdź, czy blokada jest aktywna')),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);

    if (sub === 'status') {
      if (!cfg.lockdown?.active) {
        return interaction.reply({ content: '🔓 Blokada nie jest aktywna.', ephemeral: true });
      }
      const since = Math.floor(cfg.lockdown.startedAt / 1000);
      return interaction.reply({
        content: `🔒 Blokada jest **aktywna** od <t:${since}:F> (<t:${since}:R>), włączona przez **${cfg.lockdown.by}**.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    if (sub === 'wlacz') {
      const result = await lockdown.enable(interaction.guild, interaction.user);
      return interaction.editReply(
        result.ok
          ? `🔒 Blokada włączona. Zmieniono ${result.affected} kanałów (błędów: ${result.errors}).`
          : `❌ ${result.message}`
      );
    }

    if (sub === 'wylacz') {
      const result = await lockdown.disable(interaction.guild, interaction.user);
      return interaction.editReply(
        result.ok
          ? `🔓 Blokada wyłączona. Przywrócono uprawnienia ${result.restored} kanałów (błędów: ${result.errors}).`
          : `❌ ${result.message}`
      );
    }
  },
};
