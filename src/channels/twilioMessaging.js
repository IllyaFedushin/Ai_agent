import { respondText } from '../openai/textAgent.js';

export async function twilioInboundSms(req, reply) {
  const from = req.body.From || '';
  const body = req.body.Body || '';
  const userId = `twilio:sms:${from}`;

  const answer = await respondText({ userId, channel: 'sms', userText: body, phone: from });

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escapeXml(answer)}</Message></Response>`;
  reply.type('text/xml').send(twiml);
}

export async function twilioInboundWhatsApp(req, reply) {
  const from = req.body.From || '';
  const body = req.body.Body || '';
  const userId = `twilio:whatsapp:${from}`;

  const answer = await respondText({ userId, channel: 'whatsapp', userText: body, phone: from });

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escapeXml(answer)}</Message></Response>`;
  reply.type('text/xml').send(twiml);
}

function escapeXml(s) {
  return (s || '').replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}
