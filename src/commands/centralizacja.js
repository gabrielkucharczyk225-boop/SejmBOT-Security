const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('centralizacja')
    .setDescription('Zbieranie logów ze wszystkich serwerów na jednym kanale głównego serwera')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('ustaw')
        .setDescription('[Serwer główny] Ustaw kanał, na który mają trafiać logi ze wszystkich serwerów')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Kanał na tym serwerze').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('podlacz')
        .setDescription('[Serwer podrzędny] Wysyłaj logi tego serwera na kanał serwera głównego')
        .addStringOption((o) =>
          o.setName('id_kanalu').setDescription('ID kanału z serwera głównego (tryb dewelopera → PPM na kanał → Kopiuj ID)').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('odlacz').setDescription('[Serwer podrzędny] Przestań wysyłać logi na serwer główny'))
    .addSubcommand((s) => s.setName('status').setDescription('Pokaż ustawienia centralizacji dla tego serwera')),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);

    if (sub === 'ustaw') {
      const channel = interaction.options.getChannel('kanal');
      cfg.centralHubChannelId = channel.id;
      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({
        content:
          `✅ Ten serwer jest teraz **głównym** (hubem logów). Logi z podłączonych serwerów będą trafiać na ${channel}.\n` +
          `Na każdym innym serwerze wpisz:\n\`/centralizacja podlacz id_kanalu:${channel.id}\``,
        ephemeral: true,
      });
    }

    if (sub === 'podlacz') {
      const id = interaction.options.getString('id_kanalu').trim();
      if (!/^\d{17,20}$/.test(id)) {
        return interaction.reply({ content: '❌ To nie wygląda na ID kanału (same cyfry, 17-20 znaków).', ephemeral: true });
      }

      const target = await interaction.client.channels.fetch(id).catch(() => null);
      if (!target || !target.guild) {
        return interaction.reply({
          content: '❌ Nie znaleziono tego kanału. Sprawdź ID i czy bot jest na serwerze głównym.',
          ephemeral: true,
        });
      }
      if (target.guild.id === interaction.guild.id) {
        return interaction.reply({ content: '❌ Ten kanał jest na tym samym serwerze. Podaj kanał z serwera głównego.', ephemeral: true });
      }
      if (!target.isTextBased()) {
        return interaction.reply({ content: '❌ Wskazany kanał nie jest tekstowy.', ephemeral: true });
      }

      cfg.centralForwardTo = target.id;
      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({
        content: `✅ Logi tego serwera będą kopiowane na **${target.guild.name}** → ${target}.`,
        ephemeral: true,
      });
    }

    if (sub === 'odlacz') {
      if (!cfg.centralForwardTo) {
        return interaction.reply({ content: 'Ten serwer nie wysyła logów na serwer główny.', ephemeral: true });
      }
      delete cfg.centralForwardTo;
      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({ content: '🚫 Odłączono - logi tego serwera nie są już kopiowane na serwer główny.', ephemeral: true });
    }

    if (sub === 'status') {
      const hub = cfg.centralHubChannelId ? `<#${cfg.centralHubChannelId}> (ten serwer jest hubem)` : '*brak*';
      const fwd = cfg.centralForwardTo ? `<#${cfg.centralForwardTo}>` : '*brak*';
      return interaction.reply({
        content: `**Hub (kanał zbiorczy na tym serwerze):** ${hub}\n**Przekazywanie logów tego serwera:** ${fwd}`,
        ephemeral: true,
      });
    }
  },
};
