const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { FORBIDDEN_NAMES, NEW_ACCOUNT_DAYS, RAID_JOIN_LIMIT, PUNISHMENT_ROLE_ID } = require('../config');
const { log } = require('../utils/logger');
const { baseEmbed, who, withIds, when, trim } = require('../utils/embeds');
const { registerJoin, getRecentJoinCount } = require('../utils/raid');
const { scoreMember } = require('../utils/multiAccountDetector');
const recentBans = require('../utils/recentBans');
const bannedRegistry = require('../utils/bannedRegistry');
const actionLog = require('../utils/actionLog');
const inviteTracker = require('../utils/inviteTracker');
const { notifyOwner } = require('../utils/ownerNotify');
const { ROLE_PING } = require('../utils/ping');

function confirmButtons(memberId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`multiacc:ban:yes:${memberId}`).setLabel('Tak, zbanuj').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`multiacc:ban:no:${memberId}`).setLabel('Nie').setStyle(ButtonStyle.Secondary)
  );
}

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
          .setDescription(`${who(member.user)} został wyrzucony za podejrzany nick.`));
      } catch (err) {
        console.error('Nie udało się wyrzucić użytkownika:', err.message);
      }
      return;
    }

    // Kto go zaprosił (śledzenie zaproszeń)
    const usedInvite = await inviteTracker.detectUsedInvite(member.guild);
    const inviteText = usedInvite
      ? `\`${usedInvite.code}\` (utworzone przez **${usedInvite.inviterTag}**)`
      : 'nieznany (zaproszenie jednorazowe, link bezpośredni lub wygasłe)';

    // Czy ta sama osoba (ID) była zbanowana na innym serwerze bota
    const banElsewhere = await bannedRegistry.findBanElsewhere(member.id, member.guild.id, member.client);
    if (banElsewhere) {
      actionLog.record(
        member.guild.id,
        'banned_id_returned',
        `${member.user.tag} (${member.id}) wrócił - był zbanowany na serwerze ${banElsewhere.guildName}.`
      );
      const banAlert = baseEmbed('security', '🚨 Osoba zbanowana na innym serwerze wróciła')
        .setDescription(`${who(member.user)} był zbanowany na serwerze **${banElsewhere.guildName}**.`)
        .addFields(
          { name: 'Powód bana', value: trim(banElsewhere.reason || 'brak podanego powodu', 500) },
          { name: 'Data bana', value: when(banElsewhere.ts) },
          { name: 'Kto może zatwierdzić', value: `<@&${PUNISHMENT_ROLE_ID}>` }
        )
        .setFooter({ text: 'Czy mam zbanować tę osobę?' });
      withIds(banAlert, { user: member.id });
      await log(member.guild, 'security', banAlert, { ...ROLE_PING, components: [confirmButtons(member.id)] });
      await notifyOwner(member.guild, banAlert);
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
        { name: 'Użytkownik', value: who(member.user), inline: true },
        { name: 'Konto założone', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
        { name: 'Wiek konta', value: `${ageDays} dni${ageDays < NEW_ACCOUNT_DAYS ? ' ⚠️ bardzo nowe konto!' : ''}`, inline: true },
        { name: 'Liczba członków', value: String(member.guild.memberCount), inline: true },
        { name: 'Zaproszony przez', value: inviteText },
        { name: '🕵️ Podejrzenie multikonta', value: `**${score}%**` },
        { name: 'Powody', value: reasons.length ? reasons.map((r) => `• ${r}`).join('\n') : '*(brak sygnałów ostrzegawczych)*' }
      );
    withIds(embed, { user: member.id });
    if (score >= 50) embed.setColor(0xe74c3c);
    else if (ageDays < NEW_ACCOUNT_DAYS) embed.setColor(0xf1c40f);
    await log(member.guild, 'members', embed);

    actionLog.record(
      member.guild.id,
      'member_join',
      `Dołączył ${member.user.tag} (${member.id}) przez zaproszenie ${usedInvite ? usedInvite.code : 'nieznane'} - podejrzenie multikonta: ${score}%.`
    );

    // ---- Progi działania ----
    if (score < 50) {
      return;
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
        ROLE_PING
      );
      return;
    }

    if (score < 80) {
      actionLog.record(member.guild.id, 'multiacc_confirm_pending', `${member.user.tag} (${member.id}) - ${score}% - czeka na decyzję moderacji (przyciski).`);
      const confirmEmbed = baseEmbed('security', '🚨 Wysokie podejrzenie multikonta (70-80%)')
        .setDescription(`${member} ma **${score}%** podejrzenia o multikonto.`)
        .addFields(
          { name: 'Powody', value: reasons.map((r) => `• ${r}`).join('\n') },
          { name: 'Kto może zatwierdzić', value: `<@&${PUNISHMENT_ROLE_ID}>` }
        )
        .setFooter({ text: 'Czy mam zbanować tę osobę?' });

      await log(member.guild, 'security', confirmEmbed, { ...ROLE_PING, components: [confirmButtons(member.id)] });
      return;
    }

    actionLog.record(member.guild.id, 'multiacc_confirm_pending_high', `${member.user.tag} (${member.id}) - ${score}% - czeka na decyzję moderacji (przyciski, wysoki priorytet).`);
    const highConfirmEmbed = baseEmbed('security', '🔨 BARDZO WYSOKIE podejrzenie multikonta (80-100%)')
      .setDescription(`${member} ma **${score}%** podejrzenia o multikonto. To najwyższy poziom pewności, jaki bot potrafi wyliczyć.`)
      .addFields(
        { name: 'Powody', value: reasons.map((r) => `• ${r}`).join('\n') },
        { name: 'Kto może zatwierdzić', value: `<@&${PUNISHMENT_ROLE_ID}>` }
      )
      .setFooter({ text: 'Czy mam zbanować tę osobę?' });

    await log(member.guild, 'security', highConfirmEmbed, { ...ROLE_PING, components: [confirmButtons(member.id)] });
    await notifyOwner(member.guild, highConfirmEmbed);
  },
};
