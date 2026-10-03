const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chron-bota')
    .setDescription('Chroń kanał z logami innego bota - auto-odtwarzanie + alarm z @everyone, jeśli ktoś go usunie')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('dodaj')
        .setDescription('Dodaj bota i jego kanał z logami do ochrony')
        .addUserOption((o) => o.setName('bot').setDescription('Bot (lub osoba), którego logi mają być chronione').setRequired(true))
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Kanał, na który ten bot wysyła logi').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('usun').setDescription('Usuń ochronę kanału bota').addChannelOption((o) => o.setName('kanal').setDescription('Kanał do usunięcia z ochrony').setRequired(true))
    )
    .addSubcommand((s) => s.setName('lista').setDescription('Pokaż chronione boty i ich kanały')),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);
    cfg.protectedBots = cfg.protectedBots || [];

    if (sub === 'dodaj') {
      const bot = interaction.options.getUser('bot');
      const channel = interaction.options.getChannel('kanal');

      cfg.protectedBots = cfg.protectedBots.filter((b) => b.channelId !== channel.id);
      cfg.protectedBots.push({ botId: bot.id, botTag: bot.tag, channelId: channel.id });
      if (!cfg.protectedChannels.includes(channel.id)) cfg.protectedChannels.push(channel.id);

      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({
        content: `🛡️ Kanał ${channel} jest teraz chroniony jako logi bota **${bot.tag}**. Jeśli ktoś go usunie, bot go odtworzy i wyśle alarm z @everyone, podając kto to zrobił.`,
        ephemeral: true,
      });
    }

    if (sub === 'usun') {
      const channel = interaction.options.getChannel('kanal');
      cfg.protectedBots = cfg.protectedBots.filter((b) => b.channelId !== channel.id);
      cfg.protectedChannels = cfg.protectedChannels.filter((id) => id !== channel.id);
      await storage.saveConfig(interaction.guild.id, cfg);
      return interaction.reply({ content: `Usunięto ochronę kanału ${channel}.`, ephemeral: true });
    }

    if (sub === 'lista') {
      const list = cfg.protectedBots.map((b) => `<@${b.botId}> (${b.botTag}) → <#${b.channelId}>`).join('\n') || '*(brak)*';
      return interaction.reply({ content: `**Chronione boty i ich kanały logów:**\n${list}`, ephemeral: true });
    }
  },
};
