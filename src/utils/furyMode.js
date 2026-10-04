// TRYB FURII - automatyczna reakcja na wzorce przypominające rajd.
// Aktywuje się sam po 3x próbie usunięcia chronionego kanału (ten sam sprawca, 10 min okno)
// albo po 3x próbie wysłania linku-zaproszenia (ten sam sprawca, 5 min okno).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../storage');
const { log } = require('./logger');
const { baseEmbed } = require('./embeds');

const FURY_DURATION_MS = 10 * 60 * 1000;
const CHANNEL_WINDOW_MS = 10 * 60 * 1000;
const LINK_WINDOW_MS = 5 * 60 * 1000;
const CHANNEL_DELETE_THRESHOLD = 3;
const LINK_SPAM_THRESHOLD = 3;

const channelDeleteAttempts = new Map(); // guildId -> Map<userId, timestamps[]>
const linkSpamAttempts = new Map();      // guildId -> Map<userId, timestamps[]>
const activeFury = new Map();            // guildId -> { expiresAt, timer, blockedBotsOldRoles, prevProtectAll }

function isActive(guildId) {
  return activeFury.has(guildId);
}

function registerAttempt(map, guildId, userId, windowMs) {
  if (!map.has(guildId)) map.set(guildId, new Map());
  const guildMap = map.get(guildId);
  const now = Date.now();
  const arr = (guildMap.get(userId) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  guildMap.set(userId, arr);
  return arr.length;
}

async function registerChannelDeleteAttempt(guild, userId, details = {}) {
  if (!userId || isActive(guild.id)) return;
  const count = registerAttempt(channelDeleteAttempts, guild.id, userId, CHANNEL_WINDOW_MS);
  if (count >= CHANNEL_DELETE_THRESHOLD) {
    await activate(guild, { type: 'channelDeleteSpam', userId, count, details });
  }
}

async function registerLinkSpamAttempt(guild, userId, details = {}) {
  if (!userId || isActive(guild.id)) return;
  const count = registerAttempt(linkSpamAttempts, guild.id, userId, LINK_WINDOW_MS);
  if (count >= LINK_SPAM_THRESHOLD) {
    await activate(guild, { type: 'inviteLinkSpam', userId, count, details });
  }
}

async function activate(guild, trigger) {
  const cfg = await storage.getConfig(guild.id);
  const expiresAt = Date.now() + FURY_DURATION_MS;

  const prevProtectAll = cfg.protectAllChannels;
  cfg.protectAllChannels = true;
  await storage.saveConfig(guild.id, cfg);

  const blockedBotsOldRoles = new Map();
  for (const botId of cfg.furyBlockedBots || []) {
    try {
      const member = await guild.members.fetch(botId).catch(() => null);
      if (!member) continue;
      const roleIds = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
      if (roleIds.length) {
        blockedBotsOldRoles.set(botId, roleIds);
        await member.roles.remove(roleIds, 'Tryb Furii SejmBOT Security - tymczasowe zablokowanie bota').catch(() => {});
      }
    } catch {
      /* best effort */
    }
  }

  const timer = setTimeout(() => deactivate(guild, 'upłynął czas (10 minut)').catch(() => {}), FURY_DURATION_MS);
  if (timer.unref) timer.unref();

  activeFury.set(guild.id, { expiresAt, timer, blockedBotsOldRoles, prevProtectAll });

  await sendFuryAlert(guild, trigger);
}

async function deactivate(guild, reason = 'ręcznie wyłączony') {
  const state = activeFury.get(guild.id);
  if (!state) return;
  clearTimeout(state.timer);

  const cfg = await storage.getConfig(guild.id);
  cfg.protectAllChannels = state.prevProtectAll;
  await storage.saveConfig(guild.id, cfg);

  for (const [botId, roleIds] of state.blockedBotsOldRoles) {
    try {
      const member = await guild.members.fetch(botId).catch(() => null);
      if (member) await member.roles.add(roleIds, 'Koniec trybu furii - przywrócono role bota').catch(() => {});
    } catch {
      /* best effort */
    }
  }

  activeFury.delete(guild.id);

  await log(
    guild,
    'security',
    baseEmbed('security', '🕊️ Tryb furii wyłączony').setDescription(
      `Powód: ${reason}. Poziom ochrony i zablokowane boty wróciły do normy.`
    )
  );
}

function pickPunishment(triggerType) {
  if (triggerType === 'channelDeleteSpam') return 'ban';
  if (triggerType === 'inviteLinkSpam') return 'kick';
  return 'kick';
}

async function sendFuryAlert(guild, trigger) {
  const member = await guild.members.fetch(trigger.userId).catch(() => null);
  const title =
    trigger.type === 'channelDeleteSpam'
      ? '🔥 TRYB FURII: Wielokrotne usuwanie chronionych kanałów!'
      : '🔥 TRYB FURII: Spam linkami-zaproszeniami!';

  const embed = baseEmbed('security', title)
    .setDescription(
      'Wykryto wzorzec zachowania przypominający rajd. **Tryb furii aktywny przez 10 minut** - ochrona wszystkich kanałów włączona na maksimum, powiązane boty (jeśli skonfigurowane) tymczasowo zablokowane.'
    )
    .addFields(
      { name: 'Podejrzany', value: member ? `${member} (\`${member.id}\`)` : `\`${trigger.userId}\` (poza serwerem?)`, inline: true },
      { name: 'Liczba prób', value: String(trigger.count), inline: true },
      { name: 'Typ zdarzenia', value: trigger.type === 'channelDeleteSpam' ? 'Wielokrotne usuwanie kanałów' : 'Spam linkami-zaproszeniami', inline: true }
    );

  if (trigger.details?.channels?.length) {
    embed.addFields({ name: 'Usunięte kanały', value: trigger.details.channels.map((c) => `#${c}`).join(', ') });
  }
  if (trigger.details?.exampleLink) {
    embed.addFields({ name: 'Przykładowy link', value: trigger.details.exampleLink });
  }
  if (member) {
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    embed.addFields(
      { name: 'Konto założone', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (${ageDays} dni temu)`, inline: true },
      { name: 'Dołączył na serwer', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'nieznane', inline: true },
      { name: 'Role', value: member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name).join(', ') || '*(brak)*' }
    );
  }

  const suggestedPunishment = pickPunishment(trigger.type);
  embed.addFields({ name: 'Sugerowana kara', value: suggestedPunishment === 'ban' ? '🔨 Ban' : '👢 Kick + zdjęcie ról', inline: true });
  embed.setFooter({ text: 'Czy mam podjąć odpowiednie działania?' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`fury:punish:yes:${trigger.userId}:${suggestedPunishment}`).setLabel('Tak, działaj').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`fury:punish:no:${trigger.userId}`).setLabel('Nie').setStyle(ButtonStyle.Secondary)
  );

  await log(guild, 'security', embed, {
    content: '@everyone',
    allowedMentions: { parse: ['everyone'] },
    components: [row],
  });
}

async function applyPunishment(guild, userId, punishment, authorizedBy) {
  const member = await guild.members.fetch(userId).catch(() => null);
  const reason = `Tryb Furii SejmBOT Security - zatwierdzone przez ${authorizedBy.tag}`;
  if (!member) return { ok: false, message: 'Użytkownik nie jest już na serwerze.' };
  try {
    if (punishment === 'ban') {
      await member.ban({ reason });
      return { ok: true, message: `Zbanowano ${member.user.tag}.` };
    }
    if (punishment === 'kick') {
      const roleIds = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
      if (roleIds.length) await member.roles.remove(roleIds, reason).catch(() => {});
      await member.kick(reason);
      return { ok: true, message: `Zdjęto role i wyrzucono ${member.user.tag}.` };
    }
    if (punishment === 'roles') {
      const roleIds = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
      await member.roles.remove(roleIds, reason).catch(() => {});
      return { ok: true, message: `Zdjęto wszystkie role ${member.user.tag}.` };
    }
  } catch (err) {
    return { ok: false, message: `Błąd: ${err.message}` };
  }
  return { ok: false, message: 'Nieznany typ kary.' };
}

module.exports = { isActive, registerChannelDeleteAttempt, registerLinkSpamAttempt, activate, deactivate, applyPunishment };
