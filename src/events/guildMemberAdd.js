const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { FORBIDDEN_NAMES, NEW_ACCOUNT_DAYS, RAID_JOIN_LIMIT } = require('../config');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const { registerJoin, getRecentJoinCount } = require('../utils/raid');
const { scoreMember } = require('../utils/multiAccountDetector');
const recentBans = require('../utils/recentBans');
const actionLog = require('../utils/actionLog');

const EVERYONE_PING = { content: '@everyone', allowedMentions: { parse: ['everyone'] } };

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await registerJoin(member.guild);

    // Ochrona nicków
    const username = member.user.username.toLowerCase();
    if (FORBIDDEN_NAMES.some((bad) => username.includes(bad))) {
      try {
        await member.kick('Podejrzany nick (SejmBOT Security)');
        actionLog.record(member.guild.id, 'kick_forbidden_name', `Wyrzucono ${member.user.tag} (${member.id}) za zakazany nick.`);
        await log(member.guild, 'security', baseEmbed('security', '🚫 Zablokowano podejrzanego użytkownika')
          .setDescription(`${member.user.tag} (\`${member.id}\`) został wyrzucony za podejrzany nick.`));
      } catch (err) {
        console.error('Nie udało się wyrzucić użytkownika:', err.message);
      }
      return;
    }

    // ---- Wynik podejrzenia multikonta ----
    const duringRaid = getRecentJoinCount(member.guild.id) >= Math.max(3, Math.floor(RAID_JOIN_LIMIT / 2));
    const match = recentBans.findMatch(member.user);
    const { score, reasons } = scoreMember(member, {
      duringRaid,
      matchesRecentBan: match?.username || null,
      matchesRecentBanBy: match?.by || null,
    });

    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const embed = baseEmbed('members', '👤 Nowy użytkownik dołączył')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'Użytkownik', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: 'Konto założone', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Wiek konta', value: `${ageDays} dni${ageDays < NEW_ACCOUNT_DAYS ? ' ⚠️ bardzo nowe konto!' : ''}`, inline: true },
        { name: 'Liczba członków', value: String(member.guild.memberCount), inline: true },
        { name: '🕵️ Podejrzenie multikonta', value: `**${score}%**` },
        { name: 'Powody', value: reasons.length ? reasons.map((r) => `• ${r}`).join('\n') : '*(brak sygnałów ostrzegawczych)*' }
      );
    if (score >= 50) embed.setColor(0xe74c3c);
    else if (ageDays < NEW_ACCOUNT_DAYS) embed.setColor(0xf1c40f);
    await log(member.guild, 'members', embed);

    actionLog.record(member.guild.id, 'member_join', `Dołączył ${member.user.tag} (${member.id}) - podejrzenie multikonta: ${score}%.`);

    // ---- Progi działania ----
    if (score < 50) {
      return; // za mało pewności, bot nic nie robi
    }

    if (score < 70) {
      actionLog.record(member.guild.id, 'multiacc_suggest', `${member.user.tag} (${member.id}) - ${score}% - zasugerowano wezwanie do wyjaśnienia.`);
      await log(
        member.guild,
        'security',
        baseEmbed('security', '⚠️ Podejrzenie multikonta (50-70%)')
          .setDescription(
            `${member} ma **${score}%** podejrzenia o multikonto. Sugeruję wezwanie tej osoby do wyjaśnienia (np. na prywatnej rozmowie z moderacją).`
          )
          .addFields({ name: 'Powody', value: reasons.map((r) => `• ${r}`).join('\n') }),
        EVERYONE_PING
      );
      return;
    }

    if (score < 80) {
      actionLog.record(member.guild.id, 'multiacc_confirm_pending', `${member.user.tag} (${member.id}) - ${score}% - czeka na decyzję moderacji (przyciski).`);
      const confirmEmbed = baseEmbed('security', '🚨 Wysokie podejrzenie multikonta (70-80%)')
        .setDescription(`${member} ma **${score}%** podejrzenia o multikonto.`)
        .addFields({ name: 'Powody', value: reasons.map((r) => `• ${r}`).join('\n') })
        .setFooter({ text: 'Czy mam zbanować tę osobę?' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`multiacc:ban:yes:${member.id}`).setLabel('Tak, zbanuj').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`multiacc:ban:no:${member.id}`).setLabel('Nie').setStyle(ButtonStyle.Secondary)
      );

      await log(member.guild, 'security', confirmEmbed, { ...EVERYONE_PING, components: [row] });
      return;
    }

    // 80-100%: bot sam nadaje karę (ban)
    try {
      await member.ban({ reason: `SejmBOT Security - automatyczne wykrycie multikonta (${score}%)` });
      actionLog.record(member.guild.id, 'multiacc_autoban', `Automatycznie zbanowano ${member.user.tag} (${member.id}) - ${score}% pewności.`);
      await log(
        member.guild,
        'security',
        baseEmbed('security', '🔨 AUTOMATYCZNY BAN - bardzo wysokie podejrzenie multikonta (80-100%)')
          .setDescription(`${member.user.tag} (\`${member.id}\`) został automatycznie zbanowany - **${score}%** podejrzenia.`)
          .addFields({ name: 'Powody', value: reasons.map((r) => `• ${r}`).join('\n') }),
        EVERYONE_PING
      );
    } catch (err) {
      console.error('[multiacc] nie udało się zbanować:', err.message);
      await log(
        member.guild,
        'security',
        baseEmbed('security', '❌ Nie udało się zbanować podejrzanego multikonta')
          .setDescription(`${member} - **${score}%** podejrzenia, ale ban się nie powiódł: ${err.message}`),
        EVERYONE_PING
      );
    }
  },
};
