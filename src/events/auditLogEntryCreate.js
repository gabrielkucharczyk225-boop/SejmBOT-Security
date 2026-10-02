const { Events, AuditLogEvent } = require('discord.js');
const { log } = require('../utils/logger');
const { baseEmbed, trim } = require('../utils/embeds');

const ACTION_NAMES = {
  [AuditLogEvent.GuildUpdate]: 'Aktualizacja serwera',
  [AuditLogEvent.ChannelCreate]: 'Utworzenie kanału',
  [AuditLogEvent.ChannelUpdate]: 'Edycja kanału',
  [AuditLogEvent.ChannelDelete]: 'Usunięcie kanału',
  [AuditLogEvent.ChannelOverwriteCreate]: 'Nowe uprawnienia kanału',
  [AuditLogEvent.ChannelOverwriteUpdate]: 'Edycja uprawnień kanału',
  [AuditLogEvent.ChannelOverwriteDelete]: 'Usunięcie uprawnień kanału',
  [AuditLogEvent.MemberKick]: 'Wyrzucenie użytkownika',
  [AuditLogEvent.MemberPrune]: 'Czyszczenie nieaktywnych',
  [AuditLogEvent.MemberBanAdd]: 'Ban',
  [AuditLogEvent.MemberBanRemove]: 'Odbanowanie',
  [AuditLogEvent.MemberUpdate]: 'Edycja członka',
  [AuditLogEvent.MemberRoleUpdate]: 'Zmiana ról członka',
  [AuditLogEvent.MemberMove]: 'Przeniesienie na kanale głosowym',
  [AuditLogEvent.MemberDisconnect]: 'Rozłączenie z kanału głosowego',
  [AuditLogEvent.BotAdd]: 'Dodanie bota',
  [AuditLogEvent.RoleCreate]: 'Utworzenie roli',
  [AuditLogEvent.RoleUpdate]: 'Edycja roli',
  [AuditLogEvent.RoleDelete]: 'Usunięcie roli',
  [AuditLogEvent.InviteCreate]: 'Utworzenie zaproszenia',
  [AuditLogEvent.InviteUpdate]: 'Edycja zaproszenia',
  [AuditLogEvent.InviteDelete]: 'Usunięcie zaproszenia',
  [AuditLogEvent.WebhookCreate]: 'Utworzenie webhooka',
  [AuditLogEvent.WebhookUpdate]: 'Edycja webhooka',
  [AuditLogEvent.WebhookDelete]: 'Usunięcie webhooka',
  [AuditLogEvent.EmojiCreate]: 'Dodanie emoji',
  [AuditLogEvent.EmojiUpdate]: 'Edycja emoji',
  [AuditLogEvent.EmojiDelete]: 'Usunięcie emoji',
  [AuditLogEvent.MessageDelete]: 'Usunięcie wiadomości',
  [AuditLogEvent.MessageBulkDelete]: 'Masowe usunięcie wiadomości',
  [AuditLogEvent.MessagePin]: 'Przypięcie wiadomości',
  [AuditLogEvent.MessageUnpin]: 'Odpięcie wiadomości',
  [AuditLogEvent.StickerCreate]: 'Dodanie naklejki',
  [AuditLogEvent.StickerUpdate]: 'Edycja naklejki',
  [AuditLogEvent.StickerDelete]: 'Usunięcie naklejki',
  [AuditLogEvent.ThreadCreate]: 'Utworzenie wątku',
  [AuditLogEvent.ThreadUpdate]: 'Edycja wątku',
  [AuditLogEvent.ThreadDelete]: 'Usunięcie wątku',
  [AuditLogEvent.AutoModerationBlockMessage]: 'AutoMod zablokował wiadomość',
  [AuditLogEvent.AutoModerationRuleCreate]: 'Utworzenie reguły AutoMod',
  [AuditLogEvent.AutoModerationRuleUpdate]: 'Edycja reguły AutoMod',
  [AuditLogEvent.AutoModerationRuleDelete]: 'Usunięcie reguły AutoMod',
};

module.exports = {
  name: Events.GuildAuditLogEntryCreate,
  async execute(entry, guild) {
    const title = ACTION_NAMES[entry.action] || `Akcja typu ${entry.action}`;
    const embed = baseEmbed('audit', `📜 ${title}`)
      .addFields(
        { name: 'Wykonał', value: entry.executor ? `${entry.executor.tag} (\`${entry.executor.id}\`)` : 'Nieznany', inline: true },
        { name: 'Cel', value: entry.targetId ? `\`${entry.targetId}\`` : '*(brak)*', inline: true }
      );
    if (entry.reason) embed.addFields({ name: 'Powód', value: trim(entry.reason, 500) });
    if (entry.changes?.length) {
      const lines = entry.changes.slice(0, 10).map((c) => {
        const before = c.old === undefined ? '—' : typeof c.old === 'object' ? JSON.stringify(c.old) : String(c.old);
        const after = c.new === undefined ? '—' : typeof c.new === 'object' ? JSON.stringify(c.new) : String(c.new);
        return `**${c.key}:** ${trim(before, 150)} → ${trim(after, 150)}`;
      });
      embed.addFields({ name: 'Szczegóły zmian', value: trim(lines.join('\n'), 1000) });
    }
    if (entry.extra) {
      try { embed.addFields({ name: 'Dodatkowe dane', value: trim(JSON.stringify(entry.extra), 500) }); } catch { /* ignore */ }
    }
    await log(guild, 'audit', embed);
  },
};
