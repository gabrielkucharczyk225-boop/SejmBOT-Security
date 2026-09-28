async function sendWebhook(embed) {
  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed.toJSON()] }),
    });
  } catch (err) {
    console.error('Błąd wysyłania webhooka:', err);
  }
}

module.exports = { sendWebhook };
