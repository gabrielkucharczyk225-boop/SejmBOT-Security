const { Events } = require('discord.js');
const { isAuthorized } = require('../utils/permissions');
const { restoreServer } = require('../utils/restore');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const furyMode = require('../utils/furyMode');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (err) {
        console.error(`[command:${interaction.commandName}]`, err);
        const payload = { content: '❌ Wystąpił błąd podczas wykonywania komendy.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'restore:cancel') {
        return interaction.update({ content: 'Anulowano przywracanie serwera.', embeds: [], components: [] });
      }
      if (interaction.customId.startsWith('restore:confirm:')) {
        if (!isAuthorized(interaction.member)) {
          return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
        }
        const backupId = interaction.customId.replace('restore:confirm:', '');
        await interaction.update({ content: '⏳ Trwa przywracanie serwera... to może potrwać kilka minut.', embeds: [], components: [] });

        const progressEmbed = () => baseEmbed('backup', '♻️ Przywracanie serwera w toku');
        try {
          const result = await restoreServer(interaction.guild, backupId, async (msg) => {
            await log(interaction.guild, 'backup', progressEmbed().setDescription(msg)).catch(() => {});
          });
          const summary = baseEmbed('backup', '✅ Przywracanie serwera zakończone')
            .setDescription(
              result.errors.length
                ? `Zakończono z ${result.errors.length} błędami (drobne elementy mogły się nie odtworzyć):\n` +
                  result.errors.slice(0, 10).map((e) => `• ${e}`).join('\n')
                : 'Wszystko odtworzone bez błędów.'
            );
          await log(interaction.guild, 'backup', summary);
          await interaction.followUp({ content: '✅ Zakończono przywracanie serwera. Szczegóły na kanale logów backupów.', ephemeral: true });
        } catch (err) {
          console.error('[restore]', err);
          await interaction.followUp({ content: `❌ Przywracanie nie powiodło się: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (interaction.customId.startsWith('fury:punish:')) {
        if (!isAuthorized(interaction.member)) {
          return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
        }
        const parts = interaction.customId.split(':'); // fury, punish, yes|no, userId, [punishment]
        const decision = parts[2];
        const targetUserId = parts[3];

        if (decision === 'no') {
          await interaction.update({ content: '🚫 Odrzucono - SejmBOT Security nie podejmie działań wobec tej osoby.', components: [] });
          return;
        }

        const punishment = parts[4];
        await interaction.update({ content: '⏳ Wykonuję działania...', components: [] });
        const result = await furyMode.applyPunishment(interaction.guild, targetUserId, punishment, interaction.user);
        await interaction.followUp({ content: result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('multiacc:ban:')) {
        if (!isAuthorized(interaction.member)) {
          return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
        }
        const parts = interaction.customId.split(':'); // multiacc, ban, yes|no, userId
        const decision = parts[2];
        const targetUserId = parts[3];

        if (decision === 'no') {
          await interaction.update({ content: '🚫 Odrzucono - SejmBOT Security nie podejmie działań wobec tej osoby.', components: [] });
          return;
        }

        await interaction.update({ content: '⏳ Banuję...', components: [] });
        try {
          const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          if (!member) {
            await interaction.followUp({ content: '❌ Użytkownik nie jest już na serwerze.', ephemeral: true });
            return;
          }
          await member.ban({ reason: `SejmBOT Security - potwierdzone multikonto przez ${interaction.user.tag}` });
          await interaction.followUp({ content: `✅ Zbanowano ${member.user.tag}.`, ephemeral: true });
        } catch (err) {
          await interaction.followUp({ content: `❌ Nie udało się zbanować: ${err.message}`, ephemeral: true });
        }
      }
    }
  },
};
