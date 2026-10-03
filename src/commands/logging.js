const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { CATEGORIES } = require('../config');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

const choices = [{ name: '🌐 Wszystko', value: 'all' }, ...CATEGORIES.map((c) => ({ name: `${c.emoji} ${c.label}`, value: c.id }))];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Konfiguracja kanałów logów SejmBOT Security')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Ustaw kanał logów dla kategorii')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanał, na który mają iść logi').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName('kategoria').setDescription('Kategoria logów albo "Wszystko"').addChoices(...choices).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Wyłącz logowanie dla kategorii')
        .addStringOption((o) => o.setName('kategoria').setDescription('Kategoria logów albo "Wszystko"').addChoices(...choices).setRequired(true))
    )
    .addSubcommand((s) => s.setName('status').setDescription('Pokaż obecną konfigurację logów'))
    .addSubcommandGroup((g) =>
      g
        .setName('protect')
        .setDescription('Ochrona kanałów przed usunięciem (auto-odtwarzanie)')
        .addSubcommand((s) =>
          s.setName('add').setDescription('Dodaj pojedynczy kanał do ochrony').addChannelOption((o) => o.setName('kanal').setDescription('Kanał do ochrony').setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName('remove').setDescription('Usuń pojedynczy kanał z ochrony').addChannelOption((o) => o.setName('kanal').setDescription('Kanał do usunięcia z ochrony').setRequired(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('Lista chronionych kanałów'))
        .addSubcommand((s) =>
          s
            .setName('all')
            .setDescription('Chroń WSZYSTKIE kanały na serwerze (poza zignorowanymi prefiksami)')
            .addBooleanOption((o) => o.setName('wlaczone').setDescription('true = chroń wszystkie kanały, false = wyłącz').setRequired(true))
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('ignore')
        .setDescription('Prefiksy nazw kanałów, które NIGDY nie są chronione/odtwarzane (np. "ticket")')
        .addSubcommand((s) =>
          s.setName('add').setDescription('Dodaj prefiks do ignorowania').addStringOption((o) => o.setName('prefiks').setDescription('Np. "ticket" zignoruje kanały "ticket-1", "ticket-jan" itd.').setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName('remove').setDescription('Usuń prefiks z listy ignorowanych').addStringOption((o) => o.setName('prefiks').setDescription('Prefiks do usunięcia').setRequired(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('Lista ignorowanych prefiksów'))
    ),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**, żeby to zmienić.', ephemeral: true });
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);

    if (group === 'protect') {
      const channel = interaction.options.getChannel('kanal', false);
      if (sub === 'add') {
        if (!cfg.protectedChannels.includes(channel.id)) cfg.protectedChannels.push(channel.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `🛡️ Kanał ${channel} jest teraz chroniony. Jeśli ktoś go usunie, bot go odtworzy i wyśle alarm.`, ephemeral: true });
      }
      if (sub === 'remove') {
        cfg.protectedChannels = cfg.protectedChannels.filter((id) => id !== channel.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `Usunięto ochronę kanału ${channel}.`, ephemeral: true });
      }
      if (sub === 'list') {
        const list = cfg.protectedChannels.map((id) => `<#${id}>`).join('\n') || '*(brak)*';
        return interaction.reply({ content: `**Chronione kanały:**\n${list}\n\nTryb "chroń wszystkie": **${cfg.protectAllChannels ? 'włączony' : 'wyłączony'}**`, ephemeral: true });
      }
      if (sub === 'all') {
        const enabled = interaction.options.getBoolean('wlaczone');
        cfg.protectAllChannels = enabled;
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({
          content: enabled
            ? `🛡️ Ochrona WSZYSTKICH kanałów **włączona**. Każdy usunięty kanał (poza prefiksami z \`/logging ignore\`) zostanie automatycznie odtworzony.`
            : `Ochrona wszystkich kanałów **wyłączona**. Dalej chronione są tylko kanały dodane przez \`/logging protect add\` oraz kanały logów.`,
          ephemeral: true,
        });
      }
    }

    if (group === 'ignore') {
      const prefix = interaction.options.getString('prefiks', false)?.toLowerCase();
      if (sub === 'add') {
        if (!cfg.ignorePrefixes.includes(prefix)) cfg.ignorePrefixes.push(prefix);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `✅ Kanały zaczynające się na \`${prefix}\` nie będą chronione/odtwarzane.`, ephemeral: true });
      }
      if (sub === 'remove') {
        cfg.ignorePrefixes = cfg.ignorePrefixes.filter((p) => p !== prefix);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `Usunięto prefiks \`${prefix}\` z listy ignorowanych.`, ephemeral: true });
      }
      if (sub === 'list') {
        const list = cfg.ignorePrefixes.map((p) => `\`${p}\``).join(', ') || '*(brak)*';
        return interaction.reply({ content: `**Ignorowane prefiksy:** ${list}`, ephemeral: true });
      }
    }

    if (sub === 'set') {
      const channel = interaction.options.getChannel('kanal');
      const category = interaction.options.getString('kategoria');
      const targets = category === 'all' ? CATEGORIES.map((c) => c.id) : [category];
      for (const t of targets) cfg.routes[t] = channel.id;
      await storage.saveConfig(interaction.guild.id, cfg);
      const label = category === 'all' ? 'wszystkie kategorie' : CATEGORIES.find((c) => c.id === category)?.label;
      return interaction.reply({ content: `✅ Logi (**${label}**) będą wysyłane na ${channel}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const category = interaction.options.getString('kategoria');
      const targets = category === 'all' ? CATEGORIES.map((c) => c.id) : [category];
      for (const t of targets) delete cfg.routes[t];
      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({ content: '🚫 Wyłączono logowanie dla wybranej kategorii.', ephemeral: true });
    }

    if (sub === 'status') {
      const embed = new EmbedBuilder().setTitle('⚙️ Konfiguracja logów').setColor(0x2f3136).setTimestamp();
      const lines = CATEGORIES.map((c) => {
        const chId = cfg.routes[c.id];
        return `${c.emoji} **${c.label}** — ${chId ? `<#${chId}>` : '*wyłączone*'}`;
      });
      embed.setDescription(lines.join('\n'));
      embed.addFields(
        { name: 'Chronione kanały (pojedyncze)', value: cfg.protectedChannels.map((id) => `<#${id}>`).join(', ') || '*(brak)*' },
        { name: 'Chroń wszystkie kanały', value: cfg.protectAllChannels ? '✅ włączone' : '❌ wyłączone', inline: true },
        { name: 'Ignorowane prefiksy', value: cfg.ignorePrefixes.map((p) => `\`${p}\``).join(', ') || '*(brak)*', inline: true }
      );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
