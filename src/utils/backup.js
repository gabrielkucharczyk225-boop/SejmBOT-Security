const { ChannelType } = require('discord.js');
const storage = require('../storage');
const { log } = require('./logger');
const { baseEmbed } = require('./embeds');
const actionLog = require('./actionLog');

async function fetchAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString('base64');
  } catch {
    return null;
  }
}

// Robi pełny zrzut struktury serwera: role, kanały, uprawnienia, ustawienia, emoji, naklejki, role członków,
// a dodatkowo konfigurację bota i historię jego działań - cały backup to JEDEN samowystarczalny blok danych.
async function createBackup(guild, reason = 'manual') {
  await guild.fetch();
  const cfg = await storage.getConfig(guild.id);
  const ignorePrefixes = (cfg.ignorePrefixes || []).map((p) => p.toLowerCase());
  const isIgnoredChannel = (name) => ignorePrefixes.some((p) => (name || '').toLowerCase().startsWith(p));

  const roles = [];
  for (const role of guild.roles.cache.sort((a, b) => a.position - b.position).values()) {
    if (role.managed) continue; // role botów/integracji - nie da się ich ręcznie odtworzyć
    const iconURL = role.iconURL({ extension: 'png', size: 256 });
    roles.push({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
      isEveryone: role.id === guild.id,
      iconData: await fetchAsBase64(iconURL),
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
    if (isIgnoredChannel(ch.name)) continue;
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

  const emojis = [];
  for (const e of guild.emojis.cache.values()) {
    emojis.push({
      id: e.id,
      name: e.name,
      animated: e.animated,
      data: await fetchAsBase64(e.imageURL({ extension: e.animated ? 'gif' : 'png' })),
    });
  }
  const stickers = [];
  for (const s of guild.stickers.cache.values()) {
    stickers.push({ id: s.id, name: s.name, description: s.description, tags: s.tags, data: await fetchAsBase64(s.url) });
  }

  // Konfiguracja bota (jakie kanały logów/ochrony są ustawione) - czysto informacyjnie,
  // nie jest automatycznie przywracana przez /restore (to nie wpływa na strukturę serwera).
  const botConfig = {
    routes: cfg.routes,
    protectedChannels: cfg.protectedChannels,
    protectAllChannels: cfg.protectAllChannels,
    ignorePrefixes: cfg.ignorePrefixes,
    linkWhitelist: cfg.linkWhitelist,
    protectedBots: cfg.protectedBots,
    furyBlockedBots: cfg.furyBlockedBots,
  };

  // Historia działań bota na tym serwerze (ostatnie 14 dni) - co bot po drodze zrobił.
  const actionHistory = actionLog.getRecent(guild.id).map((e) => ({ ts: e.ts, type: e.type, summary: e.summary }));

  const snapshot = {
    guild: {
      name: guild.name,
      iconData: await fetchAsBase64(guild.iconURL({ extension: 'png', size: 512 })),
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
    botConfig,
    actionHistory,
  };

  const id = await storage.saveBackup(guild.id, snapshot, {
    reason,
    guildName: guild.name,
    counts: { roles: roles.length, channels: channels.length, members: members.length, emojis: emojis.length, stickers: stickers.length },
  });

  actionLog.record(guild.id, 'backup_created', `Utworzono backup (powód: ${reason}) - ${roles.length} ról, ${channels.length} kanałów, ${actionHistory.length} wpisów historii dołączonych.`);

  const embed = baseEmbed('backup', '💾 Utworzono backup serwera')
    .setDescription(`Powód: **${reason}**\nBaza danych: **${storage.modeFor(guild.id) === 'channel' ? 'kanał Discorda' : storage.modeFor(guild.id) === 'mongo' ? 'MongoDB' : 'pamięć (nietrwałe!)'}**`)
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
