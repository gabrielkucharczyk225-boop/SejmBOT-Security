// Punktowa heurystyka "czy to może być multikonto". Discord nie udostępnia takiej informacji
// wprost, więc liczymy wynik na podstawie poszlak - każda dokłada swój procent, suma max 100%.
function scoreMember(member, context = {}) {
  const reasons = [];
  let score = 0;
  const now = Date.now();
  const ageMs = now - member.user.createdTimestamp;
  const ageDays = ageMs / 86_400_000;

  if (ageDays < 1) {
    score += 35;
    reasons.push('Konto założone mniej niż 24h temu (+35%)');
  } else if (ageDays < 3) {
    score += 25;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+25%)`);
  } else if (ageDays < 7) {
    score += 15;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+15%)`);
  } else if (ageDays < 30) {
    score += 5;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+5%)`);
  }

  if (ageMs < 60 * 60 * 1000) {
    score += 20;
    reasons.push('Konto utworzone mniej niż godzinę przed dołączeniem (+20%)');
  }

  if (!member.user.avatar) {
    score += 15;
    reasons.push('Brak własnego avatara - domyślny awatar Discorda (+15%)');
  }

  if (!member.user.flags || member.user.flags.bitfield === 0) {
    score += 5;
    reasons.push('Brak jakichkolwiek odznak konta (+5%)');
  }

  const uname = member.user.username || '';
  const looksRandom = /\d{4,}$/.test(uname) || /^[a-z0-9]{8,}$/i.test(uname.replace(/[_.]/g, ''));
  if (looksRandom) {
    score += 15;
    reasons.push('Nazwa użytkownika wygląda na losowo wygenerowaną (+15%)');
  }

  if (context.duringRaid) {
    score += 20;
    reasons.push('Dołączył w trakcie fali masowych dołączeń (+20%)');
  }

  if (context.matchesRecentBan) {
    score += 40;
    reasons.push(`Avatar lub nazwa pasuje do niedawno zbanowanego konta **${context.matchesRecentBan}** (+40%)`);
  }

  return { score: Math.min(100, score), reasons };
}

module.exports = { scoreMember };
