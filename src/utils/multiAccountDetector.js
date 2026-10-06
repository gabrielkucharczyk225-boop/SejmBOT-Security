// Punktowa heurystyka "czy to może być multikonto". Discord nie udostępnia takiej informacji
// wprost, więc liczymy wynik na podstawie poszlak - każda dokłada swój procent, suma max 100%.
//
// WAŻNE: wagi są dobrane tak, żeby ZWYKŁY, nowy, niewinny użytkownik Discorda (świeże konto +
// domyślna nazwa typu "słowo1234", którą Discord sam proponuje przy rejestracji + brak avatara)
// NIE przekraczał 50% sam z siebie. Do wysokich wyników potrzeba kombinacji kilku sygnałów naraz.
function scoreMember(member, context = {}) {
  const reasons = [];
  let score = 0;
  const now = Date.now();
  const ageMs = now - member.user.createdTimestamp;
  const ageDays = ageMs / 86_400_000;

  // --- Wiek konta (osobno, łagodniejsze wagi niż poprzednio) ---
  if (ageDays < 1) {
    score += 20;
    reasons.push('Konto założone mniej niż 24h temu (+20%)');
  } else if (ageDays < 3) {
    score += 12;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+12%)`);
  } else if (ageDays < 7) {
    score += 6;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+6%)`);
  } else if (ageDays < 30) {
    score += 2;
    reasons.push(`Konto założone ${Math.floor(ageDays)} dni temu (+2%)`);
  }

  // --- Konto stworzone "na szybko" tuż przed dołączeniem - mocny, osobny sygnał ---
  if (ageMs < 60 * 60 * 1000) {
    score += 15;
    reasons.push('Konto utworzone mniej niż godzinę przed dołączeniem (+15%)');
  }

  // --- Brak własnego avatara - słaby sygnał sam w sobie (bardzo powszechny u nowych, uczciwych kont) ---
  if (!member.user.avatar) {
    score += 8;
    reasons.push('Brak własnego avatara - domyślny awatar Discorda (+8%)');
  }

  // --- Brak odznak konta - bardzo słaby sygnał (większość kont i tak ich nie ma) ---
  if (!member.user.flags || member.user.flags.bitfield === 0) {
    score += 3;
    reasons.push('Brak jakichkolwiek odznak konta (+3%)');
  }

  // --- Nazwa wygląda na losowo wygenerowaną - TYLKO gdy konto jest młode.
  // Próg 5+ cyfr (nie 4+), bo Discord sam proponuje nazwy typu "slowo1234" (4 cyfry)
  // przy rejestracji - to normalne u zwykłych, świeżych kont i nie powinno ich obciążać.
  const uname = member.user.username || '';
  const looksRandom = /\d{5,}$/.test(uname) || /^[a-z0-9]{10,}$/i.test(uname.replace(/[_.]/g, ''));
  if (looksRandom && ageDays < 7) {
    score += 8;
    reasons.push('Nazwa użytkownika wygląda na losowo wygenerowaną, a konto jest młode (+8%)');
  }

  // --- Dołączenie w trakcie fali masowych wejść (raid) ---
  if (context.duringRaid) {
    score += 15;
    reasons.push('Dołączył w trakcie fali masowych dołączeń (+15%)');
  }

  // --- Dopasowanie do niedawno zbanowanego konta - najmocniejszy możliwy sygnał ---
  if (context.matchesRecentBan) {
    if (context.matchesRecentBanBy === 'avatar') {
      score += 45;
      reasons.push(`Ten sam avatar co niedawno zbanowane konto **${context.matchesRecentBan}** (+45%)`);
    } else {
      score += 18;
      reasons.push(`Taka sama nazwa jak niedawno zbanowane konto **${context.matchesRecentBan}** (+18%)`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

module.exports = { scoreMember };
