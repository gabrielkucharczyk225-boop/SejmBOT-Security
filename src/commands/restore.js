const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Przywróć CAŁY serwer (kanały, role, permisje) z backupu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName('id').setDescription('ID backupu (z /backup list) - puste = najnowszy').setRequired(false)),

  async execute(interaction) {
    if (!isAuthorized(interaction.member) || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Ta komenda wymaga uprawnienia **Administrator**.', ephemeral: true });
    }

    const backups = await storage.listBackups(interaction.guild.id);
    if (!backups.length) return interaction.reply({ content: 'Brak backupów do przywrócenia.', ephemeral: true });

    const idPart = interaction.options.getString('id');
    const meta = idPart ? backups.find((b) => b.id.endsWith(':' + idPart) || b.id === idPart) : backups[0];
    if (!meta) return interaction.reply({ content: '❌ Nie znaleziono backupu o takim ID. Użyj `/backup list`.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Potwierdzenie przywrócenia serwera')
      .setColor(0xe74c3c)
      .setDescription(
        `Zamierzasz przywrócić serwer z backupu z **${new Date(meta.ts).toLocaleString('pl-PL')}** (${meta.reason}).\n\n` +
          `Bot **utworzy brakujące** kanały, role, permisje, emoji i naklejki tak, by odpowiadały temu backupowi. ` +
          `Istniejące elementy o tej samej nazwie NIE zostaną usunięte ani zdublowane. Operacja może potrwać kilka minut.`
      )
      .addFields(
        { name: 'Role', value: String(meta.counts.roles), inline: true },
        { name: 'Kanały', value: String(meta.counts.channels), inline: true },
        { name: 'Emoji', value: String(meta.counts.emojis), inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`restore:confirm:${meta.id}`).setLabel('Tak, przywróć serwer').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('restore:cancel').setLabel('Anuluj').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
