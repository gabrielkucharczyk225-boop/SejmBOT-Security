const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const storage = require('../storage');
const { createBackup } = require('../utils/backup');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ustaw-kanal-backupow')
    .setDescription('Kanał, na którym bot trzyma swoje dane (config + backupy) - zamiast zewnętrznej bazy danych')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('ustaw')
        .setDescription('Ustaw kanał jako magazyn danych bota')
        .addChannelOption((o) => o.setName('kanal').setDescription('Najlepiej prywatny kanał tylko dla bota/adminów').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) => s.setName('wylacz').setDescription('Przestań używać kanału jako magazynu danych (wróć do bazy domyślnej)')),

  async execute(interaction) {
    if (!isAuthorized(interaction.member) || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Ta komenda wymaga uprawnienia **Administrator**.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'wylacz') {
      storage.detachChannelAdapter(interaction.guild.id);
      return interaction.reply({ content: '🚫 Bot przestał używać kanału jako magazynu danych. Wraca do domyślnej bazy (MongoDB/pamięć).', ephemeral: true });
    }

    const channel = interaction.options.getChannel('kanal');

    const me = await interaction.guild.members.fetchMe();
    const perms = channel.permissionsFor(me);
    const required = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageMessages,
    ];
    const missing = required.filter((p) => !perms.has(p));
    if (missing.length) {
      return interaction.reply({
        content: `❌ Bot nie ma wystarczających uprawnień na kanale ${channel}. Potrzebuje: Wyświetlaj kanał, Wysyłaj wiadomości, Załączaj pliki, Odczytuj historię, Zarządzaj wiadomościami.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const pinned = await channel.messages.fetchPinned();
      const existingMarker = pinned.find((m) => m.content.startsWith('#SEJMBOT_DATA_CHANNEL#'));
      if (!existingMarker) {
        const markerMsg = await channel.send({ content: storage.PIN_MARKER });
        await markerMsg.pin().catch(() => {});
      }

      storage.attachChannelAdapter(interaction.guild.id, channel.id);

      await createBackup(interaction.guild, 'pierwszy backup po podłączeniu kanału danych');

      await interaction.editReply(
        `✅ Kanał ${channel} jest teraz magazynem danych bota. Konfiguracja i backupy będą tam zapisywane, a po każdym restarcie bot sam je stamtąd odczyta - **nie potrzebujesz MongoDB**.\n\n` +
          `Nie usuwaj przypiętej wiadomości-znacznika na tym kanale - to po niej bot go rozpoznaje.`
      );
    } catch (err) {
      console.error('[ustaw-kanal-backupow]', err);
      await interaction.editReply(`❌ Coś poszło nie tak: ${err.message}`);
    }
  },
};
