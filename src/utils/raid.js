const { EmbedBuilder } = require('discord.js');
const { RAID_JOIN_LIMIT, RAID_WINDOW_MS, RAID_ALERT_COOLDOWN_MS } = require('../config');
const { sendWebhook } = require('./webhook');

let joinTimestamps = [];
let lastAlert = 0;

async function registerJoin() {
  const now = Date.now();
  joinTimestamps.push(now);
  joinTimestamps = joinTimestamps.filter((t) => now - t < RAID_WINDOW_MS);

  if (joinTimestamps.length >= RAID_JOIN_LIMIT && now - lastAlert > RAID_ALERT_COOLDOWN_MS) {
    lastAlert = now;
    const embed = new EmbedBuilder()
      .setTitle('🚨 TRYB ALARMOWY')
      .setColor(0x992d22)
      .setDescription('Wykryto rajd! Zbyt wiele dołączeń w krótkim czasie.');
    await sendWebhook(embed);
  }
}

module.exports = { registerJoin };
