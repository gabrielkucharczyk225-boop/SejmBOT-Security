const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const dir = path.join(__dirname, '..', 'events');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    for (const event of [].concat(require(path.join(dir, file)))) {
      const run = (...args) =>
        Promise.resolve(event.execute(...args, client)).catch((err) =>
          console.error(`[event:${file}:${String(event.name)}]`, err)
        );
      if (event.once) client.once(event.name, run);
      else client.on(event.name, run);
    }
  }
};
