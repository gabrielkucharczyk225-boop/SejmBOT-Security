const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`SejmBOT Security (Master Edition) online jako ${client.user.tag}!`);
  },
};
