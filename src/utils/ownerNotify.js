const storage = require('../storage');

// Prywatna wiadomość do właściciela serwera z najważniejszymi alarmami.
// Przycisków NIE dołączamy - w DM nie da się ich obsłużyć.
// Wyłączenie: w configu ustaw ownerDM: false.
async function notifyOwner(guild, embed) {
  try {
    const cfg = await storage.getConfig(guild.id);
    if (cfg.ownerDM === false) return false;
    const owner = await guild.fetchOwner();
    await owner.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

module.exports = { notifyOwner };
