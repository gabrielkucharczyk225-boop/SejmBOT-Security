const { Events, PermissionsBitField } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');
const storage = require('../storage');

// Wyłapuje pojedyncze linki z treści (http/https ORAZ gołe discord.gg/...)
const LINK_EXTRACT_RE = /(https?:\/\/\S+)|(discord\.gg\/\S+)/gi;
const INVITE_CODE_RE = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([\w-]+)/i;
const EVENT_LINK_RE = /discord(?:app)?\.com\/events\/(\d+)/i;

// Sprawdza, czy pojedynczy link to zaproszenie/wydarzenie TEGO SAMEGO serwera - wtedy jest zawsze dozwolony.
async function isOwnServerLink(url, guild, client) {
  const eventMatch = url.match(EVENT_LINK_RE);
  if (eventMatch) return eventMatch[1] === guild.id;

  const inviteMatch = url.match(INVITE_CODE_RE);
  if (inviteMatch) {
    try {
      const invite = await client.fetchInvite(inviteMatch[1]);
      return invite.guild?.id === guild.id;
    } catch {
      return false; // nieprawidłowe/wygasłe zaproszenie - traktuj jak zwykły link
    }
  }
  return false;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const links = message.content.match(LINK_EXTRACT_RE);
    if (!links || !links.length) return;

    const cfg = await storage.getConfig(message.guild.id);
    const whitelist = cfg.linkWhitelist || { roles: [], channels: [] };

    // 1. Kanał na białej liście -> nic nie rób.
    // Posty/wątki w kanałach Forum mają WŁASNE ID (inne niż kanał forum), dlatego sprawdzamy
    // też parentId - jeśli to wątek, a jego kanał-rodzic (forum) jest na białej liście, też przepuszczamy.
    const parentId = message.channel.parentId;
    if (whitelist.channels.includes(message.channel.id) || (parentId && whitelist.channels.includes(parentId))) return;

    // 2. Autor ma rolę z białej listy -> nic nie rób
    if (message.member && message.member.roles.cache.some((r) => whitelist.roles.includes(r.id))) return;

    // 3. Wszystkie linki w wiadomości to zaproszenia/wydarzenia WŁASNEGO serwera -> nic nie rób
    const ownChecks = await Promise.all(links.map((u) => isOwnServerLink(u, message.guild, message.client)));
    if (ownChecks.every(Boolean)) return;

    // W przeciwnym razie usuń wiadomość (tak jak dotychczas)
    const content = message.content;
    const channel = message.channel;
    try {
      await message.delete();
      await log(message.guild, 'security', baseEmbed('security', '🔗 Zablokowano link')
        .setDescription(`Wiadomość od ${message.author} w ${channel} zawierała link i została usunięta.`)
        .addFields({ name: 'Treść', value: content.slice(0, 1000) || '*(puste)*' }));
    } catch (err) {
      console.error('Nie udało się usunąć wiadomości z linkiem:', err.message);
    }
  },
};
