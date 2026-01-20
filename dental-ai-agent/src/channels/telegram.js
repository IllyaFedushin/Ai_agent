import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { respondText } from '../openai/textAgent.js';

export async function telegramWebhookHandler(req, reply) {
  const update = req.body;
  const msg = update?.message;
  if (!msg?.text) return reply.send({ ok: true });

  const chatId = msg.chat.id;
  const userText = msg.text;
  const userId = `tg:${chatId}`;

  const answer = await respondText({ userId, channel: 'telegram', userText, phone: '' });
  await sendTelegramMessage(chatId, answer);

  return reply.send({ ok: true });
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!res.ok) console.error('Telegram send error:', await res.text());
}
