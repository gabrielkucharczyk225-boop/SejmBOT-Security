# SejmBOT Security

Bot bezpieczeństwa na Discorda (discord.js v14).

## Funkcje
- Anti-raid (alarm przy masowych dołączeniach)
- Ochrona nicków (kick za podejrzane nazwy)
- Log nowych użytkowników z wiekiem konta
- Blokada linków (poza administratorami)
- Log usuniętych wiadomości (ghost ping)
- Alarm przy zmianie uprawnień ról

## Struktura
```
index.js                  # start bota
src/config.js             # ustawienia (limity, zakazane nicki, regex)
src/handlers/             # automatyczne ładowanie eventów
src/events/               # jeden plik = jeden event
src/utils/                # webhook, wykrywanie rajdu
```

## Uruchomienie lokalnie
```
npm install
cp .env.example .env   # uzupełnij TOKEN i WEBHOOK_URL
npm start
```

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: `TOKEN`, `WEBHOOK_URL`
- Discord Developer Portal -> Bot: włącz Server Members Intent i Message Content Intent
