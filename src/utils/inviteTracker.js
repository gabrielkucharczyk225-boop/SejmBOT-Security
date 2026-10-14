// Śledzenie zaproszeń: pamięta stan zaproszeń serwera (liczba użyć, autor)
// i przy dołączeniu porównuje go z aktualnym - to, którego licznik wzrósł, to użyte zaproszenie.
const cache = new Map(); // guildId -> Map<code, snapshot>

function snapshotInvite(inv) {
  return {
    uses: inv.uses ?? 0,
    maxUses: inv.maxUses ?? 0,
    inviterId: inv.inviter?.id ?? null,
    inviterTag: inv.inviter?.tag ?? 'nieznany',
    channelId: inv.channelId ?? null,
  };
}

function primeFromCollection(guildId, invites) {
  const map = new Map();
  for (const inv of invites.values()) map.set(inv.code, snapshotInvite(inv));
  cache.set(guildId, map);
}

async function primeGuild(guild) {
  try {
    primeFromCollection(guild.id, await guild.invites.fetch());
  } catch (err) {
    console.error(`[invites] nie udało się pobrać zaproszeń (${guild.name}):`, err.message);
  }
}

function onInviteCreate(invite) {
  if (!invite.guild) return;
  const map = cache.get(invite.guild.id) || new Map();
  map.set(invite.code, snapshotInvite(invite));
  cache.set(invite.guild.id, map);
}

function onInviteDelete(invite) {
  if (!invite.guild) return;
  cache.get(invite.guild.id)?.delete(invite.code);
}

// Zwraca { code, inviterTag, inviterId, channelId, uses } albo null.
async function detectUsedInvite(guild) {
  const before = cache.get(guild.id) || new Map();
  let fresh;
  try {
    fresh = await guild.invites.fetch();
  } catch {
    return null;
  }

  let used = null;
  for (const inv of fresh.values()) {
    const prev = before.get(inv.code);
    if (prev && (inv.uses ?? 0) > prev.uses) {
      used = { code: inv.code, ...snapshotInvite(inv) };
      break;
    }
  }

  // Zaproszenie jednorazowe/limitowane znika z listy po wyczerpaniu - szukamy go wśród poprzednich.
  if (!used) {
    for (const [code, prev] of before) {
      if (!fresh.has(code) && prev.maxUses > 0 && prev.uses + 1 >= prev.maxUses) {
        used = { code, ...prev };
        break;
      }
    }
  }

  primeFromCollection(guild.id, fresh);
  return used;
}

module.exports = { primeGuild, onInviteCreate, onInviteDelete, detectUsedInvite };
