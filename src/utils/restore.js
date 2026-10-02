const { ChannelType, AttachmentBuilder } = require('discord.js');
const storage = require('../storage');
const { BACKUP } = require('../config');
const { log } = require('./logger');
const { baseEmbed } = require('./embeds');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function restoreSingleChannel(guild, data) {
  const overwrites = [...(data.permissionOverwrites?.cache.values() || [])].map((o) => ({
    id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield,
  }));
  const options = {
    name: data.name, type: data.type, topic: data.topic ?? undefined, nsfw: data.nsfw ?? undefined,
    bitrate: data.bitrate ?? undefined, userLimit: data.userLimit ?? undefined,
    rateLimitPerUser: data.rateLimitPerUser ?? undefined,
    parent: data.parentId && guild.channels.cache.has(data.parentId) ? data.parentId : undefined,
    permissionOverwrites: overwrites, reason: 'Auto-przywrócenie usuniętego kanału (ochrona SejmBOT Security)',
  };
  const created = await guild.channels.create(options);
  try { await created.setPosition(data.rawPosition ?? 0); } catch { /* nieistotne */ }
  return created;
}

async function restoreSingleRole(guild, role) {
  const created = await guild.roles.create({
    name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable,
    permissions: role.permissions.bitfield, reason: 'Auto-przywrócenie usuniętej roli (ochrona SejmBOT Security)',
  });
  try {
    const backups = await storage.listBackups(guild.id);
    if (backups[0]) {
      const snap = await storage.loadBackup(backups[0].id);
      const owners = snap.members.filter((m) => snap.roles.some((r) => r.id === role.id && m.roles.includes(role.id)));
      for (const m of owners) {
        const member = await guild.members.fetch(m.userId).catch(() => null);
        if (member) await member.roles.add(created).catch(() => {});
      }
    }
  } catch { /* best effort */ }
  return created;
}

