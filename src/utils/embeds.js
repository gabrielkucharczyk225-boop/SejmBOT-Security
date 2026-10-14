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

// Standardowy embed logu w stylu Discordowych logów serwera:
// nagłówek "Logi serwera • <kategoria>", tytuł z emoji, stopka z nazwą bota i znacznikiem czasu.
function baseEmbed(category, title) {
  return new EmbedBuilder()
    .setColor(COLORS[category] || 0x2f3136)
    .setAuthor({ name: `Logi serwera • ${CATEGORY_LABELS[category] || 'Inne'}` })
    .setTitle(title)
    .setFooter({ text: BOT_NAME })
    .setTimestamp();
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

// Stopka z identyfikatorami - tak jak w logach Discorda (ID użytkownika, wiadomości, kanału).
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

module.exports = { baseEmbed, trim, who, where, when, withIds, COLORS, CATEGORY_LABELS };
