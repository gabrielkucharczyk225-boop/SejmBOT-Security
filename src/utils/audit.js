const { AuditLogEvent } = require('discord.js');

async function findExecutor(guild, type, filterFn, maxAgeMs = 15_000) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const now = Date.now();
    for (const entry of logs.entries.values()) {
      if (now - entry.createdTimestamp > maxAgeMs) continue;
      if (!filterFn || filterFn(entry)) return entry;
    }
  } catch (err) {
    console.error('[audit] fetchAuditLogs failed:', err.message);
  }
  return null;
}

function executorTag(entry) {
  return entry?.executor ? `${entry.executor.tag} (\`${entry.executor.id}\`)` : 'Nieznany (brak w audit logu)';
}

module.exports = { findExecutor, executorTag, AuditLogEvent };
