const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../storage');
const { createBackup } = require('../utils/backup');
const { isAuthorized } = require('../utils/permissions');
const actionLog = require('../utils/actionLog');
const { restoreBotConfig } = require('../utils/configRestore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backupy serwera (kanały, role, permisje, ustawienia)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('create').setDescription('Utwórz backup serwera teraz'))
    .addSubcommand((s) => s.setName('list').setDescription('Pokaż listę zapisanych backupów'))
    .addSubcommand((s) => s.setName('historia').setDescription('Pokaż ostatnie działania bota (ochrona, furia, multikonta...)'))
    .addSubcommand((s) =>
      s
        .setName('przywroc-ustawienia')
        .setDescription('Przywróć ustawienia bota (kanały logów, ochrony, białą listę) z backupu')
        .addStringOption((o) =>
          o.setName('id').setDescription('ID backupu (z /backup list). Puste = najnowszy backup z ustawieniami').setRequired(false)
        )
    ),

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
      await interaction.deferReply({ ephemeral: true });
      const embed = new EmbedBuilder().setTitle('💾 Backupy serwera').setColor(0xf1c40f).setTimestamp();
      const lines = [];
      for (const b of backups.slice(0, 15)) {
        const date = new Date(b.ts).toLocaleString('pl-PL');
        const snap = await storage.loadBackup(b.id).catch(() => null);
        const bc = snap?.botConfig;
        const cfgText = bc
          ? `ustawienia: ${Object.keys(bc.routes || {}).length} kanałów logów, ${(bc.protectedChannels || []).length} chronionych, ${(bc.linkWhitelist?.channels || []).length} na białej liście`
          : 'brak ustawień bota';
        lines.push(`\`${b.id.split(':')[1]}\` — ${date} — ${b.reason}\n↳ role: ${b.counts.roles}, kanały: ${b.counts.channels}, emoji: ${b.counts.emojis}\n↳ ${cfgText}`);
      }
      embed.setDescription(lines.join('\n\n'));
      const modeLabel = storage.modeFor(interaction.guild.id) === 'channel' ? 'kanał Discorda (trwałe)' : storage.modeFor(interaction.guild.id) === 'mongo' ? 'MongoDB (trwałe)' : 'PAMIĘĆ (zniknie po restarcie!)';
      embed.setFooter({ text: `Baza danych: ${modeLabel}` });
      return interaction.editReply({ embeds: [embed] });
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

    if (sub === 'przywroc-ustawienia') {
      await interaction.deferReply({ ephemeral: true });
      const idPart = interaction.options.getString('id');
      const backups = await storage.listBackups(interaction.guild.id);

      let snapshot = null;
      let usedId = null;
      let usedTs = null;
      if (idPart) {
        const meta = backups.find((b) => b.id.endsWith(':' + idPart) || b.id === idPart);
        if (!meta) return interaction.editReply('❌ Nie znaleziono backupu o takim ID. Użyj `/backup list`.');
        snapshot = await storage.loadBackup(meta.id);
        usedId = meta.id;
        usedTs = meta.ts;
      } else {
        for (const meta of backups) {
          const s = await storage.loadBackup(meta.id);
          if (s?.botConfig) {
            snapshot = s;
            usedId = meta.id;
            usedTs = meta.ts;
            break;
          }
        }
      }

      if (!snapshot) return interaction.editReply('❌ Nie znaleziono backupu z ustawieniami bota.');

      const r = await restoreBotConfig(interaction.guild, snapshot, interaction.user);
      if (!r.ok) return interaction.editReply(`❌ ${r.message}`);

      const date = new Date(usedTs).toLocaleString('pl-PL');
      const lostText = r.lost.length
        ? `\n\n⚠️ Nie udało się dopasować (kanał/rola nie istnieje na serwerze):\n${[...new Set(r.lost)].map((l) => `• ${l}`).join('\n')}\nUstaw je ponownie komendą z /logging albo /whitelist.`
        : '';

      return interaction.editReply(
        `✅ Przywrócono ustawienia bota z backupu z **${date}** (\`${usedId.split(':')[1]}\`).\n` +
          `• Kanały logów: **${r.routes}**\n` +
          `• Chronione kanały: **${r.protectedChannels}** (tryb „chroń wszystkie”: ${r.protectAll ? 'tak' : 'nie'})\n` +
          `• Biała lista: **${r.whitelistChannels}** kanałów, **${r.whitelistRoles}** ról\n` +
          `• Chronione boty: **${r.protectedBots}**\n` +
          `• Ignorowane prefiksy: ${r.prefixes.map((p) => `\`${p}\``).join(', ') || '*(brak)*'}` +
          lostText
      );
    }
  },
};
