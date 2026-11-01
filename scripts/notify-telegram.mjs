#!/usr/bin/env node
// Sends a message to Telegram. Reads text from argv or stdin.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. Uses HTML parse mode.
// Usage: node scripts/notify-telegram.mjs "<b>texto</b>"   |   echo texto | node scripts/notify-telegram.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.error("Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.");
  process.exit(2);
}

let text = process.argv.slice(2).join(" ");
if (!text) {
  for await (const chunk of process.stdin) text += chunk;
}
text = text.trim().slice(0, 4000); // Telegram limit is 4096
if (!text) {
  console.error("Mensagem vazia.");
  process.exit(2);
}

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  signal: AbortSignal.timeout(10_000),
});
const body = await response.json();
if (!body.ok) {
  console.error(`Telegram recusou: ${body.description}`);
  process.exit(1);
}
console.log("Mensagem enviada.");
