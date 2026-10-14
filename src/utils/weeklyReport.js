// Tygodniowy raport bezpieczeństwa - zbiera wpisy z rejestru działań z ostatnich 7 dni.
const storage = require('../storage');
const actionLog = require('./actionLog');
const { log } = require('./logger');
const { baseEmbed, trim } = require('./embeds');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function sendReport(guild) {
  const entries = actionLog.getRecent(guild.id, WEEK_MS);
  const count = (...types) => entries.filter((e) => types.includes(e.type)).length;
  const multiacc = entries.filter((e) => e.type.startsWith('multiacc')).length;
  const selfProtect = entries.filter((e) => e.type.startsWith('self_') || e.type === 'protected_bot_log_protect').length;

  const embed = baseEmbed('security', '📊 Tygodniowy raport bezpieczeństwa')
    .setDescription(`Podsumowanie działań SejmBOT Security z ostatnich 7 dni na serwerze **${guild.name}**.`)
    .addFields(
      { name: '👥 Nowe dołączenia', value: String(count('member_join')), inline: true },
      { name: '🚫 Wyrzucone za nick', value: String(count('kick_forbidden_name')), inline: true },
      { name: '🔗 Zablokowane linki', value: String(count('link_blocked')), inline: true },
      { name: '📁 Przywrócone kanały', value: String(count('channel_restore')), inline: true },
      { name: '🎭 Przywrócone role', value: String(count('role_restore')), inline: true },
      { name: '🛡️ Ochrona logów', value: String(selfProtect), inline: true },
      { name: '🕵️ Podejrzenia multikont', value: String(multiacc), inline: true },
      { name: '🔥 Aktywacje Trybu Furii', value: String(count('fury_activate')), inline: true },
      { name: '⚖️ Kary z Trybu Furii', value: String(count('fury_punishment')), inline: true },
      { name: '🔒 Włączenia blokady', value: String(count('lockdown_on')), inline: true },
      { name: '💾 Utworzone backupy', value: String(count('backup_created')), inline: true },
      { name: '📈 Wszystkich wpisów', value: String(entries.length), inline: true }
    );

  const recent = entries.slice(-5).reverse();
  if (recent.length) {
    embed.addFields({
      name: 'Ostatnie zdarzenia',
      value: trim(recent.map((e) => `<t:${Math.floor(e.ts / 1000)}:R> ${e.summary}`).join('\n'), 1000),
    });
  }
  embed.setFooter({ text: 'Raport z pamięci bota - po restarcie historia zaczyna się od nowa, pełna historia jest w backupach.' });

  await log(guild, 'security', embed);
  return embed;
}

// Wysyła raport, jeśli od ostatniego minęło 7 dni. Wywoływane co godzinę z ready.js.
async function maybeSend(guild) {
  const cfg = await storage.getConfig(guild.id);
  if (Date.now() - (cfg.lastWeeklyReport || 0) < WEEK_MS) return false;
  await sendReport(guild);
  cfg.lastWeeklyReport = Date.now();
  await storage.saveConfig(guild.id, cfg);
  return true;
}

module.exports = { sendReport, maybeSend };
