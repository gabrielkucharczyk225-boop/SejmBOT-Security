module.exports = {
  RAID_JOIN_LIMIT: 5,               // ile wejść...
  RAID_WINDOW_MS: 10_000,           // ...w tylu ms uruchamia alarm
  RAID_ALERT_COOLDOWN_MS: 60_000,
  FORBIDDEN_NAMES: ['raider', 'bot_', 'spam'],
  LINK_REGEX: /(https?:\/\/\S+)|(discord\.gg\/\S+)/i,
  NEW_ACCOUNT_DAYS: 3,              // konta młodsze = czerwony embed
};
