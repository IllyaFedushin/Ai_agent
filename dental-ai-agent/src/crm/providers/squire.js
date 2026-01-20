/**
 * Squire/"скуер" CRM provider STUB.
 * Подставь реальные эндпойнты и payload под твою CRM.
 */
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (CONFIG.crm.apiKey) h['Authorization'] = `Bearer ${CONFIG.crm.apiKey}`;
  if (CONFIG.crm.headerName && CONFIG.crm.headerValue) h[CONFIG.crm.headerName] = CONFIG.crm.headerValue;
  return h;
}
async function safeJson(res) {
  const t = await res.text();
  try { return t ? JSON.parse(t) : {}; } catch { return { raw: t }; }
}

export const squireProvider = {
  async listAppointmentsByPhone(phone) {
    if (!CONFIG.crm.baseUrl) return { warning: "CRM_API_BASE_URL not set", items: [] };
    const url = new URL('/appointments', CONFIG.crm.baseUrl);
    url.searchParams.set('phone', phone);
    const res = await fetch(url.toString(), { headers: headers() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(`Squire list error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  },
  async createAppointment(payload) {
    if (!CONFIG.crm.baseUrl) return { warning: "CRM_API_BASE_URL not set", created: false };
    const res = await fetch(new URL('/appointments', CONFIG.crm.baseUrl).toString(), {
      method: 'POST', headers: headers(), body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(`Squire create error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  },
  async rescheduleAppointment({ appointmentId, startISO, endISO }) {
    if (!CONFIG.crm.baseUrl) return { warning: "CRM_API_BASE_URL not set", updated: false };
    const res = await fetch(new URL(`/appointments/${encodeURIComponent(appointmentId)}`, CONFIG.crm.baseUrl).toString(), {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ startISO, endISO })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(`Squire reschedule error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  },
  async cancelAppointment(appointmentId) {
    if (!CONFIG.crm.baseUrl) return { warning: "CRM_API_BASE_URL not set", cancelled: false };
    const res = await fetch(new URL(`/appointments/${encodeURIComponent(appointmentId)}`, CONFIG.crm.baseUrl).toString(), {
      method: 'DELETE', headers: headers()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(`Squire cancel error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  },
};
