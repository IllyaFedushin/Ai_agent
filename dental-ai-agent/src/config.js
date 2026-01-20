import dotenv from 'dotenv';
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function safeJson(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

export const CONFIG = {
  port: parseInt(process.env.PORT || '5050', 10),
  publicBaseUrl: required('PUBLIC_BASE_URL').replace(/\/$/, ''),
  openaiApiKey: required('OPENAI_API_KEY'),
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
  openaiRealtimeModel: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime',

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  },

  crm: {
    provider: process.env.CRM_PROVIDER || 'generic',
    baseUrl: process.env.CRM_API_BASE_URL || '',
    apiKey: process.env.CRM_API_KEY || '',
    locationId: process.env.CRM_LOCATION_ID || '',
    headerName: process.env.CRM_API_HEADER_NAME || '',
    headerValue: process.env.CRM_API_HEADER_VALUE || '',
  },

  clinic: {
    name: process.env.CLINIC_NAME || 'Dental Clinic',
    city: process.env.CLINIC_CITY || 'Stockholm',
    timezone: process.env.CLINIC_TIMEZONE || 'Europe/Stockholm',
    workingHours: safeJson(process.env.WORKING_HOURS_JSON, {
      mon: ['09:00','18:00'], tue: ['09:00','18:00'], wed: ['09:00','18:00'],
      thu: ['09:00','18:00'], fri: ['09:00','18:00'], sat: null, sun: null
    }),
    priceList: safeJson(process.env.PRICE_LIST_JSON, {}),
  },
};
