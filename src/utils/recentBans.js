// Krótka pamięć niedawno zbanowanych użytkowników (nazwa + hash avatara).
// Używana do wykrywania, czy nowo dołączająca osoba to prawdopodobnie ten sam
// użytkownik wracający na nowym koncie (multikonto).
const recent = []; // { userId, username, avatarHash, ts }
const MAX_ENTRIES = 50;
const MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 dni

function recordBan(user) {
  recent.unshift({ userId: user.id, username: user.username, avatarHash: user.avatar, ts: Date.now() });
  if (recent.length > MAX_ENTRIES) recent.length = MAX_ENTRIES;
}

// Zwraca { username, by: 'avatar'|'username' } dla najlepszego dopasowania, albo null.
// Dopasowanie po avatarze jest silniejszym sygnałem niż samo po nazwie (nazwy mogą się pokrywać przypadkiem).
function findMatch(user) {
  const now = Date.now();
  let usernameMatch = null;
  for (const r of recent) {
    if (now - r.ts > MATCH_WINDOW_MS) continue;
    if (r.userId === user.id) continue;
    if (r.avatarHash && user.avatar && r.avatarHash === user.avatar) {
      return { username: r.username, by: 'avatar' };
    }
    if (!usernameMatch && r.username && r.username === user.username) {
      usernameMatch = { username: r.username, by: 'username' };
    }
  }
  return usernameMatch;
}

module.exports = { recordBan, findMatch };
