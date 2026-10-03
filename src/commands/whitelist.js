const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../storage');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Biała lista linków - role i kanały, na których bot NIE usuwa linków')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName('rola')
        .setDescription('Role zwolnione z blokady linków')
        .addSubcommand((s) => s.setName('dodaj').setDescription('Dodaj rolę do białej listy').addRoleOption((o) => o.setName('rola').setDescription('Rola').setRequired(true)))
        .addSubcommand((s) => s.setName('usun').setDescription('Usuń rolę z białej listy').addRoleOption((o) => o.setName('rola').setDescription('Rola').setRequired(true)))
        .addSubcommand((s) => s.setName('lista').setDescription('Pokaż role na białej liście'))
    )
    .addSubcommandGroup((g) =>
      g
        .setName('kanal')
        .setDescription('Kanały, na których linki są dozwolone')
        .addSubcommand((s) => s.setName('dodaj').setDescription('Dodaj kanał do białej listy').addChannelOption((o) => o.setName('kanal').setDescription('Kanał').setRequired(true)))
        .addSubcommand((s) => s.setName('usun').setDescription('Usuń kanał z białej listy').addChannelOption((o) => o.setName('kanal').setDescription('Kanał').setRequired(true)))
        .addSubcommand((s) => s.setName('lista').setDescription('Pokaż kanały na białej liście'))
    ),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);
    cfg.linkWhitelist = cfg.linkWhitelist || { roles: [], channels: [] };

    if (group === 'rola') {
      const role = interaction.options.getRole('rola', false);
      if (sub === 'dodaj') {
        if (!cfg.linkWhitelist.roles.includes(role.id)) cfg.linkWhitelist.roles.push(role.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `✅ Osoby z rolą ${role} mogą teraz wysyłać linki - bot ich nie usunie.`, ephemeral: true });
      }
      if (sub === 'usun') {
        cfg.linkWhitelist.roles = cfg.linkWhitelist.roles.filter((id) => id !== role.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `Usunięto rolę ${role} z białej listy.`, ephemeral: true });
      }
      if (sub === 'lista') {
        const list = cfg.linkWhitelist.roles.map((id) => `<@&${id}>`).join('\n') || '*(brak)*';
        return interaction.reply({ content: `**Role na białej liście linków:**\n${list}`, ephemeral: true });
      }
    }

    if (group === 'kanal') {
      const channel = interaction.options.getChannel('kanal', false);
      if (sub === 'dodaj') {
        if (!cfg.linkWhitelist.channels.includes(channel.id)) cfg.linkWhitelist.channels.push(channel.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `✅ Na kanale ${channel} linki nie będą usuwane.`, ephemeral: true });
      }
      if (sub === 'usun') {
        cfg.linkWhitelist.channels = cfg.linkWhitelist.channels.filter((id) => id !== channel.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `Usunięto kanał ${channel} z białej listy.`, ephemeral: true });
      }
      if (sub === 'lista') {
        const list = cfg.linkWhitelist.channels.map((id) => `<#${id}>`).join('\n') || '*(brak)*';
        return interaction.reply({ content: `**Kanały na białej liście linków:**\n${list}`, ephemeral: true });
      }
    }
  },
};
