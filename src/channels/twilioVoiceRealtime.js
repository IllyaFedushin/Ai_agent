import WebSocket from 'ws';
import { CONFIG } from '../config.js';
import { buildSystemPrompt } from '../agent/systemPromptRu.js';

const VOICE = 'alloy';
const TEMPERATURE = 0.6;

export function twilioIncomingCallHandler(req, reply) {
  const host = req.headers.host;
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/twilio/media-stream" />
  </Connect>
</Response>`;
  reply.type('text/xml').send(twimlResponse);
}

export function registerTwilioMediaStreamRoute(fastify) {
  fastify.get('/twilio/media-stream', { websocket: true }, (connection) => {
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    const openAiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(CONFIG.openaiRealtimeModel)}&temperature=${TEMPERATURE}`,
      { headers: { Authorization: `Bearer ${CONFIG.openaiApiKey}` } }
    );

    const initializeSession = () => {
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: CONFIG.openaiRealtimeModel,
          output_modalities: ["audio"],
          audio: {
            input: { format: { type: 'audio/pcmu' }, turn_detection: { type: "server_vad" } },
            output: { format: { type: 'audio/pcmu' }, voice: VOICE },
          },
          instructions: buildSystemPrompt(),
        },
      }));

      openAiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type:'message', role:'user', content:[{type:'input_text', text:'Поздоровайся и спроси, чем помочь.'}] }
      }));
      openAiWs.send(JSON.stringify({ type: 'response.create' }));
    };

    const handleSpeechStartedEvent = () => {
      if (markQueue.length && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
        if (lastAssistantItem) {
          openAiWs.send(JSON.stringify({ type:'conversation.item.truncate', item_id:lastAssistantItem, content_index:0, audio_end_ms: elapsedTime }));
        }
        connection.send(JSON.stringify({ event:'clear', streamSid }));
        markQueue = []; lastAssistantItem = null; responseStartTimestampTwilio = null;
      }
    };

    const sendMark = () => {
      if (!streamSid) return;
      connection.send(JSON.stringify({ event:'mark', streamSid, mark:{ name:'responsePart' } }));
      markQueue.push('responsePart');
    };

    openAiWs.on('open', () => setTimeout(initializeSession, 100));

    openAiWs.on('message', (data) => {
      try {
        const resp = JSON.parse(data.toString());
        if (resp.type === 'response.output_audio.delta' && resp.delta) {
          connection.send(JSON.stringify({ event:'media', streamSid, media:{ payload: resp.delta } }));
          if (!responseStartTimestampTwilio) responseStartTimestampTwilio = latestMediaTimestamp;
          if (resp.item_id) lastAssistantItem = resp.item_id;
          sendMark();
        }
        if (resp.type === 'input_audio_buffer.speech_started') handleSpeechStartedEvent();
      } catch {}
    });

    connection.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        responseStartTimestampTwilio = null;
        latestMediaTimestamp = 0;
      } else if (data.event === 'media') {
        latestMediaTimestamp = data.media.timestamp;
        if (openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(JSON.stringify({ type:'input_audio_buffer.append', audio: data.media.payload }));
        }
      } else if (data.event === 'mark') {
        if (markQueue.length) markQueue.shift();
      }
    });

    connection.on('close', () => { if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close(); });
  });
}
