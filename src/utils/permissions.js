const { PermissionFlagsBits } = require('discord.js');

function isAuthorized(member) {
  if (!member || !member.guild) return false;
  if (member.id === member.guild.ownerId) return true;
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

module.exports = { isAuthorized };
