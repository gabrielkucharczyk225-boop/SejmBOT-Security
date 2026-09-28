require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const loadEvents = require('./src/handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,    // włącz w Developer Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,  // włącz w Developer Portal
  ],
  partials: [Partials.Message, Partials.Channel],
});

loadEvents(client);

// Mini serwer HTTP dla Render Web Service / health check
if (process.env.PORT) {
  http
    .createServer((req, res) => {
      res.writeHead(200);
      res.end('SejmBOT Security działa');
    })
    .listen(process.env.PORT);
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(process.env.TOKEN);
