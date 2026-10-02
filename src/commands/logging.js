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
      s.setName('set').setDescription('Ustaw kanał logów dla kategorii')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanał, na który mają iść logi').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName('kategoria').setDescription('Kategoria logów albo "Wszystko"').addChoices(...choices).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Wyłącz logowanie dla kategorii')
        .addStringOption((o) => o.setName('kategoria').setDescription('Kategoria logów albo "Wszystko"').addChoices(...choices).setRequired(true))
    )
    .addSubcommand((s) => s.setName('status').setDescription('Pokaż obecną konfigurację logów'))
    .addSubcommandGroup((g) =>
      g.setName('protect').setDescription('Ochrona kanałów z logami (także innych botów) przed usunięciem')
        .addSubcommand((s) => s.setName('add').setDescription('Dodaj kanał do ochrony').addChannelOption((o) => o.setName('kanal').setDescription('Kanał do ochrony').setRequired(true)))
        .addSubcommand((s) => s.setName('remove').setDescription('Usuń kanał z ochrony').addChannelOption((o) => o.setName('kanal').setDescription('Kanał do usunięcia z ochrony').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('Lista chronionych kanałów'))
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
        return interaction.reply({ content: `**Chronione kanały:**\n${list}`, ephemeral: true });
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
      embed.addFields({ name: 'Chronione kanały', value: cfg.protectedChannels.map((id) => `<#${id}>`).join(', ') || '*(brak)*' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
