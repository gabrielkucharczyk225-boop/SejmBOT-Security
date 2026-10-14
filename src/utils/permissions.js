const { PermissionFlagsBits } = require('discord.js');
const { PUNISHMENT_ROLE_ID } = require('../config');

// Kto może zarządzać botem (komendy konfiguracyjne): właściciel serwera albo osoba
// z uprawnieniem "Zarządzaj serwerem".
function isAuthorized(member) {
  if (!member || !member.guild) return false;
  if (member.id === member.guild.ownerId) return true;
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

// Kto może zatwierdzać/odrzucać KARY (ban/kick) proponowane przez bota - TYLKO konkretna rola,
// niezależnie od uprawnień administracyjnych. Właściciel serwera też musi mieć tę rolę.
function canApprovePunishment(member) {
  if (!member) return false;
  return member.roles.cache.has(PUNISHMENT_ROLE_ID);
}

module.exports = { isAuthorized, canApprovePunishment };