async function restoreServer(guild, backupId, onProgress = () => {}) {
  const snapshot = await storage.loadBackup(backupId);
  if (!snapshot) throw new Error('Nie znaleziono backupu o podanym ID.');

  const roleIdMap = new Map();
  const channelIdMap = new Map();
  const errors = [];

  const rolesToCreate = snapshot.roles.filter((r) => !r.isEveryone).sort((a, b) => a.position - b.position);
  const everyoneData = snapshot.roles.find((r) => r.isEveryone);
  if (everyoneData) {
    try {
      await guild.roles.everyone.setPermissions(BigInt(everyoneData.permissions), 'Przywracanie serwera - uprawnienia @everyone');
    } catch (e) { errors.push(`@everyone: ${e.message}`); }
  }

  onProgress(`Odtwarzam ${rolesToCreate.length} ról...`);
  for (const r of rolesToCreate) {
    await sleep(BACKUP.CREATE_DELAY_MS);
    try {
      let role = guild.roles.cache.find((x) => x.name === r.name && !x.managed);
      if (!role) {
        role = await guild.roles.create({
          name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
          permissions: BigInt(r.permissions), reason: 'Przywracanie serwera z backupu',
        });
      }
      const iconBuf = await storage.getAsset(`${backupId}:role:${r.id}`);
      if (iconBuf) await role.setIcon(iconBuf).catch(() => {});
      else if (r.unicodeEmoji) await role.setUnicodeEmoji(r.unicodeEmoji).catch(() => {});
      roleIdMap.set(r.id, role.id);
    } catch (e) { errors.push(`Rola "${r.name}": ${e.message}`); }
  }
  try {
    const positions = rolesToCreate.map((r) => roleIdMap.get(r.id)).filter(Boolean).map((id, i) => ({ role: id, position: i + 1 }));
    if (positions.length) await guild.roles.setPositions(positions);
  } catch (e) { errors.push(`Kolejność ról: ${e.message}`); }

  const mapOverwrites = (overwrites) =>
    overwrites.map((o) => {
      const id = o.type === 0 ? roleIdMap.get(o.id) || (o.id === snapshot.guild.everyoneId ? guild.id : null) : o.id;
      if (!id) return null;
      return { id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) };
    }).filter(Boolean);

  const categories = snapshot.channels.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const others = snapshot.channels.filter((c) => c.type !== ChannelType.GuildCategory).sort((a, b) => a.position - b.position);

  onProgress(`Odtwarzam ${categories.length} kategorii...`);
  for (const c of categories) {
    await sleep(BACKUP.CREATE_DELAY_MS);
    try {
      let ch = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === c.name);
      if (!ch) {
        ch = await guild.channels.create({
          name: c.name, type: ChannelType.GuildCategory, permissionOverwrites: mapOverwrites(c.overwrites),
          reason: 'Przywracanie serwera z backupu',
        });
      }
      channelIdMap.set(c.id, ch.id);
    } catch (e) { errors.push(`Kategoria "${c.name}": ${e.message}`); }
  }

  onProgress(`Odtwarzam ${others.length} kanałów...`);
  for (const c of others) {
    await sleep(BACKUP.CREATE_DELAY_MS);
    try {
      let ch = guild.channels.cache.find((x) => x.name === c.name && x.type === c.type);
      if (!ch) {
        ch = await guild.channels.create({
          name: c.name, type: c.type, topic: c.topic ?? undefined, nsfw: c.nsfw ?? undefined,
          bitrate: c.bitrate ?? undefined, userLimit: c.userLimit ?? undefined,
          rateLimitPerUser: c.rateLimitPerUser ?? undefined, parent: channelIdMap.get(c.parentId) || undefined,
          permissionOverwrites: mapOverwrites(c.overwrites), reason: 'Przywracanie serwera z backupu',
        });
      }
      channelIdMap.set(c.id, ch.id);
    } catch (e) { errors.push(`Kanał "${c.name}": ${e.message}`); }
  }

  onProgress('Przywracam ustawienia serwera...');
  try {
    const patch = { name: snapshot.guild.name };
    if (snapshot.guild.description) patch.description = snapshot.guild.description;
    await guild.edit(patch);
    const iconBuf = await storage.getAsset(`${backupId}:guildIcon`);
    if (iconBuf) await guild.setIcon(iconBuf).catch(() => {});
  } catch (e) { errors.push(`Ustawienia serwera: ${e.message}`); }

  onProgress(`Odtwarzam ${snapshot.emojis.length} emoji...`);
  for (const e of snapshot.emojis) {
    await sleep(BACKUP.CREATE_DELAY_MS);
    if (guild.emojis.cache.some((x) => x.name === e.name)) continue;
    const buf = await storage.getAsset(`${backupId}:emoji:${e.id}`);
    if (!buf) continue;
    try { await guild.emojis.create({ attachment: buf, name: e.name }); } catch (err) { errors.push(`Emoji "${e.name}": ${err.message}`); }
  }

  onProgress(`Odtwarzam ${snapshot.stickers.length} naklejek...`);
  for (const s of snapshot.stickers) {
    await sleep(BACKUP.CREATE_DELAY_MS);
    if (guild.stickers.cache.some((x) => x.name === s.name)) continue;
    const buf = await storage.getAsset(`${backupId}:sticker:${s.id}`);
    if (!buf) continue;
    try {
      const file = new AttachmentBuilder(buf, { name: `${s.name}.png` });
      await guild.stickers.create({ file, name: s.name, description: s.description || s.name, tags: s.tags || s.name });
    } catch (err) { errors.push(`Naklejka "${s.name}": ${err.message}`); }
  }

  onProgress(`Przywracam role ${snapshot.members.length} członków...`);
  for (const m of snapshot.members) {
    const member = await guild.members.fetch(m.userId).catch(() => null);
    if (!member) continue;
    await sleep(80);
    try {
      const roleIds = m.roles.map((id) => roleIdMap.get(id)).filter(Boolean);
      if (roleIds.length) await member.roles.add(roleIds).catch(() => {});
      if (m.nick) await member.setNickname(m.nick).catch(() => {});
    } catch (e) { errors.push(`Członek ${m.userId}: ${e.message}`); }
  }

  return { errors, roleIdMap, channelIdMap };
}

module.exports = { restoreSingleChannel, restoreSingleRole, restoreServer };
