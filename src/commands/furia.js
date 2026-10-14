const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../storage');
const furyMode = require('../utils/furyMode');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('furia')
    .setDescription('Tryb furii - automatyczna ochrona antyrajdowa')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('status').setDescription('Sprawdź czy tryb furii jest aktywny'))
    .addSubcommand((s) => s.setName('wylacz').setDescription('Ręcznie wyłącz tryb furii'))
    .addSubcommandGroup((g) =>
      g
        .setName('blokowane-boty')
        .setDescription('Boty blokowane (zdjęcie ról) automatycznie podczas trybu furii')
        .addSubcommand((s) => s.setName('dodaj').setDescription('Dodaj bota do blokowania').addUserOption((o) => o.setName('bot').setDescription('Bot').setRequired(true)))
        .addSubcommand((s) => s.setName('usun').setDescription('Usuń bota z listy').addUserOption((o) => o.setName('bot').setDescription('Bot').setRequired(true)))
        .addSubcommand((s) => s.setName('lista').setDescription('Pokaż listę'))
    ),

  async execute(interaction) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '❌ Musisz mieć uprawnienie **Zarządzaj serwerem**.', ephemeral: true });
    }
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const cfg = await storage.getConfig(interaction.guild.id);
    cfg.furyBlockedBots = cfg.furyBlockedBots || [];

    if (group === 'blokowane-boty') {
      const bot = interaction.options.getUser('bot', false);
      if (sub === 'dodaj') {
        if (!cfg.furyBlockedBots.includes(bot.id)) cfg.furyBlockedBots.push(bot.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `✅ Bot ${bot} będzie tymczasowo blokowany (zdjęcie ról) podczas trybu furii.`, ephemeral: true });
      }
      if (sub === 'usun') {
        cfg.furyBlockedBots = cfg.furyBlockedBots.filter((id) => id !== bot.id);
        await storage.saveConfig(interaction.guild.id, cfg);
        return interaction.reply({ content: `Usunięto ${bot} z listy blokowanych.`, ephemeral: true });
      }
      if (sub === 'lista') {
        const list = cfg.furyBlockedBots.map((id) => `<@${id}>`).join('\n') || '*(brak)*';
        return interaction.reply({ content: `**Boty blokowane podczas furii:**\n${list}`, ephemeral: true });
      }
    }

    if (sub === 'status') {
      const active = furyMode.isActive(interaction.guild.id);
      return interaction.reply({ content: active ? '🔥 Tryb furii jest AKTYWNY.' : '🕊️ Tryb furii jest wyłączony.', ephemeral: true });
    }
    if (sub === 'wylacz') {
      if (!furyMode.isActive(interaction.guild.id)) {
        return interaction.reply({ content: 'Tryb furii i tak nie jest aktywny.', ephemeral: true });
      }
      await furyMode.deactivate(interaction.guild, `ręcznie wyłączony przez ${interaction.user.tag}`);
      return interaction.reply({ content: '🕊️ Tryb furii wyłączony.', ephemeral: true });
    }
  },
};
