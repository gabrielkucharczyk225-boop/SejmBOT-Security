const { EmbedBuilder } = require('discord.js');

const COLORS = {
  messages: 0xe67e22, members: 0x3498db, moderation: 0xe74c3c, roles: 0x9b59b6,
  channels: 0x1abc9c, voice: 0x2ecc71, server: 0x95a5a6, audit: 0x34495e,
  security: 0x992d22, backup: 0xf1c40f,
};

function baseEmbed(category, title) {
  return new EmbedBuilder().setColor(COLORS[category] || 0x2f3136).setTitle(title).setTimestamp();
}

function trim(text, max = 1000) {
  if (!text) return '*(puste)*';
  const s = String(text);
  return s.length > max ? s.slice(0, max) + '… *(ucięto)*' : s;
}

module.exports = { baseEmbed, trim, COLORS };
