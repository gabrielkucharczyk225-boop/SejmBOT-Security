const { PUNISHMENT_ROLE_ID } = require('../config');

// Jedyna rola pingowana we wszystkich alertach bota (zamiast @everyone).
const ROLE_PING = {
  content: `<@&${PUNISHMENT_ROLE_ID}>`,
  allowedMentions: { roles: [PUNISHMENT_ROLE_ID] },
};

module.exports = { ROLE_PING };
