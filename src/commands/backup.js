const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../storage');
const { createBackup } = require('../utils/backup');
const { isAuthorized } = require('../utils/permissions');
const actionLog = require('../utils/actionLog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backupy serwera (kanały, role, permisje, ustawienia)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('create').setDescription('Utwórz backup serwera teraz'))
    .addSubcommand((s) => s.setName('list').setDescription('Pokaż listę zapisanych backupów'))
    .addSubcommand((s) => s.setName('historia').setDescription('Pokaż ostatnie działania bota (ochrona, furia, multikonta...)')),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });
      const id = await createBackup(interaction.guild, `ręczny (${interaction.user.tag})`);
      return interaction.editReply(`✅ Backup utworzony. ID: \`${id.split(':')[1]}\``);
    }

    if (sub === 'list') {
      const backups = await storage.listBackups(interaction.guild.id);
      if (!backups.length) return interaction.reply({ content: 'Brak zapisanych backupów.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('💾 Backupy serwera').setColor(0xf1c40f).setTimestamp();
      embed.setDescription(
        backups
          .slice(0, 15)
          .map((b) => {
            const date = new Date(b.ts).toLocaleString('pl-PL');
            return `\`${b.id.split(':')[1]}\` — ${date} — ${b.reason}\n↳ role: ${b.counts.roles}, kanały: ${b.counts.channels}, emoji: ${b.counts.emojis}`;
          })
          .join('\n\n')
      );
      const modeLabel = storage.modeFor(interaction.guild.id) === 'channel' ? 'kanał Discorda (trwałe)' : storage.modeFor(interaction.guild.id) === 'mongo' ? 'MongoDB (trwałe)' : 'PAMIĘĆ (zniknie po restarcie!)';
      embed.setFooter({ text: `Baza danych: ${modeLabel}` });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'historia') {
      const entries = actionLog.getRecent(interaction.guild.id).slice(-15).reverse();
      if (!entries.length) return interaction.reply({ content: 'Brak zarejestrowanych działań.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('📜 Ostatnie działania SejmBOT Security').setColor(0x34495e).setTimestamp();
      embed.setDescription(
        entries.map((e) => `<t:${Math.floor(e.ts / 1000)}:R> **[${e.type}]** ${e.summary}`).join('\n\n')
      );
      embed.setFooter({ text: 'Ta sama historia jest też dołączana do każdego backupu serwera.' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
