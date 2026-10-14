require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const storage = require('./src/storage');
const loadEvents = require('./src/handlers/eventHandler');
const loadCommands = require('./src/handlers/commandHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,            // PRIVILEGED - włącz w Developer Portal
    GatewayIntentBits.GuildModeration,         // bany + audit log entries
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,          // PRIVILEGED - włącz w Developer Portal
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

loadCommands(client);
loadEvents(client);

// Mini serwer HTTP - health check dla Render / UptimeRobot
if (process.env.PORT) {
  http
    .createServer((req, res) => {
      res.writeHead(200);
      res.end('SejmBOT Security działa');
    })
    .listen(process.env.PORT);
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

(async () => {
  await storage.init();
  await client.login(process.env.TOKEN);
})();
