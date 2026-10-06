module.exports = {
  // --- Anti-raid ---
  RAID_JOIN_LIMIT: 5,
  RAID_WINDOW_MS: 10_000,
  RAID_ALERT_COOLDOWN_MS: 60_000,
  FORBIDDEN_NAMES: ['raider', 'bot_', 'spam'],
  LINK_REGEX: /(https?:\/\/\S+)|(discord\.gg\/\S+)/i,
  NEW_ACCOUNT_DAYS: 3,

  // --- Backupy ---
  BACKUP: {
    DEBOUNCE_MS: 30_000,              // backup struktury 30s po ostatniej zmianie
    MEMBER_DEBOUNCE_MS: 5 * 60_000,   // backup ról/nicków członków - 5 min
    INTERVAL_MS: 60 * 60 * 1000,      // planowy backup co 1h
    KEEP: 15,                         // ile wersji backupu trzymać
    CREATE_DELAY_MS: 400,             // odstęp między requestami przy odtwarzaniu (rate limit)
  },

  CATEGORIES: [
    { id: 'messages',   emoji: '💬', label: 'Wiadomości',     desc: 'Usunięte/edytowane wiadomości, masowe usuwanie' },
    { id: 'members',    emoji: '👤', label: 'Członkowie',     desc: 'Dołączenia, wyjścia, zmiany nicków i ról' },
    { id: 'moderation', emoji: '🔨', label: 'Moderacja',      desc: 'Bany, kicki, timeouty' },
    { id: 'roles',      emoji: '🎭', label: 'Role',           desc: 'Tworzenie, usuwanie, edycja ról i uprawnień' },
    { id: 'channels',   emoji: '📁', label: 'Kanały i wątki', desc: 'Kanały, kategorie, wątki, uprawnienia' },
    { id: 'voice',      emoji: '🔊', label: 'Głos',           desc: 'Wejścia/wyjścia/przenosiny na kanałach głosowych' },
    { id: 'server',     emoji: '⚙️', label: 'Serwer',         desc: 'Ustawienia, emoji, naklejki, zaproszenia, webhooki' },
    { id: 'audit',      emoji: '📜', label: 'Audit Log',      desc: 'Surowy, bardzo szczegółowy log każdej akcji z audit logu' },
    { id: 'security',   emoji: '🛡️', label: 'Ochrona',        desc: 'Raidy, blokada linków, próby usunięcia kanałów logów' },
    { id: 'backup',     emoji: '💾', label: 'Backupy',        desc: 'Tworzenie backupów i przywracanie serwera' },
  ],
};
