// Pozwala odróżnić "bot sam usunął swoją starą wiadomość" (normalna podmiana configu/backupu)
// od "ktoś INNY usunął wiadomość bota" (próba sabotażu - wymaga alarmu).
// Przed każdym zaplanowanym własnym usunięciem wołamy markExpected(id); event messageDelete
// sprawdza consumeExpected(id) - jeśli true, to było zaplanowane i nic się nie dzieje.
const expected = new Map(); // messageId -> timestamp
const TTL_MS = 5 * 60 * 1000;

function markExpected(messageId) {
  expected.set(messageId, Date.now());
}
function consumeExpected(messageId) {
  if (expected.has(messageId)) {
    expected.delete(messageId);
    return true;
  }
  return false;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of expected) {
    if (now - ts > TTL_MS) expected.delete(id);
  }
}, 60_000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = { markExpected, consumeExpected };
