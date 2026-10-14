const { EmbedBuilder } = require('discord.js');

const BOT_NAME = 'SejmBOT Security';

const COLORS = {
  messages: 0xe67e22,
  members: 0x3498db,
  moderation: 0xe74c3c,
  roles: 0x9b59b6,
  channels: 0x1abc9c,
  voice: 0x2ecc71,
  server: 0x95a5a6,
  audit: 0x34495e,
  security: 0x992d22,
  backup: 0xf1c40f,
};

const CATEGORY_LABELS = {
  messages: 'Wiadomości',
  members: 'Członkowie',
  moderation: 'Moderacja',
  roles: 'Role',
  channels: 'Kanały',
  voice: 'Kanały głosowe',
  server: 'Serwer',
  audit: 'Audit Log',
  security: 'Ochrona',
  backup: 'Kopie zapasowe',
};

// Standardowy nagłówek logu: "Logi serwera • <kategoria>", tytuł, kolor, stopka i czas.
function baseEmbed(category, title) {
  return new EmbedBuilder()
    .setColor(COLORS[category] || 0x2f3136)
    .setAuthor({ name: `Logi serwera • ${CATEGORY_LABELS[category] || 'Inne'}` })
    .setTitle(title)
    .setFooter({ text: BOT_NAME })
    .setTimestamp();
}

// Log w układzie z logów Discorda:
// opis, miniaturka po prawej, pola "Wykonał(a)", "Dotyczy", "Kanał", dodatkowe pola,
// "Kiedy" z datą i czasem względnym, a na dole identyfikatory.
// opts: { category, title, description, actor, target, channel, thumb, fields, ids }
//  - actor/target/channel: gotowe napisy (np. who(user), where(channel), executorTag(entry))
//  - fields: [{ name, value, inline }] - dodatkowe pola po "Kanał"
//  - ids: { user, message, channel, role, target } - trafiają do stopki
function logEmbed(opts) {
  const embed = baseEmbed(opts.category, opts.title);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.thumb) embed.setThumbnail(opts.thumb);

  const fields = [];
  if (opts.actor !== undefined) fields.push({ name: '👮 Wykonał(a)', value: String(opts.actor), inline: true });
  if (opts.target !== undefined) fields.push({ name: '🎯 Dotyczy', value: String(opts.target), inline: true });
  if (opts.channel !== undefined) fields.push({ name: '📁 Kanał', value: String(opts.channel), inline: true });
  for (const f of opts.fields || []) fields.push({ inline: false, ...f });

  const now = Math.floor(Date.now() / 1000);
  fields.push({ name: '🕒 Kiedy', value: `<t:${now}:F> (<t:${now}:R>)`, inline: false });

  embed.addFields(fields);
  if (opts.ids) withIds(embed, opts.ids);
  return embed;
}

// Skraca długi tekst tak, żeby zmieścił się w polu embeda (limit Discorda: 1024 znaki).
function trim(text, max = 1000) {
  if (!text) return '*(puste)*';
  const s = String(text);
  return s.length > max ? s.slice(0, max) + '… *(ucięto)*' : s;
}

// Użytkownik: wzmianka + ID w jednej linii.
function who(user) {
  if (!user) return '*(nieznany)*';
  return `${user} (\`${user.id}\`)`;
}

// Kanał: wzmianka + ID w jednej linii.
function where(channel) {
  if (!channel) return '*(nieznany)*';
  return `${channel} (\`${channel.id}\`)`;
}

// Czas w formacie Discorda: pełna data + "x minut temu".
function when(ts) {
  const s = Math.floor(ts / 1000);
  return `<t:${s}:F> (<t:${s}:R>)`;
}

// Stopka z identyfikatorami - tak jak w logach Discorda.
function withIds(embed, ids = {}) {
  const parts = [];
  if (ids.user) parts.push(`ID użytkownika: ${ids.user}`);
  if (ids.message) parts.push(`ID wiadomości: ${ids.message}`);
  if (ids.channel) parts.push(`ID kanału: ${ids.channel}`);
  if (ids.role) parts.push(`ID roli: ${ids.role}`);
  if (ids.target) parts.push(`ID celu: ${ids.target}`);
  parts.push(BOT_NAME);
  return embed.setFooter({ text: parts.join(' • ') });
}

module.exports = { baseEmbed, logEmbed, trim, who, where, when, withIds, COLORS, CATEGORY_LABELS };
