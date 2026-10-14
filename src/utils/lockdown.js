// BLOKADA SERWERA - wyłącza pisanie, wątki, reakcje i wejście na głosowe dla @everyone.
// Zapamiętuje dokładne uprawnienia sprzed blokady i przy odblokowaniu przywraca je co do bitu.
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../storage');
const actionLog = require('./actionLog');
const { log } = require('./logger');
const { baseEmbed, who } = require('./embeds');
const { notifyOwner } = require('./ownerNotify');

const LOCK_MASK = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.Connect,
].reduce((acc, flag) => acc | flag, 0n);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const THREAD_TYPES = [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread];

function overwritesToArray(channel, skipId) {
  return [...channel.permissionOverwrites.cache.values()]
    .filter((o) => o.id !== skipId)
    .map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));
}

function isLocked(cfg) {
  return !!cfg.lockdown?.active;
}

async function enable(guild, by) {
  const cfg = await storage.getConfig(guild.id);
  if (cfg.lockdown?.active) return { ok: false, message: 'Blokada jest już aktywna.' };

  const everyone = guild.roles.everyone;
  const previousRolePerms = everyone.permissions.bitfield;
  const channelSnapshot = {};
  let errors = 0;

  try {
    await everyone.setPermissions(previousRolePerms & ~LOCK_MASK, `Blokada serwera - ${by.tag}`);
  } catch {
    errors++;
  }

  let affected = 0;
  for (const channel of guild.channels.cache.values()) {
    if (THREAD_TYPES.includes(channel.type) || !channel.permissionOverwrites) continue;
    const current = channel.permissionOverwrites.cache.get(guild.id);
    channelSnapshot[channel.id] = current
      ? { allow: current.allow.bitfield.toString(), deny: current.deny.bitfield.toString() }
      : null;

    const allow = current ? current.allow.bitfield : 0n;
    const deny = current ? current.deny.bitfield : 0n;
    const next = overwritesToArray(channel, guild.id);
    next.push({ id: guild.id, type: 0, allow: allow & ~LOCK_MASK, deny: deny | LOCK_MASK });

    try {
      await channel.permissionOverwrites.set(next, `Blokada serwera - ${by.tag}`);
      affected++;
      await sleep(250);
    } catch {
      errors++;
    }
  }

  cfg.lockdown = {
    active: true,
    startedAt: Date.now(),
    by: by.tag,
    byId: by.id,
    rolePermissions: previousRolePerms.toString(),
    channels: channelSnapshot,
  };
  await storage.saveConfig(guild.id, cfg);

  actionLog.record(guild.id, 'lockdown_on', `Włączono blokadę serwera przez ${by.tag}. Zmieniono ${affected} kanałów, błędów: ${errors}.`);

  const embed = baseEmbed('security', '🔒 BLOKADA SERWERA WŁĄCZONA')
    .setDescription(`Blokada włączona przez ${who(by)}. Nikt bez dodatkowych ról nie może pisać, tworzyć wątków, dodawać reakcji ani wchodzić na kanały głosowe.`)
    .addFields(
      { name: 'Zmienione kanały', value: String(affected), inline: true },
      { name: 'Błędy', value: String(errors), inline: true },
      { name: 'Odblokowanie', value: '`/blokada wylacz` - przywraca zapamiętane uprawnienia co do bitu.' }
    );
  await log(guild, 'security', embed);
  await notifyOwner(guild, embed);

  return { ok: true, affected, errors };
}

async function disable(guild, by) {
  const cfg = await storage.getConfig(guild.id);
  const state = cfg.lockdown;
  if (!state?.active) return { ok: false, message: 'Blokada nie jest aktywna.' };

  let restored = 0;
  let errors = 0;

  for (const [channelId, snap] of Object.entries(state.channels || {})) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.permissionOverwrites) continue;
    const next = overwritesToArray(channel, guild.id);
    if (snap) next.push({ id: guild.id, type: 0, allow: BigInt(snap.allow), deny: BigInt(snap.deny) });
    try {
      await channel.permissionOverwrites.set(next, `Odblokowanie serwera - ${by.tag}`);
      restored++;
      await sleep(250);
    } catch {
      errors++;
    }
  }

  try {
    await guild.roles.everyone.setPermissions(BigInt(state.rolePermissions), `Odblokowanie serwera - ${by.tag}`);
  } catch {
    errors++;
  }

  cfg.lockdown = { active: false, endedAt: Date.now(), by: by.tag, byId: by.id };
  await storage.saveConfig(guild.id, cfg);

  actionLog.record(guild.id, 'lockdown_off', `Wyłączono blokadę serwera przez ${by.tag}. Przywrócono ${restored} kanałów, błędów: ${errors}.`);

  const embed = baseEmbed('security', '🔓 Blokada serwera wyłączona')
    .setDescription(`Odblokowano przez ${who(by)}. Zapamiętane uprawnienia zostały przywrócone.`)
    .addFields(
      { name: 'Przywrócone kanały', value: String(restored), inline: true },
      { name: 'Błędy', value: String(errors), inline: true }
    );
  await log(guild, 'security', embed);
  await notifyOwner(guild, embed);

  return { ok: true, restored, errors };
}

module.exports = { enable, disable, isLocked, LOCK_MASK };
