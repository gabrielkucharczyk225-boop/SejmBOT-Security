const { ChannelType } = require('discord.js');
const storage = require('../storage');
const { log } = require('./logger');
const { baseEmbed } = require('./embeds');

async function fetchAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } catch {
    return null;
  }
}

// Robi pełny zrzut struktury serwera: role, kanały, uprawnienia, ustawienia, emoji, naklejki, role członków.
async function createBackup(guild, reason = 'manual') {
  await guild.fetch();
  const cfg = await storage.getConfig(guild.id);
  const ignorePrefixes = (cfg.ignorePrefixes || []).map((p) => p.toLowerCase());
  const isIgnoredChannel = (name) => ignorePrefixes.some((p) => (name || '').toLowerCase().startsWith(p));

  const roles = [];
  for (const role of guild.roles.cache.sort((a, b) => a.position - b.position).values()) {
    if (role.managed) continue; // role botów/integracji - nie da się ich ręcznie odtworzyć
    roles.push({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
      isEveryone: role.id === guild.id,
      iconURL: role.iconURL({ extension: 'png', size: 256 }),
      unicodeEmoji: role.unicodeEmoji,
    });
  }

  const channels = [];
  const sorted = [...guild.channels.cache.values()].sort((a, b) => {
    if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return -1;
    if (b.type === ChannelType.GuildCategory && a.type !== ChannelType.GuildCategory) return 1;
    return a.rawPosition - b.rawPosition;
  });
  for (const ch of sorted) {
    if (isIgnoredChannel(ch.name)) continue; // np. kanały "ticket-*" - nie wchodzą do backupu
    channels.push({
      id: ch.id,
      type: ch.type,
      name: ch.name,
      parentId: ch.parentId,
      position: ch.rawPosition,
      topic: ch.topic ?? null,
      nsfw: ch.nsfw ?? false,
      bitrate: ch.bitrate ?? null,
      userLimit: ch.userLimit ?? null,
      rateLimitPerUser: ch.rateLimitPerUser ?? null,
      overwrites: [...(ch.permissionOverwrites?.cache.values() || [])].map((o) => ({
        id: o.id,
        type: o.type,
        allow: o.allow.bitfield.toString(),
        deny: o.deny.bitfield.toString(),
      })),
    });
  }

  const members = [];
  for (const m of guild.members.cache.values()) {
    if (m.user.bot) continue;
    members.push({ userId: m.id, nick: m.nickname, roles: m.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id) });
  }

  const emojis = guild.emojis.cache.map((e) => ({ id: e.id, name: e.name, animated: e.animated, url: e.imageURL({ extension: e.animated ? 'gif' : 'png' }) }));
  const stickers = guild.stickers.cache.map((s) => ({ id: s.id, name: s.name, description: s.description, tags: s.tags, url: s.url }));

  const snapshot = {
    guild: {
      name: guild.name,
      iconURL: guild.iconURL({ extension: 'png', size: 512 }),
      bannerURL: guild.bannerURL({ extension: 'png', size: 512 }),
      description: guild.description,
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      explicitContentFilter: guild.explicitContentFilter,
      afkTimeout: guild.afkTimeout,
      afkChannelName: guild.afkChannel?.name || null,
    },
    roles,
    channels,
    members,
    emojis,
    stickers,
  };

  const id = await storage.saveBackup(guild.id, snapshot, {
    reason,
    guildName: guild.name,
    counts: { roles: roles.length, channels: channels.length, members: members.length, emojis: emojis.length, stickers: stickers.length },
  });

  // Zapisz assety (ikony/emoji/naklejki) osobno, dopiero po zapisaniu backupu - żeby nie tracić danych przy błędzie sieci.
  for (const r of roles) {
    if (r.iconURL) { const b = await fetchAsBase64(r.iconURL); if (b) await storage.putAsset(`${id}:role:${r.id}`, b); }
  }
  if (snapshot.guild.iconURL) { const b = await fetchAsBase64(snapshot.guild.iconURL); if (b) await storage.putAsset(`${id}:guildIcon`, b); }
  for (const e of emojis) {
    const b = await fetchAsBase64(e.url); if (b) await storage.putAsset(`${id}:emoji:${e.id}`, b);
  }
  for (const s of stickers) {
    const b = await fetchAsBase64(s.url); if (b) await storage.putAsset(`${id}:sticker:${s.id}`, b);
  }

  const embed = baseEmbed('backup', '💾 Utworzono backup serwera')
    .setDescription(`Powód: **${reason}**`)
    .addFields(
      { name: 'ID backupu', value: `\`${id.split(':')[1]}\``, inline: true },
      { name: 'Role', value: String(roles.length), inline: true },
      { name: 'Kanały', value: String(channels.length), inline: true },
      { name: 'Członkowie (zapisani)', value: String(members.length), inline: true },
      { name: 'Emoji', value: String(emojis.length), inline: true },
      { name: 'Naklejki', value: String(stickers.length), inline: true }
    );
  await log(guild, 'backup', embed);

  return id;
}

// ---------- Debounce - żeby nie robić backupu przy każdej pojedynczej zmianie z osobna ----------
const { BACKUP } = require('../config');
const timers = new Map();

function scheduleBackup(guild, reason, ms = BACKUP.DEBOUNCE_MS) {
  const key = guild.id;
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => createBackup(guild, reason).catch((e) => console.error('[backup] auto-backup failed:', e.message)), ms)
  );
}

module.exports = { createBackup, scheduleBackup, fetchAsBase64 };
