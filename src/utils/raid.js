const { EmbedBuilder } = require('discord.js');
const { RAID_JOIN_LIMIT, RAID_WINDOW_MS, RAID_ALERT_COOLDOWN_MS } = require('../config');
const { log } = require('./logger');

const joinTimestamps = new Map(); // guildId -> [timestamps]
const lastAlert = new Map();

async function registerJoin(guild) {
  const now = Date.now();
  const arr = (joinTimestamps.get(guild.id) || []).filter((t) => now - t < RAID_WINDOW_MS);
  arr.push(now);
  joinTimestamps.set(guild.id, arr);

  const last = lastAlert.get(guild.id) || 0;
  if (arr.length >= RAID_JOIN_LIMIT && now - last > RAID_ALERT_COOLDOWN_MS) {
    lastAlert.set(guild.id, now);
    const embed = new EmbedBuilder()
      .setTitle('🚨 TRYB ALARMOWY')
      .setColor(0x992d22)
      .setDescription(`Wykryto rajd! **${arr.length}** dołączeń w ciągu ${Math.round(RAID_WINDOW_MS / 1000)}s.`)
      .setTimestamp();
    await log(guild, 'security', embed);
  }
}

function getRecentJoinCount(guildId) {
  const now = Date.now();
  const arr = (joinTimestamps.get(guildId) || []).filter((t) => now - t < RAID_WINDOW_MS);
  return arr.length;
}

module.exports = { registerJoin, getRecentJoinCount };
