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

// healthcheck
app.get('/', async () => ({
  ok: true,
  name: 'Dental AI Agent',
  time: new Date().toISOString()
}));

// Telegram webhook
app.get('/telegram/webhook', async () => ({
  ok: true,
  message: 'Telegram webhook endpoint is alive'
}));

app.post('/telegram/webhook', telegramWebhookHandler);

// Twilio
app.post('/twilio/inbound-sms', twilioInboundSms);
app.post('/twilio/inbound-whatsapp', twilioInboundWhatsApp);
app.all('/twilio/incoming-call', twilioIncomingCallHandler);
registerTwilioMediaStreamRoute(app);

// ❗️LISTEN — ВСЕГДА В САМОМ КОНЦЕ
app.listen({ port: CONFIG.port, host: '0.0.0.0' })
  .then(() => console.log(`Server listening on ${CONFIG.port}`))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
