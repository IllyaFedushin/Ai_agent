import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

import { CONFIG } from './config.js';
import { telegramWebhookHandler } from './channels/telegram.js';
import { twilioInboundSms, twilioInboundWhatsApp } from './channels/twilioMessaging.js';
import { twilioIncomingCallHandler, registerTwilioMediaStreamRoute } from './channels/twilioVoiceRealtime.js';

const app = Fastify({ logger: true });
app.register(fastifyFormBody);
app.register(fastifyWs);

app.get('/', async () => ({ ok: true, name: 'Dental AI Agent', time: new Date().toISOString() }));

app.post('/telegram/webhook', telegramWebhookHandler);

app.post('/twilio/inbound-sms', twilioInboundSms);
app.post('/twilio/inbound-whatsapp', twilioInboundWhatsApp);

app.all('/twilio/incoming-call', twilioIncomingCallHandler);
registerTwilioMediaStreamRoute(app);

// (необязательно, но удобно для проверки в браузере)
app.get('/telegram/webhook', async () => ({ ok: true, message: 'telegram webhook alive' }));

app.listen({ port: CONFIG.port, host: '0.0.0.0' })
  .then(() => console.log(`Server listening on :${CONFIG.port}`))
  .catch((err) => { console.error(err); process.exit(1); });

// --- Telegram Webhook (debug + production) ---
fastify.get('/telegram/webhook', async (request, reply) => {
  return { ok: true, message: 'Telegram webhook endpoint is alive' };
});

fastify.post('/telegram/webhook', async (request, reply) => {
  console.log('TG UPDATE:', JSON.stringify(request.body));

  // Telegram expects 200 OK quickly
  return { ok: true };
});

