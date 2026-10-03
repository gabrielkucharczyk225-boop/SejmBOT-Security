require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const storage = require('./src/storage');
const loadEvents = require('./src/handlers/eventHandler');
const loadCommands = require('./src/handlers/commandHandler');

// --- Uruchomienie serwera HTTP dla UptimeRobot / Render ---
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  // Odpowiedź na każdy request GET (np. od UptimeRobot)
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SejmBOT Security działa!');
});

// Nasłuchiwanie na porcie przypisanym przez Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Serwer Web uruchomiony na porcie ${PORT}`);
});
// --------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Obsługa błędów, aby proces się nie wykradał
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

// Uruchomienie bota i ładowanie modułów
async function main() {
  try {
    loadCommands(client);
    loadEvents(client);

    await storage.init();
    await client.login(process.env.TOKEN);
    console.log('[BOT] Zalogowano pomyślnie!');
  } catch (error) {
    console.error('[ERR] Błąd podczas uruchamiania bota:', error);
  }
}

main();
